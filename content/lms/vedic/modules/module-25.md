# 🕉️ VEDIC MATHEMATICS — LEVEL 3: ADVANCED

# MODULE 25: Statistics & Probability — Vedic Computation

## Complete Study Material | Theory + Examples + Practice + Test Bank

---

> "Through Vyashti-Samashti, the chaotic field of raw data resolves into an orderly relationship between the isolated point and the complete system."
> — Kenneth Williams, Vedic Mathematics Teacher

---

## 📋 MODULE AT A GLANCE

| Item | Details |
| --- | --- |
| Level | Advanced (Level 3) |
| Module Number | 25 of 30 |
| Target Age | 16–18 years / Grade 11–12 (Also highly beneficial for JEE, CAT, and Statistical Data Analysis) |
| Duration | 6–7 hours (Theory: 2.5 hrs, Practice: 3 hrs, Test: 1.5 hrs) |
| Prerequisites | Core arithmetic arithmetic, basic data sets, introductory probability ratios |
| Sutra Focus | Sutra 11: Vyashti-Samashti (Part and Whole) & Sub-Sutra 1: Anurupyena (Proportionately) |
| Next Module | Module 26: Coordinate Geometry — Pure Vedic Analytical Transformations |

---

## 🎯 LEARNING OUTCOMES

By the end of this module, the student will be able to:

1. Use Anurupyena (proportionality) to determine the mean, median, and mode of large numeric datasets without raw accumulation.
2. Calculate variance and standard deviation using the Vedic working mean deviation strategy.
3. Compute Pearson's correlation coefficient ($r$) using Urdhva-Tiryak mental cross-products.
4. Solve complex permutation ($^nP_r$) and combination ($^nC_r$) problems line-by-line using rapid structural factorial reduction patterns.
5. Expand and compute Binomial Distribution probabilities mentally using symmetric path analysis.
6. Map complex multi-stage compound probabilities onto visual Vyashti-Samashti (Part-Whole) tree structures.
7. Solve conditional inverse probability cases under Bayes' Theorem through immediate single-line cell weight balancing.

---

---

# PART 1: THEORY

---

## 1.1 — Central Tendency: Mean, Median, Mode via Anurupyena

When working with large data matrices, conventional statistical calculation methods demand that every single value be mechanically summed up and divided ($\bar{x} = \frac{\sum x}{n}$). This approach easily leads to calculation errors when processing multi-digit data fields.

Vedic statistics uses the principle of Anurupyena (Proportionately). Instead of accumulating massive data values, we isolate a localized structural base or Assumed Mean ($A$). Every data point is then scaled down to its relative deficiency or surplus deviation vector ($d = x - A$).

The true mean is extracted by finding the balancing scale factor of these deviations and applying it directly to the base:

$$\bar{x} = A + \frac{\sum d}{n}$$

For grouped frequency data sets, Anurupyena transforms raw intervals into direct step-ratios, scaling values down to single-digit operations. Median and Mode computations leverage this same proportional interpolation framework to target exact positions inside data blocks without demanding cumbersome multi-layer formula memorization.

---

## 1.2 — Variance & Standard Deviation via Working Mean Method

Variance ($\sigma^2$) and Standard Deviation ($\sigma$) quantify the internal dispersion or structural spread of individual elements (Vyashti) around the complete system identity (Samashti).

Vedic computation avoids the complex squaring of large numbers by combining our deviation vectors ($d$) with the structural alignment of an assumed working base. The complete variance formula updates to:

$$\sigma^2 = \frac{\sum d^2}{n} - \left(\frac{\sum d}{n}\right)^2$$

### Side-by-Side Comparison

Problem: Calculate the Variance of the dataset: $98, 102, 105, 97, 98$

---

Conventional School Method:

1. Calculate long arithmetic raw average:

$$\bar{x} = \frac{98 + 102 + 105 + 97 + 98}{5} = \frac{500}{5} = 100$$


2. Find every individual absolute deviation distance:

$$(98-100), (102-100), (105-100), (97-100), (98-100) \rightarrow -2, 2, 5, -3, -2$$


3. Square each individual result value: $4, 4, 25, 9, 4$
4. Sum the squared variations: $\sum (x-\bar{x})^2 = 4 + 4 + 25 + 9 + 4 = 46$
5. Divide by the total elements: $\sigma^2 = \frac{46}{5} = 9.2$

Time: ~40 seconds | Writing: Multiple rows of scratchpad arithmetic.

---

Vedic Deviation Method (Anurupyena):

1. Select working base anchor $A = 100$ instantly by scanning.
2. List small relative deviations ($d$): $-2, +2, +5, -3, -2$
3. Compute operational metrics mentally in columns:
 $\sum d = -2 + 2 + 5 - 3 - 2 = 0$
 $\sum d^2 = 4 + 4 + 25 + 9 + 4 = 46$


4. Drop metrics into the structural equation:

$$\sigma^2 = \frac{46}{5} - \left(\frac{0}{5}\right)^2 = 9.2 - 0 = \mathbf{9.2}$$



Time: ~5 seconds | Writing: Minimal scratchpad lines.

---

## 1.3 — Correlation Coefficient: Urdhva-Tiryak Cross-Products

Pearson's Correlation Coefficient ($r$) tracks the directional linear strength between two separate variables $X$ and $Y$. Conventional calculation models present a massive equation requiring separate calculations for five different summation layers ($\sum x, \sum y, \sum x^2, \sum y^2, \sum xy$).

Vedic calculation simplifies this by converting both datasets into deviation vectors ($dx$ and $dy$) relative to their own assumed base centers. The calculation for the cross-variable product sum ($\sum dx \cdot dy$) then uses the parallel multiplication patterns of Sutra 3 (Urdhva-Tiryagbhyam).

$$r = \frac{\sum (dx \cdot dy)}{\sqrt{\sum dx^2 \cdot \sum dy^2}}$$

Using Urdhva-Tiryak, product terms are accumulated mentally across parallel columns, reducing the entire correlation process down to a single compact table.

---

## 1.4 — Permutations & Combinations via Factorial Reduction

Vedic counting avoids calculating full standalone factorials (like $10!$) when solving arrangements ($^nP_r$) and selections ($^nC_r$). Instead, it uses a rapid reduction technique based on Sutra 14 (Ekanyunena Purvena — By one less than the previous one).

### Selection Reduction Pattern ($^nC_r$)

To compute $^nC_r$, write a fraction where the numerator starts at $n$ and counts down by ones for exactly $r$ steps. The denominator starts at $1$ and counts up to $r$. Cancel out common factors before multiplying.

───► Top line counts DOWN by ones (Ekanyunena) for $r$ steps


$$^nC_r = \frac{n \cdot (n-1) \cdot (n-2) \cdots \text{ ($r$ terms)}}{1 \cdot 2 \cdot 3 \cdots r}$$


───► Bottom line counts UP by ones for $r$ steps

Example: Calculate $^{10}C_3$

1. Write 3 terms counting down from 10, over 3 terms counting up from 1:

$$^{10}C_3 = \frac{10 \cdot 9 \cdot 8}{1 \cdot 2 \cdot 3}$$


2. Simplify the fractions mentally before multiplying:
 $\frac{9}{3} = 3$ and $\frac{8}{2} = 4$


3. Calculate the remaining values: $10 \cdot 3 \cdot 4 = \mathbf{120}$.

---

## 1.5 — Binomial Distribution Mental Calculations

The Binomial Probability distribution models experiments with two outcomes: success ($p$) or failure ($q = 1-p$), over $n$ trials. The probability of getting exactly $r$ successes is:

$$P(X=r) = \,^nC_r \cdot p^r \cdot q^{n-r}$$

Vedic algebra matches these coefficients with Pascal's Triangle using immediate proportional transitions. Instead of recalculating every value from scratch, the coefficient for each successive step is derived from the previous one using a simple multiplication ratio:

$$\text{Next Coefficient} = \text{Current Coefficient} \times \frac{\text{Current Success Power}}{\text{Current Step Counter}}$$

This allows you to calculate and write down an entire binomial probability distribution in a single linear pass.

---

## 1.6 — Probability Trees via Vyashti-Samashti

The words Vyashti mean individual component, cell, or part, and Samashti mean collective universe, system, or whole.

```
            [SAMASHTI: The Total Universe Balance = 1.0]
                             /\
                            /  \
               [Vyashti A] /    \ [Vyashti B]
                          /\    /\
                         /  \  /  \
                        [Conditional Sub-Branches]

```

When tracking multi-stage independent or dependent probability paths, standard school math often gets tangled in nested formulas. The Vyashti-Samashti framework models the entire sample space as a single, visually balanced tree structure.

1. The Whole (Samashti): The master root node always represents a total probability weight of exactly $1.0$.
2. The Parts (Vyashti): Sub-branches break down into fractional paths that must always sum up to their parent node's value.
3. Path Evaluation: Multiplying values along any continuous path isolates that specific structural outcome, keeping the relationship between individual paths and the entire system clear.

---

## 1.7 — Bayes' Theorem: Single-Line Weight Balancing

Bayes' Theorem calculates inverted conditional probabilities—finding the likelihood that a specific cause occurred given that a certain outcome has been observed:

$$P(A_i|B) = \frac{P(B|A_i)P(A_i)}{\sum P(B|A_j)P(A_j)}$$

Vedic probability simplifies this calculation using a matrix layout called the Vedic Probability Cell Grid. This method organizes the sample space into proportional parts (Vyashti) that can be balanced in a single line, completely bypassing complex abstract formulas.

### The Vedic Grid Layout

| Active Cause Option ($A_i$) | Prior Weight | Conditional Likelihood | Absolute Path Weight (Vyashti) | Inverted Balance Value |
| --- | --- | --- | --- | --- |
| Cause Choice 1 ($A_1$) | $P(A_1)$ | $P(B\|A_1$ | $W_1 = P(A_1) \cdot P(B\|A_1$ | $\frac{W_1}{W_1 + W_2}$ ✅ |
| Cause Choice 2 ($A_2$) | $P(A_2)$ | $P(B\|A_2$ | $W_2 = P(A_2) \cdot P(B\|A_2$ | $\frac{W_2}{W_1 + W_2}$ |
| SYSTEM WHOLE |  |  | $\sum W_i$ (Samashti) | Total Sum = 1.0 |

Once the grid is filled out, the probability for any chosen cause is simply its individual path weight divided by the total system weight.

---

---

# PART 2: WORKED EXAMPLES

---

## Section A: Proportional Central Tendency & Variance

### Example 1

Question: Compute the exact arithmetic mean for the data set $\{245, 248, 252, 241, 244, 256, 250, 248\}$ using the Anurupyena deviation strategy.

Answer:

1. Choose a round assumed mean base near the center of the data: $A = 250$.
2. List the relative deviations ($d = x - 250$) for each data point:

$$-5, -2, +2, -9, -6, +6, 0, -2$$


3. Sum these deviation values:

$$\sum d = (-5) + (-2) + 2 + (-9) + (-6) + 6 + 0 + (-2) = -16$$


4. Divide the sum of deviations by the total number of items ($n = 8$):

$$\text{Deviation Average} = \frac{-16}{8} = -2$$


5. Combine this result with your assumed mean base to find the true mean:

$$\bar{x} = A + \left(\frac{\sum d}{n}\right) = 250 + (-2) = \mathbf{248}$$



---

### Example 2

Question: Find the Variance ($\sigma^2$) and Standard Deviation ($\sigma$) for the data set $\{10, 13, 15, 9, 8, 11\}$ using the Vedic working mean deviation method.

Answer:

1. Select a convenient assumed mean base: $A = 10$.
2. Create a working table for your calculations:

| Value ($x$) | Deviation ($d = x - 10$) | Squared Deviation ($d^2$) |
| --- | --- | --- |
| 10 | $0$ | $0$ |
| 13 | $+3$ | $9$ |
| 15 | $+5$ | $25$ |
| 9 | $-1$ | $1$ |
| 8 | $-2$ | $4$ |
| 11 | $+1$ | $1$ |
| SUMS | $\sum d = 6$ | $\sum d^2 = 40$ |

3. Apply the Vedic variance formula:

$$\sigma^2 = \frac{\sum d^2}{n} - \left(\frac{\sum d}{n}\right)^2 = \frac{40}{6} - \left(\frac{6}{6}\right)^2 = \frac{20}{3} - (1)^2 = 6.67 - 1 = \mathbf{5.67}$$


4. Take the square root to find the standard deviation:

$$\sigma = \sqrt{5.67} \approx \mathbf{2.38}$$



---

## Section B: Correlation and Combinatorics

### Example 3

Question: Compute Pearson's correlation coefficient ($r$) for the paired data arrays $X = \{5, 7, 8, 4, 6\}$ and $Y = \{11, 14, 15, 9, 11\}$.

Answer:

1. Choose an assumed mean base for both datasets: $A_x = 6$ and $A_y = 12$.
2. Create a table for the deviation vectors ($dx, dy$) and their products using Urdhva-Tiryak:

| $X$ | $Y$ | $dx$ | $dy$ | $dx^2$ | $dy^2$ | $dx \cdot dy$ |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 11 | $-1$ | $-1$ | $1$ | $1$ | $1$ |
| 7 | 14 | $+1$ | $+2$ | $1$ | $4$ | $2$ |
| 8 | 15 | $+2$ | $+3$ | $4$ | $9$ | $6$ |
| 4 | 9 | $-2$ | $-3$ | $4$ | $9$ | $6$ |
| 6 | 11 | $0$ | $-1$ | $0$ | $1$ | $0$ |
| SUM |  | $0$ | $0$ | $10$ | $24$ | $15$ |

3. Calculate the correlation coefficient directly from the sums:

$$r = \frac{\sum (dx \cdot dy)}{\sqrt{\sum dx^2 \cdot \sum dy^2}} = \frac{15}{\sqrt{10 \cdot 24}} = \frac{15}{\sqrt{240}} = \frac{15}{15.49} \approx \mathbf{0.968}$$



---

### Example 4

Question: A committee of 4 people is to be selected from a group of 8 candidates. Calculate the number of possible combinations ($^8C_4$) using the Vedic rapid reduction pattern.

Answer:

1. Set up the fractional reduction pattern. Count down 4 steps from 8 in the numerator, and count up from 1 to 4 in the denominator:

$$^8C_4 = \frac{8 \cdot 7 \cdot 6 \cdot 5}{1 \cdot 2 \cdot 3 \cdot 4}$$


2. Simplify the fraction by canceling out common terms before multiplying:
 Cancel $2 \cdot 3 = 6$ from both top and bottom.
 Divide 8 in the numerator by 4 in the denominator: $\frac{8}{4} = 2$.


3. Multiply the remaining numbers together:

$$^8C_4 = 2 \cdot 7 \cdot 5 = \mathbf{70}$$



---

## Section C: Probability Trees & Bayesian Grids

### Example 5

Question: A fair coin is flipped 4 times. Calculate the probability of getting exactly 2 heads using proportional binomial transition patterns.

Answer:

1. Identify the trial parameters: $n = 4$, probability of success (heads) $p = 0.5$, probability of failure (tails) $q = 0.5$.
2. Use Pascal's Triangle coefficients for $n = 4$, which are: $1, 4, 6, 4, 1$.
3. We need the coefficient for exactly 2 successes ($r = 2$), which is the third term: $6$.
4. Calculate the total probability weight for this combination:

$$P(X=2) = 6 \cdot (0.5)^2 \cdot (0.5)^{4-2} = 6 \cdot (0.5)^4 = 6 \cdot 0.0625 = \mathbf{0.375} \text{ or } \frac{3}{8}$$



---

### Example 6

Question: Three manufacturing machines ($A, B, C$) produce $50\%$, $30\%$, and $20\%$ of a factory's total output. Their defect rates are $1\%$, $2\%$, and $3\%$ respectively. A random item is sampled and found to be defective. Find the probability that it came from Machine $C$ using the single-line Vedic grid layout.

Answer:

1. Set up your calculation values into the proportional path weight grid layout:

| Machine Choice | Prior Production Weight | Conditional Defect Rate | Absolute Path Weight (Vyashti) | Bayesian Balance Fraction |
| --- | --- | --- | --- | --- |
| Machine $A$ | $0.50$ | $0.01$ | $0.50 \cdot 0.01 = 0.005$ | $\frac{0.005}{0.017} = \frac{5}{17}$ |
| Machine $B$ | $0.30$ | $0.02$ | $0.30 \cdot 0.02 = 0.006$ | $\frac{0.006}{0.017} = \frac{6}{17}$ |
| Machine $C$ | $0.20$ | $0.03$ | $0.20 \cdot 0.03 = 0.006$ | $\frac{0.006}{0.017} = \mathbf{\frac{6}{17}}$ ✅ |
| TOTALS |  |  | $\sum W_i = 0.017$ (Samashti) | Total Sum = $1.0$ |

2. The calculated probability that the defective item came from Machine $C$ is:

$$P(C|\text{Defective}) = \frac{0.006}{0.017} = \mathbf{\frac{6}{17}} \approx \mathbf{0.353}$$



---

---

# PART 3: PRACTICE EXERCISES

---

## Exercise Set A: Proportional Central Tendency (20 Questions)

Calculate the exact Arithmetic Mean ($\bar{x}$) for each data set using an assumed mean base.

A1. $\{95, 98, 102, 105, 97, 94, 101, 108\}$
A2. $\{450, 462, 448, 455, 451, 465, 442, 449\}$
A3. $\{12, 15, 9, 11, 14, 18, 10, 13, 12\}$
A4. $\{1105, 1108, 1112, 1098, 1101, 1106\}$
A5. $\{72, 75, 69, 71, 74, 78, 80, 68\}$
A6. $\{198, 202, 205, 197, 199, 201, 204\}$
A7. $\{54, 56, 52, 55, 53, 57, 51, 54\}$
A8. $\{320, 315, 325, 330, 310, 318\}$
A9. $\{8, 12, 15, 7, 9, 14, 11, 10\}$
A10. $\{2495, 2502, 2498, 2505, 2491, 2501\}$

Find the missing value in each dataset using the deviation balancing method.

A11. Mean = $50$, Data: $\{48, 52, 55, 46, x\}$; Find $x$.
A12. Mean = $100$, Data: $\{97, 104, 98, 101, 105, x\}$; Find $x$.
A13. Mean = $15$, Data: $\{14, 17, 12, 16, 11, 18, x\}$; Find $x$.
A14. Mean = $250$, Data: $\{245, 252, 248, 255, 246, x\}$; Find $x$.
A15. Mean = $80$, Data: $\{78, 82, 85, 74, 81, x\}$; Find $x$.

Determine the median value for each dataset.

A16. $\{14, 17, 12, 19, 15, 22, 11, 16, 18\}$
A17. $\{92, 95, 88, 104, 101, 97, 90, 99\}$
A18. $\{5, 12, 8, 4, 15, 7, 10, 9\}$
A19. $\{120, 125, 118, 122, 130, 121, 124\}$
A20. $\{34, 38, 32, 36, 40, 35, 37\}$

---

## Exercise Set B: Variance & Dispersion Metrics (20 Questions)

Find the Variance ($\sigma^2$) and Standard Deviation ($\sigma$) for each dataset using the deviation method.

B1. $\{8, 10, 12, 14, 6\}$
B2. $\{101, 99, 102, 98, 100\}$
B3. $\{15, 18, 12, 14, 16, 17\}$
B4. $\{50, 55, 45, 48, 52\}$
B5. $\{5, 9, 7, 11, 8\}$
B6. $\{12, 12, 12, 12, 12\}$
B7. $\{20, 25, 30, 15, 10\}$
B8. $\{202, 206, 198, 204, 195, 201\}$
B9. $\{44, 46, 42, 45, 43, 47, 41\}$
B10. $\{9, 15, 11, 8, 12\}$

Calculate the correlation coefficient ($r$) for the following paired data arrays using Urdhva-Tiryak.

B11. $X = \{1, 2, 3, 4, 5\}$ and $Y = \{2, 4, 5, 7, 8\}$
B12. $X = \{10, 20, 30\}$ and $Y = \{5, 10, 15\}$
B13. $X = \{4, 6, 8, 10\}$ and $Y = \{12, 10, 8, 6\}$
B14. $X = \{3, 5, 6, 8, 9\}$ and $Y = \{7, 8, 10, 11, 12\}$
B15. $X = \{2, 4, 6\}$ and $Y = \{9, 7, 5\}$

Find the Mean Deviation from the Median for each dataset.

B16. $\{3, 6, 7, 9, 15\}$
B17. $\{10, 12, 18, 20, 25\}$
B18. $\{100, 102, 105, 108, 110\}$
B19. $\{4, 7, 8, 9, 12, 14\}$
B20. $\{50, 52, 55, 58, 60\}$

---

## Exercise Set C: Combinatorics & Distributions (15 Questions)

Calculate the number of possibilities for each problem using rapid structural reduction.

C1. $^{10}C_4$
C2. $^{12}C_3$
C3. $^7C_5$
C4. $^{15}C_2$
C5. $^{50}C_{48}$ (Hint: Use symmetry $^nC_r = \,^nC_{n-r}$ first)
C6. $^8P_3$
C7. $^{10}P_4$
C8. $^6P_5$
C9. In how many ways can a 3-person team be chosen from 7 people?
C10. In how many ways can 4 books be arranged on a shelf out of a selection of 6 books?

Solve these Binomial Distribution problems using proportional transition patterns.

C11. A fair die is rolled 3 times. Find the probability of getting exactly 2 sixes.
C12. A coin with a 60% probability of landing heads ($p=0.6$) is flipped 4 times. Find the probability of exactly 3 heads.
C13. An experiment has a success rate of $20\%$ ($p=0.2$). Out of 5 trials, find the probability of exactly 1 success.
C14. A basketball player hits 80% of their free throws. If they take 3 shots, find the probability that they score exactly 2 times.
C15. A true/false quiz has 5 questions. If a student guesses randomly, find the probability of getting exactly 4 correct answers.

---

## Exercise Set D: Probability Trees & Bayesian Grids (15 Questions)

Map these multi-stage probability problems onto paths to find the final answers.

D1. Bag $A$ contains 3 red and 2 blue marbles. Bag $B$ contains 4 red and 5 blue marbles. A bag is chosen at random, and one marble is drawn. Find the probability that the marble is red.
D2. A student studies for an exam with a 90% chance of passing if they prepare. If they do not study, their chance of passing drops to 30%. The student has a 70% chance of studying. Find the probability that they pass the exam.
D3. Two cards are drawn from a standard deck without replacement. Find the probability that both cards are Aces.
D4. Weather forecasts predict rain tomorrow with a 60% probability. If it rains, a local sports game has a 40% chance of being delayed. If it does not rain, the chance of a delay is only 10%. Find the probability that the game is delayed.
D5. A target is fired upon by two archers. Archer 1 hits the target with a 70% probability, and Archer 2 hits it with an 80% probability. If both shoot once, find the probability that the target is hit at least once.

Solve these inverse conditional probability problems using the single-line cell weight grid layout.

D6. Using the information from question D1, if the drawn marble is red, find the probability that it came from Bag $A$.
D7. Using the information from question D2, if the student passed the exam, find the probability that they studied for it.
D8. A rare medical condition occurs in 1% of the population. A diagnostic test is 95% accurate for people who have the condition, but has a 5% false-positive rate for healthy individuals. If a person tests positive, find the probability that they actually have the condition.
D9. Three distinct political factions ($X, Y, Z$) have a $40\%$, $35\%$, and $25\%$ chance of winning an election. The probabilities that they pass a specific environmental law if elected are $80\%$, $40\%$, and $20\%$ respectively. If the law is passed after the election, find the probability that Faction $X$ won.
D10. An automated spam filter flags email messages. $10\%$ of all incoming mail is spam. The filter flags 99% of actual spam emails, but also mistakenly flags 2% of legitimate emails. If an email is flagged as spam, find the probability that it is actually spam.
D11. Box 1 contains 2 gold coins and 1 silver coin. Box 2 contains 1 gold coin and 3 silver coins. A box is selected at random, and a coin is drawn. If the coin is gold, find the probability that it was drawn from Box 1.
D12. A manufacturing plant uses two production lines ($L_1$ and $L_2$) that turn out $60\%$ and $40\%$ of its total products. Line 1 produces 2% defective items, while Line 2 produces 5% defective items. If an item is found to be defective, find the probability that it came from Line 1.
D13. An insurance company classifies drivers into three risk tiers: Low Risk (70% of clients), Medium Risk (20%), and High Risk (10%). The probabilities of an accident over a year are 1% for Low Risk, 5% for Medium Risk, and 10% for High Risk. If a customer files a claim for an accident, find the probability that they belong to the High Risk tier.
D14. A security guard checks badges at an entrance. 98% of employees wear valid badges. The guard correctly admits 99% of people with valid badges, but also mistakenly admits 5% of people without valid badges. If a person is admitted, find the probability that they have a valid badge.
D15. A student takes a multiple-choice question with 4 options. The student either knows the answer (60% probability) or guesses randomly. If they know the answer, they get it right with 100% probability. If they guess, they have a 25% chance of getting it right. If the student answers correctly, find the probability that they actually knew the answer.

---

## Answer Key for Practice Exercises

### Set A Answers:

A1. $100$ | A2. $452.125$ | A3. $13.78$ | A4. $1105$ | A5. $73.375$ | A6. $201.14$ | A7. $54.125$ | A8. $319.67$ | A9. $11$ | A10. $2498.67$ | A11. $49$ | A12. $95$ | A13. $15$ | A14. $262$ | A15. $81$ | A16. $16$ | A17. $96$ | A18. $8.5$ | A19. $122$ | A20. $36$

### Set B Answers:

B1. $\sigma^2 = 8, \sigma = 2.83$ | B2. $\sigma^2 = 2, \sigma = 1.41$ | B3. $\sigma^2 = 4.22, \sigma = 2.05$ | B4. $\sigma^2 = 12.8, \sigma = 3.58$ | B5. $\sigma^2 = 4.24, \sigma = 2.06$ | B6. $\sigma^2 = 0, \sigma = 0$ | B7. $\sigma^2 = 50, \sigma = 7.07$ | B8. $\sigma^2 = 14.89, \sigma = 3.86$ | B9. $\sigma^2 = 4, \sigma = 2$ | B10. $\sigma^2 = 6.8, \sigma = 2.61$ | B11. $0.98$ | B12. $1.0$ | B13. $-1.0$ | B14. $0.991$ | B15. $-1.0$ | B16. $3.2$ | B17. $5.2$ | B18. $3.2$ | B19. $2.67$ | B20. $3.2$

### Set C Answers:

C1. $210$ | C2. $220$ | C3. $21$ | C4. $105$ | C5. $1225$ | C6. $336$ | C7. $5040$ | C8. $720$ | C9. $35$ | C10. $360$ | C11. $\frac{5}{72} \approx 0.069$ | C12. $0.3456$ | C13. $0.4096$ | C14. $0.384$ | C15. $\frac{5}{32} \approx 0.156$

### Set D Answers:

D1. $\frac{47}{90} \approx 0.522$ | D2. $0.72$ | D3. $\frac{1}{221} \approx 0.0045$ | D4. $0.28$ | D5. $0.94$ | D6. $\frac{27}{47} \approx 0.574$ | D7. $\frac{7}{8} = 0.875$ | D8. $\frac{19}{118} \approx 0.161$ | D9. $\frac{32}{51} \approx 0.627$ | D10. $\frac{11}{13} \approx 0.846$ | D11. $\frac{8}{11} \approx 0.727$ | D12. $\frac{3}{8} = 0.375$ | D13. $\frac{10}{27} \approx 0.370$ | D14. $\frac{9702}{9712} \approx 0.999$ | D15. $\frac{6}{7} \approx 0.857$

---

---

# PART 4: ONLINE TEST BANK

## For Web Portal — Module 25

---

## 📝 TEST 1: CONCEPT QUIZ — Proportional Combinatorics

Format: Multiple Choice Questions (MCQ)
Total Marks: 20 | Time: 15 minutes
Difficulty Distribution: Easy (60%), Medium (40%)

---

Q1. [EASY] What does the Sanskrit word Vyashti translate to in probability and statistics?

 A) The entire data collection universe
 B) A single localized cell or component part ✅
 C) An infinite limit expansion
 D) A zero-deviation matrix balance

Explanation: Vyashti means the individual component or single part, while Samashti represents the entire system whole.

---

Q2. [EASY] Which Vedic principle helps find the mean of a large dataset without having to add up all the raw values?

 A) Urdhva-Tiryagbhyam
 B) Paravartya Yojayet
 C) Anurupyena (Proportionately) ✅
 D) Shunyam Samyasamuccaye

Explanation: Anurupyena allows you to choose an assumed mean base and work with smaller relative deviation numbers.

---

Q3. [EASY] What is the sum of all individual probability branch weights expanding out from a single parent node in a Vyashti-Samashti probability tree?

 A) It varies depending on the number of options
 B) Always exactly $0.5$
 C) Always exactly $1.0$ ✅
 D) It equals the square root of the total trials

---

Q4. [EASY] Calculate the combination value $^{11}C_2$ instantly using the rapid reduction method.

 A) $110$
 B) $22$
 C) $55$ ✅
 D) $45$

Explanation: $(11 \times 10) / (1 \times 2) = 110 / 2 = 55$.

---

Q5. [EASY] What is the calculated variance ($\sigma^2$) for a static dataset where every single value is identical ($[15, 15, 15, 15, 15]$)?

 A) $15$
 B) $1$
 C) $0$ ✅
 D) Indeterminate

Explanation: Since all values match the mean exactly, there are no deviations, resulting in a variance of zero.

---

Q6. [MEDIUM] Calculate the value of $^7P_3$ using the rapid countdown method.

 A) $210$ ✅
 B) $35$
 C) $840$
 D) $143$

Explanation: Count down 3 steps from 7: $7 \times 6 \times 5 = 210$.

---

Q7. [EASY] Pearson's correlation coefficient value ($r = -1.0$) means the two data vectors have:

 A) A perfect positive linear relationship
 B) No relationship at all
 C) A perfect negative linear relationship ✅
 D) An identical average value

---

Q8. [MEDIUM] Find the correct value of the combination rule choice $^{100}C_{98}$ using symmetric conversion.

 A) $9900$
 B) $4950$ ✅
 C) $100$
 D) $200$

Explanation: $^{100}C_{98} = \,^{100}C_2 = (100 \times 99) / (1 \times 2) = 9900 / 2 = 4950$.

---

Q9. [MEDIUM] An experiment has a success probability of $p = 0.5$. What is the binomial distribution probability coefficient for exactly 3 successes out of 5 total trials?

 A) $5$
 B) $20$
 C) $10$ ✅
 D) $15$

Explanation: The coefficient is $^5C_3 = \,^5C_2 = (5 \times 4) / (1 \times 2) = 10$.

---

Q10. [MEDIUM] If you choose an assumed mean of $A = 500$ for a dataset, and the average of the deviations calculates to $-4.2$, what is the true arithmetic mean of the data?

 A) $504.2$
 B) $495.8$ ✅
 C) $-4.2$
 D) $500$

---

Q11. [EASY] Find the median value for the dataset $\{7, 3, 9, 12, 5, 8, 10\}$.

 A) $12$
 B) $7$
 C) $8$ ✅
 D) $7.7$

Explanation: Arranging the numbers in order gives $\{3, 5, 7, 8, 9, 10, 12\}$. The middle value is 8.

---

Q12. [MEDIUM] If the total variance of a system is calculated to be $\sigma^2 = 12.25$, what is its standard deviation ($\sigma$)?

 A) $6.125$
 B) $3.5$ ✅
 C) $2.5$
 D) $4.25$

---

Q13. [MEDIUM] Which step layout configuration does Bayes' Theorem evaluate?

 A) Forward cumulative addition
 B) Inverted conditional probability path balancing ✅
 C) Continuous factorial expansion
 D) Symmetrical polynomial grouping

---

Q14. [MEDIUM] Calculate the value of $^5C_3 \cdot (0.1)^3 \cdot (0.9)^2$ for a binomial distribution step.

 A) $0.0081$ ✅
 B) $0.081$
 C) $0.81$
 D) $0.00081$

Explanation: $10 \times 0.001 \times 0.81 = 0.01 \times 0.81 = 0.0081$.

---

Q15. [MEDIUM] If $\sum dx^2 = 16$, $\sum dy^2 = 25$, and $\sum (dx \cdot dy) = -12$, what is the correlation coefficient value $r$?

 A) $0.6$
 B) $-0.6$ ✅
 C) $-0.75$
 D) $0.8$

Explanation: $r = -12 / \sqrt{16 \times 25} = -12 / \sqrt{400} = -12 / 20 = -0.6$.

---

Q16. [EASY] In a standard binomial trial setup, if the probability of success is $p = 0.15$, what is the probability of failure ($q$)?

 A) $0.15$
 B) $0.50$
 C) $0.85$ ✅
 D) $1.00$

---

Q17. [MEDIUM] Find the arithmetic mean for the data values $\{122, 118, 125, 121, 119\}$ using an assumed base of $120$.

 A) $120$
 B) $121$ ✅
 C) $120.5$
 D) $119.5$

---

Q18. [MEDIUM] How many unique ways can you arrange 3 students in a row from a group of 5 candidates?

 A) $10$
 B) $20$
 C) $60$ ✅
 D) $120$

Explanation: This is a permutation problem: $^5P_3 = 5 \times 4 \times 3 = 60$.

---

Q19. [EASY] The prior probability weight parameter in a Bayesian grid layout represents:

 A) The initial probability of a cause before looking at new evidence ✅
 B) The error rate of the diagnostic test
 C) The total sum of all possible outcomes
 D) The variance of the dataset

---

Q20. [MEDIUM] Find the median value for an even number of data points: $\{12, 16, 18, 22\}$.

 A) $16$
 B) $18$
 C) $17$ ✅
 D) $20$

Explanation: The median is the average of the two middle terms: $(16 + 18) / 2 = 17$.

---

## 📝 TEST 2: WEIGHT VARIANCE AND FACTORIAL LAYOUTS

Format: Fill in the blank + Short Answer
Total Marks: 25 | Time: 20 minutes
Difficulty Distribution: Easy (30%), Medium (50%), Hard (20%)

---

Q1. [Fill in the blank] The calculated value for the combination pattern $^{15}C_3$ using rapid reduction is _______.
Answer: $455$

---

Q2. [Fill in the blank] The arithmetic mean for the data set $\{2005, 1998, 2002, 2007, 1993, 2005\}$ using $A = 2000$ as a base is _______.
Answer: $2002$

---

Q3. [Fill in the blank] If a dataset has a sum of deviations $\sum d = +10$ over $n = 50$ total items, and the assumed mean is $A = 75$, the true mean value is _______.
Answer: $75.2$

---

Q4. [Fill in the blank] The value of the permutation option $^{10}P_3$ is _______.
Answer: $720$

---

Q5. [Fill in the blank] A coin is flipped 3 times. The exact probability of getting 3 straight heads along a single path of a probability tree is _______.
Answer: $0.125$ (or $\frac{1}{8}$)

---

Q6. [Short Answer] Calculate the variance ($\sigma^2$) for the dataset $\{47, 51, 49, 53, 50\}$ using an assumed mean base of $A = 50$.
Answer:

 Deviations ($d$): $-3, +1, -1, +3, 0 \rightarrow \sum d = 0$
 Squared Deviations ($d^2$): $9, 1, 1, 9, 0 \rightarrow \sum d^2 = 20$
 Variance equation step: $\sigma^2 = \frac{20}{5} - \left(\frac{0}{5}\right)^2 = 4 - 0 = \mathbf{4}$

---

Q7. [Fill in the blank] The simplified result value for the factorial fraction $\frac{8 \cdot 7 \cdot 6}{1 \cdot 2 \cdot 3}$ is _______.
Answer: $56$

---

Q8. [Fill in the blank] In a Bayesian analysis grid, if the path weights are $W_1 = 0.04$ and $W_2 = 0.16$, the balanced inverse probability value for Cause 1 is _______.
Answer: $0.20$ (or $\frac{1}{5}$)

---

Q9. [Short Answer] Explain how to use Anurupyena to make it easier to find the median of a large grouped frequency table.
Answer: Anurupyena allows you to work with smaller, proportional scale factors inside the target median class interval. Instead of doing calculations with large raw frequency counts, you can scale them down to simpler ratios. This lets you calculate the exact position of the median within the class interval using basic linear interpolation, without needing to memorize long, complicated formulas.

---

Q10. [Fill in the blank] The value of the combination item $^9C_0$ is equal to _______.
Answer: $1$

---

## 📝 TEST 3: BAYESIAN GRID MATCHING MATRIX

Format: Matching Matrix + Complex Case MCQ
Total Marks: 20 | Time: 15 minutes

---

Part A: Match the Component to its Role in the Bayesian Grid (10 Marks)

| Grid Component Name | Operational Meaning & Formula |
| --- | --- |
| 1. Prior Probability | A. The individual path weight component ($W_i = \text{Prior} \times \text{Likelihood}$) |
| 2. Conditional Likelihood | B. The starting probability of a cause ($P(A_i)$) before looking at new evidence |
| 3. Vyashti Path Weight | C. The total sum of all absolute path weights ($\sum W_i$) across the system |
| 4. Samashti Total Weight | D. The final step: balancing a specific path weight against the system total ($\frac{W_i}{\sum W_i}$) |
| 5. Inverse Balanced Value | E. The probability of an observed outcome given a specific cause ($P(B\|A_i$) |

Correct Matrix Connections: 1-B, 2-E, 3-A, 4-C, 5-D

---

Part B: Complex Case MCQ (10 Marks)

Q6. A diagnostic system flags computer network security risks. 5% of all connections are actual attacks. The system has a 90% accuracy rate for detecting actual attacks, but also carries a 10% false-positive rate for safe traffic. If a connection is flagged as an attack, what is the probability that it is a safe connection?

 A) $0.346$
 B) $0.654$ ✅
 C) $0.100$
 D) $0.500$

Explanation: Set up the weights in a Bayesian cell grid layout:

 Attack path weight ($W_1$): $0.05 \times 0.90 = 0.045$
 Safe path weight ($W_2$): $0.95 \times 0.10 = 0.095$
 Total system weight (Samashti): $0.045 + 0.095 = 0.140$
 Probability that the flagged connection is actually safe: $\frac{W_2}{\text{Total}} = \frac{0.095}{0.140} = \frac{95}{140} \approx \mathbf{0.654}$.

---

---

## 📝 TEST 4: COMPREHENSIVE COMPUTATION LAB

Format: Mixed Structure (MCQ + Short Answer + Proportional Proofs)
Total Marks: 50 | Time: 45 minutes

---

### Section 1: Single-Line Calculation MCQs (20 Marks)

Q1. Find the arithmetic mean of the dataset $\{988, 995, 1002, 991, 1004\}$ using an assumed base of $1000$.

 Answer: $996$

Q2. Calculate the rapid reduction value for $^{12}C_4$.

 Answer: $495$

Q3. Find the variance ($\sigma^2$) for the dataset $\{3, 5, 7, 3, 7\}$.

 Answer: $3.2$

Q4. Calculate the permutation value $^6P_4$.

 Answer: $360$

Q5. An experiment has a success rate of $p = 0.3$. Find the binomial probability for exactly 2 successes out of 3 trials.

 Answer: $0.189$ (Calculated as $3 \times 0.09 \times 0.7 = 0.189$)

Q6. Find the median value for the dataset $\{42, 45, 38, 52, 47, 40\}$.

 Answer: $43.5$

Q7. If $\sum dx^2 = 20, \sum dy^2 = 20$, and $\sum (dx \cdot dy) = 18$, find the correlation coefficient value $r$.

 Answer: $0.9$

Q8. A box contains 5 white and 5 black balls. If you draw two balls without replacement, what is the probability that both are white?

 Answer: $\frac{2}{9}$ (Calculated as $\frac{5}{10} \times \frac{4}{9} = \frac{20}{90} = \frac{2}{9}$)

Q9. Find the value of the combination pattern $^{20}C_1$.

 Answer: $20$

Q10. If a Bayesian grid has path weights $W_1 = 0.15, W_2 = 0.45$, and $W_3 = 0.20$, find the balanced probability value for Cause 2.

 Answer: $0.5625$ (Calculated as $\frac{0.45}{0.80} = \frac{45}{80} = 0.5625$)

---

### Section 2: Core Calculations & Step Explanations (15 Marks)

Q11. Compute the variance ($\sigma^2$) and standard deviation ($\sigma$) for the dataset $\{148, 153, 150, 147, 152\}$ using the deviation method.

 Answer:
 Select an assumed mean base of $A = 150$.
 Deviations ($d$): $-2, +3, 0, -3, +2 \rightarrow \sum d = 0$
 Squared deviations ($d^2$): $4, 9, 0, 9, 4 \rightarrow \sum d^2 = 26$
 Variance calculation: $\sigma^2 = \frac{26}{5} - \left(\frac{0}{5}\right)^2 = \mathbf{5.2}$
 Standard Deviation: $\sigma = \sqrt{5.2} \approx \mathbf{2.28}$



Q12. Calculate Pearson's correlation coefficient ($r$) for the following data sets using an assumed mean layout: $X = \{2, 4, 5, 1\}$ and $Y = \{7, 8, 10, 5\}$.

 Answer:
 Select assumed mean bases near the middle of each dataset: $A_x = 3, A_y = 7.5$.
 Deviations ($dx$): $-1, +1, +2, -2 \rightarrow \sum dx = 0, \sum dx^2 = 10$
 Deviations ($dy$): $-0.5, +0.5, +2.5, -2.5 \rightarrow \sum dy = 0, \sum dy^2 = 13$
 Cross-products ($\sum dx \cdot dy$): $0.5 + 0.5 + 5.0 + 5.0 = 11$
 Correlation coefficient calculation: $r = \frac{11}{\sqrt{10 \times 13}} = \frac{11}{\sqrt{130}} = \frac{11}{11.40} \approx \mathbf{0.965}$



Q13. Box $A$ has 1 gold coin and 3 silver coins. Box $B$ has 3 gold coins and 1 silver coin. A box is picked at random, and a coin is drawn. If the drawn coin is gold, find the probability that it came from Box $B$ using the Bayesian cell grid layout.

 Answer: Set up the path weights in the cell grid layout:
 Box $A$ path weight ($W_1$): $0.5 \times 0.25 = 0.125$
 Box $B$ path weight ($W_2$): $0.5 \times 0.75 = 0.375$
 Total system weight (Samashti): $0.125 + 0.375 = 0.500$
 Balanced conditional probability: $P(B|\text{Gold}) = \frac{W_2}{\text{Total}} = \frac{0.375}{0.500} = \mathbf{0.75} \text{ or } \mathbf{\frac{3}{4}}$.



---

### Section 3: Structural Proofs & Real-World Applications (15 Marks)

Q14. Prove that the rapid reduction pattern used to compute combinations ($^nC_r$) yields the exact same mathematical results as the traditional factorial formula ($\frac{n!}{r!(n-r)!}$). Use $^{10}C_3$ as your verification example.

 Answer: The traditional formula writes out the full factorials: $\frac{10!}{3! \cdot 7!}$.
Expanding this out gives: $\frac{10 \cdot 9 \cdot 8 \cdot 7 \cdot 6 \cdot 5 \cdot 4 \cdot 3 \cdot 2 \cdot 1}{(3 \cdot 2 \cdot 1) \cdot (7 \cdot 6 \cdot 5 \cdot 4 \cdot 3 \cdot 2 \cdot 1)}$.
Notice that the factorial terms from $1$ to $7$ appear in both the numerator and denominator, so they cancel out completely: $\frac{10 \cdot 9 \cdot 8}{3 \cdot 2 \cdot 1}$.
This matches the rapid reduction pattern exactly. The Vedic method arrives at this simplified step directly, avoiding the need to write out and calculate large intermediate factorials.

Q15. A factory uses an automated quality control scanner. 1% of the products coming off the line have defects. The scanner correctly flags 98% of defective items, but has a 3% false-alarm rate for non-defective items. If the scanner flags an item, find the probability that it actually has a defect.

 Answer: Set up the calculation values into the proportional path weight grid:
 Defective path weight ($W_1$): $0.01 \times 0.98 = 0.0098$
 Non-defective path weight ($W_2$): $0.99 \times 0.03 = 0.0297$
 Total system weight (Samashti): $0.0098 + 0.0297 = 0.0395$
 Balanced probability calculation: $P(\text{Defective}|\text{Flagged}) = \frac{0.0098}{0.0395} = \frac{98}{395} \approx \mathbf{0.248}$ (or $\mathbf{24.8\%}$).



---

---

# PART 5: TEACHER'S GUIDE & ASSESSMENT RUBRIC

---

## Classroom Practical Lab Work

### Activity 1: The Deviation Balance Game

 Objective: Master using Anurupyena to find the mean of a dataset mentally.
 Execution: The teacher writes a baseline number on the board (e.g., $A = 150$), then calls out a series of data points (e.g., $152, 147, 155, 146$). Students keep a running tally of the deviations mentally ($+2, -3, +5, -4 \rightarrow \text{Net } 0$). The first student to call out the correct balanced system mean wins the round.

---

### Activity 2: Setting up the Bayesian Grid

 Objective: Learn to solve conditional probability problems using cell weight grids instead of abstract formulas.
 Execution: Give students real-world scenarios (such as weather forecasting or medical screening options). Have them work in pairs to build and fill in a balanced cell weight table for each scenario, showing how the individual path weights (Vyashti) combine to form the complete system whole (Samashti).

---

## Grading Rubric (150 Total Module Points)

| Evaluation Component | Maximum Points |
| --- | --- |
| Foundational Concepts Quiz (Test 1) | 20 Marks |
| Structural Computation Lab (Test 2) | 25 Marks |
| Bayesian Grid Matching Matrix (Test 3) | 20 Marks |
| Comprehensive Written Test (Test 4) | 50 Marks |
| Active Practical Lab Performance | 35 Marks |

---

## Common Student Missteps & Action Fixes

| Observed Student Error | Direct Corrective Fix |
| --- | --- |
| Mixing up positive and negative signs when calculating deviations ($d = x - A$) | Remind students: if the data point is larger than the assumed mean, the deviation is positive ($+$); if it is smaller, the deviation is negative ($-$). |
| Forgetting to use the symmetry rule ($^nC_r = \,^nC_{n-r}$) for large combinations | Show students how much time they can save by converting a problem like $^{20}C_{18}$ into $^{20}C_2$ before using the rapid reduction method. |
| Forgetting to include the false-alarm path weight when calculating the total Bayesian probability | Emphasize that the total system weight (Samashti) must include every possible path that can lead to the observed outcome, not just the path being evaluated. |

---

---

# QUICK REFERENCE CARD

## Module 25 Summary Sheet (Print-Friendly)

```
╔═════════════════════════════════════════════════════════════════════════╗
║             VEDIC STATISTICS & PROBABILITY — CHEAT SHEET                ║
╠═════════════════════════════════════════════════════════════════════════╣
║ CORE SUTRAS: Sutra 11: Vyashti-Samashti (Part and Whole)                ║
║              Sub-Sutra 1: Anurupyena (Proportionately)                  ║
╠═════════════════════════════════════════════════════════════════════════╣
║ ARITHMETIC MEAN VIA DEVIATIONS:                                         ║
║    x̄ = A + (∑d / n)    where d = x - A  (A = Assumed Mean Base)         ║
║                                                                         ║
║ VARIANCE VIA WORKING MEAN:                                              ║
║    σ² = (∑d² / n) - (∑d / n)²                                           ║
╠═════════════════════════════════════════════════════════════════════════╣
║ RAPID COMBINATION REDUCTION (ⁿCᵣ):                                      ║
║    Count DOWN r steps from n in the numerator.                          ║
║    Count UP from 1 to r in the denominator.                             ║
║    Simplify fractions before multiplying.                               ║
║    Example: ¹⁰C₃ = (10 · 9 · 8) / (1 · 2 · 3) = 10 · 3 · 4 = 120        ║
╠═════════════════════════════════════════════════════════════════════════╣
║ BINOMIAL DISTRIBUTION PROBABILITIES:                                    ║
║    P(X=r) = ⁿCᵣ · pʳ · qⁿ⁻ʳ                                              ║
║    Use Pascal's Triangle coefficients to transition between steps.       ║
╠═════════════════════════════════════════════════════════════════════════╝
║ THE VEDIC BAYESIAN CELL GRID:                                           ║
║    1. Find path weights: Wᵢ = Prior Probability · Likelihood             ║
║    2. Sum path weights to get total system weight: Samashti = ∑Wᵦ        ║
║    3. Calculate balanced inverse probability: P(Cause|Outcome) = Wᵢ / ∑Wᵦ║
╚═════════════════════════════════════════════════════════════════════════╝

```

---

## End of Module 25 — Complete Study Material
Total Practice Base Questions: 90+ Items for Web Portals
Next Module: Module 26 — Coordinate Geometry: Pure Vedic Analytical Transformations
