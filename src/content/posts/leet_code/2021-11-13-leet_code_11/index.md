---
title : LeetCode - 11. Container With Most Water
date : 2021-11-13T23:26:00+09:00
editDate: 2024-06-05T23:49:37+09:00
series : "LeetCode"
tags : ["LeetCode", "medium", "C++"]
description: 다양한 길이를 가진 막대들을 이용해 가장 많은 액체를 담을 수 있는 양을 구합니다.
---

## 목차

## 문제 개요

난이도 - `MEDIUM` 사용 언어 - `C++`

![challenge example](./images/11/question_11.webp)

배열에 각 막대의 길이가 순서대로 주어질 때, 막대 사이에 담을 수 있는 액체의 최대량을 구하는 문제입니다.

문제 - [LeetCode 11. Container With Most Water](https://leetcode.com/problems/container-with-most-water/)


## 풀이
### Solution 1 - Brute force

첫 번째 방법으로 먼저 간단히 Brute force, 즉 무차별 대입으로 문제를 풀어보겠습니다.

중첩된 반복문을 사용해 두 막대를 선택해 가장 큰 크기를 선택합니다.

```cpp showLineNumbers
int maxArea = 0;

for (int i = 0; i < count - 1; i++)
{
    for (int j = i; j < count; j++)
    {
        int barHeight = std::min(height[i], height[j]);
        int barWidth = j - i;

        int area = barWidth * barHeight;

        if (area > maxArea)
        {
            maxArea = area;
        }
    }
}
```

넓이를 구하기 위해서는 너비(width)와 높이(height)가 필요합니다. 

두 막대의 높이가 같다면 둘 중 하나의 높이를 사용할 수 있지만, 높이가 다를 때 액체를 담는다고 상상하면 낮은 쪽 높이 이상으로는 액체가 넘치겠죠. 그러므로 둘 중 높이가 낮은 쪽을 선택합니다.

너비도 간단히 구할 수 있습니다. 두 막대 사이의 거리를 계산하면 됩니다.

#### 제출 결과
![Solution 1 result](./images/11/result_1.webp)

중첩된 반복문을 사용하기 때문에 시간 복잡도는 $$O(n^2)$$입니다. 매우 많은 입력이 주어졌을 때 시간 초과가 발생함을 확인할 수 있었습니다.

<details>
<summary>코드 전문</summary>
    
```cpp showLineNumbers
#include <vector>
#include <algorithm>

class Solution 
{
public:
    int maxArea(std::vector<int>& height) 
    {
        if (height.size() == 2)
        {
            return  std::min(height[0], height[1]);
        }

        int count = height.size();

        int maxArea = 0;

        for (int i = 0; i < count - 1; i++)
        {
            for (int j = i; j < count; j++)
            {
                int barHeight = std::min(height[i], height[j]);
                int barWidth = j - i;

                int area = barWidth * barHeight;

                if (area > maxArea)
                {
                    maxArea = area;
                }
            }
        }
        
        return maxArea;
    }
};
```

</details>

---

### Solution 2

두 번째 방법은 첫 번째 방법을 조금 개선해, 굳이 필요 없는 계산을 줄여보겠습니다.

높이가 가장 큰 두 개의 막대를 선택한다 하더라도 너비가 너무 좁으면 다른 것보다 넓이가 작을 수도 있습니다.

그래서 맨 처음에는 너비가 가장 큰 상태인 첫 번째 막대와 마지막 막대를 선택합니다.

![Selection example](./images/11/selection_example_1.webp)

여기서 넓이가 더 커지려면 왼쪽 막대가 더 높아져야 합니다. 즉, 오른쪽 막대는 충분히 높지만 왼쪽 막대가 낮기 때문에, 지금의 왼쪽 막대로는 기대 이상의 넓이를 구할 수 없을 것 같습니다.

왼쪽 막대를 한 칸 오른쪽에 있는 막대로 옮겨 선택합니다.

![Selection example 2](./images/11/selection_example_2.webp)

너비가 1 줄어들었지만, 높이가 그 이상으로 증가했기 때문에 넓이는 이전 결과보다 더 커졌습니다.

현재 상황에서는 오른쪽 막대가 왼쪽 막대보다 높이가 낮기 때문에, 오른쪽 막대가 더 높아진다면 넓이가 더 증가할 수도 있을 것 같습니다. 오른쪽 막대를 한 칸 왼쪽에 있는 막대로 옮겨 선택합니다.

![Selection example 3](./images/11/selection_example_3.webp)

아쉽지만 오히려 넓이가 줄었습니다. 오른쪽 막대가 왼쪽 막대보다 높이가 낮기 때문입니다. 다시 한 번 왼쪽으로 이동합니다.

![Selection example 4](./images/11/selection_example_4.webp)

이런 방식으로 계속 순회하며 가장 컸던 넓이를 선택하면 됩니다.

```cpp showLineNumbers
int maxArea = 0;

int left = 0;
int right = height.size() -1;

while (left < right)
{
    int area = std::min(height[left], height[right]) * (right - left);

    maxArea = std::max(area, maxArea);

    if (height[left] < height[right]) left++;
    else right--; 
}

return maxArea;
```

이런 방식으로 순회하면 모든 경우를 검사하는 것이 아니기 때문에, 최선의 값을 못 찾을 수도 있지 않을까 하는 생각이 들었습니다.

하지만 조금만 더 생각해보니, 모든 경우를 검사하지 않더라도 최선의 결과가 나온다는 것을 알 수 있었습니다.

```cpp showLineNumbers
if (height[left] < height[right]) left++;
else right--; 
```

한쪽 막대가 다른 쪽 막대보다 낮으면 인덱스를 1 올리거나 내려서 다음 막대를 선택합니다.

위 코드를 계속 실행하면, 두 막대가 계속 경쟁하면서 가장 높은 막대를 선택하려고 시도하게 됩니다. 물론 높이가 가장 높은 두 막대를 선택하더라도 너비가 좁아 더 넓은 공간이 나오지 않을 수 있습니다.

하지만 결국 높은 막대를 선택할수록 큰 넓이가 나올 기대치가 있으므로, 이렇게 기대치가 있는 경우만 검사해도 최선의 결과를 얻을 수 있습니다.

#### 제출 결과
![Solution 2 result](./images/11/result_2.webp)

시간 복잡도는 $$O(n)$$이며, 실제 실행 시간은 76ms로 다른 C++ 제출자보다 91%가량 좋은 성능을 보임을 알 수 있습니다.

<details>
<summary>코드 전문</summary>
    
```cpp showLineNumbers
#include <vector>
#include <algorithm>

class Solution 
{
public:
    int maxArea(std::vector<int>& height) 
    {
        if (height.size() == 2)
        {
            return  std::min(height[0], height[1]);
        }

        int maxArea = 0;

        int left = 0;
        int right = height.size() -1;

        while (left < right)
        {
            int area = std::min(height[left], height[right]) * (right - left);

            maxArea = std::max(area, maxArea);

            if (height[left] < height[right]) left++;
            else right--; 
        }
        
        return maxArea;
    }
};
```

</details>
