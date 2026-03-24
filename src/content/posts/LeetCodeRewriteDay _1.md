---
title: "LeetCode 复盘 Day1：哈希表与并查集"
published: 2026-01-12
pinned: false
description: 记录 LeetCode 两数之和、字母异位词分组及最长连续序列的解题思路，涵盖哈希表与并查集（DSU）的应用。
tags: [LeetCode, C++, 哈希表, 并查集, 算法]
category: Algorithm
licenseName: "CC-BY-NC-SA 4.0"
author: "海岬的人"
draft: false
---

# LeetCode 复盘 Day1

## LeetCode 1. 两数之和

**空间换时间的最基础入门。**

**核心思路：** 通过哈希表，维护已经走过的值，两数相加变成“定一找一”。

* **Q：为什么时间复杂度是 O(n)?** **A：** 每个元素都只经过一次遍历，我们通过 O(1) 的哈希表函数 `find`，去寻找右边区域是否存在目标变量。
* **Q：`find` 方法是什么？**
  **A：** 找到哈希表中的目标键，返回迭代器。因为是找键，所以我们的存储模式是 `(值, 下标)`。

```c++
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> idx; // memo哈希表，记录走过位置的下标以及对应值
       for(int i = 0; i < nums.size(); i++){
          auto it = idx.find(target - nums[i]);
          if(it != idx.end()){ // 如果没找到会返回hash_map end
            return {i, it -> second};
          }
          idx[nums[i]] = i; // 没找到则以（值，下标）的方式存入，这是维护右边
        }
    }
};
```

**时间复杂度：** O(n)

---

## LeetCode 49. 字母异位词分组

**字母异位词**就是由相同字母的不同排序得到的不同字符串。

**核心思路：** 提取相同分组的共同点，转化为可量化分组的数学值。异位词的字母种类数量相同，则排序后的结果一定相同，可将排序后的 `string` 作为哈希键进行分组。

* **Q：怎么对字符串进行重新排序？**
  **A：** C++ 库函数天然支持对 `string` 等可随机访问且可比较的元素的容器进行排序。
* **Q：`sort` 的排序规则是什么？用法呢？**
  **A：** 对于单个字符串按字母表顺序，对于字符串数组按字典顺序。`sort` 需要传入指定范围的迭代器 `sort(container.begin(), container.end())`。或者我们选用 C++20 引入的范围库直接传入整个容器 `ranges::sort(container)`。
* **Q：如何从哈希表中取出所有结果？**
  **A：** 通过 C++17 引入的结构化绑定，将元组或者结构体的元素进行解包，同时通过 `for` 进行遍历。

```c++
class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        unordered_map<string, vector<string>> map;
       for(auto& str : strs){ // 取引用以减小开销
          string temp = str;
          sort(temp.begin(), temp.end());
          //也可以写为 ranges::sort(temp) 但是sort直接在容器上进行操作，不会返回string，所以不能用temp接受str的排序结果。
          map[temp].push_back(std::move(str)); // 将相同字符排序的字符串压入对应容器
        }
        vector<vector<string>> res;
       res.reserve(map.size()); //预先分配空间 (使用reserve只分配capacity)
        for(auto&  [_, arr] : map){ // _是程序员习惯性的留空变量，也叫弃用变量
          res.push_back(std::move(arr));
        }
        return res;
    }
};
```

**时间复杂度：** O(n * m log(m))。因为 `sort` 底层使用快排，单次时间复杂度为 `m log(m)`，需要排序 `n` 次。

> **代码拓展：关于 vector 容器预留空间的介绍**
> 区别开 `size` 与 `capacity`：`size` 是 vector 的实际元素数量，而 `capacity` 只是申请的内存容量，其中是否包含确切的值并不关心。
>
> * 通过初始化时分配 `vector<T> container(m)` 或 `resize(m)` 等方法，是直接提升 `size`，默认初始化赋值为 `0`。这样的话 `push_back` 就会在默认为 `0` 的变量后面添加新的变量，让容器扩容。
> * 如果只想申请内存不添加元素，采用 `reserve(m)` 方法，只增加 `capacity`。此时 `push_back` 不会在 `capacity` 后进行元素添加，所以第一个元素一定添加在容器开头。

---

## LeetCode 128. 最长连续序列

**O(n) 复杂度硬性要求。**

**核心思路：** 并查集思想（第一次复盘到并查集，先挖个坑，以后可能出并查集总结，今年 26 年 3 月 21 雷火的笔试出到并查集了）。另一种思路是找到每一个可能连续序列的起点，从起点往上遍历计数，这种方法的时间复杂度可能达到 O(2n)，但总体也是 O(n)。

### 寻找起始序列做法

```c++
class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
      unordered_set<int> set(nums.begin(), nums.end()); // 快速将vector容器转化为set哈希表
      int res = 0; //题目中数组可以为空所以要考虑此情况
      for(auto num : set){
        if(set.count(num - 1)){ // 如果该值不是有序序列最小值 则跳过
          continue;
        }
        int y = num;
        while(set.count(y)){
          y++;
        }
        res = max(res, y - num); //此时y为序列末尾后一位 直接减去num就是长度 这么设置变量优化很多冗余操作
      }
      return res;
    }
};
```

### 并查集做法 (DSU)

**并查集的思路：** 1. 自立分类
2. 合并分类
3. 寻找最大类

```c++
class Solution {
private:
    unordered_map<int, int> parent;
    unordered_map<int, int> size;
    int maxSize = 0; // 记录全场最大的集合大小 

    //查：路径压缩
    int find(int x){
      if(parent[x] == x){ // 如果找到一个父节点为自己的点 说明是该分类的root节点
        return x;
      }
      parent[x] = find(parent[x]); // 在递归寻找的同时将自己的父节点设为root节点 以压缩并查集
      return parent[x];
    }
    /*
        由于以上递归写法可能引起栈溢出，以下有更推荐的迭代写法：
        int find(int x){
            int root = x;
            while(parent[root] != root){
                root = parent[root];
            }

            手动回溯进行路径压缩
            int curr = x;
            while(curr != root){
                int next = parent[curr];
                parent[next] = root;
                curr = next;
            }
            
            return root;
        }
    */
  
    //并：按大小合并（小的并入大的）
    void unite(int x, int y){
      int rootX = find(x);
      int rootY = find(y);
      
      if(rootX == rootY) return;

      //让小的集合归入大的集合下 若1 合并到 2，然后2 再和 3进行合并，这时候应该是2 作为 3的根节点，因为2的size更大
      if(size[rootX] < size[rootY]){
        parent[rootX] = rootY;
        size[rootY] += size[rootX];
        maxSize = max(maxSize, size[rootY]);
      }else{
        parent[rootY] = rootX;
        size[rootX] += size[rootY];
        maxSize = max(maxSize, size[rootX]);
      }
    }
public:
    int longestConsecutive(vector<int>& nums) {
      if(nums.empty()) return 0;
      //初始化并查集 - 自立门户
      for(int x : nums){
        if(!parent.count(x)){ // 去重
          parent[x] = x;
          size[x] = 1;
          maxSize = max(maxSize, 1);
        }
      }
      
      //寻找相邻元素进行合并
      for(int x : nums){
        if(parent.count(x + 1)){
          unite(x, x + 1);
        }
      }
      
      return maxSize;
    }
};
```

**时间复杂度：** O(n)。因为两次遍历中每个元素都只处理了一次，`find` 函数也不是所有元素都执行 n 次，基本都是只 `find` 一次。并查集的题目汇总以及模板后续再进行总结。
