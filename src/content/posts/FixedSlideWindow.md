---
title: "LeetCode 刷题总结：定长滑动窗口模板与进阶"
published: 2026-01-20
pinned: false
description: 总结定长滑动窗口的基础模板与进阶应用，包含 LeetCode 1456 与 2841 的单循环解法及哈希表优化技巧。
tags: [LeetCode, C++, 滑动窗口, 算法, 题单复盘]
category: Algorithm
licenseName: "CC-BY-NC-SA 4.0"
author: "海岬的人"
draft: false
---

# 定长滑动窗口-题单刷题后总结一则

> **前言：**
> 之前我们讨论过不定长的滑动窗口（如求最小覆盖子串、找到所有字母异位词等），今天来总结一下**定长滑动窗口**。它的核心思想是维护一个长度固定的窗口，在向右滑动的过程中，采用“一进一出”的策略，避免重复计算重叠部分的元素。

## 💡 知识点总结：定长窗口核心模板

定长滑动窗口的标准**单循环**操作通常严格遵循以下三步：

1. **入（Move In）：** 右端点元素进入窗口，更新窗口内维护的属性（如：和、计数器、哈希表等）。
2. **更新（Update）：** 判断当前是否已经形成了一个完整大小的窗口。如果形成了，就记录或更新答案。
3. **出（Move Out）：** 左端点元素即将离开窗口，扣除它对窗口属性的贡献，为下一次右指针的滑动做准备。

---

## LeetCode 1456. 定长子串中元音的最大数目

**核心思路：** 窗口大小固定为 `k`，每次向右滑动一个字符。我们只需要判断新进入窗口的字符是否为元音并增加计数，同时判断离开窗口的字符是否为元音并减少计数。

* **Q：为什么要强调掌握“单循环”得出答案，而不是双循环？**
  **A：** 如果使用双循环（即每次都从头遍历长度为 `k` 的子串计算元音），时间复杂度会退化为 `O(n * k)`。而使用单循环的滑动窗口，每次移动只产生 `O(1)` 的状态变化，整体时间复杂度优化为 `O(n)`。这正是滑动窗口的精髓所在：**极致利用相邻状态的重叠部分**。
* **Q：元音判断还可以怎么优化？**
  **A：** 如代码下方思考的那样，采用 `O(1)` 空间记录窗口的特别属性。比如可以用一个长度为 128 的 `bool` 或 `int` 数组充当哈希表，预先把 `a, e, i, o, u` 对应的 ASCII 位设为 1，这样判断时只需查表 `if (hash[s[i]])` 即可，免去了一长串的 `||` 判断，代码执行效率更高也更简洁。

```c++
class Solution {
public:
    int maxVowels(string s, int k) {
        int ans = 0, vowel = 0;
        for(int i = 0; i < s.size(); i++){
            // 入 (Move In)
            if(s[i] == 'a' || s[i] == 'i' || s[i] == 'e' || s[i] == 'o' || s[i] == 'u'){
                vowel++;
            }

            int left = i - k + 1; // 得到窗口左端点
            if(left < 0){ // 如果小于0则尚未形成一个完整窗口
                continue;
            }

            // 更新 (Update)
            ans = max(ans, vowel); // 开始形成窗口了就更新一次答案
            
            // 出 (Move Out)
            char out = s[left];
            if(out == 'a' || out == 'e' || out == 'i' || out == 'o' || out == 'u'){
                vowel--;
            }
        }

        return ans;
    }
};
```

---

## LeetCode 2841. 几乎唯一子数组的最大和

再来一题熟悉模板，这题在定长滑动窗口的基础上，结合了**哈希表**来维护窗口内元素的“种类数”。

**核心思路：** 题目要求子数组长度为 `k`，且至少包含 `m` 个不同的元素。我们用一个变量 `sum` 维护窗口内元素和，用 `unordered_map` 维护窗口内各元素的出现频数。

* **Q：为什么在“出”操作时，频数为 0 要调用 `erase` 完全清除当前变量？**
  **A：** 因为 C++ 的 `unordered_map` 如果只做 `--` 操作，即使值变成了 0，这个“键值对”依然作为一个节点存在于哈希表中。而我们在“更新”步骤是通过 `type.size() >= m` 来判断不同元素的种类数的。如果不把频数为 0 的元素 `erase` 掉，`size()` 就会把它们也算进去，返回一个虚高的种类数，导致逻辑彻底崩溃。

> [!NOTE]
> **代码细节提炼：**
> `if(type[nums[left]]-- == 1)` 这一句写得非常巧妙。因为使用的是**后置 `--`**，它会先判断当前频数是否为 `1`。如果是 `1`，说明减去这次后频数就变成 `0` 了，所以立刻执行 `type.erase()` 清除它。一行代码同时完成了“频数递减”和“清零判断”。

```c++
class Solution {
public:
    long long maxSum(vector<int>& nums, int m, int k) {
        long long ans = 0, sum = 0;
        unordered_map<int, int> type;
        for(int i = 0; i < nums.size(); i++){
            // 入 (Move In)
            sum += nums[i];
            type[nums[i]]++;

            int left = i - k + 1;
            if(left < 0) continue; // 未形成滑动窗口 直接跳过
            
            // 更新 (Update)：如果能过关，就加入答案
            if(type.size() >= m){
                ans = max(sum, ans);
            }

            // 出 (Move Out)
            sum -= nums[left];
            if(type[nums[left]]-- == 1){
                type.erase(nums[left]);  // 采用erase完全清除当前变量
            }
        }

        return ans;
    }
};
```
