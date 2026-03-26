---
title: "LeetCode 复盘 Day3：接雨水的三种解法"
published: 2026-01-14
pinned: false
description: 记录 LeetCode 42 题接雨水的详细解题思路，涵盖前后缀数组（动态规划）、双指针以及单调栈三种经典解法的对比与分析。
tags: [LeetCode, C++, 动态规划, 双指针, 单调栈, 算法]
category: Algorithm
licenseName: "CC-BY-NC-SA 4.0"
author: "海岬的人"
draft: false
---

# LeetCode 复盘 Day3

## LeetCode 42. 接雨水

经典力扣题，我的评价是虚有其表，看过的一定会，没看过的很难做出来，其实思路和盛水最多的容器类似。

**核心思路：** 每个 index 最多能接多少水，取决于前缀最大值和后缀最大值构成的一个最大容器，而这个最大容器的最大盛水量取决于其中较矮的边。从而我们可以对每个点都维护其前缀最大值和后缀最大值，算出当前点的盛水量，最后相加。但在经历过第一遍的力扣刷题后，我们多了单调栈和双指针的解法，我在此一一列出。

### 维护前后缀（动态规划）

* **Q：为什么这是动态规划？**
  **A：** 判断一个问题是不是动态规划，关键看是否有重叠子问题，以及通过状态转移方程来去重。在本题中，前缀后缀最大值数组是一个 DP 备忘录，而 `pre_max[i] = max(pre_max[i - 1], height[i])` 则是判断 `i` 位置值的状态转移方程，通过备忘录进行了去重计算，所以这一定是一个动态规划的解题思路。

```c++
class Solution {
public:
    int trap(vector<int>& height) {
        int n = height.size();
        vector<int> pre_max(n); //前缀最大值（包含自身）其实本质是一个一维dp
        pre_max[0] = height[0];
        for(int i = 1; i < n; i++){
            pre_max[i] = max(pre_max[i - 1], height[i]); //记录前缀中最大的值
        }

        vector<int> suf_max(n);
        suf_max[n - 1] = height[n - 1];
        for(int i = n - 2; i >= 0; i--){
            suf_max[i] = max(suf_max[i + 1], height[i]); //记录后缀中的最大值 
        }

        int res = 0;
        for(int i = 0; i < n; i++){
            res += min(pre_max[i], suf_max[i]) - height[i]; //前缀最大与后缀最大中较小的那个减去自身（如果自己最大就天然为0）
        }
        return res;
    }
};
```

**时间复杂度：** O(n)
**空间复杂度：** O(n)

---

### 双指针解法

我们想在动态规划的 O(n) 空间复杂度上做优化，可以引入双指针解法。

**核心思路：** 利用水只往矮的一处跑的特性，不论左侧右侧是否是当前点的对应最大值，只要有一侧更高，水就绝对不可能从这一侧流出。

```c++
class Solution {
public:
    int trap(vector<int>& height) {
        int res = 0;
        int left = 0, right = height.size() - 1;
        int leftMax = 0, rightMax = 0; //初始情况下为0 (因为高度皆>=0)
        while(left < right){
            leftMax = max(height[left], leftMax); //更新左边最大值
            rightMax = max(height[right], rightMax); //更新右侧最大值
            if(leftMax < rightMax){ //只要左侧的最大值小，水一定不会从右侧流出
                res += leftMax - height[left];
                left++; //继续移动left直到右侧拦不住水
            }else{
                res += rightMax - height[right];
                right--;
            }
        }
        return res;
    }
};
```

**时间复杂度：** O(n)
**空间复杂度：** O(1) *(修正: 原文误写为 O(n))*

---

### 单调栈解法

易知，如果当前点之前的柱子都比自己矮，那么此点一定接不到水，若后面的柱子比自己高且前面的数字也比自己高，则此点可以接水。
我们引入一个单调递减的单调栈，遇到比栈顶更大的元素则弹栈，看看前面有没有更大的元素，让栈顶形成“洼地”。

* **Q：为什么存下标？**
  **A：** 因为这里是横向计算，我们每次将 `top` 作为底部，计算当前底部与两边形成的小洼地横向可以存储多少水量，也许自己处理完后，下一个比自己大的栈顶元素还是比 `height[i]` 小，这样他就作为新的底部了，再次横向计算的水量正好填满当前 `top` 的上部。
  **与双指针和动态规划的核心区别：横向计算**，值得细品。

```c++
class Solution {
public:
    int trap(vector<int>& height) {
        int res = 0;
        stack<int> stk;
        int n = height.size();
        for(int i = 0; i < n; i++){
            while(!stk.empty() && height[i] >= height[stk.top()]){ 
                int top = height[stk.top()];
                stk.pop();
                if(stk.empty()){ //如果栈空了说明水会从前面流出 不用计算了
                    break;
                }
                res += (min(height[stk.top()], height[i]) - top) * (i - stk.top() - 1);
            }
            stk.push(i);
        }
        return res;
    }
};
```

**时间复杂度：** O(n)
**空间复杂度：** O(n)
