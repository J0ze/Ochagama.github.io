---
title: "LeetCode 76. 最小覆盖子串"
published: 2025-12-19
pinned: false
description: 记录 LeetCode 76 题最小覆盖子串的 C++ 滑动窗口解法与复杂度分析。
tags: [LeetCode, C++, 滑动窗口, 数据结构与算法]
category: Algorithm
licenseName: "CC-BY-NC-SA 4.0"
author: "海岬的人"
draft: false
---

# LeetCode刷题

#### SlideWindow

###### T1 LeetCode 76. 最小覆盖子串

给你一个字符串 S、一个字符串 T，请在字符串 S 里面找出：包含 T 所有字母的最小子串。

- 如果 S 中不存这样的子串，则返回空字符串 “”。
- 如果 S 中存在这样的子串，我们保证它是唯一的答案。

`输入: S = "ADOBECODEBANC", T = "ABC" 输出: "BANC"`

**知识点：**

- 哈希表
- 滑动窗口

**思路：通过两个哈希表存储目标滑动窗口、T串中的各个字母及其出现次数，再通过滑动窗口的右滑扩大范围，直到当前窗口中包含了所有T串的字母且出现词素相符。进行寻找最小子串的处理。即从左侧缩小滑动窗口**

```c++
class Solution
{
    public:
    	string minWindow(string s,string t)
        {
            unordered_map<char,int> slideWindow; //滑动窗口中的各个字母及其个数
            unordered_map<char,int> targetString; //目标字符串的各个字母及其个数
            
            //传入目标字符串的数据
            for(char c : t) targetString[c]++;
            int left = 0,right = 0; //滑动窗口左右侧
            int length = s.size(); //S串的长度
            int start = 0,minLength = INT_MAX; //最小字串的开始位置 以及最短长度
            int windowCount = 0; //滑动窗口中字母的种类数 当该数据与targetString中的字符种类数相等时开始进行缩小处理
            
            //扩大窗口开始查询
            while(right < length) //right会停在刚好满足目标串字母数的最后一个字母处 可能不会到S串底
            {
                if(targetString.count(s[right])) //只对Target字符串中的字母进行记录
                {
                    slideWindow[s[right]]++; //对right处对应的字母数量进行记录
                    if(slideWindow[s[right]]==targetString[s[right]])
                    {
                        windowCount++; //如果滑动窗口中当前字母的数量与Target字符串中的数量能够对应 则记录该种字母
                    }
                }
                right++; //滑动窗口扩大 继续寻找所需要的字符
                //如果S串确实包含了T串中所有字母 则开始缩小滑动窗口寻找最小串 否则继续执行该循环 扩大滑动窗口
                while(windowCount == targetString.size())
                {
                    //因为已经能够在S串中找到目标串的所有字母了 所以先要记录当下的最小串 再看看能不能找到更小的
                    if(right - left < minLength)
                    {
                        start = left; //更新起始位置
                        minLength = right - left; //更新最短长度
                    }
                    
                    //接下来进行缩短窗口的处理
                    char c_left = s[left]; //取出窗口左侧的字母
                    if(targetString.count(c_left)) //如果当前字母在目标串中存在
                    {
                        slideWindow[c_left]--; //将该字母移除 同时减少数量
                        if(slideWindow[c_left] < targetString[c_left]) //如果滑动窗口串中的该字母数量已经不满足目标串 则结束循环 继续扩大窗口																		 或者因为right到达尾部而直接结束循环
                        {
                            windowCount--; //通过windowCount != targetString.size() 结束循环
                        }
                    }
                    left++; //如果不是目标字符串的字母 直接将其移除 收缩窗口
                }
            }
            //进行收尾处理
            return minLength == INT_MAX ? "" : s.substr(start,minLength);
        }
};

时间复杂度O(n) 13ms 并非最优 空间复杂度O(n) 11.4MB  并非最优