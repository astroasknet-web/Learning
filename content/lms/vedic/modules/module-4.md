Here is **Module 4** developed exactly according to the format you established.

---

# 🕉️ VEDIC MATHEMATICS — LEVEL 1: FOUNDATION
# MODULE 4: The Nikhilam Method — Multiplication Near Base
## Complete Study Material | Theory + Examples + Practice + Test Bank

---

> **"Nikhilam is the gateway sutra. Master it, and you will never look at multiplication the same way again."**
> — Vedic Mathematics Teacher's Manual

---

## 📋 MODULE AT A GLANCE

| Item | Details |
|------|---------|
| **Level** | Foundation (Level 1) |
| **Module Number** | 4 of 10 |
| **Target Age** | 8–12 years (also suitable for all ages beginning Vedic Math) |
| **Duration** | 5–6 hours (Theory: 2 hrs, Practice: 2 hrs, Test: 1 hr) |
| **Prerequisites** | Module 1 (Base System, Deficiency/Surplus), Basic multiplication tables (1–20) |
| **Sutra Focus** | Sutra 2 — Nikhilam Navatashcaramam Dashatah; Sub-Sutra 6 — Yavadunam Tavadunam |
| **Next Module** | Module 5: Urdhva-Tiryak — General Multiplication |

---

## 🎯 LEARNING OUTCOMES

By the end of this module, the student will be able to:

1. State Sutra 2 and Sub-Sutra 6 with their English meanings
2. Multiply any two numbers near Base 10 in under 3 seconds mentally
3. Multiply any two numbers near Base 100 in under 5 seconds mentally
4. Multiply any two numbers near Base 1000 in under 10 seconds mentally
5. Apply cross-subtraction correctly for both-below-base cases
6. Apply cross-addition correctly for both-above-base cases
7. Handle mixed cases (one below, one above base) with sign awareness
8. Identify and use sub-bases (20, 30, 50, 200, 500) with proper division
9. Determine the correct number of digits for the right part based on base
10. Verify multiplication results using the complement check

---

# PART 1: THEORY

---

## 1.1 — Sutra 2: Nikhilam Navatashcaramam Dashatah

### The Sutra and Its Meaning

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| निखिलं नवतश्चरमं दशतः | Nikhilam Navatashcaramam Dashatah | **All from 9 and the last from 10** |

### What Does This Sutra Mean?

In Module 1, we used this sutra for **subtraction** from powers of 10. Now we will use it for **multiplication** — and this is where its real power shines.

The sutra has two interpretations:

| Interpretation | Use | Example |
|----------------|-----|---------|
| **Subtraction meaning** | Finding complement (deficiency) from base | 100 − 97 = 03 |
| **Multiplication meaning** | Multiplying numbers close to a base | 97 × 96 = 9312 |

### The Core Insight

When two numbers are **both close to the same base** (like 100), instead of multiplying them directly, we:
1. Find how far each number is from the base (deficiency or surplus)
2. Perform a simple cross-operation
3. Multiply the deficiencies/surpluses
4. Combine the results

**Result:** A complex multiplication becomes two simple operations.

---

## 1.2 — Sub-Sutra 6: Yavadunam Tavadunam

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| यावदूनं तावदूनम् | Yavadunam Tavadunam | **Whatever the deficiency, lessen it still further** |

### What Does This Sub-Sutra Mean?

This sub-sutra is the **operational instruction** for Nikhilam multiplication. It tells us:

> "Take the deficiency of the number from the base, and reduce the other number by that same deficiency."

**Example:** For 97 × 96 with Base 100:
- Deficiency of 97 = 3
- Deficiency of 96 = 4
- Following Yavadunam Tavadunam: Reduce 97 by 4 → 93 (or reduce 96 by 3 → 93)

This gives us the **left part** of the answer.

---

## 1.3 — The Algebraic Proof (Why It Works)

### Both Numbers Below Base

Let Base = $B$ (where $B = 10^n$, like 10, 100, 1000)

Let the two numbers be $(B - a)$ and $(B - b)$, where $a$ and $b$ are their deficiencies from $B$.

**Multiplication:**
$$(B - a)(B - b) = B^2 - B(a + b) + ab$$

**Rearranging:**
$$= B(B - a - b) + ab$$

**But $(B - a - b) = (B - a) - b =$ First number minus the deficiency of the second**

So: 
- **Left part** = $B - a - b$ (or directly $\text{Number}_1 - b$)
- **Right part** = $a \times b$

**Final answer:** Left part × B + Right part

### Both Numbers Above Base

Let the two numbers be $(B + a)$ and $(B + b)$, where $a$ and $b$ are their surpluses.

$$(B + a)(B + b) = B^2 + B(a + b) + ab$$
$$= B(B + a + b) + ab$$

- **Left part** = $B + a + b$ (or directly $\text{Number}_1 + b$)
- **Right part** = $a \times b$

### Mixed Case (One Below, One Above)

Let numbers be $(B - a)$ and $(B + b)$:

$$(B - a)(B + b) = B^2 + B(b - a) - ab$$
$$= B(B + b - a) - ab$$

- **Left part** = $B + b - a$ (or $\text{Number}_1 + b$ OR $\text{Number}_2 - a$)
- **Right part** = $-(a \times b)$ → meaning we **subtract** $ab$ from the left part

This is why mixed cases require special handling (see Section 1.8).

---

## 1.4 — The 3-Step Nikhilam Method

### Step-by-Step Procedure (Both Numbers Below Base)

| Step | Action | Example: 97 × 96 (Base 100) |
|------|--------|------------------------------|
| **Step 1** | Choose the appropriate base (10, 100, 1000, etc.) | Base = 100 |
| **Step 2** | Find deficiencies from base: $d_1 = B - N_1$, $d_2 = B - N_2$ | 100−97 = 3, 100−96 = 4 |
| **Step 3** | **Left part** = $N_1 - d_2$ (or $N_2 - d_1$) | 97 − 4 = 93 |
| **Step 4** | **Right part** = $d_1 \times d_2$ | 3 × 4 = 12 |
| **Step 5** | Combine: Left part \| Right part (with proper digits) | 93 \| 12 = 9312 |

### Important: Right Part Digit Rule

| Base | Number of Digits in Right Part | Reason |
|------|-------------------------------|--------|
| 10 | 1 digit | $10^1$ |
| 100 | 2 digits | $10^2$ |
| 1000 | 3 digits | $10^3$ |
| 10000 | 4 digits | $10^4$ |

**Rule:** Right part must always have exactly as many digits as the number of zeros in the base. If $d_1 \times d_2$ has fewer digits, pad with leading zeros.

**Example:** 98 × 97 (Base 100)
- Deficiencies: 2, 3
- Left: 98 − 3 = 95
- Right: 2 × 3 = **06** (not 6!) → 95|06 = 9506 ✓

---

## 1.5 — Case 1: Base 10 Multiplication

Base 10 is used for numbers from 6 to 14 (close to 10).

### Examples

**Example 1:** 8 × 7 (Base 10)

| Step | Calculation |
|------|-------------|
| Base | 10 |
| Deficiencies | 10−8 = 2, 10−7 = 3 |
| Left part | 8 − 3 = 5 (or 7 − 2 = 5) |
| Right part | 2 × 3 = 6 |
| Answer | 5 \| 6 = **56** ✓ |

**Check:** 8 × 7 = 56 ✓

---

**Example 2:** 9 × 8 (Base 10)

| Step | Calculation |
|------|-------------|
| Deficiencies | 10−9 = 1, 10−8 = 2 |
| Left part | 9 − 2 = 7 |
| Right part | 1 × 2 = 2 |
| Answer | 7 \| 2 = **72** ✓ |

---

**Example 3:** 12 × 13 (Both above Base 10)

When both numbers are **above** the base, we use **cross-addition** instead of cross-subtraction.

| Step | Calculation |
|------|-------------|
| Base | 10 |
| Surpluses | 12−10 = 2, 13−10 = 3 |
| Left part | 12 + 3 = 15 (or 13 + 2 = 15) |
| Right part | 2 × 3 = 6 |
| Answer | 15 \| 6 = **156** ✓ |

**Check:** 12 × 13 = 156 ✓

---

**Example 4:** 11 × 14 (Base 10)

| Step | Calculation |
|------|-------------|
| Surpluses | 11−10 = 1, 14−10 = 4 |
| Left part | 11 + 4 = 15 (or 14 + 1 = 15) |
| Right part | 1 × 4 = 4 |
| Answer | 15 \| 4 = **154** ✓ |

---

### Base 10 Quick Reference

| Numbers | Operation | Left Part Formula |
|---------|-----------|-------------------|
| Both below base | Cross-subtract | $N_1 - d_2$ |
| Both above base | Cross-add | $N_1 + s_2$ |
| Mixed | Special (see 1.8) | $N_1 + s_2$ OR $N_1 - d_2$ then adjust |

---

## 1.6 — Case 2: Base 100 Multiplication

Base 100 is the most frequently used base in Nikhilam multiplication. Numbers from 85 to 115 work well.

### Example 1: Both Below Base — 96 × 94

| Step | Calculation |
|------|-------------|
| Base | 100 |
| Deficiencies | 100−96 = 4, 100−94 = 6 |
| Left part | 96 − 6 = 90 (or 94 − 4 = 90) |
| Right part | 4 × 6 = 24 |
| Answer | 90 \| 24 = **9024** ✓ |

**Check:** 96 × 94 = (100−4)(100−6) = 10000 − 1000 + 24 = 9024 ✓

---

### Example 2: Both Below Base — 98 × 97

| Step | Calculation |
|------|-------------|
| Deficiencies | 100−98 = 2, 100−97 = 3 |
| Left part | 98 − 3 = 95 |
| Right part | 2 × 3 = 06 (2 digits!) |
| Answer | 95 \| 06 = **9506** ✓ |

---

### Example 3: Both Above Base — 103 × 104

| Step | Calculation |
|------|-------------|
| Base | 100 |
| Surpluses | 103−100 = 3, 104−100 = 4 |
| Left part | 103 + 4 = 107 (or 104 + 3 = 107) |
| Right part | 3 × 4 = 12 |
| Answer | 107 \| 12 = **10712** ✓ |

**Check:** 103 × 104 = 10712 ✓

---

### Example 4: Both Above Base — 108 × 109

| Step | Calculation |
|------|-------------|
| Surpluses | 8, 9 |
| Left part | 108 + 9 = 117 |
| Right part | 8 × 9 = 72 |
| Answer | 117 \| 72 = **11772** ✓ |

---

### Example 5: Both Below Base — 92 × 91

| Step | Calculation |
|------|-------------|
| Deficiencies | 100−92 = 8, 100−91 = 9 |
| Left part | 92 − 9 = 83 |
| Right part | 8 × 9 = 72 |
| Answer | 83 \| 72 = **8372** ✓ |

---

### Example 6: Both Below Base — 88 × 85

| Step | Calculation |
|------|-------------|
| Deficiencies | 100−88 = 12, 100−85 = 15 |
| Left part | 88 − 15 = 73 |
| Right part | 12 × 15 = 180 |
| Wait — right part has 3 digits but base 100 needs only 2 digits! |

**Handling right part overflow:** When $d_1 \times d_2$ has more digits than allowed, **carry the extra to the left part**.

| Step | Calculation |
|------|-------------|
| Right part (raw) | 180 → 3 digits |
| Keep last 2 digits | 80 |
| Carry extra | 1 (the hundreds digit) |
| Left part (adjusted) | 73 + 1 = 74 |
| Final answer | 74 \| 80 = **7480** ✓ |

**Check:** 88 × 85 = 7480 ✓

---

### Base 100 Rules Summary

| Situation | Left Part | Right Part |
|-----------|-----------|------------|
| Both below | $N_1 - d_2$ | $d_1 \times d_2$ (2 digits) |
| Both above | $N_1 + s_2$ | $s_1 \times s_2$ (2 digits) |
| Overflow | Add carry to left part | Keep rightmost 2 digits |

---

## 1.7 — Case 3: Base 1000 Multiplication

Same principles apply. Right part must have **3 digits**.

### Example 1: 998 × 997 (Both Below)

| Step | Calculation |
|------|-------------|
| Base | 1000 |
| Deficiencies | 1000−998 = 2, 1000−997 = 3 |
| Left part | 998 − 3 = 995 |
| Right part | 2 × 3 = 006 (3 digits!) |
| Answer | 995 \| 006 = **995006** ✓ |

---

### Example 2: 1004 × 1003 (Both Above)

| Step | Calculation |
|------|-------------|
| Surpluses | 4, 3 |
| Left part | 1004 + 3 = 1007 |
| Right part | 4 × 3 = 012 (3 digits!) |
| Answer | 1007 \| 012 = **1007012** ✓ |

---

### Example 3: 992 × 989 (Both Below, with Overflow)

| Step | Calculation |
|------|-------------|
| Deficiencies | 1000−992 = 8, 1000−989 = 11 |
| Left part | 992 − 11 = 981 |
| Right part (raw) | 8 × 11 = 88 → but needs 3 digits → 088 |
| No overflow (88 is 2 digits, fits in 3) | Answer = **981088** ✓ |

---

### Example 4: 985 × 978 (Overflow Case)

| Step | Calculation |
|------|-------------|
| Deficiencies | 15, 22 |
| Left part | 985 − 22 = 963 |
| Right part (raw) | 15 × 22 = 330 |
| Right part has 3 digits? 330 → 3 digits exactly. OK! | Answer = **963330** |

**Check:** Let's verify: 985 × 978 = (1000−15)(1000−22) = 1,000,000 − 37,000 + 330 = 963,330 ✓

---

## 1.8 — Case 4: Mixed Case (One Below, One Above Base)

This is the trickiest case. When one number is below base and one is above base, their deficiencies/surpluses have **opposite signs**.

### The Formula

For numbers $(B - a)$ and $(B + b)$:

$$(B - a)(B + b) = B(B + b - a) - ab$$

This means:
- **Left part** = $N_1 + b$ (or $N_2 - a$)
- Then **subtract** $a \times b$ from the left part
- Right part has **negative** value, so we handle it by borrowing

### Step-by-Step Method

| Step | Action | Example: 97 × 103 (Base 100) |
|------|--------|------------------------------|
| 1 | Identify base | Base = 100 |
| 2 | Find deficiency ($d$) and surplus ($s$) | 97: deficiency 3; 103: surplus 3 |
| 3 | Cross-operate: $N_1 + s$ (or $N_2 - d$) | 97 + 3 = 100 (or 103 − 3 = 100) |
| 4 | Multiply $d \times s$ | 3 × 3 = 9 |
| 5 | **Subtract** product from left part | 100 − 9 = 91 |
| 6 | This 91 is the left part? Wait — careful! | Actually, the answer structure changes. |

### The Correct Mixed Case Procedure

Better method:

**Step 1:** Find the **base** and write both numbers as deviations: $N_1 = B - d$, $N_2 = B + s$

**Step 2:** Find the **base answer** = $\text{Left} = N_1 + s$ (or $N_2 - d$)

**Step 3:** Find **product** = $d \times s$

**Step 4:** The actual answer = $\text{Left} \times B - \text{product}$

But since we write as Left|Right, we need to handle the subtraction in the right part.

**Practical Method:**

| Step | Example: 97 × 103 (Base 100) |
|------|------------------------------|
| 1 | $N_1 = 97$, $N_2 = 103$, Base = 100 |
| 2 | $d = 3$, $s = 3$ |
| 3 | Left (temporary) = $N_1 + s = 97 + 3 = 100$ |
| 4 | Right (raw) = $-(d \times s) = -9$ |
| 5 | To write as positive right part: Borrow 1 from left | Left = 99, Right = 100 − 9 = 91 |
| 6 | Answer = 99 \| 91 = **9991** |

**Check:** 97 × 103 = 97 × 100 + 97 × 3 = 9700 + 291 = 9991 ✓

---

### More Mixed Case Examples

**Example 2:** 96 × 105 (Base 100)

| Step | Calculation |
|------|-------------|
| Deviations | 96: deficiency 4; 105: surplus 5 |
| $N_1 + s$ | 96 + 5 = 101 |
| $d \times s$ | 4 × 5 = 20 |
| Subtract | 101 − 20 = 81 (but this is wrong — need proper method) |

**Correct Method:**

| Step | Calculation |
|------|-------------|
| Temporary Left | $N_1 + s = 96 + 5 = 101$ |
| Right (negative) | $-(4 × 5) = -20$ |
| Borrow 1 from left | Left = 100, Borrowed 1 = 100, subtract 20 → Right = 80 |

**Systematic Mixed Case Formula:**

Let $L = N_1 + s$ (or $N_2 - d$)
Let $P = d \times s$

Then answer = $(L - 1) \mid (B - P)$ when $P > 0$

Actually, the clean formula:

**For $(B - d) \times (B + s)$:**

**Answer** = $(N_1 + s - 1) \mid (B - (d \times s))$ when $d \times s < B$

Let's verify with 96 × 105:

| Step | Calculation |
|------|-------------|
| $d = 4$, $s = 5$, $B = 100$ | $P = 20$ |
| Left = $96 + 5 - 1 = 100$ | Right = $100 - 20 = 80$ |
| Answer = 100 \| 80 = **10080** | Check: 96 × 105 = 10080 ✓ |

**Example 3:** 92 × 108 (Base 100)

| Step | Calculation |
|------|-------------|
| $d = 8$, $s = 8$, $P = 64$ | |
| Left = $92 + 8 - 1 = 99$ | |
| Right = $100 - 64 = 36$ | |
| Answer = 99 \| 36 = **9936** | |

**Check:** 92 × 108 = (100−8)(100+8) = 10000 − 64 = 9936 ✓ ✓ ✓ (This is $(B-d)(B+d) = B^2 - d^2$!)

---

### Mixed Case Shortcut

When numbers are equidistant from base ($d = s$), this becomes the **Difference of Squares** formula:

$$(B-d)(B+d) = B^2 - d^2$$

Example: 97 × 103 = 10000 − 9 = 9991 ✓

---

## 1.9 — Case 5: Sub-Base Multiplication

Sometimes numbers are not close to 10, 100, or 1000, but are close to a **sub-base** like 20, 30, 50, 200, 500, etc.

### What is a Sub-Base?

A **sub-base** is a number that is a **factor** or **multiple** of a main base (10, 100, 1000).

| Main Base | Sub-Base | Factor |
|-----------|----------|--------|
| 10 | 20, 30, 40, 50 | 2×, 3×, 4×, 5× |
| 100 | 200, 300, 500, 600 | 2×, 3×, 5×, 6× |
| 1000 | 2000, 4000, 5000 | 2×, 4×, 5× |

### Sub-Base Method (Two-Step)

**Step 1:** Treat the sub-base as the working base and find deficiencies/surpluses from it.

**Step 2:** After finding the left part, **divide by the sub-base factor** (ratio between sub-base and main base 10/100/1000).

---

### Example 1: Base 50 (Sub-base of 100, factor = 2)

**Problem:** 48 × 47

| Step | Calculation |
|------|-------------|
| Main base | 100 |
| Sub-base | 50 (since 100 ÷ 2 = 50) |
| Factor | 2 |
| Deviations from 50 | 48: −2; 47: −3 |
| Left part (using sub-base method) | $48 - 3 = 45$ |
| **Divide left part by factor** | $45 \div 2 = 22.5$ → $22$ (integer part) |
| Right part (raw) | $(-2) \times (-3) = 6$ |
| But right part for base 100 needs 2 digits | 06 |
| Wait — we need to handle the remainder from division! |

**Correct Sub-Base Procedure:**

| Step | Calculation |
|------|-------------|
| 1 | Working base = Sub-base = 50, Factor = 2 |
| 2 | Deviations: $48 - 50 = -2$, $47 - 50 = -3$ |
| 3 | Left (in working base units) = $48 - 3 = 45$ |
| 4 | **Multiply left by factor?** No — we need to convert to main base. Let's use the proper formula: |

**Proper Sub-Base Formula:**

Let $B$ = main base (100), $S$ = sub-base (50), $F = B/S = 2$

For numbers $N_1 = S - d$, $N_2 = S - e$:

$$N_1 \times N_2 = \left( \frac{(S - d - e)}{F} \right) \times B + (d \times e)$$

But simpler: **Calculate with sub-base, then adjust.**

**Practical Method:**

| Step | Example: 48 × 47 |
|------|-----------------|
| 1 | Write numbers relative to sub-base 50: 48 = 50 − 2, 47 = 50 − 3 |
| 2 | Find left part (using sub-base as if it were base 100): 48 − 3 = 45 |
| 3 | Multiply left part by the factor? No — the factor is 2 because 100/50 = 2. Actually, we divide: |
| 4 | **Left part for main base** = $(48 - 3) \div 2 = 45 \div 2 = 22$ remainder 1 |
| 5 | **Right part** = $(-2) \times (-3) = 6$ |
| 6 | **Add remainder × 100 to right part?** Wait — this is getting messy. Let me show the clean method: |

**The Standard Sub-Base Method (Correct):**

For multiplication near $S$ (sub-base) where $S = B/k$ (B is main base 100, k is factor like 2, 4, 5):

1. Let $d_1 = S - N_1$, $d_2 = S - N_2$ (can be negative for above-sub-base)
2. Left part (raw) = $N_1 - d_2$ (or $N_2 - d_1$)
3. **Left part for final answer** = $\lfloor \frac{\text{Left(raw)}}{k} \rfloor$
4. **Right part** = $d_1 \times d_2 + (\text{remainder from division} \times B)$
5. Right part must have $n$ digits where $B = 10^n$

Let me demonstrate with a clean example:

**Example 1 (Clean): 48 × 47 with sub-base 50, factor 2**

| Step | Calculation |
|------|-------------|
| Sub-base S = 50, Main base B = 100, k = B/S = 2 |
| $d_1 = 50 - 48 = 2$, $d_2 = 50 - 47 = 3$ |
| Left(raw) = $48 - 3 = 45$ |
| Left(final) = $\lfloor 45 / 2 \rfloor = 22$ |
| Remainder = $45 - (22 \times 2) = 1$ |
| Right = $(2 \times 3) + (1 \times 100) = 6 + 100 = 106$ |
| Since B=100, right part needs 2 digits → 106 has 3 digits → carry 1 to left |
| Left adjusted = $22 + 1 = 23$ |
| Right final = 06 |
| Answer = $23 \mid 06 = 2306$ |

**Wait — this gives 2306, but we know 48 × 47 = 2256! Something is wrong.**

Let me correct this with the **true and tested Vedic sub-base method**:

---

### Correct Sub-Base Method (From Authentic Vedic Texts)

For numbers near a sub-base $S$ where $S = B/k$:

Actually, the simplest way: **Convert to working base = S, then apply formula, then multiply by k appropriately.**

Better approach — use **Anurupyena (Sub-Sutra 1)**:

**Method:** Treat $S$ as base, find deficiencies. Then:
- Left part = $(N_1 - d_2) \div k$ (or multiplied by k — let me derive)

Let me just give the **proven working method**:

**For 48 × 47 with sub-base 50 (k=2 because 100/50=2):**

| Step | Calculation |
|------|-------------|
| 1 | 48 = 50 − 2, 47 = 50 − 3 |
| 2 | Left (using sub-base as if it were base 100) = 48 − 3 = 45 |
| 3 | Since sub-base is 50 (half of 100), **halve** the left part: 45 ÷ 2 = 22.5 |
| 4 | The integer part (22) is the left part of answer |
| 5 | The fraction (0.5) means add 50 to right part: Right = $2 \times 3 = 6$ → 6 + 50 = 56 |
| 6 | Answer = 22 \| 56 = **2256** ✓ ✓ ✓ |

This works!

**Another example: 52 × 49 (Sub-base 50)**

| Step | Calculation |
|------|-------------|
| 1 | 52 = 50 + 2, 49 = 50 − 1 |
| 2 | Left (working) = 52 − 1 = 51 (or 49 + 2 = 51) |
| 3 | Halve: 51 ÷ 2 = 25.5 → Left = 25 |
| 4 | Remainder 0.5 → Add 50 to right part |
| 5 | Right = $2 \times (-1) = -2$ → This is mixed case! |
| This becomes complex. For simplicity, we focus on both-below or both-above sub-base in this module. |

---

### Easier Sub-Base Method for Beginners

For numbers **both below** a sub-base that is a **multiple of 10** (20, 30, 40, 50, 60, etc.):

**Rule:** Multiply using the sub-base normally (as if it were base 10), then multiply the result by the factor at the end? No — that would be wrong.

**Simpler:** Just use **Base 100** method by moving decimal or scaling.

Actually, for most practical problems, use this approach:

**For 48 × 47:**
- 48 × 47 = (50−2)(50−3) = 2500 − 250 + 6 = 2256

So we can just use algebra mentally. But for Vedic speed, practice the halving method.

**For 48 × 47 (Using the proper halving method):**

| Step | Calculation |
|------|-------------|
| 1 | $d_1 = 2$, $d_2 = 3$ |
| 2 | $L = 48 - 3 = 45$ |
| 3 | Since base is 50 = 100/2, $L_{final} = 45 \div 2 = 22$ remainder 1 |
| 4 | Right = $(2 \times 3) + (1 \times 100) = 6 + 100 = 106$ |
| 5 | 106 → carry 1 to left: Left = 23, Right = 06 → 2306 ✗ (still wrong!) |

I realize the authentic method requires more careful handling. For the purpose of this foundational module, we will focus on **main bases** (10, 100, 1000) and treat sub-bases in a simplified manner:

**Simplified Sub-Base Method (Practical for Module 4):**

> When numbers are close to a sub-base like 50, convert the problem to base 100 by **doubling** the numbers, multiplying, then dividing by 4 at the end.

**Example: 48 × 47**
- Double each: 96 × 94
- 96 × 94 with Base 100 = 9024
- Divide by 4: 9024 ÷ 4 = 2256 ✓

This is much easier for beginners!

---

### Sub-Base Method via Doubling/Halving (Recommended)

| Sub-base | Action to reach Base 100 |
|----------|-------------------------|
| 50 | Double both numbers → multiply → divide by 4 |
| 25 | Multiply both by 4 → multiply → divide by 16 |
| 20 | Multiply both by 5 → multiply → divide by 25 |
| 200 | Halve both numbers → multiply → multiply by 4 |

**Example 2: 23 × 22 (Near Base 25, 25×4=100)**

| Step | Calculation |
|------|-------------|
| 1 | Multiply each by 4: 23×4=92, 22×4=88 |
| 2 | 92 × 88 with Base 100: deficiencies 8, 12 |
| 3 | Left = 92−12=80, Right=8×12=96 → 8096 |
| 4 | Divide by 16 (because 4×4=16): 8096 ÷ 16 = 506 |
| 5 | Answer = **506** ✓ Check: 23×22=506 ✓ |

**Example 3: 53 × 52 (Near Base 50)**

| Step | Calculation |
|------|-------------|
| 1 | Double: 106 × 104 |
| 2 | Base 100: surpluses 6, 4 → Left=106+4=110, Right=24 → 11024 |
| 3 | Divide by 4: 11024 ÷ 4 = **2756** |
| 4 | Check: 53×52=2756 ✓ |

**Example 4: 197 × 193 (Near Base 200, halve to Base 100)**

| Step | Calculation |
|------|-------------|
| 1 | Halve each: 98.5 × 96.5 — not convenient. Better: Use Base 200 directly? |

For Base 200: factor = 2 (since 200 = 2×100)
Method: Find deviations from 200, then divide left part by 2.

**197 × 193 (Base 200 = 2 × 100):**

For a base $B = k \times 100$ (here $k = 2$):

$$(k \times 100 - a)(k \times 100 - b) = 100 \times [k(k \times 100 - a - b)] + ab$$

So the left part is $k \times (k \times 100 - a - b)$ and the right part is $ab$.

For 197 × 193, $k = 2$, $a = 3$, $b = 7$:
- Left = $2 \times (200 - 3 - 7) = 2 \times 190 = 380$
- Right = $3 \times 7 = 21$
- Answer = 380 \| 21 = **38021**

Check: 197 × 193 = (200−3)(200−7) = 40000 − 2000 + 21 = 38021 ✓

---

### Sub-Base Formula Summary

| Sub-base type | Base = k × 100 | Left part formula |
|---------------|----------------|-------------------|
| 200 | k=2 | $k \times (B - a - b)$ |
| 300 | k=3 | $k \times (B - a - b)$ |
| 500 | k=5 | $k \times (B - a - b)$ |

For above-base cases, add instead of subtract.

For this module, we will focus on **Base 10, 100, 1000** and introduce sub-bases **200 and 50** through the doubling/halving method.

---

## 1.10 — Choosing the Right Base

| Numbers range | Best base | Example |
|---------------|-----------|---------|
| 6–14 | 10 | 8 × 7 |
| 85–115 | 100 | 97 × 96 |
| 85–115 (both above) | 100 | 103 × 108 |
| 950–1050 | 1000 | 998 × 997 |
| 45–55 | 50 (via doubling) | 48 × 47 |
| 190–210 | 200 | 197 × 193 |
| 24–26 | 25 (via ×4) | 23 × 22 |

---

# PART 2: WORKED EXAMPLES

---

## Section A: Base 10 Multiplication

### Example 1

**Question:** Multiply 9 × 8 using the Nikhilam method with Base 10.

**Answer:**

| Step | Work |
|------|------|
| Base = 10 | Deficiencies: 10−9=1, 10−8=2 |
| Left part | 9 − 2 = 7 |
| Right part | 1 × 2 = 2 |
| Answer | **72** |

---

### Example 2

**Question:** Multiply 12 × 13 using Nikhilam (both above base).

**Answer:**

| Step | Work |
|------|------|
| Base = 10 | Surpluses: 12−10=2, 13−10=3 |
| Left part | 12 + 3 = 15 |
| Right part | 2 × 3 = 6 |
| Answer | **156** |

---

### Example 3

**Question:** Multiply 6 × 7 using Nikhilam.

**Answer:**

| Step | Work |
|------|------|
| Base = 10 | Deficiencies: 4, 3 |
| Left | 6 − 3 = 3 |
| Right | 4 × 3 = 12 |
| Right part should be 1 digit? Overflow! 12 has 2 digits | |
| Keep 2 (rightmost), carry 1 to left | Left = 3 + 1 = 4, Right = 2 |
| Answer | **42** ✓ |

---

## Section B: Base 100 Multiplication

### Example 4

**Question:** Multiply 95 × 93 using Nikhilam.

**Answer:**

| Step | Work |
|------|------|
| Base = 100 | Deficiencies: 5, 7 |
| Left | 95 − 7 = 88 |
| Right | 5 × 7 = 35 |
| Answer | **8835** |

---

### Example 5

**Question:** Multiply 88 × 86 using Nikhilam (overflow case).

**Answer:**

| Step | Work |
|------|------|
| Deficiencies: 12, 14 | |
| Left (raw) | 88 − 14 = 74 |
| Right (raw) | 12 × 14 = 168 |
| 168 → keep 68, carry 1 to left | Left = 74 + 1 = 75 |
| Answer | **7568** |

**Check:** 88 × 86 = 7568 ✓

---

### Example 6

**Question:** Multiply 106 × 108 (both above base).

**Answer:**

| Step | Work |
|------|------|
| Surpluses: 6, 8 | |
| Left | 106 + 8 = 114 |
| Right | 6 × 8 = 48 |
| Answer | **11448** |

---

### Example 7

**Question:** Multiply 112 × 109 (both above base).

**Answer:**

| Step | Work |
|------|------|
| Surpluses: 12, 9 | |
| Left | 112 + 9 = 121 |
| Right | 12 × 9 = 108 |
| 108 → keep 08, carry 1 to left | Left = 121 + 1 = 122 |
| Answer | **12208** |

---

## Section C: Base 1000 Multiplication

### Example 8

**Question:** Multiply 994 × 992 using Nikhilam.

**Answer:**

| Step | Work |
|------|------|
| Base = 1000 | Deficiencies: 6, 8 |
| Left | 994 − 8 = 986 |
| Right | 6 × 8 = 48 → needs 3 digits → 048 |
| Answer | **986048** |

---

### Example 9

**Question:** Multiply 1007 × 1004 (both above base).

**Answer:**

| Step | Work |
|------|------|
| Surpluses: 7, 4 | |
| Left | 1007 + 4 = 1011 |
| Right | 7 × 4 = 28 → 028 |
| Answer | **1011028** |

---

### Example 10

**Question:** Multiply 995 × 988 (overflow case).

**Answer:**

| Step | Work |
|------|------|
| Deficiencies: 5, 12 | |
| Left | 995 − 12 = 983 |
| Right (raw) | 5 × 12 = 60 → 060 (fits in 3 digits) |
| Answer | **983060** |

---

## Section D: Mixed Cases (One Above, One Below)

### Example 11

**Question:** Multiply 96 × 105 (mixed case, Base 100).

**Answer:**

| Step | Work |
|------|------|
| 96 = 100 − 4 (d=4), 105 = 100 + 5 (s=5) | |
| Temporary Left = 96 + 5 = 101 | |
| Product = 4 × 5 = 20 | |
| Since 20 < 100, Left = 101 − 1 = 100, Right = 100 − 20 = 80 | |
| Answer = **10080** | |

**Check:** 96 × 105 = 10080 ✓

---

### Example 12

**Question:** Multiply 97 × 104 (mixed case).

**Answer:**

| Step | Work |
|------|------|
| d=3, s=4, Product=12 | |
| Temp Left = 97 + 4 = 101 | |
| Left = 101 − 1 = 100, Right = 100 − 12 = 88 | |
| Answer = **10088** | |

---

### Example 13

**Question:** Multiply 92 × 108 (mixed case, equidistant).

**Answer:**

| Step | Work |
|------|------|
| d=8, s=8, Product=64 | |
| Temp Left = 92 + 8 = 100 | |
| Left = 100 − 1 = 99, Right = 100 − 64 = 36 | |
| Answer = **9936** | |

This is $100^2 - 8^2 = 10000 - 64 = 9936$ ✓

---

## Section E: Sub-Base Multiplication

### Example 14

**Question:** Multiply 48 × 47 using the doubling method (sub-base 50).

**Answer:**

| Step | Work |
|------|------|
| Double each: 96 × 94 | |
| Base 100: deficiencies 4, 6 | |
| Left = 96 − 6 = 90, Right = 24 | 9024 |
| Divide by 4: 9024 ÷ 4 = **2256** ✓ | |

---

### Example 15

**Question:** Multiply 23 × 22 using the ×4 method (sub-base 25).

**Answer:**

| Step | Work |
|------|------|
| Multiply each by 4: 92 × 88 | |
| Base 100: deficiencies 8, 12 | |
| Left = 92 − 12 = 80, Right = 96 → 8096 | |
| Divide by 16: 8096 ÷ 16 = **506** ✓ | |

---

### Example 16

**Question:** Multiply 197 × 193 (Base 200, k=2).

**Answer:**

| Step | Work |
|------|------|
| Base = 200 = 2×100 | Deficiencies from 200: 3, 7 |
| Left = k × (200 − 3 − 7) = 2 × 190 = 380 | |
| Right = 3 × 7 = 21 | |
| Answer = **38021** ✓ | |

---

### Example 17

**Question:** Multiply 29 × 28 using sub-base 30 method (Base 30, adjust to Base 100?).

**Answer:** Simpler to use Base 30 directly:

| Step | Work |
|------|------|
| Base = 30 | 29 = 30−1, 28 = 30−2 |
| Left = 29 − 2 = 27 | Right = 1 × 2 = 2 |
| But Base 30 is not a power of 10, so answer structure is different. |

Actually, for Base 30, we can't use the Left|Right notation directly. Use algebraic method:

$29 × 28 = (30−1)(30−2) = 900 − 90 + 2 = 812$

So answer = **812**

For Vedic speed, use Base 100 via × method or just use Urdhva-Tiryak (Module 5). For Module 4, we focus on bases that are powers of 10.

---

# PART 3: PRACTICE EXERCISES

---

## Exercise Set A: Base 10 Multiplication (15 Questions)

*Use Nikhilam method with Base 10. Write both left part and right part steps.*

**A1.** 7 × 8
**A2.** 9 × 6
**A3.** 8 × 9
**A4.** 7 × 9
**A5.** 6 × 6
**A6.** 11 × 12 (both above)
**A7.** 12 × 14 (both above)
**A8.** 13 × 11 (both above)
**A9.** 14 × 13 (both above)
**A10.** 6 × 14 (mixed — use borrowing method)
**A11.** 7 × 13 (mixed)
**A12.** 8 × 12 (mixed)
**A13.** 9 × 11 (mixed)
**A14.** 5 × 15 (mixed — be careful!)
**A15.** 4 × 16 (mixed)

---

## Exercise Set B: Base 100 Multiplication (20 Questions)

**B1.** 98 × 97
**B2.** 99 × 95
**B3.** 96 × 94
**B4.** 97 × 92
**B5.** 95 × 94
**B6.** 93 × 91
**B7.** 88 × 87 (overflow expected)
**B8.** 89 × 85 (overflow)
**B9.** 86 × 84 (overflow)
**B10.** 92 × 89
**B11.** 102 × 105 (both above)
**B12.** 104 × 107 (both above)
**B13.** 108 × 103 (both above)
**B14.** 109 × 106 (both above)
**B15.** 112 × 108 (both above, overflow)
**B16.** 115 × 112 (both above, overflow)
**B17.** 95 × 106 (mixed)
**B18.** 92 × 109 (mixed)
**B19.** 88 × 115 (mixed)
**B20.** 93 × 108 (mixed, equidistant)

---

## Exercise Set C: Base 1000 Multiplication (15 Questions)

**C1.** 998 × 997
**C2.** 999 × 995
**C3.** 996 × 994
**C4.** 995 × 992
**C5.** 997 × 993
**C6.** 989 × 988 (overflow)
**C7.** 985 × 982 (overflow)
**C8.** 992 × 991
**C9.** 1004 × 1006 (both above)
**C10.** 1008 × 1005 (both above)
**C11.** 1012 × 1009 (both above, overflow)
**C12.** 1005 × 1010 (both above)
**C13.** 995 × 1006 (mixed)
**C14.** 992 × 1011 (mixed)
**C15.** 998 × 1004 (mixed, equidistant)

---

## Exercise Set D: Mixed Cases — One Above, One Below (10 Questions)

**D1.** 96 × 104
**D2.** 95 × 106
**D3.** 97 × 105
**D4.** 94 × 107
**D5.** 93 × 109
**D6.** 92 × 108
**D7.** 91 × 110
**D8.** 89 × 112
**D9.** 88 × 115
**D10.** 85 × 118

---

## Exercise Set E: Sub-Base Multiplication (10 Questions)

*Use the doubling/halving or scaling method.*

**E1.** 48 × 46 (sub-base 50)
**E2.** 49 × 47 (sub-base 50)
**E3.** 52 × 51 (sub-base 50, both above)
**E4.** 53 × 49 (mixed near 50)
**E5.** 24 × 23 (sub-base 25)
**E6.** 26 × 24 (sub-base 25)
**E7.** 197 × 195 (Base 200)
**E8.** 203 × 202 (Base 200, both above)
**E9.** 198 × 196 (Base 200)
**E10.** 21 × 19 (sub-base 20)

---

## Exercise Set F: Right Part Digit Practice (10 Questions)

*For each, determine the correct right part after multiplication, including leading zeros.*

**F1.** Base 100, product of deficiencies = 7
**F2.** Base 100, product = 12
**F3.** Base 100, product = 3
**F4.** Base 100, product = 45
**F5.** Base 1000, product = 8
**F6.** Base 1000, product = 56
**F7.** Base 1000, product = 120
**F8.** Base 10, product = 12 (what do you do?)
**F9.** Base 100, product = 100
**F10.** Base 1000, product = 999

---

## Answer Key for Practice Exercises

### Set A Answers:
A1. 56 | A2. 54 | A3. 72 | A4. 63 | A5. 36 | A6. 132 | A7. 168 | A8. 143 | A9. 182 | A10. 84 | A11. 91 | A12. 96 | A13. 99 | A14. 75 | A15. 64

### Set B Answers:
B1. 9506 | B2. 9405 | B3. 9024 | B4. 8924 | B5. 8930 | B6. 8463 | B7. 7656 | B8. 7565 | B9. 7224 | B10. 8188 | B11. 10710 | B12. 11128 | B13. 11124 | B14. 11554 | B15. 12096 | B16. 12880 | B17. 10070 | B18. 10028 | B19. 10120 | B20. 10044

### Set C Answers:
C1. 995006 | C2. 994005 | C3. 990024 | C4. 987040 | C5. 990021 | C6. 977132 | C7. 966870 | C8. 984072 | C9. 1010024 | C10. 1013040 | C11. 1021108 | C12. 1015050 | C13. 1000970 | C14. 1002912 | C15. 1001992

### Set D Answers:
D1. 9984 | D2. 10070 | D3. 10185 | D4. 10058 | D5. 10137 | D6. 9936 | D7. 10010 | D8. 9968 | D9. 10120 | D10. 10030

### Set E Answers:
E1. 2208 | E2. 2303 | E3. 2652 | E4. 2597 | E5. 552 | E6. 624 | E7. 38415 | E8. 41006 | E9. 38808 | E10. 399

### Set F Answers:
F1. 07 | F2. 12 | F3. 03 | F4. 45 | F5. 008 | F6. 056 | F7. 120 | F8. 12 → carry 1 to left, keep 2 | F9. 00 carry 1 to left | F10. 999

---

# PART 4: ONLINE TEST BANK

---

## 📝 TEST 1: Nikhilam Basics — Base 10 & 100
**Format:** Multiple Choice Questions (MCQ)
**Total Marks:** 20 | **Time:** 15 minutes

---

**Q1.** [EASY] The Nikhilam sutra "Nikhilam Navatashcaramam Dashatah" means:
- A) Vertically and cross-wise
- B) All from 9 and the last from 10 ✅
- C) By one more than the previous one
- D) Whatever the extent of its deficiency

---

**Q2.** [EASY] For Base 100 multiplication, the right part of the answer must have how many digits?
- A) 1 digit
- B) 2 digits ✅
- C) 3 digits
- D) 4 digits

---

**Q3.** [EASY] Using Nikhilam with Base 10, 8 × 7 = ?
- A) 54
- B) 56 ✅
- C) 63
- D) 48

---

**Q4.** [EASY] 12 × 13 using Nikhilam (Base 10, both above) = ?
- A) 125
- B) 144
- C) 156 ✅
- D) 169

---

**Q5.** [EASY] For 98 × 97 (Base 100), the deficiencies are:
- A) 1 and 2
- B) 2 and 3 ✅
- C) 3 and 4
- D) 1 and 3

---

**Q6.** [MEDIUM] 96 × 94 (Base 100) = ?
- A) 9024 ✅
- B) 9124
- C) 8924
- D) 9026

---

**Q7.** [MEDIUM] 103 × 104 (Base 100, both above) = ?
- A) 10612
- B) 10712 ✅
- C) 10812
- D) 10702

---

**Q8.** [MEDIUM] When multiplying 88 × 86, the right part raw product is 168. What is the final answer?
- A) 7468
- B) 7568 ✅
- C) 7668
- D) 7488

---

**Q9.** [MEDIUM] 95 × 93 (Base 100) = ?
- A) 8735
- B) 8835 ✅
- C) 8935
- D) 8635

---

**Q10.** [MEDIUM] For Base 100 multiplication, if $d_1 × d_2 = 5$, the right part is written as:
- A) 5
- B) 05 ✅
- C) 005
- D) 50

---

**Q11.** [MEDIUM] 7 × 13 using Nikhilam Base 10 (mixed case) = ?
- A) 81
- B) 91 ✅
- C) 101
- D) 71

---

**Q12.** [MEDIUM] 92 × 108 (mixed, equidistant from 100) = ?
- A) 9936 ✅
- B) 9836
- C) 10036
- D) 9930

---

**Q13.** [HARD] Which sub-base method correctly computes 48 × 47?
- A) Double each → multiply → divide by 4 ✅
- B) Halve each → multiply → multiply by 4
- C) Use Base 50 directly with left part halving
- D) Both A and C are correct

---

**Q14.** [HARD] 998 × 997 (Base 1000) = ?
- A) 995006 ✅
- B) 995006 (yes, same)
- C) 994006
- D) 996006

---

**Q15.** [MEDIUM] 112 × 109 (Base 100) = ?
- A) 12108
- B) 12208 ✅
- C) 12008
- D) 12218

---

**Q16.** [EASY] Sub-Sutra 6 "Yavadunam Tavadunam" means:
- A) All from 9 and last from 10
- B) Whatever the deficiency, lessen it still further ✅
- C) By one less than previous
- D) Vertically and cross-wise

---

**Q17.** [MEDIUM] In the formula $(B-a)(B-b) = B(B-a-b) + ab$, what is the left part of the Vedic answer?
- A) $B-a-b$ ✅
- B) $B-a$
- C) $B-b$
- D) $ab$

---

**Q18.** [MEDIUM] 89 × 85 (Base 100) = ?
- A) 7465
- B) 7565 ✅
- C) 7665
- D) 7365

---

**Q19.** [HARD] 1007 × 1004 (Base 1000) = ?
- A) 1010028
- B) 1011028 ✅
- C) 1012028
- D) 1010028

---

**Q20.** [MEDIUM] When using Base 200, if deviations are 3 and 7, and left raw = 190, what is final left part?
- A) 190
- B) 380 ✅
- C) 95
- D) 200

---

## 📝 TEST 2: Right Part, Overflow & Mixed Cases
**Format:** Fill in the blank + Short Answer
**Total Marks:** 25 | **Time:** 15 minutes

---

**Q1.** [EASY — Fill] For Base 100, 4 × 3 = 12 → right part is written as ______.
**Answer:** 12

**Q2.** [EASY — Fill] For Base 100, 2 × 3 = 6 → right part is written as ______.
**Answer:** 06

**Q3.** [EASY — Fill] For Base 1000, 3 × 4 = 12 → right part is written as ______.
**Answer:** 012

**Q4.** [MEDIUM — Fill] 88 × 86 gives right part raw = 168. After carrying, right part = ______.
**Answer:** 68

**Q5.** [MEDIUM — Fill] 95 × 96 (Base 100) = ______.
**Answer:** 9120

**Q6.** [MEDIUM — Short] Multiply 97 × 96. Show left part and right part calculation.
**Answer:** Left = 97−4=93, Right=3×4=12 → 9312

**Q7.** [MEDIUM — Fill] For mixed case 96 × 105, after borrowing, the final answer is ______.
**Answer:** 10080

**Q8.** [HARD — Short] Explain what to do when $d_1 × d_2$ has more digits than allowed for the base.
**Answer:** Keep the rightmost n digits (where n = number of zeros in base) as the right part, and carry the remaining digits to the left part.

**Q9.** [MEDIUM — Fill] 93 × 107 (mixed case) = ______.
**Answer:** 9951

**Q10.** [MEDIUM — Fill] 995 × 992 (Base 1000) = ______.
**Answer:** 987040

**Q11.** [EASY — Fill] 9 × 6 (Base 10) = ______.
**Answer:** 54

**Q12.** [MEDIUM — Fill] 14 × 13 (Base 10, both above) = ______.
**Answer:** 182

**Q13.** [HARD — Short] Using the doubling method, compute 48 × 47 step by step.
**Answer:** Double each → 96×94 → Base 100: def 4,6 → left=96−6=90, right=24 → 9024 → divide by 4 → 2256

**Q14.** [MEDIUM — Fill] 197 × 193 (Base 200) = ______.
**Answer:** 38021

**Q15.** [HARD — Short] For Base 100, if $d_1 × d_2 = 200$, what are the final left and right parts?
**Answer:** Keep last 2 digits (00) as right part, carry 2 to left part. Left increases by 2.

---

## 📝 TEST 3: Sub-Base & Application
**Format:** Matching + MCQ
**Total Marks:** 20 | **Time:** 10 minutes

---

**Part A: Match the Base to Its Correct Use (8 Marks)**

| Numbers | Best Base |
|---------|-----------|
| 1. 7 × 8 | A. 1000 |
| 2. 98 × 97 | B. 10 |
| 3. 998 × 997 | C. 200 |
| 4. 197 × 195 | D. 100 |
| 5. 48 × 47 | E. 50 (via doubling) |
| 6. 23 × 22 | F. 25 (via ×4) |
| 7. 89 × 85 | G. 100 |
| 8. 103 × 108 | H. 100 |

**Correct Matches:** 1-B, 2-D, 3-A, 4-C, 5-E, 6-F, 7-G, 8-H

---

**Part B: Application MCQs (12 Marks)**

**Q9.** [EASY] Which sub-base is best for multiplying 49 × 48?
- A) 100
- B) 50 ✅
- C) 25
- D) 20

**Q10.** [MEDIUM] 52 × 48 using sub-base 50 gives:
- A) 2496 ✅
- B) 2596
- C) 2396
- D) 2696

**Q11.** [MEDIUM] The Nikhilam method is fastest when numbers are:
- A) Very large
- B) Close to a common base ✅
- C) Prime numbers
- D) Fractions

**Q12.** [HARD] For numbers 985 × 978 (Base 1000), the product of deficiencies is 330. What is the answer?
- A) 963330 ✅
- B) 963300
- C) 963030
- D) 963000

**Q13.** [MEDIUM] 24 × 23 using sub-base 25 (×4 method) = ?
- A) 550
- B) 552 ✅
- C) 554
- D) 556

**Q14.** [MEDIUM] 1012 × 1009 (Base 1000, both above) = ?
- A) 1021108 ✅
- B) 1021008
- C) 1021208
- D) 1022008

**Q15.** [EASY] The algebraic identity for both-below-base multiplication is:
- A) $(B+a)(B+b) = B^2 + B(a+b) + ab$
- B) $(B-a)(B-b) = B^2 - B(a+b) + ab$ ✅
- C) $(B-a)(B+b) = B^2 + B(b-a) - ab$
- D) None of the above

---

## 📝 TEST 4: Comprehensive Module Test
**Format:** Mixed (MCQ + Fill-in + Short Answer)
**Total Marks:** 50 | **Time:** 30 minutes

---

**Section 1: MCQ (20 Marks, 1 mark each)**

**Q1.** [E] 97 × 96 = : 9312 / 9212 / 9412 / 9112
**Q2.** [E] 9 × 7 = : 56 / 63 / 72 / 54
**Q3.** [E] 98 × 95 = : 9310 / 9210 / 9410 / **9310**
**Q4.** [E] 998 × 997 = : **995006** / 994006 / 996006 / 995016
**Q5.** [M] 88 × 85 = : 7480 / 7380 / **7480** / 7580
**Q6.** [M] 105 × 106 = : 11130 / **11130** / 11030 / 11230
**Q7.** [M] 96 × 105 = : **10080** / 10070 / 10090 / 10060
**Q8.** [M] 48 × 47 = : 2208 / **2256** / 2306 / 2156
**Q9.** [M] 197 × 193 = : **38021** / 37021 / 39021 / 38031
**Q10.** [M] 23 × 22 = : 500 / 506 / **506** / 512
**Q11.** [M] When $d_1 × d_2 = 120$ for Base 100, right part = : 120 / 20 / **20** / 12
**Q12.** [M] 7 × 14 = : **98** / 88 / 108 / 78
**Q13.** [M] 15 × 15 using Base 10? Better to use: Sutra 1 / **Sutra 2** / Sutra 14 / Not Nikhilam
**Q14.** [H] 999 × 995 = : **994005** / 995005 / 994015 / 995015
**Q15.** [H] 1015 × 1008 = : **1023120** / 1024120 / 1022120 / 1025120
**Q16.** [M] The number of digits in right part for Base 1000 is: 1 / 2 / **3** / 4
**Q17.** [M] 92 × 109 = : **10028** / 10018 / 10038 / 10048
**Q18.** [E] Sub-Sutra for "whatever the deficiency, lessen it still further" is: Sutra 2 / **Sub-Sutra 6** / Sub-Sutra 1 / Sutra 14
**Q19.** [M] 89 × 115 = : **10235** / 10135 / 10335 / 10035
**Q20.** [H] 1003 × 999 = : **1001997** / 1002997 / 1000997 / 1001997

---

**Section 2: Fill in the Blank (15 Marks, 1 mark each)**

**Q21.** For Base 100, if $d_1 = 12$ and $d_2 = 15$, the raw product is _____.
*Answer: 180*

**Q22.** After carrying, the right part for Q21 is _____ (2 digits).
*Answer: 80*

**Q23.** The carry amount from Q21 to left part is _____.
*Answer: 1*

**Q24.** 94 × 93 = _____.
*Answer: 8742*

**Q25.** 996 × 994 = _____.
*Answer: 990024*

**Q26.** 1008 × 1006 = _____.
*Answer: 1014048*

**Q27.** For mixed case 95 × 106, the final answer is _____.
*Answer: 10070*

**Q28.** 48 × 46 using doubling method = _____.
*Answer: 2208*

**Q29.** 197 × 199 (Base 200) = _____.
*Answer: 39203*

**Q30.** 88 × 112 = _____.
*Answer: 9856*

**Q31.** $99^2$ using Nikhilam = _____.
*Answer: 9801*

**Q32.** $102^2$ using Nikhilam = _____.
*Answer: 10404*

**Q33.** 1007 × 993 = _____.
*Answer: 999951*

**Q34.** 7 × 12 = _____.
*Answer: 84*

**Q35.** 13 × 8 = _____.
*Answer: 104*

---

**Section 3: Short Answer (15 Marks)**

**Q36.** [3 marks] Explain the 3-step Nikhilam method for multiplying 96 × 94 with Base 100.

*Answer:*
Step 1 — Find deficiencies: 100−96=4, 100−94=6
Step 2 — Left part: 96 − 6 = 90
Step 3 — Right part: 4 × 6 = 24
Answer = 90|24 = 9024

---

**Q37.** [3 marks] What is the difference in procedure between both-below-base and both-above-base multiplication? Give one example of each.

*Answer:*
Both below base: Use cross-subtraction. Example: 97×96 → left=97−4=93
Both above base: Use cross-addition. Example: 103×104 → left=103+4=107

---

**Q38.** [3 marks] A student multiplies 88 × 86 and gets 74|168 = 74168. What mistake did they make? Correct the answer.

*Answer:*
Mistake: They kept all 3 digits of 168 as right part, but Base 100 requires only 2 digits.
Correction: Keep last 2 digits (68) as right part, carry 1 to left part. Left=74+1=75.
Correct answer = 7568.

---

**Q39.** [3 marks — HARD] Derive the algebraic identity for $(B-a)(B-b)$ and explain how it maps to the Vedic left|right notation.

*Answer:*
$(B-a)(B-b) = B^2 - B(a+b) + ab = B(B-a-b) + ab$
Here, $(B-a-b)$ is the left part (since $(B-a)-b = B-a-b$).
$ab$ is the right part.
The Vedic answer = $(B-a-b) | ab$ when written in base B.

---

**Q40.** [3 marks — HARD] Using the doubling method, compute 53 × 52 step by step.

*Answer:*
Step 1: Double each number → 53×2=106, 52×2=104
Step 2: Multiply 106 × 104 using Base 100:
- Surpluses: 6, 4
- Left = 106 + 4 = 110
- Right = 6 × 4 = 24
- Product = 11024
Step 3: Divide by 4 (since we doubled both numbers, we multiplied by 4 overall) → 11024 ÷ 4 = 2756
Answer = 2756 ✓

---

# PART 5: TEACHER'S GUIDE & ASSESSMENT RUBRIC

---

## Classroom Activities

### Activity 1: Nikhilam Race (Pairs)
**Objective:** Speed practice for Base 100 multiplication
**Materials:** 20 flash cards with problems (88×86, 97×96, etc.)
**Rules:** Pairs race to solve. First correct answer wins point.
**Duration:** 15 minutes

### Activity 2: Right Part Bingo
**Objective:** Master leading zeros and digit rules
**Procedure:** Teacher calls out (base, product). Students fill bingo card with correct right part format (e.g., "Base 100, product=7" → "07")
**Duration:** 10 minutes

### Activity 3: Mixed Case Challenge
**Objective:** Handle one-above-one-below cases
**Materials:** Worksheet with 10 mixed problems
**Duration:** 15 minutes

### Activity 4: Sub-Base Detective
**Objective:** Identify best sub-base for given numbers
**Procedure:** Give numbers like 48×47, 23×22, 197×195. Students choose best approach.
**Duration:** 10 minutes

---

## Grading Rubric

| Component | Marks |
|-----------|-------|
| Test 1 (Nikhilam Basics) | 20 |
| Test 2 (Right Part & Mixed) | 25 |
| Test 3 (Sub-Base) | 20 |
| Comprehensive Test (Test 4) | 50 |
| **Class Participation** | 10 |
| **Activity / Project** | 25 |
| **TOTAL** | **150** |

**Grade Scale:**
- 135–150: Outstanding (A+)
- 120–134: Excellent (A)
- 105–119: Very Good (B+)
- 90–104: Good (B)
- 75–89: Satisfactory (C)
- Below 75: Needs Improvement

---

## Common Mistakes & How to Correct Them

| Mistake | Correction |
|---------|-----------|
| Forgetting leading zeros in right part | Right part must have exactly as many digits as zeros in base. 2×3=6 → for Base 100 write "06" |
| Wrong operation for above-base | Use cross-ADDITION, not cross-subtraction |
| Mixed case without borrowing | Subtract product from 100, not from left part directly |
| Sub-base confusion | Use doubling/halving method instead of direct sub-base |
| Overflow mishandling | Carry extra digits to left part, keep only required digits on right |
| Choosing wrong base | Numbers should be within 15% of base for efficiency |

---

# QUICK REFERENCE CARD

## Module 4 Summary Sheet (Print-Friendly)

```
╔═══════════════════════════════════════════════════════════════════════╗
║              NIKHILAM METHOD — CHEAT SHEET (Module 4)                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║ SUTRA 2: Nikhilam Navatashcaramam Dashatah                            ║
║          "All from 9 and the last from 10"                            ║
║ SUB-SUTRA 6: Yavadunam Tavadunam — "Whatever the deficiency,          ║
║              lessen it still further"                                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  BOTH BELOW BASE (B - a)(B - b):                                      ║
║  ┌─────────────────────────────────────────────────────────┐          ║
║  │ Left = N₁ - d₂    │    Right = d₁ × d₂ (pad with zeros) │          ║
║  └─────────────────────────────────────────────────────────┘          ║
║  Example: 97×96 (B=100, d₁=3, d₂=4) → 97-4=93 | 12 = 9312            ║
║                                                                       ║
║  BOTH ABOVE BASE (B + a)(B + b):                                      ║
║  ┌─────────────────────────────────────────────────────────┐          ║
║  │ Left = N₁ + s₂    │    Right = s₁ × s₂ (pad with zeros) │          ║
║  └─────────────────────────────────────────────────────────┘          ║
║  Example: 103×104 (B=100, s₁=3, s₂=4) → 103+4=107 | 12 = 10712       ║
║                                                                       ║
║  MIXED CASE (B - d)(B + s):                                          ║
║  ┌─────────────────────────────────────────────────────────┐          ║
║  │ Left = N₁ + s - 1    │    Right = 100 - (d × s)          │          ║
║  └─────────────────────────────────────────────────────────┘          ║
║  Example: 96×105 → d=4, s=5 → 96+5-1=100 | 100-20=80 → 10080         ║
║                                                                       ║
║  RIGHT PART DIGITS:                                                  ║
║  Base 10 → 1 digit    Base 100 → 2 digits    Base 1000 → 3 digits    ║
║                                                                       ║
║  SUB-BASE TRICKS:                                                    ║
║  48×47 → Double → 96×94 → 9024 ÷ 4 = 2256                            ║
║  23×22 → ×4 → 92×88 → 8096 ÷ 16 = 506                                ║
║  197×193 → Base 200 → k=2 → Left=2×(200-3-7)=380 → 38021             ║
║                                                                       ║
║  OVERFLOW: Keep rightmost n digits, carry rest to left               ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

