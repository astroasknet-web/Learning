Here is **Module 13** developed exactly according to the established format for Level 2 Intermediate.

---

# 🕉️ VEDIC MATHEMATICS — LEVEL 2: INTERMEDIATE
# MODULE 13: Cubes and Cube Roots
## Complete Study Material | Theory + Examples + Practice + Test Bank

---

> **"The cube reveals the three-dimensional nature of numbers. Master cubes, and you master the bridge between arithmetic and geometry."**
> — Vedic Mathematics Teacher's Manual

---

## 📋 MODULE AT A GLANCE

| Item | Details |
|------|---------|
| **Level** | Intermediate (Level 2) |
| **Module Number** | 13 of 10 (Level 2, Module 3) |
| **Target Age** | 12–16 years (Class 6–10 students) |
| **Duration** | 5–6 hours (Theory: 2 hrs, Practice: 2 hrs, Test: 1 hr) |
| **Prerequisites** | Level 1 complete, Squaring methods (Module 9), Basic algebra, Multiplication fluency |
| **Sutra Focus** | Sutra 10 — Yavadunam; Sub-Sutra 1 — Anurupyena |
| **Next Module** | Module 14: Vedic Algebra — Solving Equations |

---

## 🎯 LEARNING OUTCOMES

By the end of this module, the student will be able to:

1. Calculate the cube of any 2-digit number in under 15 seconds mentally
2. Apply the Anurupya (ratio) method for cubing numbers
3. Find cube roots of perfect cubes up to 1,000,000 (10⁶) in under 10 seconds
4. Use the last digit pattern to identify cube roots instantly
5. Apply Yavadunam to cube numbers near a base (10, 100, 1000)
6. Recognize the binomial expansion pattern (1:3:3:1) in cubing
7. Understand the relationship between a number and its cube through digital roots
8. Build a mental reference table of cubes from 1 to 99

---

# PART 1: THEORY

---

## 1.1 — Introduction to Cubing

### What is a Cube?

The **cube** of a number is the number multiplied by itself three times.

$$n^3 = n \times n \times n$$

**Examples:**
- $2^3 = 8$
- $5^3 = 125$
- $10^3 = 1000$

### Why Learn Vedic Cubing?

| Conventional Method | Vedic Method |
|---------------------|--------------|
| Multiply n × n × n (two multiplications) | Single pass using binomial ratio |
| Requires writing intermediate steps | Mental calculation possible |
| Takes 30–60 seconds for 2-digit numbers | Takes 5–10 seconds |

---

## 1.2 — The Binomial Expansion (a+b)³

### The Algebraic Identity

$$(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3$$

### The Ratio Pattern: 1 : 3 : 3 : 1

| Term | Coefficient | Power of a | Power of b |
|------|-------------|------------|------------|
| 1st | 1 | a³ | b⁰ |
| 2nd | 3 | a² | b¹ |
| 3rd | 3 | a¹ | b² |
| 4th | 1 | a⁰ | b³ |

### The 2-Digit Cubing Strategy

For any 2-digit number $N = 10a + b$ (where a is tens digit, b is units digit):

$$(10a + b)^3 = 1000a^3 + 100(3a^2b) + 10(3ab^2) + b^3$$

But careful: This representation works when we consider place values:
- $a^3$ contributes to thousands (10³ place)
- $3a^2b$ contributes to hundreds (10² place)
- $3ab^2$ contributes to tens (10¹ place)
- $b^3$ contributes to units (10⁰ place)

However, each term may produce carries that need to be handled.

---

## 1.3 — The Anurupya (Ratio) Method

### Sub-Sutra 1: Anurupyena

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| आनुरूप्येण | Anurupyena | **Proportionately** or **By the ratio method**

### How It Works for Cubing

For a 2-digit number $N = a|b$ (where a is tens digit, b is units digit):

1. Calculate $a^3$ (this will be the leftmost part)
2. Calculate the ratio $r = \frac{b}{a}$ (can be a fraction)
3. The four terms of the cube follow the geometric progression with ratio r:
   - Term 1 = $a^3$
   - Term 2 = $a^3 \times 3r = 3a^2b$
   - Term 3 = $a^3 \times 3r^2 = 3ab^2$
   - Term 4 = $a^3 \times r^3 = b^3$

4. Write these four terms with appropriate place values (1, 3, 3, 1 ratio) and add with carries.

### Example: 12³

Here a=1, b=2, r = b/a = 2/1 = 2

| Term | Calculation | Value |
|------|-------------|-------|
| T₁ | a³ = 1³ | 1 |
| T₂ | 3a²b = 3 × 1 × 2 | 6 |
| T₃ | 3ab² = 3 × 1 × 4 | 12 |
| T₄ | b³ = 8 | 8 |

Now arrange with place values (T₁ in thousands, T₂ in hundreds, T₃ in tens, T₄ in units):

```
T₁ (1000s):    1
T₂ (100s):     6
T₃ (10s):     12
T₄ (1s):       8
```

T₃ has 12 → keep 2, carry 1 to T₂: T₂ becomes 6+1=7
T₂ (7) and T₄ (8) are fine.

Result: 1 | 7 | 2 | 8 = **1728** ✓

---

### Example 2: 23³

a=2, b=3, r = b/a = 3/2 = 1.5

| Term | Calculation | Value |
|------|-------------|-------|
| T₁ | a³ = 8 | 8 |
| T₂ | 3a²b = 3 × 4 × 3 = 36 | 36 |
| T₃ | 3ab² = 3 × 2 × 9 = 54 | 54 |
| T₄ | b³ = 27 | 27 |

Place values (a³ is in thousands place? For 23, a=2 represents 20, so a³=8 represents 8000? Let me be careful.)

Actually, for a 2-digit number, a is the tens digit, so:
- T₁ (a³) is in the 1000s place (but multiplied by 1000)
- T₂ (3a²b) is in the 100s place (multiplied by 100)
- T₃ (3ab²) is in the 10s place (multiplied by 10)
- T₄ (b³) is in the units place

So we write:

```
T₁: 8      (means 8000)
T₂: 36     (means 3600)
T₃: 54     (means 540)
T₄: 27     (means 27)
```

Sum: 8000 + 3600 = 11600, +540 = 12140, +27 = 12167

But let me do the carry method for clarity:

Write in columns (thousands, hundreds, tens, units):

| Place | Thousands | Hundreds | Tens | Units |
|-------|-----------|----------|------|-------|
| T₁ | 8 | | | |
| T₂ | | 36 | | |
| T₃ | | | 54 | |
| T₄ | | | | 27 |

Now handle carries:
- Units: 27 → write 7, carry 2 to tens
- Tens: 54 + 2 = 56 → write 6, carry 5 to hundreds
- Hundreds: 36 + 5 = 41 → write 1, carry 4 to thousands
- Thousands: 8 + 4 = 12 → write 2, carry 1 to ten-thousands

Ten-thousands: 1

Reading: 1 | 2 | 1 | 6 | 7 = **12,167** ✓

Check: 23³ = 23 × 23 = 529, ×23 = 12,167 ✓

---

## 1.4 — Ratio Method with Fractions

When b/a is not a simple integer, the ratio method still works using fractions.

### Example: 25³

a=2, b=5, r = 5/2 = 2.5

| Term | Calculation | Value |
|------|-------------|-------|
| T₁ | 2³ = 8 | 8 |
| T₂ | 3 × 2² × 5 = 3 × 4 × 5 = 60 | 60 |
| T₃ | 3 × 2 × 5² = 3 × 2 × 25 = 150 | 150 |
| T₄ | 5³ = 125 | 125 |

Arrange:

| Thousands | Hundreds | Tens | Units |
|-----------|----------|------|-------|
| 8 | 60 | 150 | 125 |

Carries:
- Units: 125 → 5, carry 12 to tens
- Tens: 150 + 12 = 162 → 2, carry 16 to hundreds
- Hundreds: 60 + 16 = 76 → 6, carry 7 to thousands
- Thousands: 8 + 7 = 15 → 5, carry 1 to ten-thousands

Result: 15,625 ✓ (25³ = 15,625)

---

## 1.5 — The Vedic Anurupya Shortcut

For faster mental calculation, use the **ratio progression** directly:

**Step 1:** Find the ratio $r = b/a$ (as a simplified fraction)

**Step 2:** Express each term using the ratio $r$. The binomial coefficients (1, 3, 3, 1) mean the term-to-term ratio is not constant, so derive the four terms directly:

$T_1 = a^3$
$T_2 = 3a^2b = 3a^3 \times (b/a) = 3T_1 \times r$
$T_3 = 3ab^2 = 3a^3 \times (b/a)^2 = 3T_1 \times r^2$
$T_4 = b^3 = a^3 \times (b/a)^3 = T_1 \times r^3$

But the coefficients change: T₂ has factor 3, T₃ has factor 3, T₄ has factor 1.

So the progression is:
$T_1 = a^3$
$T_2 = 3 \times a^3 \times r$
$T_3 = 3 \times a^3 \times r^2$
$T_4 = a^3 \times r^3$

Then arrange in place value columns and add with carries.

---

## 1.6 — Yavadunam: Cubing Numbers Near a Base

### Sutra 10: Yavadunam

**"Whatever the extent of its deficiency"**

For numbers near a base (10, 100, 1000), we can cube using a formula similar to Nikhilam.

### Formula for (Base − d)³

$$(B - d)^3 = B^3 - 3B^2d + 3Bd^2 - d^3$$

In Vedic notation (for Base = 10^n):

Left part = $B - 3d$
Right part = $3d^2$ (with adjustments)
Last part = $d^3$

Actually, the standard Vedic method:

For $(B - d)^3$:
- Left part = $B - 3d$
- Middle part = $3d^2$
- Right part = $d^3$

But each part has a specific number of digits based on the base.

### Example: 97³ (Base 100)

B = 100, d = 3

Step 1: Left part = B − 3d = 100 − 9 = 91
Step 2: Middle part = 3d² = 3 × 9 = 27
Step 3: Right part = d³ = 27

But we need correct digit counts:
- For Base 100, the right part should have 2 digits, middle part 2 digits?
Actually, the standard method:

Write as: (100−3)³ = 100³ − 3×100²×3 + 3×100×3² − 3³
= 1,000,000 − 90,000 + 2,700 − 27 = 912,673

Step by step: 1,000,000 − 90,000 = 910,000; + 2,700 = 912,700; − 27 = 912,673

So 97³ = 912,673

Let me check: 97² = 9409, 9409×97 = 9409×100 − 9409×3 = 940,900 − 28,227 = 912,673 ✓

---

### Vedic Yavadunam Cubing Method (Base 100)

For (100 − d)³:

| Step | Calculation | Example (d=3) |
|------|-------------|---------------|
| 1 | Left = (100 − 3d) | 100 − 9 = 91 |
| 2 | Middle = 3d² (2 digits) | 27 → 27 |
| 3 | Right = d³ (2 digits) | 27 → 27 |

Combine: 91 | 27 | 27 = 912,727? That gives 912,727, not 912,673. So this is wrong.

The correct Vedic formula for (100 − d)³ is more nuanced. Let me use the algebraic expansion:

(100 − d)³ = 1,000,000 − 30,000d + 300d² − d³

For d=3: 1,000,000 − 90,000 + 2,700 − 27 = 912,673

So the parts are:
- 1,000,000 − 30,000d = 1000000 − 90000 = 910,000
- +300d² = +2,700 → 912,700
- −d³ = −27 → 912,673

In Vedic notation for Base 1000 (since 100³ = 1,000,000):

For (1000 − d)³: Left = 1000 − 3d, Middle = 3d², Right = d³, each with 3 digits.

For 97³, we need Base 100, but 100³ = 1,000,000 has 7 digits. This gets messy.

For practical purposes, use the direct algebraic expansion for numbers near 100:

**97³ = (100−3)³ = 1,000,000 − 90,000 + 2,700 − 27 = 912,673**

---

### For Numbers Near 1000

**Example: 998³**

B = 1000, d = 2

998³ = (1000−2)³ = 1,000,000,000 − 6,000,000 + 12,000 − 8 = 994,011,992

Check: 998² = 996,004, ×998 = 996,004×1000 − 996,004×2 = 996,004,000 − 1,992,008 = 994,011,992 ✓

---

## 1.7 — Mental Cube Roots

### The Power of Last Digits

For perfect cubes, the **last digit** of the cube uniquely determines the last digit of the cube root:

| Last digit of cube | Last digit of cube root |
|--------------------|------------------------|
| 0 | 0 |
| 1 | 1 |
| 2 | 8 |
| 3 | 7 |
| 4 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 3 |
| 8 | 2 |
| 9 | 9 |

**Memory aid:** 
- 1→1, 4→4, 5→5, 6→6, 9→9 (same)
- 2↔8 (swap)
- 3↔7 (swap)
- 0→0

---

### Finding Cube Roots of Numbers Up to 10⁶

For a perfect cube between 1³ = 1 and 99³ = 970,299:

**Step 1:** Look at the last digit of the cube → find the last digit of the cube root.

**Step 2:** Ignore the last 3 digits of the cube. Look at the remaining digits.

**Step 3:** Find the largest integer whose cube is ≤ this number. That is the first digit(s) of the cube root.

### Example: Find ∛185,193

Step 1: Last digit is 3 → cube root ends with 7 (since 3↔7)

Step 2: Ignore last 3 digits: 185

Step 3: Largest cube ≤ 185: 5³ = 125, 6³ = 216 (>185) → first digit = 5

Answer: **57** (since 57³ = 185,193)

Check: 57³ = 57×57=3249, ×57 = 3249×50 + 3249×7 = 162,450 + 22,743 = 185,193 ✓

---

### Example 2: Find ∛300,763

Last digit 3 → root ends with 7
Ignore last 3 digits: 300
Largest cube ≤ 300: 6³=216, 7³=343 (>300) → first digit = 6
Answer: 67. Check: 67³ = 67² × 67 = 4489 × 67 = 269,340 + 31,423 = 300,763 ✓

---

### Example 3: Find ∛157,464

Last digit 4 → root ends with 4
Ignore last 3 digits: 157
Largest cube ≤ 157: 5³=125, 6³=216 (>157) → first digit = 5
Answer: 54? Check 54³ = 54²=2916, ×54 = 2916×50 + 2916×4 = 145,800 + 11,664 = 157,464 ✓

---

### Example 4: Find ∛1,000,000

Since 100³ = 1,000,000, we have ∛1,000,000 = 100 ✓

---

## 1.8 — Digital Roots of Cubes

### The Pattern

| Number mod 9 | Digital root | Cube mod 9 | Cube digital root |
|--------------|--------------|------------|-------------------|
| 0 | 9 (or 0) | 0 | 9 |
| 1 | 1 | 1 | 1 |
| 2 | 2 | 8 | 8 |
| 3 | 3 | 27→9 | 9 |
| 4 | 4 | 64→10→1 | 1 |
| 5 | 5 | 125→8 | 8 |
| 6 | 6 | 216→9 | 9 |
| 7 | 7 | 343→10→1 | 1 |
| 8 | 8 | 512→8 | 8 |

### Observation

Digital root of a cube is always 1, 8, or 9.
- If n ≡ 0,3,6 (mod 9) → n³ ≡ 0 (mod 9) → DR = 9
- If n ≡ 1,4,7 (mod 9) → n³ ≡ 1 (mod 9) → DR = 1
- If n ≡ 2,5,8 (mod 9) → n³ ≡ 8 (mod 9) → DR = 8

This provides a quick verification check for cube roots.

---

## 1.9 — Pattern Recognition: Cubes of 1–20

Memorize these for quick reference:

| n | n³ | n | n³ | n | n³ |
|---|----|---|----|---|----|
| 1 | 1 | 8 | 512 | 15 | 3,375 |
| 2 | 8 | 9 | 729 | 16 | 4,096 |
| 3 | 27 | 10 | 1,000 | 17 | 4,913 |
| 4 | 64 | 11 | 1,331 | 18 | 5,832 |
| 5 | 125 | 12 | 1,728 | 19 | 6,859 |
| 6 | 216 | 13 | 2,197 | 20 | 8,000 |
| 7 | 343 | 14 | 2,744 | | |

### Patterns to Notice

- Differences between consecutive cubes: 1, 7, 19, 37, 61, 91, 127, 169, 217, 271, 331, 397, 469, 547, 631, 721, 817, 919, 1027, 1141...
- These differences themselves increase by multiples of 6

---

## 1.10 — Cubes of Numbers Near 100 (Reference Table)

| Number | Cube | Number | Cube |
|--------|------|--------|------|
| 95 | 857,375 | 105 | 1,157,625 |
| 96 | 884,736 | 106 | 1,191,016 |
| 97 | 912,673 | 107 | 1,225,043 |
| 98 | 941,192 | 108 | 1,259,712 |
| 99 | 970,299 | 109 | 1,295,029 |
| 100 | 1,000,000 | 110 | 1,331,000 |

---

# PART 2: WORKED EXAMPLES

---

## Section A: Cubing 2-Digit Numbers (Anurupya Method)

### Example 1: 14³

a=1, b=4, r = 4/1 = 4

| Term | Calculation | Value |
|------|-------------|-------|
| T₁ | 1³ = 1 | 1 |
| T₂ | 3×1²×4 = 12 | 12 |
| T₃ | 3×1×4² = 3×16 = 48 | 48 |
| T₄ | 4³ = 64 | 64 |

Arrange (thousands, hundreds, tens, units):

| Thousands | Hundreds | Tens | Units |
|-----------|----------|------|-------|
| 1 | 12 | 48 | 64 |

Carries:
- Units: 64 → 4, carry 6 to tens
- Tens: 48 + 6 = 54 → 4, carry 5 to hundreds
- Hundreds: 12 + 5 = 17 → 7, carry 1 to thousands
- Thousands: 1 + 1 = 2

Result: 2,744 ✓ (14³ = 2744)

---

### Example 2: 32³

a=3, b=2, r = 2/3

| Term | Calculation | Value |
|------|-------------|-------|
| T₁ | 27 | 27 |
| T₂ | 3×9×2 = 54 | 54 |
| T₃ | 3×3×4 = 36 | 36 |
| T₄ | 8 | 8 |

Now arrange the four terms by place value. For 32, $a = 3$ (the tens digit), so the place values are:
- T₁ = a³ × 1000 = 27 × 1000 = 27,000
- T₂ = 3a²b × 100 = 54 × 100 = 5,400
- T₃ = 3ab² × 10 = 36 × 10 = 360
- T₄ = b³ = 8

Sum: 27,000 + 5,400 = 32,400, +360 = 32,760, +8 = 32,768

Let me do carry method:

Write as: 27 | 54 | 36 | 8 (with place values)

| 10K | Thou | Hund | Tens | Units |
|-----|------|------|------|-------|
| 2 | 7 | 54 | 36 | 8 |

Better: Write T₁=27 in thousands/hundreds? Let me use standard column method:

| Ten-thousands | Thousands | Hundreds | Tens | Units |
|---------------|-----------|----------|------|-------|
| | 27 | | | |
| | | 54 | | |
| | | | 36 | |
| | | | | 8 |

Now:
- Units: 8
- Tens: 36 → 6, carry 3 to hundreds
- Hundreds: 54 + 3 = 57 → 7, carry 5 to thousands
- Thousands: 27 + 5 = 32 → 2, carry 3 to ten-thousands
- Ten-thousands: 3

Result: 3 | 2 | 7 | 6 | 8 = 32,768 ✓

---

### Example 3: 45³

a=4, b=5, r = 5/4 = 1.25

| Term | Calculation | Value |
|------|-------------|-------|
| T₁ | 64 | 64 |
| T₂ | 3×16×5 = 240 | 240 |
| T₃ | 3×4×25 = 300 | 300 |
| T₄ | 125 | 125 |

Arrange (T₁ in ten-thousands? 64×1000=64,000? Let me do column method with carries:

Write: 64 | 240 | 300 | 125

| 100K | 10K | Thou | Hund | Tens | Units |
|------|-----|------|------|------|-------|
| | 64 | | | | |
| | | 240 | | | |
| | | | 300 | | |
| | | | | 125 | |

Carries:
- Units: 125 → 5, carry 12 to tens
- Tens: 300 + 12 = 312 → 2, carry 31 to hundreds
- Hundreds: 240 + 31 = 271 → 1, carry 27 to thousands
- Thousands: 64 + 27 = 91 → 1, carry 9 to ten-thousands
- Ten-thousands: 9

Result: 9 | 1 | 1 | 2 | 5 = **91,125**, which matches 45³ = 91,125 ✓

Check: 45²=2025, ×45 = 2025×40 + 2025×5 = 81,000 + 10,125 = 91,125 ✓

---

## Section B: Cubes Near a Base (Yavadunam)

### Example 4: 98³

Base = 100, d = 2

98³ = (100−2)³ = 1,000,000 − 3×100²×2 + 3×100×2² − 8
= 1,000,000 − 60,000 + 1,200 − 8 = 941,192 ✓

---

### Example 5: 103³

Base = 100, surplus = 3

103³ = (100+3)³ = 1,000,000 + 3×100²×3 + 3×100×9 + 27
= 1,000,000 + 90,000 + 2,700 + 27 = 1,092,727 ✓

Check: 103³ = 1,092,727 ✓

---

### Example 6: 999³

Base = 1000, d = 1

999³ = (1000−1)³ = 1,000,000,000 − 3×1000²×1 + 3×1000×1 − 1
= 1,000,000,000 − 3,000,000 + 3,000 − 1 = 997,002,999 ✓

---

## Section C: Cube Roots (Mental Method)

### Example 7: Find ∛614,125

Last digit: 5 → cube root ends with 5
Ignore last 3 digits: 614
Largest cube ≤ 614: 8³=512, 9³=729 (>614) → first digit = 8
Answer: 85

Check: 85³ = 614,125 ✓

---

### Example 8: Find ∛2,460,375

Last digit: 5 → ends with 5
Ignore last 3 digits: 2,460
Largest cube ≤ 2,460: 13³=2,197, 14³=2,744 (>2,460) → first two digits = 13
Answer: 135

Check: 135³ = 135²=18,225, ×135 = 18,225×100 + 18,225×35 = 1,822,500 + 637,875 = 2,460,375 ✓

---

### Example 9: Find ∛6,859

Last digit: 9 → ends with 9 (since 9→9)
Ignore last 3 digits: 6
Largest cube ≤ 6: 1³=1, 2³=8 (>6) → first digit = 1
Answer: 19

Check: 19³ = 6,859 ✓

---

### Example 10: Find ∛1,728

Last digit: 8 → ends with 2 (since 8↔2)
Ignore last 3 digits: 1
Largest cube ≤ 1: 1³=1 → first digit = 1
Answer: 12

Check: 12³ = 1,728 ✓

---

## Section D: Verification Using Digital Roots

### Example 11: Verify that 57³ = 185,193

DR of 57: 5+7=12→3
Cube DR: 3³=27→9
DR of 185,193: 1+8+5+1+9+3=27→9 ✓

---

### Example 12: Verify that 23³ = 12,167

DR of 23: 2+3=5
5³=125→1+2+5=8
DR of 12,167: 1+2+1+6+7=17→8 ✓

---

# PART 3: PRACTICE EXERCISES

---

## Exercise Set A: Cubing 2-Digit Numbers (20 Questions)

*Use Anurupya (ratio) method. Show the four terms before carrying.*

**A1.** 11³
**A2.** 12³
**A3.** 13³
**A4.** 14³
**A5.** 15³
**A6.** 16³
**A7.** 17³
**A8.** 18³
**A9.** 19³
**A10.** 21³
**A11.** 22³
**A12.** 23³
**A13.** 24³
**A14.** 25³
**A15.** 26³
**A16.** 31³
**A17.** 34³
**A18.** 38³
**A19.** 42³
**A20.** 47³

---

## Exercise Set B: Cubes Near Base (15 Questions)

*Use Yavadunam (binomial expansion) for numbers near 100.*

**B1.** 96³
**B2.** 97³
**B3.** 98³
**B4.** 99³
**B5.** 101³
**B6.** 102³
**B7.** 103³
**B8.** 104³
**B9.** 105³
**B10.** 106³
**B11.** 95³
**B12.** 92³
**B13.** 108³
**B14.** 109³
**B15.** 110³

---

## Exercise Set C: Cube Roots (20 Questions)

*Find the cube root of each perfect cube.*

**C1.** 729
**C2.** 1,331
**C3.** 2,197
**C4.** 2,744
**C5.** 3,375
**C6.** 4,096
**C7.** 4,913
**C8.** 5,832
**C9.** 6,859
**C10.** 9,261
**C11.** 10,648
**C12.** 12,167
**C13.** 13,824
**C14.** 15,625
**C15.** 17,576
**C16.** 19,683
**C17.** 24,389
**C18.** 29,791
**C19.** 32,768
**C20.** 39,304

---

## Exercise Set D: Larger Cube Roots (10 Questions)

*Numbers up to 99³ = 970,299.*

**D1.** 110,592
**D2.** 132,651
**D3.** 157,464
**D4.** 166,375
**D5.** 185,193
**D6.** 205,379
**D7.** 226,981
**D8.** 250,047
**D9.** 274,625
**D10.** 300,763

---

## Exercise Set E: Digital Root Verification (10 Questions)

*Verify each cube using digital roots.*

**E1.** 12³ = 1,728
**E2.** 18³ = 5,832
**E3.** 21³ = 9,261
**E4.** 27³ = 19,683
**E5.** 33³ = 35,937
**E6.** 39³ = 59,319
**E7.** 44³ = 85,184
**E8.** 51³ = 132,651
**E9.** 67³ = 300,763
**E10.** 83³ = 571,787

---

## Answer Key for Practice Exercises

### Set A Answers (Cubes):
A1. 1,331 | A2. 1,728 | A3. 2,197 | A4. 2,744 | A5. 3,375 | A6. 4,096 | A7. 4,913 | A8. 5,832 | A9. 6,859 | A10. 9,261 | A11. 10,648 | A12. 12,167 | A13. 13,824 | A14. 15,625 | A15. 17,576 | A16. 29,791 | A17. 39,304 | A18. 54,872 | A19. 74,088 | A20. 103,823

### Set B Answers (Near Base):
B1. 884,736 | B2. 912,673 | B3. 941,192 | B4. 970,299 | B5. 1,030,301 | B6. 1,061,208 | B7. 1,092,727 | B8. 1,124,864 | B9. 1,157,625 | B10. 1,191,016 | B11. 857,375 | B12. 778,688 | B13. 1,259,712 | B14. 1,295,029 | B15. 1,331,000

### Set C Answers (Cube Roots):
C1. 9 | C2. 11 | C3. 13 | C4. 14 | C5. 15 | C6. 16 | C7. 17 | C8. 18 | C9. 19 | C10. 21 | C11. 22 | C12. 23 | C13. 24 | C14. 25 | C15. 26 | C16. 27 | C17. 29 | C18. 31 | C19. 32 | C20. 34

### Set D Answers (Larger Cube Roots):
D1. 48 | D2. 51 | D3. 54 | D4. 55 | D5. 57 | D6. 59 | D7. 61 | D8. 63 | D9. 65 | D10. 67

### Set E Answers (Verification):
All are correct (digital root verification passes)

---

# PART 4: ONLINE TEST BANK

---

## 📝 TEST 1: Cubing 2-Digit Numbers
**Format:** Multiple Choice Questions
**Total Marks:** 20 | **Time:** 15 minutes

---

**Q1.** [EASY] 12³ = ?
- A) 1,728 ✅
- B) 1,728
- C) 1,728
- D) 1,828

**Q2.** [EASY] 15³ = ?
- A) 3,375 ✅
- B) 3,375
- C) 3,375
- D) 3,475

**Q3.** [EASY] The ratio r = b/a for 23 is:
- A) 1.5
- B) 2/3
- C) 3/2 ✅
- D) 2.5

**Q4.** [MEDIUM] 25³ = ?
- A) 15,625 ✅
- B) 15,625
- C) 15,625
- D) 15,725

**Q5.** [MEDIUM] The four terms for 14³ before carrying are:
- A) 1, 12, 48, 64 ✅
- B) 1, 4, 16, 64
- C) 3, 12, 48, 64
- D) 1, 12, 16, 64

**Q6.** [MEDIUM] 18³ = ?
- A) 5,832 ✅
- B) 5,832
- C) 5,832
- D) 5,932

**Q7.** [HARD] 32³ = ?
- A) 32,768 ✅
- B) 32,768
- C) 32,768
- D) 32,868

**Q8.** [MEDIUM] In the Anurupya method, the coefficient pattern is:
- A) 1:2:3:4
- B) 1:3:3:1 ✅
- C) 1:4:6:4
- D) 1:2:2:1

**Q9.** [HARD] 47³ = ?
- A) 103,823 ✅
- B) 103,823
- C) 103,823
- D) 103,923

**Q10.** [MEDIUM] The ratio method is based on which algebraic identity?
- A) (a+b)²
- B) (a+b)³ ✅
- C) (a+b)⁴
- D) a³+b³

---

## 📝 TEST 2: Cubes Near Base & Cube Roots
**Format:** Fill in the blank + Short Answer
**Total Marks:** 25 | **Time:** 20 minutes

---

**Q1.** [EASY — Fill] 98³ = _____.
**Answer:** 941,192

**Q2.** [EASY — Fill] 101³ = _____.
**Answer:** 1,030,301

**Q3.** [MEDIUM — Fill] 103³ = _____.
**Answer:** 1,092,727

**Q4.** [EASY — Fill] The cube root of 729 is _____.
**Answer:** 9

**Q5.** [MEDIUM — Fill] The cube root of 12,167 is _____.
**Answer:** 23

**Q6.** [MEDIUM — Fill] If a cube ends with 3, the cube root ends with _____.
**Answer:** 7

**Q7.** [MEDIUM — Fill] If a cube ends with 8, the cube root ends with _____.
**Answer:** 2

**Q8.** [HARD — Fill] 95³ = _____.
**Answer:** 857,375

**Q9.** [MEDIUM — Fill] ∛185,193 = _____.
**Answer:** 57

**Q10.** [HARD — Fill] ∛300,763 = _____.
**Answer:** 67

---

## 📝 TEST 3: Digital Roots & Patterns
**Format:** Matching + MCQ
**Total Marks:** 20 | **Time:** 10 minutes

---

**Part A: Match the cube root to the cube (8 marks)**

| Cube | Cube Root |
|------|-----------|
| 1. 2,744 | A. 17 |
| 2. 4,913 | B. 14 |
| 3. 6,859 | C. 12 |
| 4. 1,728 | D. 19 |

**Correct Matches:** 1-B, 2-A, 3-D, 4-C

---

**Part B: MCQ (12 marks)**

**Q5.** [MEDIUM] The digital root of a cube can never be:
- A) 1
- B) 3 ✅
- C) 8
- D) 9

**Q6.** [MEDIUM] If a number has digital root 5, its cube has digital root:
- A) 1
- B) 8 ✅
- C) 9
- D) 5

**Q7.** [MEDIUM] The cube of 99 is 970,299. Its digital root is:
- A) 9 ✅
- B) 1
- C) 8
- D) 0

**Q8.** [EASY] The sub-sutra Anurupyena means:
- A) By one more
- B) Proportionately ✅
- C) By mere observation
- D) Transpose and apply

**Q9.** [HARD] Which of the following cannot be a perfect cube?
- A) 729
- B) 1,331
- C) 2,197
- D) 3,000 ✅

**Q10.** [MEDIUM] Sutra 10 "Yavadunam" means:
- A) By one more than previous
- B) Whatever the extent of its deficiency ✅
- C) All from 9 and last from 10
- D) Vertically and cross-wise

---

## 📝 TEST 4: Comprehensive Module Test
**Format:** Mixed
**Total Marks:** 50 | **Time:** 35 minutes

---

**Section 1: MCQ (15 marks)**

**Q1.** 13³ = ? A) 2,197 ✅ B) 2,197 C) 2,197 D) 2,297
**Q2.** 22³ = ? A) 10,648 ✅ B) 10,648 C) 10,648 D) 10,748
**Q3.** 96³ = ? A) 884,736 ✅ B) 884,736 C) 884,736 D) 884,836
**Q4.** ∛15,625 = ? A) 25 ✅ B) 25 C) 25 D) 35
**Q5.** ∛166,375 = ? A) 55 ✅ B) 55 C) 55 D) 65

---

**Section 2: Fill in the Blank (15 marks)**

**Q6.** 17³ = _____.
*Answer: 4,913*

**Q7.** 99³ = _____.
*Answer: 970,299*

**Q8.** ∛729 = _____.
*Answer: 9*

**Q9.** ∛39,304 = _____.
*Answer: 34*

**Q10.** The digital root of 12³ is _____.
*Answer: 9*

---

**Section 3: Short Answer (10 marks)**

**Q11.** Find 23³ using the Anurupya method. Show the four terms before carrying.
**Q12.** Find ∛157,464 using the mental cube root method.
**Q13.** Explain how the last digit of a cube tells you the last digit of its cube root.
**Q14.** Verify 27³ = 19,683 using digital roots.
**Q15.** Calculate 998³ using the Yavadunam method.

---

**Section 4: Long Answer (10 marks)**

**Q16.** Derive the cube of 34 using the ratio method. Show all steps including carries. Then verify using digital roots.

---

# PART 5: TEACHER'S GUIDE

---

## Common Mistakes & Corrections

| Mistake | Correction |
|---------|-----------|
| Forgetting to carry in the column method | Always handle carries from right to left (units to ten-thousands) |
| Misplacing the decimal in ratio r | r = b/a (units digit / tens digit) |
| Confusing last digit mapping (2→8 vs 8→2) | Memorize: 2↔8, 3↔7, others map to themselves |
| Forgetting that 0 and 1 and 4,5,6,9 map to themselves | 0→0, 1→1, 4→4, 5→5, 6→6, 9→9 |
| Using wrong base for Yavadunam | For 2-digit numbers near 100, use 100; for 3-digit near 1000, use 1000 |

---

## Memory Aid for Last Digit Mapping

**"0-1, 4-5-6-9 stay same, 2-3-7-8 swap"**

| Cube ends with | Root ends with |
|----------------|----------------|
| 0 | 0 |
| 1 | 1 |
| 2 | 8 |
| 3 | 7 |
| 4 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 3 |
| 8 | 2 |
| 9 | 9 |

---

# QUICK REFERENCE CARD

```
╔═══════════════════════════════════════════════════════════════════════╗
║                    MODULE 13 — CUBES & CUBE ROOTS                      ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  ANURUPYA METHOD (Cubing 2-digit numbers):                            ║
║  ┌─────────────────────────────────────────────────────────────┐      ║
║  │ For (10a + b)³:                                             │      ║
║  │ T₁ = a³          (×1000)                                    │      ║
║  │ T₂ = 3a²b        (×100)                                     │      ║
║  │ T₃ = 3ab²        (×10)                                      │      ║
║  │ T₄ = b³          (×1)                                       │      ║
║  │ Ratio r = b/a → Terms follow a³, 3a³r, 3a³r², a³r³          │      ║
║  └─────────────────────────────────────────────────────────────┘      ║
║                                                                       ║
║  YAVADUNAM (Cubes near base):                                         ║
║  (B ± d)³ = B³ ± 3B²d + 3Bd² ± d³                                    ║
║                                                                       ║
║  CUBE ROOTS (Last digit mapping):                                     ║
║  ┌─────────────────────────────────────────────────────────────┐      ║
║  │ 0→0, 1→1, 2→8, 3→7, 4→4, 5→5, 6→6, 7→3, 8→2, 9→9           │      ║
║  └─────────────────────────────────────────────────────────────┘      ║
║                                                                       ║
║  DIGITAL ROOTS OF CUBES:                                             ║
║  • If DR(n) = 1,4,7 → DR(n³) = 1                                     ║
║  • If DR(n) = 2,5,8 → DR(n³) = 8                                     ║
║  • If DR(n) = 0,3,6 → DR(n³) = 9                                     ║
║                                                                       ║
║  SUTRA 10: Yavadunam — Whatever the extent of its deficiency         ║
║  SUB-SUTRA 1: Anurupyena — Proportionately                           ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

*End of Module 13 — Complete Study Material*
*Next: Module 14 — Vedic Algebra: Solving Equations*

---
*Document Version 1.0 | Vedic Mathematics Level 2 Intermediate Course*