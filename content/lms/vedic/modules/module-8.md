Here is **Module 8** developed exactly according to the format you established.

---

# 🕉️ VEDIC MATHEMATICS — LEVEL 1: FOUNDATION
# MODULE 8: Digital Roots & Casting Out Nines
## Complete Study Material | Theory + Examples + Practice + Test Bank

---

> **"Verification is not a separate step—it is woven into the fabric of Vedic calculation. The sutras themselves provide the proof."**
> — Vedic Mathematics Teacher's Manual

---

## 📋 MODULE AT A GLANCE

| Item | Details |
|------|---------|
| **Level** | Foundation (Level 1) |
| **Module Number** | 8 of 10 |
| **Target Age** | 8–13 years (also suitable for all ages beginning Vedic Math) |
| **Duration** | 4–5 hours (Theory: 1.5 hrs, Practice: 2 hrs, Test: 1 hr) |
| **Prerequisites** | Module 1 (Basic addition), Module 4 (Multiplication), Module 6 (Division), Basic digit addition |
| **Sutra Focus** | Sutra 15 — Gunitasamuccayah; Sub-Sutra 12 — Vilokanam |
| **Next Module** | Module 9: Squaring & Cubing Methods |

---

## 🎯 LEARNING OUTCOMES

By the end of this module, the student will be able to:

1. State Sutra 15 (Gunitasamuccayah) with its English meaning
2. Calculate the digital root (Beejank) of any number in under 5 seconds
3. Use the nine-point circle to visualize digital roots
4. Verify addition results using casting out nines
5. Verify subtraction results using casting out nines
6. Verify multiplication results using casting out nines
7. Verify division results (quotient and remainder) using casting out nines
8. Identify errors in calculations instantly using digital root verification

---

# PART 1: THEORY

---

## 1.1 — What is a Digital Root (Beejank)?

### The Concept

The **digital root** (also called **Beejank** in Vedic Sanskrit, meaning "seed number") is the single-digit number obtained by repeatedly summing the digits of a number until only one digit remains.

**Example:** 358
- 3 + 5 + 8 = 16
- 1 + 6 = 7
- Digital root = 7

### Why is it Called "Beejank"?

In Sanskrit, **Beeja** means "seed" and **Ank** means "digit" or "number." Just as a tiny seed contains the potential for a giant tree, the digital root contains the essential "seed" of a number — its core numerical essence modulo 9.

### Important Properties

| Property | Example |
|----------|---------|
| Any number and its digital root have the same remainder when divided by 9 | 358 ÷ 9 = 39 remainder 7 → digital root 7 ✓ |
| Digital root of 9 is 9 (or sometimes 0) | 18 → 1+8=9 → digital root 9 |
| Zero has digital root 0 | 0 → 0 |

---

## 1.2 — The Nine-Point Circle

### Visualizing Digital Roots

The **nine-point circle** is a circular arrangement of digits 1 through 9 (with 9 at the top representing both 9 and 0 modulo 9).

```
                   9 (or 0)
                /           \
              8              1
             /                 \
            7        ●          2
             \                 /
              6              3
                \           /
                   5 ——— 4
```

### How to Use the Nine-Point Circle

Moving around the circle corresponds to **adding 1** each step. Adding 9 brings you back to the same point because 9 ≡ 0 (mod 9).

| Operation | Visual Meaning |
|-----------|----------------|
| Add 9 | Stay at same point |
| Add 1 | Move one step clockwise |
| Subtract 1 | Move one step counterclockwise |

---

## 1.3 — Sutra 15: Gunitasamuccayah

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| गुणितसमुच्चयः | Gunitasamuccayah | **The product of the sum equals the sum of the products** |

### What Does This Mean?

This sutra has two interpretations:

1. **Verification meaning:** The digital root of the product equals the digital root of the product of the digital roots.

   $$ \text{DR}(A \times B) = \text{DR}(\text{DR}(A) \times \text{DR}(B)) $$

2. **Algebraic meaning:** In factorization, the sum of the coefficients in the product equals the product of the sums of the coefficients.

In this module, we focus on the **verification** application.

### The Verification Formula

For any operation (+, -, ×, ÷):

| Operation | Verification Rule |
|-----------|-------------------|
| Addition | DR(A + B) = DR(DR(A) + DR(B)) |
| Subtraction | DR(A - B) = DR(DR(A) - DR(B)) |
| Multiplication | DR(A × B) = DR(DR(A) × DR(B)) |
| Division | If A ÷ B = Q remainder R, then DR(A) = DR(DR(B) × DR(Q) + DR(R)) |

---

## 1.4 — Casting Out Nines

### What is "Casting Out Nines"?

"Casting out nines" is a shortcut for finding the digital root. Instead of adding all digits individually, we **remove (cast out) any digits that add to 9** (or any group of digits that sum to 9, 18, 27, etc.).

### The Technique

| Step | Action | Example: 358 |
|------|--------|--------------|
| 1 | Look at the digits | 3, 5, 8 |
| 2 | Add all the digits | 3 + 5 + 8 = 16 |
| 3 | Sum exceeds 9, so add again | 1 + 6 = 7 |
| 4 | Digital root | 7 |

Better example for casting out: **5463729**

- Look for digits that sum to 9: 5+4=9 → cast out (5,4)
- Remaining: 6,3,7,2,9
- 6+3=9 → cast out (6,3)
- Remaining: 7,2,9
- 7+2=9 → cast out (7,2)
- Remaining: 9 → cast out 9
- Result: 0 → digital root = 9 (or 0)

**Wait** — if everything is cast out, the digital root is 9 (not 0, unless the number is actually 0).

### The Casting Out Rule

- When you cast out a group summing to 9, remove that group
- When only 9 remains, digital root = 9
- When nothing remains, digital root = 9 (for non-zero numbers)
- For zero, digital root = 0

---

## 1.5 — Finding Digital Root: Three Methods

### Method 1: Repeated Digit Sum

Add digits repeatedly until single digit.

**Example:** 987654321
- 9+8+7+6+5+4+3+2+1 = 45
- 4+5 = 9
- Digital root = 9

### Method 2: Casting Out Nines

Cross out any digits or groups summing to 9.

**Example:** 987654321
- 9 → cast out
- 8+1=9 → cast out (8,1)
- 7+2=9 → cast out (7,2)
- 6+3=9 → cast out (6,3)
- 5+4=9 → cast out (5,4)
- Nothing remains → digital root = 9

### Method 3: Modulo 9

Digital root = number mod 9, with the result that 9 mod 9 = 9 (not 0).

**Example:** 358 ÷ 9 = 39 remainder 7 → digital root = 7

| Number mod 9 | Digital Root |
|--------------|--------------|
| 0 | 9 (or 0 for zero) |
| 1 | 1 |
| 2 | 2 |
| ... | ... |
| 8 | 8 |

---

## 1.6 — Verification of Addition

### The Rule

For addition: A + B = C

$$ \text{DR}(C) = \text{DR}(\text{DR}(A) + \text{DR}(B)) $$

If the digital roots don't match, the answer is **definitely wrong**.
If they match, the answer is **likely correct** (but not guaranteed — it's a necessary but not sufficient condition).

### Example 1: Verify 358 + 247 = 605

| Step | Calculation |
|------|-------------|
| DR of 358 | 3+5+8=16→1+6=7 |
| DR of 247 | 2+4+7=13→1+3=4 |
| Sum of DRs | 7 + 4 = 11 → 1+1=2 |
| DR of 605 | 6+0+5=11→1+1=2 |
| Match? | Yes ✓ |

### Example 2: Find the error in 1234 + 5678 = 6912

| Step | Calculation |
|------|-------------|
| DR of 1234 | 1+2+3+4=10→1 |
| DR of 5678 | 5+6+7+8=26→2+6=8 |
| Sum of DRs | 1+8=9 |
| DR of 6912 | 6+9+1+2=18→1+8=9 |
| Match? | Yes — so the answer could be correct, but let's check actual: 1234+5678=6912 ✓ |

The check passes, confirming the sum is correct. Now consider an example that contains an error:

**Example 3: 1234 + 5678 = 6900 (incorrect)**

| Step | Calculation |
|------|-------------|
| DR of 1234 | 1 |
| DR of 5678 | 8 |
| Sum of DRs | 1+8=9 |
| DR of 6900 | 6+9+0+0=15→1+5=6 |
| Match? | 9 ≠ 6 → ERROR detected! ✓ |

---

## 1.7 — Verification of Subtraction

### The Rule

For subtraction: A - B = C (where A ≥ B)

$$ \text{DR}(C) = \text{DR}(\text{DR}(A) - \text{DR}(B)) $$

If the subtraction yields a negative number, add 9 until positive.

### Example 1: Verify 582 - 347 = 235

| Step | Calculation |
|------|-------------|
| DR of 582 | 5+8+2=15→1+5=6 |
| DR of 347 | 3+4+7=14→1+4=5 |
| Difference of DRs | 6 - 5 = 1 |
| DR of 235 | 2+3+5=10→1 |
| Match? | Yes ✓ |

### Example 2: Verify 800 - 123 = 677

| Step | Calculation |
|------|-------------|
| DR of 800 | 8+0+0=8 |
| DR of 123 | 1+2+3=6 |
| Difference | 8 - 6 = 2 |
| DR of 677 | 6+7+7=20→2+0=2 |
| Match? | Yes ✓ |

### Example 3: When DR(A) < DR(B)

For 500 - 234 = 266

| Step | Calculation |
|------|-------------|
| DR of 500 | 5 |
| DR of 234 | 2+3+4=9 |
| Difference | 5 - 9 = -4 → -4 + 9 = 5 |
| DR of 266 | 2+6+6=14→1+4=5 |
| Match? | Yes ✓ |

---

## 1.8 — Verification of Multiplication

### The Rule

For multiplication: A × B = C

$$ \text{DR}(C) = \text{DR}(\text{DR}(A) \times \text{DR}(B)) $$

### Example 1: 358 × 74 = 26492 (From your prompt)

| Step | Calculation |
|------|-------------|
| DR of 358 | 3+5+8=16→1+6=7 |
| DR of 74 | 7+4=11→1+1=2 |
| Product of DRs | 7 × 2 = 14 → 1+4=5 |
| DR of 26492 | 2+6+4+9+2=23→2+3=5 |
| Match? | Yes ✓ |

### Example 2: Verify 123 × 456 = 56088

| Step | Calculation |
|------|-------------|
| DR of 123 | 1+2+3=6 |
| DR of 456 | 4+5+6=15→1+5=6 |
| Product of DRs | 6 × 6 = 36 → 3+6=9 |
| DR of 56088 | 5+6+0+8+8=27→2+7=9 |
| Match? | Yes ✓ |

### Example 3: Find the error in 123 × 456 = 56000 (incorrect)

| Step | Calculation |
|------|-------------|
| DR of 123 | 6 |
| DR of 456 | 6 |
| Product of DRs | 6×6=36→9 |
| DR of 56000 | 5+6+0+0+0=11→2 |
| Match? | 9 ≠ 2 → ERROR detected! ✓ |

---

## 1.9 — Verification of Division

### The Rule

For division: Dividend ÷ Divisor = Quotient remainder Remainder

$$ \text{Dividend} = \text{Divisor} \times \text{Quotient} + \text{Remainder} $$

Therefore:

$$ \text{DR}(\text{Dividend}) = \text{DR}\big(\text{DR}(\text{Divisor}) \times \text{DR}(\text{Quotient}) + \text{DR}(\text{Remainder})\big) $$

### Example 1: Verify 1234 ÷ 98 = 12 remainder 58

| Step | Calculation |
|------|-------------|
| DR of Divisor (98) | 9+8=17→1+7=8 |
| DR of Quotient (12) | 1+2=3 |
| Product | 8 × 3 = 24 → 2+4=6 |
| DR of Remainder (58) | 5+8=13→1+3=4 |
| Sum | 6 + 4 = 10 → 1+0=1 |
| DR of Dividend (1234) | 1+2+3+4=10→1 |
| Match? | Yes ✓ |

### Example 2: Verify 5000 ÷ 97 = 51 remainder 53

| Step | Calculation |
|------|-------------|
| DR of 97 | 9+7=16→1+6=7 |
| DR of 51 | 5+1=6 |
| Product | 7×6=42→4+2=6 |
| DR of 53 | 5+3=8 |
| Sum | 6+8=14→1+4=5 |
| DR of 5000 | 5+0+0+0=5 |
| Match? | Yes ✓ |

---

## 1.10 — Limitations of Casting Out Nines

### When Does It Work?

| Situation | Works? | Reason |
|-----------|--------|--------|
| Detecting simple errors | ✓ Yes | Most common mistakes change digit sum |
| Transposition errors (123 → 132) | ✗ No | 1+2+3 = 1+3+2 = 6 |
| Off-by-9 errors (123 → 132 is also 9 difference) | ✗ No | Adding/subtracting 9 doesn't change DR |
| Multiple of 9 errors | ✗ No | 9×n has DR = 9 |

### Examples of Errors NOT Detected

| Correct | Incorrect | DR of both | Detection? |
|---------|-----------|------------|------------|
| 123 | 132 | 6 | ❌ No |
| 45 | 54 | 9 | ❌ No |
| 99 | 108 | 9 | ❌ No |
| 1234 | 1243 | 1 | ❌ No |

### Best Practice

Use casting out nines as a **quick first check**, not as absolute proof. If digital roots don't match, the answer is definitely wrong. If they do match, the answer is probably right (but double-check critical calculations).

---

## 1.11 — Sub-Sutra 12: Vilokanam (By Mere Observation)

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| विलोकनम् | Vilokanam | **By mere observation** |

This sub-sutra reminds us that the digital root can often be found **at a glance** without formal calculation.

**Examples of mere observation:**
- 999 → DR = 9 (all 9s)
- 100 → DR = 1
- 111111111 (nine 1s) → DR = 9
- 123456789 → DR = 9 (1+2+3+4+5+6+7+8+9=45→9)

---

## 1.12 — Applications Beyond Verification

### Application 1: Checking Divisibility by 3 and 9

| Divisible by | Rule using digital root |
|--------------|------------------------|
| 3 | Digital root is 3, 6, or 9 |
| 9 | Digital root is 9 |

**Example:** 123456789 → DR=9 → divisible by 9 and 3 ✓

### Application 2: Finding Missing Digits

If a digit is missing in a product, digital root can help find it.

**Example:** 123 × 45 = 5_35 (missing digit in hundreds place)

| Step | Calculation |
|------|-------------|
| DR of 123 | 6 |
| DR of 45 | 4+5=9 |
| DR of product | 6×9=54→5+4=9 |
| DR of 5_35 | 5+x+3+5=13+x → 1+3+x=4+x |
| Solve | 4+x ≡ 9 mod 9 → x=5 |
| Answer | 5535 |

Check: 123×45 = 5535 ✓

### Application 3: Error Detection in Account Balancing

Accountants use a variation called "casting out nines" to check ledger balances. If the digital roots of debits and credits don't match, there's an error.

---

# PART 2: WORKED EXAMPLES

---

## Section A: Finding Digital Roots

### Example 1

**Question:** Find the digital root of 1234567.

**Answer:**

**Method 1 (Digit Sum):**
1+2+3+4+5+6+7 = 28 → 2+8 = 10 → 1+0 = 1
Digital root = 1

**Method 2 (Casting Out 9s):**
For the digits 1, 2, 3, 4, 5, 6, 7, cast out the pairs that sum to 9: (2,7), (3,6), (4,5).
After casting those pairs, only the digit 1 remains → DR = 1 ✓

---

### Example 2

**Question:** Find the digital root of 999999.

**Answer:**

All digits are 9. 9+9+9+9+9+9 = 54 → 5+4 = 9
Digital root = 9

**Casting out:** All digits are 9 → cast out each 9 → nothing remains → DR = 9

---

### Example 3

**Question:** Find the digital root of 1000000.

**Answer:**

1+0+0+0+0+0+0 = 1
Digital root = 1

---

### Example 4

**Question:** Find the digital root of 123456789.

**Answer:**

Sum = 45 → 4+5 = 9
Digital root = 9

---

## Section B: Addition Verification

### Example 5

**Question:** Verify 12345 + 67890 = 80235 using digital roots.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 12345 | 1+2+3+4+5=15→1+5=6 |
| DR of 67890 | 6+7+8+9+0=30→3+0=3 |
| Sum of DRs | 6+3=9 |
| DR of 80235 | 8+0+2+3+5=18→1+8=9 |
| Result | Matches ✓ |

---

### Example 6

**Question:** The sum 4567 + 8912 = 13479 is suspected to have an error. Verify.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 4567 | 4+5+6+7=22→2+2=4 |
| DR of 8912 | 8+9+1+2=20→2+0=2 |
| Sum of DRs | 4+2=6 |
| DR of 13479 | 1+3+4+7+9=24→2+4=6 |
| Match? | Yes, so answer is likely correct |

Actual: 4567+8912=13479 ✓

---

### Example 7

**Question:** Find the error in 999 + 888 = 1887 (without actually calculating).

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 999 | 9 |
| DR of 888 | 8+8+8=24→2+4=6 |
| Sum of DRs | 9+6=15→1+5=6 |
| DR of 1887 | 1+8+8+7=24→2+4=6 |
| DRs match, so error might not be caught. Actual: 999+888=1887 ✓ It's correct. |

Let me make an incorrect example: 999+888 = 1880

| Step | Calculation |
|------|-------------|
| DR of 1880 | 1+8+8+0=17→1+7=8 |
| Sum of DRs was 6 | 8 ≠ 6 → ERROR detected! |

---

## Section C: Subtraction Verification

### Example 8

**Question:** Verify 1000 - 365 = 635.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 1000 | 1+0+0+0=1 |
| DR of 365 | 3+6+5=14→1+4=5 |
| Difference | 1 - 5 = -4 → -4+9=5 |
| DR of 635 | 6+3+5=14→1+4=5 |
| Matches ✓ |

Actual: 1000-365=635 ✓

---

### Example 9

**Question:** Verify 5000 - 1234 = 3766.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 5000 | 5 |
| DR of 1234 | 1+2+3+4=10→1 |
| Difference | 5 - 1 = 4 |
| DR of 3766 | 3+7+6+6=22→2+2=4 |
| Matches ✓ |

---

### Example 10

**Question:** Find the error in 800 - 357 = 443 (incorrect — correct is 443? Actually 800-357=443 is correct!)

Let me give an incorrect: 800 - 357 = 453

| Step | Calculation |
|------|-------------|
| DR of 800 | 8 |
| DR of 357 | 3+5+7=15→1+5=6 |
| Difference | 8-6=2 |
| DR of 453 | 4+5+3=12→1+2=3 |
| 2 ≠ 3 → ERROR detected! |

---

## Section D: Multiplication Verification

### Example 11

**Question:** Verify 123 × 456 = 56088 (from earlier).

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 123 | 1+2+3=6 |
| DR of 456 | 4+5+6=15→1+5=6 |
| Product of DRs | 6×6=36→3+6=9 |
| DR of 56088 | 5+6+0+8+8=27→2+7=9 |
| Matches ✓ |

---

### Example 12

**Question:** Verify 97 × 96 = 9312 (from Module 4).

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 97 | 9+7=16→1+6=7 |
| DR of 96 | 9+6=15→1+5=6 |
| Product of DRs | 7×6=42→4+2=6 |
| DR of 9312 | 9+3+1+2=15→1+5=6 |
| Matches ✓ |

---

### Example 13

**Question:** Find the error in 358 × 74 = 26490 (instead of 26492).

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 358 | 7 |
| DR of 74 | 2 |
| Product of DRs | 7×2=14→5 |
| DR of 26490 | 2+6+4+9+0=21→2+1=3 |
| 5 ≠ 3 → ERROR detected! ✓ |

---

### Example 14

**Question:** Verify 999 × 999 = 998001.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 999 | 9 |
| DR of 999 | 9 |
| Product of DRs | 9×9=81→8+1=9 |
| DR of 998001 | 9+9+8+0+0+1=27→2+7=9 |
| Matches ✓ |

---

## Section E: Division Verification

### Example 15

**Question:** Verify 12345 ÷ 98 = 125 remainder 95.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of Divisor (98) | 9+8=17→1+7=8 |
| DR of Quotient (125) | 1+2+5=8 |
| Product | 8×8=64→6+4=10→1+0=1 |
| DR of Remainder (95) | 9+5=14→1+4=5 |
| Sum | 1+5=6 |
| DR of Dividend (12345) | 1+2+3+4+5=15→1+5=6 |
| Matches ✓ |

Check: 98×125=12250, +95=12345 ✓

---

### Example 16

**Question:** Verify 5000 ÷ 99 = 50 remainder 50.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 99 | 9+9=18→1+8=9 |
| DR of 50 | 5+0=5 |
| Product | 9×5=45→4+5=9 |
| DR of 50 (remainder) | 5 |
| Sum | 9+5=14→1+4=5 |
| DR of 5000 | 5 |
| Matches ✓ |

Check: 99×50=4950, +50=5000 ✓

---

## Section F: Error Detection & Missing Digits

### Example 17

**Question:** A multiplication 123 × 45 = 5_35 has a missing digit. Find it.

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 123 | 6 |
| DR of 45 | 9 |
| DR of correct product | 6×9=54→5+4=9 |
| Let missing digit be x. DR of 5x35 | 5+x+3+5=13+x → 1+3+x=4+x |
| Solve: 4+x ≡ 9 (mod 9) → x ≡ 5 (mod 9) |
| x is a digit (0-9), so x = 5 |
| Answer: 5535 |

---

### Example 18

**Question:** Is 123456789 × 987654321 = 121932631112635269 correct? (Use digital roots to check.)

**Answer:**

| Step | Calculation |
|------|-------------|
| DR of 123456789 | 1+2+3+4+5+6+7+8+9=45→9 |
| DR of 987654321 | 9+8+7+6+5+4+3+2+1=45→9 |
| Product of DRs | 9×9=81→9 |
| DR of result | Sum digits of 121932631112635269 |
| Quick sum: 1+2+1+9+3+2+6+3+1+1+1+2+6+3+5+2+6+9 = 63 → 6+3=9 |
| Matches ✓ (likely correct) |

---

# PART 3: PRACTICE EXERCISES

---

## Exercise Set A: Finding Digital Roots (20 Questions)

*Find the digital root of each number. Use casting out nines where helpful.*

**A1.** 45
**A2.** 99
**A3.** 100
**A4.** 358
**A5.** 777
**A6.** 1234
**A7.** 5678
**A8.** 9999
**A9.** 10000
**A10.** 12345
**A11.** 98765
**A12.** 111111
**A13.** 121212
**A14.** 12345678
**A15.** 987654321
**A16.** 1000000
**A17.** 55555
**A18.** 888888
**A19.** 135792468
**A20.** 0

---

## Exercise Set B: Addition Verification (15 Questions)

*Use digital roots to verify each addition. Mark ✓ if correct, ✗ if incorrect.*

**B1.** 123 + 456 = 579
**B2.** 789 + 321 = 1110
**B3.** 999 + 111 = 1110
**B4.** 1234 + 5678 = 6912
**B5.** 9876 + 5432 = 15308
**B6.** 1111 + 2222 = 3333
**B7.** 5555 + 4444 = 9999
**B8.** 12345 + 67890 = 80235
**B9.** 54321 + 98765 = 153086
**B10.** 1000 + 2000 = 3000
**B11.** 1357 + 2468 = 3825
**B12.** 9876 + 1234 = 11110
**B13.** 45678 + 98765 = 144443
**B14.** 999999 + 1 = 1000000
**B15.** 77777 + 22222 = 100000

---

## Exercise Set C: Subtraction Verification (15 Questions)

*Use digital roots to verify each subtraction.*

**C1.** 500 - 234 = 266
**C2.** 1000 - 365 = 635
**C3.** 800 - 357 = 443
**C4.** 10000 - 1234 = 8766
**C5.** 5000 - 1234 = 3766
**C6.** 100 - 1 = 99
**C7.** 1000 - 999 = 1
**C8.** 5555 - 1234 = 4321
**C9.** 9876 - 5432 = 4444
**C10.** 12345 - 6789 = 5556
**C11.** 100000 - 1 = 99999
**C12.** 9000 - 1111 = 7889
**C13.** 7777 - 5555 = 2222
**C14.** 8642 - 1357 = 7285
**C15.** 1000000 - 123456 = 876544

---

## Exercise Set D: Multiplication Verification (20 Questions)

*Use digital roots to verify each multiplication.*

**D1.** 12 × 12 = 144
**D2.** 15 × 15 = 225
**D3.** 25 × 25 = 625
**D4.** 37 × 37 = 1369
**D5.** 99 × 99 = 9801
**D6.** 101 × 101 = 10201
**D7.** 123 × 45 = 5535
**D8.** 456 × 78 = 35568
**D9.** 789 × 12 = 9468
**D10.** 999 × 1 = 999
**D11.** 111 × 111 = 12321
**D12.** 358 × 74 = 26492
**D13.** 97 × 96 = 9312
**D14.** 103 × 104 = 10712
**D15.** 998 × 997 = 995006
**D16.** 1234 × 56 = 69104
**D17.** 5678 × 90 = 511020
**D18.** 1357 × 2468 = 3349676
**D19.** 9876 × 5432 = 53651232
**D20.** 9999 × 9999 = 99980001

---

## Exercise Set E: Division Verification (15 Questions)

*Use digital roots to verify each division.*

**E1.** 123 ÷ 9 = 13 R6
**E2.** 456 ÷ 8 = 57 R0
**E3.** 789 ÷ 7 = 112 R5
**E4.** 1234 ÷ 98 = 12 R58
**E5.** 2345 ÷ 97 = 24 R17
**E6.** 3456 ÷ 96 = 36 R0
**E7.** 4567 ÷ 95 = 48 R7
**E8.** 5000 ÷ 99 = 50 R50
**E9.** 12345 ÷ 97 = 127 R26
**E10.** 23456 ÷ 98 = 239 R34
**E11.** 123456 ÷ 998 = 123 R702
**E12.** 100000 ÷ 999 = 100 R100
**E13.** 88888 ÷ 9 = 9876 R4
**E14.** 77777 ÷ 8 = 9722 R1
**E15.** 55555 ÷ 7 = 7936 R3

---

## Exercise Set F: Missing Digit Problems (10 Questions)

*Find the missing digit (represented by x) in each equation.*

**F1.** 123 + 45x = 578 (find x)
**F2.** 789 - 4x2 = 367 (find x)
**F3.** 45 × 67 = 30x5 (find x)
**F4.** 98 × 97 = 95x6 (find x)
**F5.** 1234 ÷ 98 = 12 R5x (find x)
**F6.** 56x × 12 = 6756 (find x)
**F7.** 7890 - 345x = 4443 (find x)
**F8.** 111 × 11x = 12321 (find x)
**F9.** 999 ÷ 9 = 111 (missing? 111? Actually 999÷9=111, so no missing — let me make one: 123x ÷ 11 = 112 R2, find x)
**F10.** 5000 - x234 = 3766 (find x)

---

## Answer Key for Practice Exercises

### Set A Answers (Digital Roots):
A1. 9 | A2. 9 | A3. 1 | A4. 7 | A5. 3 (7+7+7=21→3) | A6. 1 | A7. 8 (5+6+7+8=26→8) | A8. 9 | A9. 1 | A10. 6 | A11. 8 (9+8+7+6+5=35→8) | A12. 6 (six 1s = 6) | A13. 9 (1+2+1+2+1+2=9) | A14. 9 | A15. 9 | A16. 1 | A17. 7 (5×5=25→7? Wait 5+5+5+5+5=25→7) | A18. 3 (8×6=48→12→3) | A19. 9 | A20. 0

### Set B Answers (Addition):
B1. ✓ | B2. ✓ (789+321=1110) | B3. ✓ | B4. ✓ | B5. ✓ (9876+5432=15308) | B6. ✓ | B7. ✓ | B8. ✓ | B9. ✓ | B10. ✓ | B11. ✓ (1357+2468=3825) | B12. ✓ | B13. ✓ | B14. ✓ | B15. ✗ (77777+22222=99999, not 100000)

### Set C Answers (Subtraction):
C1. ✓ | C2. ✓ | C3. ✓ | C4. ✓ | C5. ✓ | C6. ✓ | C7. ✓ | C8. ✓ | C9. ✓ | C10. ✓ (12345-6789=5556) | C11. ✓ | C12. ✓ | C13. ✓ | C14. ✓ | C15. ✓

### Set D Answers (Multiplication):
D1. ✓ | D2. ✓ | D3. ✓ | D4. ✓ | D5. ✓ | D6. ✓ | D7. ✓ | D8. ✓ | D9. ✓ | D10. ✓ | D11. ✓ | D12. ✓ | D13. ✓ | D14. ✓ | D15. ✓ | D16. ✓ | D17. ✓ | D18. ✓ | D19. ✓ | D20. ✓

### Set E Answers (Division):
E1. ✓ | E2. ✓ | E3. ✓ | E4. ✓ | E5. ✓ | E6. ✓ | E7. ✓ | E8. ✓ | E9. ✓ | E10. ✓ | E11. ✓ | E12. ✓ | E13. ✓ | E14. ✓ | E15. ✓

### Set F Answers (Missing Digits):
F1. x=5 (123 + 45x = 578 → 45x = 455) | F2. x=2 (789−422=367) | F3. x=1 (45×67=3015) | F4. x=0 (98×97=9506) | F5. x=8 (12×98=1176, 1234−1176=58) | F6. x=3 (563×12=6756) | F7. x=4 (7890−3447=4443) | F8. x=1 (111×111=12321) | F9. x=4 (1234÷11=112 R2) | F10. x=1 (5000−1234=3766)

---

# PART 4: ONLINE TEST BANK

---

## 📝 TEST 1: Digital Roots & Basic Verification
**Format:** Multiple Choice Questions (MCQ)
**Total Marks:** 20 | **Time:** 15 minutes

---

**Q1.** [EASY] The digital root of 358 is:
- A) 5
- B) 6
- C) 7 ✅
- D) 8

---

**Q2.** [EASY] The digital root of 999 is:
- A) 0
- B) 9 ✅
- C) 27
- D) 3

---

**Q3.** [EASY] The digital root of 1000 is:
- A) 0
- B) 9
- C) 1 ✅
- D) 10

---

**Q4.** [EASY] Which number has digital root 9?
- A) 123
- B) 456
- C) 789 ✅
- D) 100

---

**Q5.** [EASY] Sutra 15 "Gunitasamuccayah" means:
- A) All from 9 and last from 10
- B) The product of the sum equals the sum of the products ✅
- C) By mere observation
- D) Transpose and apply

---

**Q6.** [EASY] Casting out nines is a shortcut for finding:
- A) Digital root ✅
- B) Square root
- C) Cube root
- D) Prime factors

---

**Q7.** [MEDIUM] The digital root of 12345678 is:
- A) 1
- B) 4
- C) 9 ✅
- D) 36

---

**Q8.** [MEDIUM] For multiplication verification, DR(A × B) = ?
- A) DR(A) + DR(B)
- B) DR(A) - DR(B)
- C) DR(DR(A) × DR(B)) ✅
- D) DR(A) × DR(B)

---

**Q9.** [MEDIUM] 123 + 456 = 579. Digital root check shows:
- A) Match ✓ ✅
- B) No match
- C) Cannot be verified
- D) DR=0

---

**Q10.** [MEDIUM] 500 - 234 = 266. Digital root check:
- A) Match ✓ ✅
- B) No match
- C) Need more digits
- D) DR of 500 is 0

---

**Q11.** [MEDIUM] For subtraction, when DR(A) < DR(B), you should:
- A) Add 0
- B) Add 9 ✅
- C) Subtract 9
- D) Multiply by 9

---

**Q12.** [MEDIUM] The nine-point circle places which digit at the top?
- A) 1
- B) 5
- C) 9 ✅
- D) 0

---

**Q13.** [MEDIUM] Which error would NOT be caught by casting out nines?
- A) 123 → 132 ✅
- B) 123 → 124
- C) 123 → 223
- D) 123 → 113

---

**Q14.** [HARD] The digital root of 987654321 is:
- A) 1
- B) 5
- C) 9 ✅
- D) 45

---

**Q15.** [HARD] 358 × 74 = 26492. The digital root of the product is:
- A) 5 ✅
- B) 7
- C) 2
- D) 4

---

**Q16.** [EASY] Sub-Sutra 12 "Vilokanam" means:
- A) By mere observation ✅
- B) By addition and subtraction
- C) By one less than previous
- D) Vertically and cross-wise

---

**Q17.** [MEDIUM] A number is divisible by 9 if its digital root is:
- A) 0
- B) 3
- C) 6
- D) 9 ✅

---

**Q18.** [MEDIUM] 12345 ÷ 9 = 1371 R6. The digital root check for division uses the formula:
- A) DR(Dividend) = DR(DR(Divisor) × DR(Quotient) + DR(Remainder)) ✅
- B) DR(Dividend) = DR(Divisor) + DR(Quotient) + DR(Remainder)
- C) DR(Dividend) = DR(Divisor) × DR(Quotient) × DR(Remainder)
- D) None of the above

---

**Q19.** [HARD] If a multiplication has digital root 5 and one factor has digital root 7, the other factor's digital root must be:
- A) 2
- B) 8
- C) Both A and B? 7×2=14→5, 7×8=56→11→2, so 2 works. 7×5=35→8, not 5. 7×1=7, not 5. So only 2? Check: 7×2=14→5 ✓. 7×?= 7×? mod9. Since 7×2=14≡5 mod9, other DR=2. ✅
- D) None

---

**Q20.** [HARD] Which verification method uses digital roots?
- A) Casting out nines ✅
- B) Casting out elevens
- C) Casting out sevens
- D) Casting out threes

---

## 📝 TEST 2: Verification Practice
**Format:** True/False + Fill in the blank
**Total Marks:** 25 | **Time:** 15 minutes

---

**Q1.** [EASY — T/F] Digital root is also called Beejank. **True**

**Q2.** [EASY — T/F] Casting out nines can detect all multiplication errors. **False**

**Q3.** [EASY — T/F] The nine-point circle shows that adding 9 returns to the same point. **True**

**Q4.** [EASY — T/F] A number with digital root 9 is always divisible by 9. **True**

**Q5.** [MEDIUM — T/F] 123 + 456 = 579 passes digital root verification. **True**

**Q6.** [MEDIUM — T/F] 500 - 234 = 266 fails digital root verification. **False** (it passes)

**Q7.** [MEDIUM — T/F] For multiplication, DR(A) × DR(B) always equals DR(A×B). **False** (need to take DR of the product)

**Q8.** [MEDIUM — T/F] The digital root of 0 is 0. **True**

**Q9.** [MEDIUM — Fill] The digital root of 13579 is _____.
**Answer:** 7 (1+3+5+7+9=25→7)

**Q10.** [MEDIUM — Fill] The digital root of 9999999 is _____.
**Answer:** 9

**Q11.** [MEDIUM — Fill] For subtraction, if DR(A)=3 and DR(B)=7, the adjusted DR difference is _____.
**Answer:** 5 (3-7=-4, +9=5)

**Q12.** [MEDIUM — Fill] The Sanskrit word for "seed number" is _____.
**Answer:** Beejank

**Q13.** [HARD — Fill] A multiplication is correct if the digital root of the product equals the digital root of the product of the _____.
**Answer:** digital roots

**Q14.** [HARD — Fill] The nine-point circle has _____ points.
**Answer:** 9

**Q15.** [HARD — Fill] If 123x × 45 = 5535, and DR(123x)=6, then x = _____.
**Answer:** 5

---

## 📝 TEST 3: Error Detection
**Format:** MCQ + Short Answer
**Total Marks:** 20 | **Time:** 10 minutes

---

**Q1.** [EASY] A student reports 123 + 456 = 578. Digital root check shows:
- A) Correct
- B) Wrong (DR 579=3, DR sum=3? Actually 123+456=579, not 578. DR 578=2, DR sum=6? Let me check: 123 DR=6, 456 DR=6, sum DR=12→3. 578 DR=5+7+8=20→2. 3≠2 → Wrong) ✅

**Q2.** [EASY] Which error would NOT be caught by casting out nines?
- A) 12 × 12 = 144 written as 141
- B) 12 × 12 = 144 written as 144 (correct)
- C) 12 × 12 = 144 written as 134
- D) 12 × 12 = 144 written as 414 ✅ (transposition, DR unchanged)

**Q3.** [MEDIUM] 358 × 74 = 26492. After changing the answer to 26490, digital root check shows:
- A) Still correct
- B) Error detected ✅ (DR 26490=3, should be 5)

**Q4.** [MEDIUM] 1000 - 365 = 635. If someone writes 645 instead:
- A) Error detected ✅ (DR 645=6, should be 5)
- B) Error not detected
- C) Check inconclusive

**Q5.** [HARD] A missing digit problem: 123 × 45 = 5x35. The missing digit x is:
- A) 3
- B) 5 ✅
- C) 7
- D) 9

**Q6.** [HARD — Short] Explain why transposition errors (like 123 written as 132) are not caught by casting out nines.
**Answer:** Because the sum of digits remains the same (1+2+3=1+3+2=6), so the digital root is unchanged.

**Q7.** [MEDIUM — Short] What is the nine-point circle used for?
**Answer:** The nine-point circle visualizes digital roots and modular arithmetic mod 9. Moving clockwise adds 1, and 9 is at the top representing both 9 and 0 mod 9.

**Q8.** [EASY — Short] State Sutra 15 in English.
**Answer:** "The product of the sum equals the sum of the products."

**Q9.** [MEDIUM — Short] For division verification, write the formula using digital roots.
**Answer:** DR(Dividend) = DR( DR(Divisor) × DR(Quotient) + DR(Remainder) )

**Q10.** [MEDIUM — Short] What is the difference between digital root of zero and digital root of nine?
**Answer:** Zero has digital root 0. Any non-zero number with digital root 9 (like 9, 18, 27, 99, etc.) has digital root 9.

---

## 📝 TEST 4: Comprehensive Module Test
**Format:** Mixed (MCQ + Fill-in + Short Answer)
**Total Marks:** 50 | **Time:** 30 minutes

---

**Section 1: MCQ (20 Marks, 1 mark each)**

**Q1.** [E] Digital root of 358 = : 5 / 6 / **7** / 8
**Q2.** [E] Digital root of 9999 = : 1 / 8 / **9** / 0
**Q3.** [E] 123 + 456 = 579 passes verification? : **Yes** / No
**Q4.** [E] 500 - 234 = 266 passes? : **Yes** / No
**Q5.** [M] 358 × 74 = 26492 DR product = : 3 / 4 / **5** / 6
**Q6.** [M] Which is NOT caught by casting out nines? : 12→21 / **45→54** / 123→124 / 456→466
**Q7.** [M] The nine-point circle has : 8 points / **9 points** / 10 points / 12 points
**Q8.** [M] If DR(A)=7 and DR(B)=8, DR(A×B)= : 56 / 11 / **2** / 7
**Q9.** [M] Beejank means : **Seed number** / Root number / Leaf number / Flower number
**Q10.** [M] 1234 ÷ 98 = 12 R58 passes? : **Yes** / No
**Q11.** [M] For subtraction, if DR(A)=2, DR(B)=8, adjusted = : 6 / **3** / 4 / 5
**Q12.** [M] A number with DR=9 is always divisible by : 2 / 3 / 5 / **9**
**Q13.** [M] Vilokanam means : **By mere observation** / By transposition / By addition / By subtraction
**Q14.** [M] 13579 ÷ 9 = 1508 R7 passes? : **Yes** / No
**Q15.** [M] Digital root is essentially the number mod : 8 / 9 / **9 (with 9≠0)** / 10
**Q16.** [M] 1000000 DR = : 0 / **1** / 9 / 6
**Q17.** [M] 123456789 DR = : 1 / 8 / **9** / 5
**Q18.** [M] If DR(A)=9 and DR(B)=5, DR(A×B)= : 14 / **9** / 5 / 45
**Q19.** [M] The main limitation of casting out nines is : **It misses transpositions** / It is slow / It requires calculator / It works only for addition
**Q20.** [H] 987654321 × 123456789 has DR : 1 / **9** / 5 / 3

---

**Section 2: Fill in the Blank (15 Marks, 1 mark each)**

**Q21.** DR(7777) = _____.
*Answer: 1 (7+7+7+7=28→10→1)*

**Q22.** DR(888888) = _____.
*Answer: 3 (8×6=48→12→3)*

**Q23.** 1234 + 5678 = 6912 passes verification? _____.
*Answer: Yes*

**Q24.** 5000 - 1234 = 3766 passes? _____.
*Answer: Yes*

**Q25.** 456 × 78 = 35568 passes? _____.
*Answer: Yes*

**Q26.** The Sanskrit word for digital root is _____.
*Answer: Beejank*

**Q27.** The nine-point circle has the digit _____ at the top.
*Answer: 9*

**Q28.** For multiplication verification, use _____ of 9s.
*Answer: Casting out*

**Q29.** If DR(Quotient)=4 and DR(Divisor)=7, product DR = _____.
*Answer: 1 (4×7=28→10→1)*

**Q30.** A number with digital root _____ is divisible by 3 but not by 9.
*Answer: 3 or 6*

**Q31.** DR(1000000000) = _____.
*Answer: 1*

**Q32.** The product of any number with digital root 9 has digital root _____.
*Answer: 9*

**Q33.** In the nine-point circle, adding _____ returns to the same point.
*Answer: 9*

**Q34.** Sub-Sutra 12, Vilokanam, means "by _____".
*Answer: mere observation*

**Q35.** The digital root of the sum of digits of 123456789 is _____.
*Answer: 9*

---

**Section 3: Short Answer (15 Marks)**

**Q36.** [3 marks] Find the digital root of 135792468 using the casting out nines method. Show your work.

*Answer:*
Digits: 1,3,5,7,9,2,4,6,8
Cast out pairs summing to 9: (1,8), (3,6), (5,4), (2,7)
Remaining: 9 → cast out 9
Nothing remains → digital root = 9

---

**Q37.** [3 marks] Verify 12345 × 6789 = 83810205 using digital roots. Show all steps.

*Answer:*
DR of 12345: 1+2+3+4+5=15→1+5=6
DR of 6789: 6+7+8+9=30→3+0=3
Product of DRs: 6×3=18→1+8=9
DR of 83810205: 8+3+8+1+0+2+0+5=27→2+7=9
Match ✓, so answer is likely correct.

---

**Q38.** [3 marks] A student calculates 98765 × 4321 = 426,756,?65 (last digit missing). The digital root of the known part is 4 and the first factor's DR is 8, second factor's DR is 1. Is the product correct? Find the missing last two digits if possible.

*Answer:*
DR(98765)=9+8+7+6+5=35→8
DR(4321)=4+3+2+1=10→1
DR(product) should be 8×1=8
Given product DR=4, so answer is incorrect.
Cannot determine missing digits without more information.

---

**Q39.** [3 marks] Why does casting out nines fail to detect transposition errors? Give an example.

*Answer:*
Casting out nines uses the sum of digits mod 9. Transposing digits doesn't change the sum.
Example: 123 and 132 both have sum 6, so digital root 6. Therefore an error where 123×45=5535 becomes 132×45=5940 would have DR(132)=6, same as correct, so the error might not be caught.

---

**Q40.** [3 marks — HARD] The product 111111111 × 111111111 = 12345678987654321. Verify using digital roots. What does this tell you about the number?

*Answer:*
DR of 111111111: sum of nine 1s = 9 → DR=9
DR of product should be 9×9=81→9
DR of 12345678987654321: sum digits = (1+2+3+4+5+6+7+8+9)×2 - 9? Actually symmetric sum: 1 through 9 sum=45, reverse 8 through 1 sum=36? Let me sum: 1+2+3+4+5+6+7+8+9+8+7+6+5+4+3+2+1 = 45+36=81 → 8+1=9 ✓
This shows the product is divisible by 9 (and 3), but more importantly, it confirms the beautiful palindromic pattern is mathematically consistent.

---

# PART 5: TEACHER'S GUIDE & ASSESSMENT RUBRIC

---

## Classroom Activities

### Activity 1: Digital Root Bingo
**Objective:** Practice finding digital roots quickly
**Materials:** Bingo cards with numbers, teacher calls out numbers
**Rules:** Students find digital root and mark if on card
**Duration:** 15 minutes

### Activity 2: Error Detective
**Objective:** Use digital roots to find calculation errors
**Materials:** Worksheet with intentionally wrong calculations
**Procedure:** Students find errors using casting out nines
**Duration:** 15 minutes

### Activity 3: Nine-Point Circle Dance
**Objective:** Internalize mod 9 addition
**Procedure:** Students stand in circle labeled 1-9. Teacher calls addition problems; students move to answer position.
**Duration:** 10 minutes

### Activity 4: Missing Digit Challenge
**Objective:** Apply digital roots to find missing digits
**Materials:** Puzzle worksheet with missing digits in products
**Duration:** 15 minutes

---

## Grading Rubric

| Component | Marks |
|-----------|-------|
| Test 1 (Digital Roots) | 20 |
| Test 2 (Verification) | 25 |
| Test 3 (Error Detection) | 20 |
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
| Digital root of 0 as 9 | Zero's digital root is 0, not 9 |
| Forgetting to take DR of product in multiplication check | Verify: DR(A×B) = DR(DR(A)×DR(B)), not just DR(A)×DR(B) |
| Subtraction when DR(A) < DR(B) | Add 9 to DR(A) before subtracting |
| Thinking casting out nines catches all errors | It misses transpositions and off-by-9 errors |
| Confusing digital root with remainder mod 9 | 9 mod 9 = 0, but digital root of 9 is 9 |

---

# QUICK REFERENCE CARD

## Module 8 Summary Sheet (Print-Friendly)

```
╔═══════════════════════════════════════════════════════════════════════╗
║           DIGITAL ROOTS & CASTING OUT NINES — CHEAT SHEET             ║
╠═══════════════════════════════════════════════════════════════════════╣
║ SUTRA 15:  Gunitasamuccayah — "The product of the sum equals          ║
║            the sum of the products"                                   ║
║ SUB-SUTRA 12: Vilokanam — "By mere observation"                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  DIGITAL ROOT (Beejank) — Sum digits repeatedly until 1 digit.        ║
║  ┌─────────────────────────────────────────────────────────┐          ║
║  │ 358 → 3+5+8=16 → 1+6=7                                  │          ║
║  │ Casting out 9s: cross out 9s and pairs summing to 9     │          ║
║  └─────────────────────────────────────────────────────────┘          ║
║                                                                       ║
║  VERIFICATION FORMULAS:                                              ║
║  ┌─────────────────────────────────────────────────────────┐          ║
║  │ Addition:   DR(A+B)   = DR(DR(A) + DR(B))               │          ║
║  │ Subtraction: DR(A-B)   = DR(DR(A) - DR(B)) [add 9 if -] │          ║
║  │ Multiply:   DR(A×B)   = DR(DR(A) × DR(B))               │          ║
║  │ Division:   DR(Dividend) = DR(DR(D)×DR(Q) + DR(R))      │          ║
║  └─────────────────────────────────────────────────────────┘          ║
║                                                                       ║
║  NINE-POINT CIRCLE (digits arranged by digital root, mod 9):          ║
║                                                                       ║
║                    9 (0)                                              ║
║                  /        \                                           ║
║                8            1                                         ║
║               /              \                                        ║
║              7                2                                       ║
║              |       ●        |                                       ║
║              6                3                                       ║
║                             /                                         ║
║                5            4                                         ║
║                          /                                            ║
║          (the cycle then repeats: 9, 1, 2, ... , 8, back to 9)        ║
║                                                                       ║
║  LIMITATIONS:                                                         ║
║  ✗ Does NOT detect transposition errors (123 vs 132)                 ║
║  ✗ Does NOT detect off-by-9 errors (adding or subtracting 9)         ║
║  ✓ Quick first check — if DRs don't match, answer is definitely wrong║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

*End of Module 8 — Complete Study Material*
*Total Questions in Test Bank: 90+ questions across 4 tests*
*Next: Module 9 — Squaring & Cubing Methods (Sutra 1: Ekadhikena Purvena, Sutra 10: Yavadunam)*

---
*Document Version 1.0 | Vedic Mathematics Level 1 Foundation Course*
*Designed for Free World-Class Online Tutorial Platform*