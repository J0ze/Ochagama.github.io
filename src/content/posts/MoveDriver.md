# BBBNexus 架构核心解析：MotionDriver (物理运动驱动系统)

## 0. 核心定位概述

在 BBBNexus 架构中，`MotionDriver` 是角色的**骨骼与肌肉**（物理执行层）。它的唯一职责是：**收集所有高层逻辑产生的意图（动画曲线、摇杆输入、锁定目标），将它们融合、平滑，最终计算出一个终极的 `Vector3 Velocity`，并调用 Unity 的 `CharacterController.Move()` 来产生真实的物理位移。**

---

## 1. 完整源码 (MotionDriver.cs)

以下为物理驱动系统的完整源代码：

```csharp
using UnityEngine;

namespace BBBNexus
{

    /*CalculateInputDrivenVelocity()  （主分支）
    ├── CalculateFreeLookVelocity()    [自由视角模式]
    │   ├── 1. 读取 DesiredWorldMoveDir（输入方向）
    │   ├── 2. 通过 SmoothDampAngle 平滑角色朝向（CurrentYaw）
    │   └── 3. 计算平滑速度（SmoothSpeed）
    │
    └── CalculateAimVelocity()         [瞄准模式]
        ├── 1. 角色朝向 AuthorityYaw（权威朝向）
        ├── 2. 将摇杆输入投影到 forward/right
        ├── 3. 检测反向输入（直接清零速度平滑状态）
        └── 4. 计算平滑速度

    CalculateClipDrivenVelocity()   （动画驱动分支）
    ├── 曲线段阶段 → CalculateCurveVelocity()
    │   ├── 1. 读取旋转曲线计算转向角度
    │   ├── 2. 读取速度曲线
    │   └── 3. 使用动画目标方向生成世界速度
    │
    └── 混合段阶段（Mixed） → 切回 CalculateInputDrivenVelocity()
        ├── 1. 对齐速度/旋转状态
        └── 2. 恢复输入驱动*/

    /// <summary>
    /// 角色运动的核心驱动器 负责将输入、动画曲线、物理参数
    /// 转换为实际的 CharacterController.Move()调用 驱动角色在场景中的实际位移
    /// </summary>
    public class MotionDriver
    {
        // 注：在最新版本 主要优化了Unity的底层开销(eulerAngles/velocity/materialized quaternion) 并保证每帧重力只积分一次
        #region Dependencies
        private readonly BBBCharacterController _player;
        private readonly CharacterController _cc;
        private readonly PlayerRuntimeData _data;
        private readonly PlayerSO _config;
        private readonly Transform _transform;
        #endregion

        #region Contexts

        private struct LocomotionCtx
        {
            public bool WasAiming;

            // 平滑速度(标量)
            public float SmoothSpeed;
            public float SpeedVelocity;

            // 用于检测瞄准形态下反向切输入，避免 SmoothDamp 造成“拖拽”
            public Vector3 LastAimMoveDir;

            public void ResetSpeed()
            {
                SmoothSpeed = 0f;
                SpeedVelocity = 0f;
                LastAimMoveDir = Vector3.zero;
            }
        }

        private struct CurveCtx
        {
            public float LastAngle;
            public bool IsInitialized;
            public MotionType? LastMotionType;
            public bool DidAlignOnMixed;

            public void Reset()
            {
                LastAngle = 0f;
                IsInitialized = false;
            }
        }

        private struct WarpCtx
        {
            public WarpedMotionData Data;
            public Vector3[] Targets;
            public int CurrentIndex;
            public float SegmentStartTime;
            public Vector3 SegmentStartPosition;
            public Vector3 CompensationVel;

            public bool IsActive => Data != null;

            public void Clear()
            {
                Data = null;
                Targets = null;
                CompensationVel = Vector3.zero;
                CurrentIndex = 0;
                SegmentStartTime = 0f;
                SegmentStartPosition = Vector3.zero;
            }
        }

        private LocomotionCtx _loco;
        private CurveCtx _curve;
        private WarpCtx _warp;

        // 单帧重力缓存：避免同帧多处调用重复积分 VerticalVelocity
        private int _gravityFrame = -1;
        private Vector3 _cachedGravity;

        #endregion

        public MotionDriver(BBBCharacterController player)
        {
            _player = player;
            _cc = player.CharController;
            _data = player.RuntimeData;
            _config = player.Config;
            _transform = player.transform;

            _loco.WasAiming = _data.IsAiming;
        }

        #region Public API

        public void UpdateGravityOnly()
        {
            Vector3 vv = GetGravityThisFrame();
            _cc.Move(vv * Time.deltaTime);
            _data.CurrentSpeed = _cc.velocity.magnitude;
        }

        public void UpdateMotion(MotionClipData clipData, float stateTime)
        {
            HandleAimModeTransitionIfNeeded();
            AutoHandleCurveDrivenEnter(clipData, stateTime);

            Vector3 hv = clipData == null
                ? CalculateInputDrivenVelocity(1f)
                : CalculateClipDrivenVelocity(clipData, stateTime);

            ExecuteMovement(hv);
        }

        public void UpdateLocomotionFromInput(float speedMult = 1f)
        {
            HandleAimModeTransitionIfNeeded();
            ExecuteMovement(CalculateInputDrivenVelocity(speedMult));
        }

        public void UpdateMotion() => ExecuteMovement(Vector3.zero);

        public void InterruptClipDrivenMotion()
        {
            _curve.LastMotionType = null;
            _curve.DidAlignOnMixed = false;
            _curve.Reset();
        }

        #endregion

        #region Warp API

        public void InitializeWarpData(WarpedMotionData data, Vector3[] targets)
        {
            if (data == null || data.WarpPoints == null || data.WarpPoints.Count == 0 ||
                targets == null || targets.Length != data.WarpPoints.Count)
            {
                Debug.LogError("运动扭曲数据初始化失败 参数不匹配");
                return;
            }

            _warp.Data = data;
            _warp.Targets = new Vector3[targets.Length];

            // 目标偏移：按角色根空间转换到世界。
            for (int i = 0; i < targets.Length; i++)
            {
                Vector3 worldOffset = _transform.TransformDirection(_warp.Data.WarpPoints[i].TargetPositionOffset);
                _warp.Targets[i] = targets[i] + worldOffset;
            }

            _warp.CurrentIndex = 0;
            _warp.SegmentStartTime = 0f;
            _warp.SegmentStartPosition = _transform.position;
            RecalculateWarpCompensation();
        }

        public void InitializeWarpData(WarpedMotionData data)
        {
            if (data?.WarpPoints == null || data.WarpPoints.Count == 0) return;

            Vector3[] targets = new Vector3[data.WarpPoints.Count];
            for (int i = 0; i < data.WarpPoints.Count; i++)
            {
                targets[i] = _transform.position + _transform.TransformVector(data.WarpPoints[i].BakedLocalOffset);
            }

            InitializeWarpData(data, targets);
        }

        public void UpdateWarpMotion(float normalizedTime)
        {
            if (!_warp.IsActive) return;

            // warp 期间不使用普通平滑(直接读当前水平速度只是为了保持数据一致)
            Vector3 v = _cc.velocity;
            _loco.SmoothSpeed = new Vector3(v.x, 0f, v.z).magnitude;
            _loco.SpeedVelocity = 0f;

            CheckAndAdvanceWarpSegment(normalizedTime);

            // 本地速度曲线 -> 世界
            Vector3 localVel = new Vector3(
                _warp.Data.LocalVelocityX.Evaluate(normalizedTime),
                _warp.Data.LocalVelocityY.Evaluate(normalizedTime),
                _warp.Data.LocalVelocityZ.Evaluate(normalizedTime)
            );

            Vector3 finalVelocity = _transform.TransformDirection(localVel) + _warp.CompensationVel;

            if (_warp.Data.ApplyGravity)
            {
                finalVelocity += GetGravityThisFrame();
            }
            else
            {
                _data.IsGrounded = _cc.isGrounded;
            }

            float rotVelY = _warp.Data.LocalRotationY.Evaluate(normalizedTime);

            _cc.Move(finalVelocity * Time.deltaTime);
            if (Mathf.Abs(rotVelY) > 0.0001f)
                _transform.Rotate(0f, rotVelY * Time.deltaTime, 0f, Space.World);

            _data.CurrentSpeed = _cc.velocity.magnitude;
        }

        public void ClearWarpData() => _warp.Clear();

        #endregion

        #region Core Movement

        private void ExecuteMovement(Vector3 horizontalVelocity)
        {
            Vector3 vv = GetGravityThisFrame();
            _cc.Move((horizontalVelocity + vv) * Time.deltaTime);
            _data.CurrentSpeed = _cc.velocity.magnitude;
        }

        private Vector3 CalculateClipDrivenVelocity(MotionClipData clipData, float stateTime)
        {
            bool isCurvePhase = clipData.Type == MotionType.CurveDriven ||
                               (clipData.Type == MotionType.Mixed && stateTime < clipData.RotationFinishedTime);

            if (isCurvePhase)
            {
                _curve.DidAlignOnMixed = false;
                return CalculateCurveVelocity(clipData, stateTime);
            }

            // Mixed 从曲线段切到输入段：只对齐一次
            if (clipData.Type == MotionType.Mixed && !_curve.DidAlignOnMixed)
            {
                AlignAndResetForInputTransition();
                _curve.DidAlignOnMixed = true;
            }

            return CalculateInputDrivenVelocity(1f);
        }

        private Vector3 CalculateInputDrivenVelocity(float speedMult)
        {
            return _data.IsAiming
                ? CalculateAimVelocity(speedMult)
                : CalculateFreeLookVelocity(speedMult);
        }

        #endregion

        #region Movement Modes

        private Vector3 CalculateFreeLookVelocity(float speedMult)
        {
            Vector3 moveDir = _data.DesiredWorldMoveDir;

            if (moveDir.sqrMagnitude < 0.0001f)
            {
                // 避免 eulerAngles 多次读取，空输入时 CurrentYaw 维持最新值即可
                _loco.SmoothSpeed = 0f;
                return Vector3.zero;
            }
            
            //需要的转向方向是多少度
            float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
            ApplySmoothYaw(targetYaw, _config.Core.RotationSmoothTime);

            return CalculateSmoothedVelocity(moveDir, isAiming: false, speedMult);
        }

        private Vector3 CalculateAimVelocity(float speedMult)
        {
            // 瞄准模式：朝权威 yaw 转向
            ApplySmoothYaw(_data.AuthorityYaw, _config.Aiming.AimRotationSmoothTime);

            Vector2 input = _data.MoveInput;
            if (input.sqrMagnitude < 0.001f)
            {
                _loco.ResetSpeed();
                return Vector3.zero;
            }

            // 平面 forward/right 投影
            Vector3 f = _transform.forward;
            f.y = 0f;
            float fMag = f.magnitude;
            if (fMag > 0.0001f) f /= fMag;

            Vector3 r = _transform.right;
            r.y = 0f;
            float rMag = r.magnitude;
            if (rMag > 0.0001f) r /= rMag;

            Vector3 move = (r * input.x + f * input.y);
            if (move.sqrMagnitude > 0.0001f) move.Normalize();

            // 反向切输入，直接清零 SmoothDamp 状态
            if (_loco.LastAimMoveDir.sqrMagnitude > 0.1f && Vector3.Dot(move, _loco.LastAimMoveDir) < 0f)
            {
                _loco.SmoothSpeed = 0f;
                _loco.SpeedVelocity = 0f;
            }

            _loco.LastAimMoveDir = move;
            return CalculateSmoothedVelocity(move, isAiming: true, speedMult);
        }

        private Vector3 CalculateCurveVelocity(MotionClipData data, float time)
        {
            float t = time * data.PlaybackSpeed;

            // 旋转曲线：用 deltaAngle 推进
            float curveAngle = data.RotationCurve.Evaluate(t);
            if (!_curve.IsInitialized)
            {
                _curve.LastAngle = curveAngle;
                _curve.IsInitialized = true;
            }

            float deltaAngle = curveAngle - _curve.LastAngle;
            _curve.LastAngle = curveAngle;

            if (Mathf.Abs(deltaAngle) > 0.0001f)
                _transform.Rotate(0f, deltaAngle, 0f, Space.World);

            // 动画驱动阶段：仍同步 CurrentYaw，供其他系统读取
            _data.CurrentYaw = _transform.eulerAngles.y;

            float speed = data.SpeedCurve.Evaluate(t);
            Vector3 localDir = data.TargetLocalDirection;

            if (localDir.sqrMagnitude > 0.0001f)
            {
                // 仅平面转换
                Vector3 worldDir = _transform.TransformDirection(localDir.SetY(0f));
                worldDir.y = 0f;
                if (worldDir.sqrMagnitude > 0.0001f) worldDir.Normalize();
                return worldDir * speed;
            }

            return _transform.forward * speed;
        }

        #endregion

        #region Helpers

        /// <summary>
        /// 平滑的转向
        /// </summary>
        /// <param name="targetYaw">目标方向</param>
        /// <param name="smoothTime">平滑转向时间</param>
        private void ApplySmoothYaw(float targetYaw, float smoothTime)
        {
            // 用 CurrentYaw 做权威 yaw
            float currentYaw = _data.CurrentYaw;
            if (currentYaw == 0f)
            {
                // 首帧或外部未初始化时，兜底读一次
                currentYaw = _transform.eulerAngles.y;
            }

            float smoothed = Mathf.SmoothDampAngle(currentYaw, targetYaw, ref _data.RotationVelocity, smoothTime);
            _transform.rotation = Quaternion.Euler(0f, smoothed, 0f);
            _data.CurrentYaw = smoothed;
        }

        private Vector3 CalculateSmoothedVelocity(Vector3 moveDir, bool isAiming, float speedMult)
        {
            float baseSpeed = GetBaseSpeed(_data.CurrentLocomotionState, isAiming);
            if (!_data.IsGrounded) baseSpeed *= _config.Core.AirControl;

            float targetSpeed = baseSpeed * speedMult;
            _loco.SmoothSpeed = Mathf.SmoothDamp(_loco.SmoothSpeed, targetSpeed, ref _loco.SpeedVelocity, _config.Core.MoveSpeedSmoothTime);
            return moveDir * _loco.SmoothSpeed;
        }

        private float GetBaseSpeed(LocomotionState state, bool isAiming) => state switch
        {
            LocomotionState.Walk => isAiming ? _config.Aiming.AimWalkSpeed : _config.Core.WalkSpeed,
            LocomotionState.Jog => isAiming ? _config.Aiming.AimJogSpeed : _config.Core.JogSpeed,
            LocomotionState.Sprint => isAiming ? _config.Aiming.AimSprintSpeed : _config.Core.SprintSpeed,
            _ => 0f
        };

        /// <summary>
        /// 获取本帧重力
        /// </summary>
        private Vector3 GetGravityThisFrame()
        {
            int frame = Time.frameCount;
            if (_gravityFrame == frame) return _cachedGravity;
            _gravityFrame = frame;

            _data.IsGrounded = _cc.isGrounded;

            // grounded 且向下速度为负：回弹到小负值/贴地力
            if (_data.IsGrounded && _data.VerticalVelocity < 0f)
                _data.VerticalVelocity = _config.Core.ReboundForce;
            else
                _data.VerticalVelocity += _config.Core.Gravity * Time.deltaTime;

            _cachedGravity = new Vector3(0f, _data.VerticalVelocity, 0f);
            return _cachedGravity;
        }

        private void HandleAimModeTransitionIfNeeded()
        {
            if (_data.IsAiming == _loco.WasAiming) return;

            // 形态切换：清理旋转与速度平滑状态
            _data.RotationVelocity = 0f;
            _loco.LastAimMoveDir = Vector3.zero;
            _loco.SpeedVelocity = 0f;
            _loco.WasAiming = _data.IsAiming;
        }

        private void AutoHandleCurveDrivenEnter(MotionClipData clipData, float stateTime)
        {
            MotionType? current = clipData?.Type;
            bool isCurvePhase = current == MotionType.CurveDriven ||
                                (current == MotionType.Mixed && stateTime < clipData?.RotationFinishedTime);

            bool wasCurveLogic = _curve.LastMotionType == MotionType.CurveDriven ||
                                 _curve.LastMotionType == MotionType.Mixed;

            // 进入曲线段：重置曲线内部状态
            if (isCurvePhase && (!wasCurveLogic || !_curve.IsInitialized))
            {
                _curve.Reset();
                _data.RotationVelocity = 0f;
                _curve.DidAlignOnMixed = false;
            }

            _curve.LastMotionType = current;
        }

        private void AlignAndResetForInputTransition()
        {
            // Mixed 切换输入段：清理旋转速度 避免 SmoothDampAngle 残留
            _data.RotationVelocity = 0f;
            _data.CurrentYaw = _transform.eulerAngles.y;
            _curve.IsInitialized = false;
        }

        #endregion

        #region Warp helpers

        private void CheckAndAdvanceWarpSegment(float normalizedTime)
        {
            if (_warp.CurrentIndex >= _warp.Data.WarpPoints.Count) return;

            float targetTime = _warp.Data.WarpPoints[_warp.CurrentIndex].NormalizedTime;
            if (normalizedTime >= targetTime)
            {
                _warp.CurrentIndex++;
                _warp.SegmentStartTime = targetTime;
                _warp.SegmentStartPosition = _transform.position;
                RecalculateWarpCompensation();
            }
        }

        private void RecalculateWarpCompensation()
        {
            if (_warp.CurrentIndex >= _warp.Data.WarpPoints.Count)
            {
                _warp.CompensationVel = Vector3.zero;
                return;
            }

            var warpPoint = _warp.Data.WarpPoints[_warp.CurrentIndex];
            float segmentSeconds = (warpPoint.NormalizedTime - _warp.SegmentStartTime) * _warp.Data.BakedDuration;

            if (segmentSeconds < 0.01f)
            {
                _warp.CompensationVel = Vector3.zero;
                return;
            }

            Vector3 realDelta = _warp.Targets[_warp.CurrentIndex] - _warp.SegmentStartPosition;
            Vector3 animDelta = _transform.TransformVector(warpPoint.BakedLocalOffset);

            _warp.CompensationVel = (realDelta - animDelta) / segmentSeconds;
        }

        #endregion
    }

    public static class Vector3Extensions
    {
        public static Vector3 SetY(this Vector3 vector, float y)
        {
            vector.y = y;
            return vector;
        }
    }
}
```

## 2. 逐段代码深度解析

### 2.1 状态上下文管理 (Context Structs)

代码中通过定义 `LocomotionCtx`、`CurveCtx` 和 `WarpCtx` 将复杂的运行时状态进行了严格的物理隔离。

- **架构意义**：这不仅提升了内存连续性（Struct 存在栈内或连续数组内提升 Cache 命中率），更重要的是实现了**“一键清理”**。例如，当角色从“瞄准”切回“自由奔跑”时，通过调用 `_loco.ResetSpeed()` 即可清空平滑变量，杜绝了“幽灵滑步”和“粘滞感”。

### 2.2 公共执行管线 (Public API)

以 `UpdateMotion(MotionClipData clipData, float stateTime)` 为核心，这是外部状态机向底层物理发号施令的唯一入口。

- **分流逻辑**：代码通过检查 `clipData == null` 将逻辑划分为两大阵营。无剪辑数据则交由玩家手柄（输入）驱动；有剪辑数据则交由动画曲线驱动。这彻底解耦了“逻辑决策”与“物理执行”。

### 2.3 核心移动模式 (Movement Modes)

物理引擎的最核心数学逻辑被划分为三种不同的形态：

- **`CalculateFreeLookVelocity` (自由视角)**：利用 `Atan2` 将意图向量转换为目标偏航角，并使用 `SmoothDampAngle` 赋予角色顺滑的转身手感。
- **`CalculateAimVelocity` (瞄准视角)**：将角色强制锁定面朝 `AuthorityYaw`（准星方向），而摇杆控制的是角色在局部空间（Forward/Right）的平移。**神来之笔在于反向输入切断逻辑**（`Vector3.Dot < 0`），它使得玩家在左右走位横移时能够瞬间刹车反跑，这是竞技级动作游戏手感的核心秘诀。
- **`CalculateClipDrivenVelocity` (动画驱动与混合)**：不仅通过 `Evaluate(t)` 严格还原动画师配置的速度和旋转，更引入了 **`Mixed`（混合段）机制**。在动画后摇阶段，通过 `AlignAndResetForInputTransition()` 瞬间对齐四元数并清洗残存速度，实现了从动画播放到玩家重新接管的无缝过渡。

### 2.4 高级空间魔法：扭曲与重力 (Warp & Helpers)

- **Warp (运动扭曲)**：在 `UpdateWarpMotion` 和相关 Helper 中，系统计算出实际需要的位移 (`realDelta`) 和动画自带的位移 (`animDelta`) 的差值，除以时间得到 `CompensationVel`。这确保了在播放处决或吸附动画时，角色能像带有磁力一般精准匹配到目标位置。
- **Gravity (单帧重力缓存)**：`GetGravityThisFrame()` 巧妙地利用了 `Time.frameCount`，确保即使在一帧内（如多重状态打断重结算时）该方法被调用了 N 次，重力也只会真实累加一次，防止了物理崩坏。

------

## 3. 终极架构思维逻辑 (Mental Model)

要彻底内化这套代码，请在脑海中建立以下这套“每一帧物理引擎的思考流转图”：

1. **【环境审查】**：玩家刚才切瞄准状态了吗？是进入了新动画吗？（如有，立即清理历史平滑缓存）。
2. **【控制权仲裁】**：
   - **情况 A（动画接管）**：如果有 `MotionClipData`，是在前摇期（曲线强制驱动位移与旋转）还是后摇期（释放控制权，混合切回输入驱动）？
   - **情况 B（玩家接管）**：玩家是在瞄准（锁定躯干朝向，计算平移横移），还是在散步（计算绝对朝向，平滑起步）？
3. **【数据合成】**：算出最终的水平速度（Horizontal Velocity）。
4. **【重力附加】**：检查本帧重力是否已结算，未结算则加上向下加速度。
5. **【执行与写回】**：调用 Unity 底层 `_cc.Move((水平速度 + 重力) * Time.deltaTime)`，并将产生的实际物理标量写回黑板（`_data.CurrentSpeed`）供动画系统下一帧读取。
