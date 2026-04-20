---
title: "LeetCode 复盘 Day4：滑动窗口进阶与动态规划"
published: 2026-01-18
pinned: false
description: 记录 LeetCode 无重复字符的最长子串及找到字符串中所有字母异位词的解题思路，包含滑动窗口优化与动态规划解法。
tags: [LeetCode, C++, 滑动窗口, 动态规划, 算法]
category: Algorithm
licenseName: "CC-BY-NC-SA 4.0"
author: "海岬的人"
draft: false
---

# LeetCode 复盘 Day4

> **闲话：**
> 最近忙于实现项目猛干三天，忘记刷 LeetCode 了，回来补上第四次复盘。

## LeetCode 3. 无重复字符的最长子串

**核心思路：** 维护一个滑动窗口，记录窗口中不同字符的数量，当右指针指向一个已有字符的时候，进行窗口收缩。记得随时维护最大长度。

* **Q：如何做空间优化？**
  **A：** 已知题目条件为 `s` 由英文字母、数字、符号和空格组成，可以省去哈希表开销，使用 128 长度的 `int` 数组存储字符数量。

> [!NOTE]
> **避坑提醒：** 我每次都忘记看数组元素数量的上下限，从而出现空数组、整型溢出等错误情况，特此提醒一下自己！

### 解法一：滑动窗口

```c++
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        int n = s.size(), res = 0, left = 0;
        int cnt[128] = {0};
        for(int right = 0; right < n; right++){
            char c = s[right];
            cnt[c]++; // 对当前字符进行计数
            while(cnt[c] > 1){
                cnt[s[left]]--;
                left++;
            } // 直接通过一个while循环完成收缩窗口 + 去掉重复字符两件事
            res = max(res, right - left + 1); // 对子字符串长度进行更新
        }
        return res;
    }
};
```

### 解法二：动态规划

**另一种思路：** 我们换个角度思考，寻找当前字符串的最长无重复字符子串，可以看作寻找**以每个字符结尾**的最长无重复字符子串长度的最大值，从而转化为一个子问题。对于每个字符下标 `j`, 以及其左边最近相等字符下标 `i`，我们都有状态转移方程如下：

`dp[j] = dp[j - 1] + 1` (当 `dp[j - 1] + 1 < j - i` 时)
或
`dp[j] = j - i` (当 `dp[j - 1] + 1 >= j - i` 时)

* **Q：如何做空间优化？**
  **A：** 由于题目只需要长度最大值，我们通过一个变量来保存 `dp[j - 1]` 即可。

```c++
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> dic;
        int res = 0, tmp = 0, n = s.size(), i;
        for(int j = 0; j < n; j++){
            char c = s[j];
            i = -1; // 先把 i 赋值为 -1，如果此前没有重复的值则 j - i 一定大于 tmp，从而 tmp + 1
            if(dic.count(c)) i = dic[c]; // 如果存在，则赋值为上一次出现的索引
            tmp = tmp < j - i ? tmp + 1 : j - i; // j - i 实际就是上一个重复字符的 index 到当前 j 的长度
            res = max(res, tmp);
            dic[c] = j; // 更新当前字符索引
        }
        return res;
    }
};
```

---

## LeetCode 438. 找到字符串中所有字母异位词

此题与先前总结过的 [LeetCode 76. 最小覆盖子串](https://www.ochagama.xyz/posts/leetcode_76/) 相似，看完后可以再去复习一下那篇 blog。

**核心思路：** 依旧是滑动窗口，不过这次是要保证滑动窗口中的字符数量和种类都与目标字符串**完全相同**，从而我们在维护窗口中字符数量时，遇到不相符的字符就可以直接开始收缩窗口了。

* **Q：如何快速判断当前字符是否在目标串中？**
  **A：** 再维护一个只记录目标字符串字符数量的数组即可。
* **Q：如何知道是否满足全部要求？**
  **A：** 维护一个 `cnt` 数，记录已经满足要求的字符种类数，当种类数与 `target` 需求的相符时，进行一次 `push_back`。

### 解法一：定长窗口（无优化基础版）

> [!NOTE]
> `vector` 容器重载过 `==` 符号，可以直接通过 `==` 比较容器内容是否相同；而 `int[]` 本质是指针，不可以通过 `==` 直接比较内容。

**思路：** 维护一个定长的窗口不断移动，每次遇到 `slideWindows == target` 的情况时，就得到一个正确答案。

```c++
class Solution {
public:
    vector<int> findAnagrams(string s, string p) {
        int n = s.size(), m = p.size();
        if(n < m){
            return {};
        }

        vector<int> res;
        vector<int> slideWindows(26);
        vector<int> target(26);

        // 先维护一个 target 长度的滑动窗口
        for(int i = 0; i < m; i++){
            ++slideWindows[s[i] - 'a'];
            ++target[p[i] - 'a'];
        }

        if(slideWindows == target){
            res.push_back(0);
        }

        for(int i = 0; i + m < n; i++){
            slideWindows[s[i] - 'a']--;
            slideWindows[s[i + m] - 'a']++; // 整体右移一位

            if(slideWindows == target){
                res.push_back(i + 1);
            }
        }

        return res;
    }
};
```

**时间复杂度：** O(m + (n - m) × Σ)（其中 Σ 为字符集大小 26）

### 解法二：不定长窗口（自主实现版）

这是仿造 76 题以及自己思路写的一种方法，思路参考前文的**核心思路**部分。

```c++
class Solution {
public:
    vector<int> findAnagrams(string s, string p) {
        vector<int> res;
        int n = s.size(), m = 0;
        int slideWindows[128] = {0};
        int target[128] = {0};
        int cnt = 0; // 记录已经符合的字符种类数
        int left = 0;
        
        for(char& c : p){
            if(target[c] == 0) m++;
            target[c]++;
        }

        for(int right = 0; right < n; right++){
            char c = s[right];
            slideWindows[c]++;
            if(slideWindows[c] == target[c]){
                cnt++;
            }else if(slideWindows[c] > target[c]){
                while(slideWindows[c] != target[c]){
                    char lt = s[left];
                    slideWindows[lt]--;
                    if(slideWindows[lt] == target[lt] - 1){
                        cnt--;
                    }
                    left++;
                }
            }
            if(cnt == m){
                res.push_back(left);
            }
        }

        return res;
    }
};
```

### 解法三：不定长窗口（灵神极简优化版）

**核心思路：** 我们不再显式维护滑动窗口，**只维护一个数组**：`target` 与窗口字符数量的差值。比如：如果 `target` 中没有 `a`，而窗口读入了 `a`，则 `a` 对应的差值为 `-1`。遇到读入的字符让值为负数了，就说明隐式维护的窗口中该字符数量太多了。从而进行收缩，而收缩时，`left` 每右移一次，原位置的字符数量就要 `++`（因为从窗口中移除了，差值变大趋向于 0）。

* **Q：对于一个 target 没有的字符，只有窗口中数量和 target 数量都为 0 才成立，但是我们如果移出一个 target 没有的数，不是得让数组对应的地方 ++ 吗？会不会出现 target 没有的字符数比窗口多 1 的情况？**
  **A：** 不会。假设维护的数组为 `cnt`，我们考虑开始左移的条件，就是 `right` 当前的字符处 `cnt < 0`。我们每一次移动的目标都是消除这个 `-1`。由于我们只对 `target` 拥有的字符赋予初值，所以每当一个 `target` 没有的字符出现时，都会触发 `cnt < 0` 从而进行收缩修正，所以不可能出现 target 不存在的字符在 `cnt` 中值为 1 的情况。
* **Q：如何判断满足异位词情况？**
  **A：** 当 `cnt` 中的数都为 0 时。我们进一步思考，都为 0 说明窗口大小和 `target` 大小相等。又因为我们严格地排除了每一个 `target` 中没有的字符，所以大小相等的时候一定不含任何一个非目标字符，从而我们可以把满足判断直接设定为：**窗口大小与 target 相等**。

```c++
class Solution {
public:
    vector<int> findAnagrams(string s, string p) {
        // 统计 p 的每种字母出现次数
        int cnt[26]{};
        for(char c : p){
            cnt[c - 'a']++;
        }

        vector<int> res;
        int left = 0;
        for(int right = 0; right < s.size(); right++){
            int c = s[right] - 'a';
            cnt[c]--; // 右端字母进入窗口
            while(cnt[c] < 0){ // 窗口中的字母 c 太多了
                cnt[s[left] - 'a']++; // 让左端的字母离开窗口
                left++;
            }
            if(right - left + 1 == p.size()){ // 窗口大小和 p 长度一样就一定是字母异位词
                res.push_back(left);
            }
        }
        return res;
    }
};
```

**时间复杂度：** O(m + n)

> **总结：极好的思维训练，值得反复推敲！**
