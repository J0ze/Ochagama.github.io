---
title: "LeetCode 复盘 Day2：双指针专题"
published: 2026-01-13
pinned: false
description: 记录 LeetCode 移动零、盛水最多的容器及三数之和的解题思路，深入探讨双指针的移动逻辑与去重技巧。
tags: [LeetCode, C++, 双指针, 算法]
category: Algorithm
licenseName: "CC-BY-NC-SA 4.0"
author: "海岬的人"
draft: false
---

# LeetCode 复盘 Day2

## LeetCode 283. 移动零

**核心思路：** 双指针。左指针维护非零数的尾节点（左指针往左都是非零），右指针寻找没有被维护的非零值。

```c++
class Solution {
public:
    void moveZeroes(vector<int>& nums) {
        //双指针筛选
        int left = 0, right = 0;
        int m = nums.size();
        while(right < m){
            if(nums[right]){ //核心：当在遇到第一个0之前left和right一起前进，遇到第一个0后，right跳过，left停留
                swap(nums[right], nums[left]); //left永远指向已维护值的后一位
                left++;
            }
            right++;
        }
    }
};
```

---

## LeetCode 11. 盛水最多的容器

**核心思路：** 双指针维护容器两边，从最大宽度开始往内遍历（因为往内宽度一定减小，想要找到更大的容积，必须找到比当前最矮边更高的边才有可能创造出更大的容积——当然这里只是有这种可能性，我们必须不断的去跟已经找到的最大容积进行比对）。

```c++
class Solution {
public:
    int maxArea(vector<int>& height) {
        int left = 0, right = height.size() - 1;
        int res = 0;
        while(left < right){
            int area = min(height[left], height[right]) * (right - left); // (修正: 将 l, r 改为 left, right)
            res = max(area, res);
            if(height[left] <= height[right]){
                ++left;
            }else{
                --right;
            }
        } // 让小的那一方移动 原因如思路所示
        return res;
    }
};
```

---

## LeetCode 15. 三数之和

**核心思路：** 想将数组排序，排序后定一，然后通过双指针查找剩下的两个数。

* **Q：双指针的位置放置以及查找逻辑是什么？**
  **A：** 假设定下来的元素为 `i`，则左指针起始位置为 `i` 后的最小元素，右指针为 `i` 后面最大的元素，第二层循环选择遍历左指针。这样我们可以先计算三数之和，如果三数之和大于 0，就左移右指针。直到左右指针重合，就跳出循环，让 `left` 右移进行下一次查找。
* **Q：这样一次只移动一个指针不会导致错过正确答案吗？**
  **A：** 不会，因为左指针一开始就是最小值，右指针一开始就是最大值，如果三数和小于 0，我们只能通过右移左指针的方式对三数和进行放大。同理，如果大于 0，我们只能通过右指针左移的方式来减小三数和。如果你觉得在左指针右移，且右指针左移后，还是出现小于 0 的情况，我们选用左指针左移才能出现正确答案，这是不正确的。举个例子 `-1  1  2  4`，左指针指向 `1`，右指针指向 `2`，如果左指针要倒退，指向 `-1`，那么会得到一小于 `1 + 2` 的值 `-1 + 2`，但是左指针一定在之前指向 `-1` 过，在左指针指向 `-1` 的时候，右指针只可能大于 `2`，也就是 `2` 或者 `4`，任何一个情况其和都大于等于 `-1 + 2`，在这种情况下左指针还能发生右移指向 `1`，只可能是和太小了。一个大于等于自己的和都小的话，我们移回去只会更小，反之同理，在我所给出的代码中，内层循环遍历了left，为什么在三数和小于0的情况下我们不回移right而是left++呢，因为在left没有++的情况下加上right的值肯定大于0，所以right才会--，我么left++后一定更大。
* **Q：如何避免重复的三元组？**
  **A：** 通过比对我们定下的外层循环数 `i` 和 `i - 1` 的大小，如果相等就直接跳过这个循环，因为相等后面一定会出现重复的结果，而重复利用本身值的可能结果已经在上一个 `i - 1` 情况下考虑过了。内层循环也是，跳过相等的值。

```c++
class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        int n = nums.size();
        sort(nums.begin(), nums.end());
        vector<vector<int>> res;
        for(int i = 0; i < n; i++){
            if(nums[i] > 0) break; //基础减枝 如果最小值都大于0 则不可能和为0
            if(i == 0 || nums[i] != nums[i - 1]){ // 去重
                int right = n - 1; //再定右指针
                for(int left = i + 1; left < right; left++){
                    if(left > i + 1 && nums[left] == nums[left -1]){
                        continue; //去重
                    }
                    while(right > left && nums[i] + nums[left] + nums[right] > 0){
                        //一直左移右指针 直到三数和 <= 0;
                        right--; //因为right是声明在外面的变量，所以left++后right仍然不变 (修正: b++ 改为 left++)
                    }
                    if(right > left && nums[i] + nums[left] + nums[right] == 0){
                        res.push_back({nums[i], nums[left], nums[right]});
                    } //看看是小于还是等于 等于就压入答案 小于就进入下一个循环left++ (修正: b++ 改为 left++)
                }
            }
        }
        return res;
    }
};
```
