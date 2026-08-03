---
title : LeetCode - 9. Palindrome Number
date : 2021-11-08T15:21:00+09:00
editDate: 2024-06-05T23:31:29+09:00
series : "LeetCode"
tags : ["LeetCode", "easy", "C++"]
description: 입력된 정수가 회문인지 검사합니다.
---

## 목차

## 문제 개요

난이도 - `EASY` 사용 언어 - `C++`

정수형 입력값이 회문인지 검사합니다. 만약 121이 입력된다면 121을 뒤집은 값도 121이니 회문입니다.

만약 -121이 들어온다면 뒤집었을 때 121-가 되므로 회문이 아닙니다. 123 또한 뒤집었을 때 321이 되므로 회문이 아닙니다.

문제 - [LeetCode 9. Palindrome Number](https://leetcode.com/problems/palindrome-number/)


## 풀이
### Solution

```cpp showLineNumbers
bool isPalindrome(int x) 
{
    if (x < 0) return false;
    else if (x < 10) return true;
    else if ((x % 10) == 0) return false;

    long reverse = 0;
    long tmpX = x;

    while (tmpX)
    {
        reverse = (reverse * 10) + (tmpX % 10);
        tmpX /= 10;
    }

    return reverse == x;
}
```

먼저 음수인 경우 절대 회문이 될 수 없기 때문에 `false`를 반환합니다.

숫자가 한 자리인 경우는 무조건 회문이기 때문에 `true`를 반환합니다.

10의 배수는 10, 20, ... 120, 130 등 회문이 절대 될 수 없기 때문에 `false`를 반환합니다.

입력값 x를 뒤집은 값 reverse를 구합니다. reverse의 타입이 `long`인 이유는, x 값으로 `int` 자료형의 최댓값이 들어올 경우 뒤집는 연산 중 오버플로가 발생할 수 있기 때문입니다. 그래서 `int`보다 큰 자료형인 `long`을 사용했습니다(별도의 자료형 제한이 없었기 때문에 사용할 수 있었습니다).

#### 제출 결과
![Solution 1 result](./images/9/result.webp)

실행 결과 0ms가 나왔으며, 다른 C++ 제출자보다 100%의 성능을 보였음을 확인할 수 있습니다.

<details>
<summary>코드 전문</summary>
    
```cpp showLineNumbers
class Solution 
{
public:
    bool isPalindrome(int x) 
    {
        if (x < 0) return false;
        else if (x < 10) return true;
        else if ((x % 10) == 0) return false;

        long reverse = 0;
        long tmpX = x;

        while (tmpX)
        {
            reverse = (reverse * 10) + (tmpX % 10);
            tmpX /= 10;
        }

        return reverse == x;
    }
};
```

</details>
