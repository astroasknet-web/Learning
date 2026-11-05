# 🕉️ VEDIC MATHEMATICS — LEVEL 3: ADVANCED

# MODULE 22: Matrices & Determinants — Vedic Methods

## Complete Study Material | Theory + Solved Examples + Practice Exercises + Test Bank

---

> "Matrix structures and determinants are not collections of disjointed arithmetic arrays. By treating rows and columns as unified numeric streams, matrix multiplication and inversion compress into single-line cross-wise operations requiring zero intermediate paperwork."
> — Reconstructed Teaching Principles of Swami Bharati Krishna Tirthaji

---

## 📋 MODULE AT A GLANCE

| Item | Details |
| --- | --- |
| Level | Advanced (Level 3) |
| Module Number | 22 of 100 (Level 3 Module 2) |
| Target Audience | Age 16+ |
| Duration | 7 Hours (Theory: 3 hrs, Worked Examples: 2 hrs, Practice & Test Bank: 2 hrs) |
| Prerequisites | Module 21 (Higher Algebra), Basic Linear Algebra, Matrix Notation |
| Sutra Focus | Sutra 3: Urdhva-Tiryagbhyam, Sutra 7: Sankalana-Vyavakalanabhyam, & Sutra 9: Chalana-Kalanabhyam |
| Next Module | Module 23: Co-ordinate Geometry — Straight Lines via Vedic Vectoring |

---

## 🎯 LEARNING OUTCOMES

By the end of this module, the student will be able to:

1. Compute $2 \times 2$ and $3 \times 3$ determinants mentally using the Cross-wise Pattern Network.
2. Multiply matrices of any size ($n \times n$) in a single line using Sutra 3 (Urdhva-Tiryak).
3. Invert any non-singular $2 \times 2$ matrix mentally within 5 seconds using the transpose-adjugate shortcut.
4. Accelerate Cramer’s Rule evaluations using parallel structural determinants to solve systems of linear equations.
5. Set up characteristic polynomial equations and find eigenvalues using a calculus-based shortcut derived from Sutra 9 (Chalana-Kalanabhyam).
6. Solve matrix equations of the form $AX = B$ directly without tedious multi-stage row reductions.

---

---

# PART 1: THEORY & PRINCIPLES

---

## 22.1 — $2 \times 2$ and $3 \times 3$ Determinants via Cross-Wise Patterns

In conventional linear algebra, evaluating a determinant involves alternating signs and computing structural minors. Vedic Mathematics unifies this process by applying Sutra 3 (Urdhva-Tiryagbhyam — Vertically and Cross-wise), turning the calculation into a direct, visual flow.

### $2 \times 2$ Determinants: Pure Cross-Wise Execution

For a standard $2 \times 2$ matrix:


$$A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$$

The determinant is evaluated by taking the down-right diagonal product (vertical-right) and subtracting the up-right diagonal product (cross-left):


$$\det(A) = |A| = ad - bc$$

### $3 \times 3$ Determinants: The Extended Sarrus-Vedic Grid

For a $3 \times 3$ matrix:


$$A = \begin{pmatrix} a & b & c \\ d & e & f \\ g & h & i \end{pmatrix}$$

Instead of manually breaking the matrix down into three separate $2 \times 2$ minors, the Vedic method maps the structural elements into a continuous visual grid by appending the first two columns to the right side of the matrix:

$$\begin{matrix}
a & b & c & a & b \\
d & e & f & d & e \\
g & h & i & g & h
\end{matrix}$$

#### The Calculation Flow:

1. Sum the products of the three downward diagonals: $D = (aei) + (bfg) + (cdh)$
2. Sum the products of the three upward diagonals: $U = (gec) + (hfa) + (idb)$
3. Subtract the upward sum from the downward sum:

$$\det(A) = D - U$$



---

## 22.2 — Matrix Multiplication using Sutra 3 (Urdhva-Tiryak)

Conventional matrix multiplication requires rewriting rows and columns repeatedly, which often leads to minor tracking or calculation errors. The Vedic approach streams the data mentally, calculating each element of the resulting matrix in a single step.

### The Row-Stream Protocol

When multiplying an $m \times n$ matrix $A$ by an $n \times p$ matrix $B$, each cell $C_{ij}$ in the resulting matrix is computed by pairing the $i$-th row of $A$ with the $j$-th column of $B$. We evaluate these pairs cross-wise and sum them instantly.

```text
Visual Mapping for Cell C_11:
Matrix A (Row 1)   -->  [ a_1  a_2  a_3 ]
                         │     │     │     (Pair vertically and sum)
Matrix B (Col 1)   -->  [ b_1  b_2  b_3 ]

C_11 = (a_1  b_1) + (a_2  b_2) + (a_3  b_3)

```

By keeping a running mental total of these vertical pairs, you can write down the final components of the product matrix without needing intermediate paperwork.

---

## 22.3 — One-Line Mental Inversion of $2 \times 2$ Matrices

Inverting a $2 \times 2$ matrix conventionally requires calculating the determinant, finding the matrix of minors, applying a sign chart to get the cofactors, transposing to find the adjugate matrix, and finally dividing by the determinant.

Vedic Mathematics compresses these steps into a single rule: Swap the main diagonal elements, flip the signs of the off-diagonal elements, and scale by the reciprocal of the determinant.

### The Inversion Formula

Given a matrix $A$:


$$A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$$

If $\det(A) = ad - bc \neq 0$, its inverse $A^{-1}$ can be written in a single step as:


$$A^{-1} = \frac{1}{ad - bc} \begin{pmatrix} d & -b \\ -c & a \end{pmatrix}$$

---

## 22.4 — Cramer's Rule Enhanced by Vedic Computation

Cramer's Rule is a powerful method for solving systems of linear equations using determinants. However, it can become slow when dealing with large numbers.

We can speed up this process by combining Sutra 7 (Sankalana-Vyavakalanabhyam) with parallel determinant checks, allowing us to find the unknowns with minimal steps.

### The System Profile

Given the system of equations:


$$\begin{aligned}
a_1x + b_1y &= c_1 \\
a_2x + b_2y &= c_2
\end{aligned}$$

Instead of manually calculating three separate determinants from scratch, we set up a shared master denominator and evaluate the numerator components across common columns using a simple cross-wise shortcut:

$$D = a_1b_2 - a_2b_1$$

$$x = \frac{c_1b_2 - c_2b_1}{D}, \quad y = \frac{a_1c_2 - a_2c_1}{D}$$

---

## 22.5 — Finding Eigenvalues via Chalana-Kalanabhyam (Sutra 9)

Finding the eigenvalues of a matrix requires solving its characteristic equation, $\det(A - \lambda I) = 0$. For a $3 \times 3$ matrix, expanding this determinant conventionally involves a lengthy algebraic expansion.

Vedic Mathematics simplifies this by using trace invariants and a calculus-based shortcut derived from Sutra 9 (Chalana-Kalanabhyam), allowing us to write down the characteristic polynomial equation immediately.

### The Invariant Trace Equation for a $3 \times 3$ Matrix

$$\lambda^3 - S_1\lambda^2 + S_2\lambda - S_3 = 0$$

Where the coefficients are defined by the following matrix properties:

 $S_1$ (Trace of $A$): The sum of the main diagonal elements ($a_{11} + a_{22} + a_{33}$).
 $S_2$ (Sum of Principal Minors): The sum of the determinants of the principal $2 \times 2$ minors:

$$S_2 = \begin{vmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{vmatrix} + \begin{vmatrix} a_{22} & a_{23} \\ a_{32} & a_{33} \end{vmatrix} + \begin{vmatrix} a_{11} & a_{13} \\ a_{31} & a_{33} \end{vmatrix}$$


 $S_3$ (Determinant of $A$): The master determinant ($|A|$), evaluated using the quick Sarrus-Vedic grid method.

Once this characteristic polynomial equation is set up, any rational eigenvalues can be found using the fast inspection techniques covered in Module 21.

---

## 22.6 — Direct Solutions for Matrix Equations $AX = B$

To solve the matrix equation $AX = B$ for an unknown column matrix $X$, conventional methods require calculating the full matrix inverse $A^{-1}$ or performing lengthy Gauss-Jordan row reductions on an augmented matrix.

The Vedic method cuts through these steps by computing the elements of $X$ directly. We combine the rows of the adjugate matrix $\text{adj}(A)$ with the column values of $B$ in a single cross-wise step, and then scale the result by the master determinant:


$$X = A^{-1}B = \frac{1}{|A|} \left[ \text{adj}(A) \times B \right]$$

---

---

# PART 2: WORKED EXAMPLES

---

## Section A: Determinant Extractions

### Example 1

Question: Calculate the determinant of the $2 \times 2$ matrix $A = \begin{pmatrix} 7 & -4 \\ 3 & 9 \end{pmatrix}$ using the cross-wise method.

Answer:
Apply the cross-wise multiplication rule directly to the elements of the matrix:


$$\det(A) = (7 \times 9) - (-4 \times 3)$$

$$\det(A) = 63 - (-12) = 63 + 12 = 75$$


Final Answer: $\det(A) = 75$

---

### Example 2

Question: Evaluate the determinant of the $3 \times 3$ matrix below using the extended Sarrus-Vedic column expansion:


$$A = \begin{pmatrix} 2 & -1 & 3 \\ 4 & 1 & -2 \\ 5 & 3 & 6 \end{pmatrix}$$

Answer:

#### Step 1: Append the first two columns to the right of the matrix to set up the grid

$$\begin{matrix}
2 & -1 & 3 & 2 & -1 \\
4 & 1 & -2 & 4 & 1 \\
5 & 3 & 6 & 5 & 3
\end{matrix}$$

#### Step 2: Sum the products of the three downward diagonals ($D$)

 Diagonal 1: $2 \times 1 \times 6 = 12$
 Diagonal 2: $(-1) \times (-2) \times 5 = 10$
 Diagonal 3: $3 \times 4 \times 3 = 36$

$$D = 12 + 10 + 36 = 58$$



#### Step 3: Sum the products of the three upward diagonals ($U$)

 Diagonal 1: $5 \times 1 \times 3 = 15$
 Diagonal 2: $3 \times (-2) \times 2 = -12$
 Diagonal 3: $6 \times 4 \times (-1) = -24$

$$U = 15 + (-12) + (-24) = 15 - 36 = -21$$



#### Step 4: Compute the final determinant ($D - U$)

$$\det(A) = D - U = 58 - (-21) = 58 + 21 = 79$$


Final Answer: $\det(A) = 79$

---

## Section B: Matrix Multiplication via Urdhva-Tiryak

### Example 3

Question: Compute the product matrix $C = AB$ in a single line using the Urdhva-Tiryak cross-wise streaming method:


$$A = \begin{pmatrix} 3 & 2 \\ 1 & 4 \end{pmatrix}, \quad B = \begin{pmatrix} 5 & -2 \\ 3 & 6 \end{pmatrix}$$

Answer:
We evaluate each cell $C_{ij}$ of the resulting $2 \times 2$ matrix by pairing the rows of $A$ with the columns of $B$:

 Cell $C_{11}$ (Row 1 of $A$ $\times$ Column 1 of $B$):

$$C_{11} = (3 \times 5) + (2 \times 3) = 15 + 6 = 21$$


 Cell $C_{12}$ (Row 1 of $A$ $\times$ Column 2 of $B$):

$$C_{12} = (3 \times -2) + (2 \times 6) = -6 + 12 = 6$$


 Cell $C_{21}$ (Row 2 of $A$ $\times$ Column 1 of $B$):

$$C_{21} = (1 \times 5) + (4 \times 3) = 5 + 12 = 17$$


 Cell $C_{22}$ (Row 2 of $A$ $\times$ Column 2 of $B$):

$$C_{22} = (1 \times -2) + (4 \times 6) = -2 + 24 = 22$$



Assemble these calculated values directly into the final product matrix:


$$C = \begin{pmatrix} 21 & 6 \\ 17 & 22 \end{pmatrix}$$


Final Answer: $C = \begin{pmatrix} 21 & 6 \\ 17 & 22 \end{pmatrix}$

---

## Section C: Mental Matrix Inversion

### Example 4

Question: Find the inverse of the matrix $Matrix = \begin{pmatrix} 5 & 4 \\ 2 & 3 \end{pmatrix}$ using the one-line mental inversion method.

Answer:

#### Step 1: Calculate the determinant

$$\det = (5 \times 3) - (4 \times 2) = 15 - 8 = 7$$

#### Step 2: Swap the main diagonal elements and flip the signs of the off-diagonal elements

$$\begin{pmatrix} 5 & 4 \\ 2 & 3 \end{pmatrix} \longrightarrow \begin{pmatrix} 3 & -4 \\ -2 & 5 \end{pmatrix}$$

#### Step 3: Scale the adjusted matrix by the reciprocal of the determinant

$$\text{Inverse Matrix} = \frac{1}{7} \begin{pmatrix} 3 & -4 \\ -2 & 5 \end{pmatrix} = \begin{pmatrix} \frac{3}{7} & -\frac{4}{7} \\ -\frac{2}{7} & \frac{5}{7} \end{pmatrix}$$


Final Answer: $\begin{pmatrix} \frac{3}{7} & -\frac{4}{7} \\ -\frac{2}{7} & \frac{5}{7} \end{pmatrix}$

---

## Section D: Eigenvalue Extractions via Invariant Traces

### Example 5

Question: Find the characteristic polynomial equation and all corresponding eigenvalues for the $3 \times 3$ matrix below using the Vedic invariant trace shortcut:


$$A = \begin{pmatrix} 1 & 2 & 0 \\ 2 & 1 & 0 \\ 0 & 0 & 5 \end{pmatrix}$$

Answer:
The characteristic equation can be written in the form: $\lambda^3 - S_1\lambda^2 + S_2\lambda - S_3 = 0$.

#### Step 1: Calculate $S_1$ (The Trace of the matrix)

Sum the elements along the main diagonal:


$$S_1 = 1 + 1 + 5 = 7$$

#### Step 2: Calculate $S_2$ (The Sum of the Principal Minors)

Evaluate the determinants of the three primary $2 \times 2$ principal minors:


$$\text{Minor 1} = \begin{vmatrix} 1 & 2 \\ 2 & 1 \end{vmatrix} = (1 \times 1) - (2 \times 2) = 1 - 4 = -3$$

$$\text{Minor 2} = \begin{vmatrix} 1 & 0 \\ 0 & 5 \end{vmatrix} = (1 \times 5) - (0 \times 0) = 5$$

$$\text{Minor 3} = \begin{vmatrix} 1 & 0 \\ 0 & 5 \end{vmatrix} = (1 \times 5) - (0 \times 0) = 5$$

$$S_2 = (-3) + 5 + 5 = 7$$

#### Step 3: Calculate $S_3$ (The Determinant of the matrix)

Expand the determinant along the third column to make the calculation easy:


$$S_3 = 5 \times \begin{vmatrix} 1 & 2 \\ 2 & 1 \end{vmatrix} = 5 \times (1 - 4) = 5 \times (-3) = -15$$

#### Step 4: Assemble the Characteristic Equation

Substitute the values of $S_1$, $S_2$, and $S_3$ into our invariant trace equation:


$$\lambda^3 - 7\lambda^2 + 7\lambda - (-15) = 0 \implies \lambda^3 - 7\lambda^2 + 7\lambda + 15 = 0$$

#### Step 5: Extract the Roots (Eigenvalues)

Let's check the coefficients of the equation using the inspection techniques from Module 21:

 Test $\lambda = -1$: $(-1)^3 - 7(-1)^2 + 7(-1) + 15 = -1 - 7 - 7 + 15 = 0$.
Since it satisfies the equation, $\lambda = -1$ is an eigenvalue.

Factoring out $(\lambda + 1)$ leaves the remaining quadratic equation: $\lambda^2 - 8\lambda + 15 = 0$.
Factoring this quadratic gives: $(\lambda - 3)(\lambda - 5) = 0$, which yields $\lambda = 3$ and $\lambda = 5$.

Final Eigenvalues: $\lambda = -1, 3, 5$

---

---

# PART 3: PRACTICE EXERCISES

---

## Exercise Set A: Determinant calculations and Matrix Products

Solve each problem using the cross-wise pattern or Urdhva-Tiryak streaming methods. Write down your final matrices clearly.

A1. Evaluate the determinant of this $2 \times 2$ matrix: $\begin{pmatrix} 8 & 5 \\ 3 & 2 \end{pmatrix}$.

A2. Evaluate the determinant of this $2 \times 2$ matrix: $\begin{pmatrix} 6 & -3 \\ 4 & 7 \end{pmatrix}$.

A3. Find the determinant of the matrix $M = \begin{pmatrix} 1 & 2 & 3 \\ 0 & 4 & 5 \\ 1 & 0 & 6 \end{pmatrix}$ using the Sarrus-Vedic expansion grid.

A4. Evaluate the determinant of the matrix $B = \begin{pmatrix} 2 & -1 & 5 \\ 3 & 0 & 2 \\ 1 & 4 & -3 \end{pmatrix}$.

A5. Multiply these matrices in a single line using the Urdhva-Tiryak cross-wise method:


$$\begin{pmatrix} 4 & 1 \\ 2 & 3 \end{pmatrix} \begin{pmatrix} 2 & 5 \\ 1 & 6 \end{pmatrix}$$


A6. Multiply these matrices in a single line:


$$\begin{pmatrix} 5 & -1 \\ 2 & 4 \end{pmatrix} \begin{pmatrix} 3 & 0 \\ 7 & 2 \end{pmatrix}$$


A7. Compute the resulting column values for the matrix product below:


$$\begin{pmatrix} 1 & 2 & 3 \\ 2 & 0 & 1 \\ 3 & 1 & 2 \end{pmatrix} \begin{pmatrix} 2 \\ -1 \\ 4 \end{pmatrix}$$


A8. True or False: Matrix multiplication values can be calculated directly left-to-right across the resulting row cells without needing to write down any intermediate steps.

A9. Evaluate the determinant of the identity matrix $I_3$ using the Sarrus-Vedic method.

A10. Compute the square of the matrix ($A \times A$): $A = \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$.

---

## Exercise Set B: Mental Inversions & Matrix Equations

Invert each matrix or solve for the unknown matrix $X$ using the one-line Vedic shortcuts.

B1. Invert the $2 \times 2$ matrix: $\begin{pmatrix} 4 & 3 \\ 1 & 2 \end{pmatrix}$.

B2. Invert the $2 \times 2$ matrix: $\begin{pmatrix} 7 & 2 \\ 5 & 2 \end{pmatrix}$.

B3. Solve for the unknown vector $X = \begin{pmatrix} x \\ y \end{pmatrix}$ in the matrix equation $AX = B$, where:


$$A = \begin{pmatrix} 3 & 1 \\ 2 & 2 \end{pmatrix}, \quad B = \begin{pmatrix} 7 \\ 6 \end{pmatrix}$$


B4. Solve for the column vector $X$ in the system $AX = B$, given:


$$A = \begin{pmatrix} 5 & 2 \\ 3 & 2 \end{pmatrix}, \quad B = \begin{pmatrix} 11 \\ 9 \end{pmatrix}$$


B5. Use the enhanced Cramer's rule method to find the values of $x$ and $y$ for the system:


$$\begin{aligned}
4x + 3y &= 25 \\
x + 2y &= 10
\end{aligned}$$

---

## Exercise Set C: Characteristic Polynomials & Eigenvalues

Determine the characteristic polynomial equation and all corresponding eigenvalues for each matrix using the invariant trace shortcut.

C1. Find the eigenvalues of the matrix: $\begin{pmatrix} 2 & 0 \\ 0 & 7 \end{pmatrix}$.

C2. Find the characteristic polynomial equation for the matrix: $\begin{pmatrix} 3 & 2 \\ 4 & 1 \end{pmatrix}$.

C3. Find the eigenvalues of the matrix: $\begin{pmatrix} 4 & 1 \\ 3 & 2 \end{pmatrix}$.

C4. Find the invariant trace coefficients $S_1$, $S_2$, and $S_3$ for the $3 \times 3$ matrix:


$$A = \begin{pmatrix} 2 & 0 & 0 \\ 0 & 3 & 0 \\ 0 & 0 & 4 \end{pmatrix}$$


C5. Find all the eigenvalues for the matrix given in problem C4.

---

## Answer Key for Practice Exercises

### Set A Answers

A1. $1$

A2. $54$

A3. $19$

A4. $53$

A5. $\begin{pmatrix} 9 & 26 \\ 7 & 28 \end{pmatrix}$

A6. $\begin{pmatrix} 8 & -2 \\ 34 & 8 \end{pmatrix}$

A7. $\begin{pmatrix} 12 \\ 8 \\ 13 \end{pmatrix}$

A8. True

A9. $1$

A10. $\begin{pmatrix} 7 & 10 \\ 15 & 22 \end{pmatrix}$

### Set B Answers

B1. $\begin{pmatrix} \frac{2}{5} & -\frac{3}{5} \\ -\frac{1}{5} & \frac{4}{5} \end{pmatrix}$

B2. $\begin{pmatrix} \frac{1}{2} & -\frac{1}{2} \\ -\frac{5}{4} & \frac{7}{4} \end{pmatrix}$

B3. $X = \begin{pmatrix} 2 \\ 1 \end{pmatrix}$

B4. $X = \begin{pmatrix} 1 \\ 3 \end{pmatrix}$

B5. $x = 4, y = 3$

### Set C Answers

C1. $\lambda = 2, 7$

C2. $\lambda^2 - 4\lambda - 5 = 0$

C3. $\lambda = 1, 5$

C4. $S_1 = 9, S_2 = 26, S_3 = 24$

C5. $\lambda = 2, 3, 4$

---

---

# PART 4: ONLINE TEST BANK

---

## 📝 TEST 1: ADVANCED TOPICS QUIZ

Format: Multiple Choice Questions (MCQ)

Total Marks: 20 | Time: 15 minutes

---

Q1. What is the value of the determinant of the matrix $A = \begin{pmatrix} 5 & -3 \\ 2 & 4 \end{pmatrix}$?

 A) 14
 B) 26  ✅
 C) 22
 D) 17

---

Q2. Which Vedic sutra forms the basis for computing matrix products by mapping rows and columns into cross-wise calculations?

 A) Paravartya Yojayet
 B) Urdhva-Tiryagbhyam ✅
 C) Sankalana-Vyavakalanabhyam
 D) Shunyam Samyasamuccaye

---

Q3. If you invert the matrix $\begin{pmatrix} 3 & 2 \\ 1 & 2 \end{pmatrix}$ mentally, what is the value of the leading element ($C_{11}$) in the resulting inverse matrix?

 A) $\frac{1}{2}$  ✅
 B) $\frac{1}{4}$
 C) $2$
 D) $-\frac{1}{2}$

---

Q4. When using the invariant trace equation $\lambda^3 - S_1\lambda^2 + S_2\lambda - S_3 = 0$ to find eigenvalues, what matrix property determines the value of coefficient $S_1$?

 A) The master determinant of the matrix
 B) The product of the principal cross-terms
 C) The trace of the matrix (sum of the main diagonal elements)  ✅
 D) The rank of the matrix

---

Q5. Find the determinant of the $3 \times 3$ matrix below using the Sarrus-Vedic shortcut method:


$$\begin{pmatrix} 1 & 0 & 2 \\ 3 & 1 & 4 \\ 0 & 2 & 5 \end{pmatrix}$$

 A) $9$
 B) $7$  ✅
 C) $-3$
 D) $11$

---

Q6. If a matrix has a determinant of exactly zero ($\det(A) = 0$), it means the matrix:

 A) Is identity symmetric
 B) Cannot be inverted (is singular)  ✅
 C) Has pure imaginary eigenvalues
 D) Is orthogonal

---

Q7. What is the resulting product matrix for the calculation $\begin{pmatrix} 2 & 0 \\ 0 & 2 \end{pmatrix} \begin{pmatrix} 3 & 4 \\ 5 & 6 \end{pmatrix}$?

 A) $\begin{pmatrix} 6 & 8 \\ 10 & 12 \end{pmatrix}$  ✅
 B) $\begin{pmatrix} 5 & 6 \\ 7 & 8 \end{pmatrix}$
 C) $\begin{pmatrix} 6 & 4 \\ 5 & 12 \end{pmatrix}$
 D) $\begin{pmatrix} 3 & 8 \\ 5 & 12 \end{pmatrix}$

---

Q8. For a $3 \times 3$ matrix, if the invariant trace coefficients are calculated as $S_1 = 6$, $S_2 = 11$, and $S_3 = 6$, what is its characteristic polynomial equation?

 A) $\lambda^3 + 6\lambda^2 + 11\lambda + 6 = 0$
 B) $\lambda^3 - 6\lambda^2 + 11\lambda - 6 = 0$  ✅
 C) $\lambda^3 - 6\lambda^2 - 11\lambda + 6 = 0$
 D) $\lambda^3 + 6\lambda^2 - 11\lambda - 6 = 0$

---

Q9. What is the value of the principal $2 \times 2$ minor determinant containing the upper-left elements for the matrix $\begin{pmatrix} 4 & 1 & 0 \\ 2 & 3 & 1 \\ 0 & 1 & 5 \end{pmatrix}$?

 A) $10$  ✅
 B) $12$
 C) $14$
 D) $8$

---

Q10. The matrix equation solution method $X = \frac{1}{|A|} [ \text{adj}(A) \times B ]$ combines matrix multiplication with which core Vedic concept?

 A) Anurupyena ratio scaling
 B) Single-line cross-wise integration  ✅
 C) Synthetic remainder reductions
 D) Casting out nines balances

---

## 📝 TEST 2: COMPUTATIONAL EFFICIENCY TRACK

Format: Fill in the Blank + Short Answer

Total Marks: 30 | Time: 25 minutes

---

Q1. [Fill in the Blank] The determinant of the matrix $\begin{pmatrix} 9 & 4 \\ 5 & 3 \end{pmatrix}$ calculated using cross-wise multiplication is _______.

Answer: 7

---

Q2. [Fill in the Blank] The sum of the elements along the main diagonal (the Trace) of the matrix $\begin{pmatrix} 5 & 1 & 2 \\ 3 & -2 & 4 \\ 1 & 0 & 8 \end{pmatrix}$ is _______.

Answer: 11

---

Q3. [Fill in the Blank] The inverse of the matrix $\begin{pmatrix} 3 & 1 \\ 5 & 2 \end{pmatrix}$ is a matrix with integer values whose upper-left element ($C_{11}$) equals _______.

Answer: 2

---

Q4. [Short Answer] Find the product matrix $C = AB$ using the single-line Urdhva-Tiryak cross-wise method:


$$A = \begin{pmatrix} 6 & 1 \\ 3 & 2 \end{pmatrix}, \quad B = \begin{pmatrix} 2 & 4 \\ 1 & 5 \end{pmatrix}$$


Answer: Evaluate each cell of the resulting matrix: $C_{11} = (6 \times 2) + (1 \times 1) = 13$. $C_{12} = (6 \times 4) + (1 \times 5) = 29$. $C_{21} = (3 \times 2) + (2 \times 1) = 8$. $C_{22} = (3 \times 4) + (2 \times 5) = 22$. This gives the final product matrix: $C = \begin{pmatrix} 13 & 29 \\ 8 & 22 \end{pmatrix}$.

---

Q5. [Short Answer] Solve the system of equations below using the enhanced Cramer's rule shortcut:


$$\begin{aligned}
5x + 3y &= 22 \\
2x + 4y &= 20
\end{aligned}$$


Answer: Calculate the master denominator determinant: $D = (5 \times 4) - (3 \times 2) = 20 - 6 = 14$. Calculate the numerator determinant for $x$: $D_x = (22 \times 4) - (20 \times 3) = 88 - 60 = 28$. This gives $x = \frac{28}{14} = 2$. Next, calculate the numerator determinant for $y$: $D_y = (5 \times 20) - (2 \times 22) = 100 - 44 = 56$. This gives $y = \frac{56}{14} = 4$. Final solution: $x = 2, y = 4$.

---

## 📝 TEST 3: COMPREHENSIVE PERFORMANCE EXAM

Format: Mixed Structural Questions

Total Marks: 50 | Time: 45 minutes

---

### Section 1: Multiple Choice Questions (20 Marks)

Q1. What is the determinant of the matrix $M = \begin{pmatrix} 2 & 3 \\ 1 & 5 \end{pmatrix}$?

 A) $7$  ✅
 B) $13$
 C) $11$
 D) $5$

Q2. Which option shows the correct characteristic polynomial equation for the matrix $\begin{pmatrix} 4 & 0 \\ 0 & 3 \end{pmatrix}$?

 A) $\lambda^2 - 7\lambda + 12 = 0$  ✅
 B) $\lambda^2 + 7\lambda + 12 = 0$
 C) $\lambda^2 - 7\lambda - 12 = 0$
 D) $\lambda^2 - 4\lambda + 3 = 0$

Q3. What is the resulting product vector for the calculation $\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix} \begin{pmatrix} 5 \\ 6 \end{pmatrix}$?

 A) $\begin{pmatrix} 17 \\ 39 \end{pmatrix}$  ✅
 B) $\begin{pmatrix} 11 \\ 23 \end{pmatrix}$
 C) $\begin{pmatrix} 12 \\ 34 \end{pmatrix}$
 D) $\begin{pmatrix} 15 \\ 40 \end{pmatrix}$

Q4. In the invariant trace equation for a $3 \times 3$ matrix, what matrix property determines the value of coefficient $S_3$?

 A) The sum of the main diagonal elements
 B) The sum of the principal minors
 C) The determinant of the matrix ($|A|$)  ✅
 D) The square of the trace

Q5. What is the inverse of the matrix $\begin{pmatrix} 1 & 2 \\ 3 & 7 \end{pmatrix}$?

 A) $\begin{pmatrix} 7 & -2 \\ -3 & 1 \end{pmatrix}$  ✅
 B) $\begin{pmatrix} 7 & 2 \\ 3 & 1 \end{pmatrix}$
 C) $\begin{pmatrix} -7 & 2 \\ 3 & -1 \end{pmatrix}$
 D) $\begin{pmatrix} 1 & -2 \\ -3 & 7 \end{pmatrix}$

---

### Section 2: Fill in the Blank Questions (15 Marks)

Q6. The method for evaluating a $3 \times 3$ determinant by extending its column fields is known as the Extended Sarrus-_______ grid.

Answer: Vedic

Q7. If you multiply a matrix by its inverse ($A \times A^{-1}$), you get the _______ matrix.

Answer: Identity

Q8. The sum of the principal $2 \times 2$ minor determinants for the matrix $\begin{pmatrix} 1 & 0 & 0 \\ 0 & 2 & 0 \\ 0 & 0 & 3 \end{pmatrix}$ is _______.

Answer: 11

Q9. When solving a system of linear equations using Cramer's Rule, the equations have a unique solution if the master denominator determinant is non-_______.

Answer: zero

Q10. The characteristic polynomial equation for a $2 \times 2$ matrix can be written in terms of its trace ($T$) and determinant ($D$) as $\lambda^2 - T\lambda +$ _______ $= 0$.

Answer: D

---

### Section 3: Short Answer Proofs & Solutions (15 Marks)

Q11. Find all the eigenvalues for the matrix below using the invariant trace method. Show all your steps clearly:


$$A = \begin{pmatrix} 2 & 1 & 1 \\ 1 & 2 & 1 \\ 1 & 1 & 2 \end{pmatrix}$$


Answer:

 Step 1: Calculate $S_1$ (Trace): $S_1 = 2 + 2 + 2 = 6$.
 Step 2: Calculate $S_2$ (Sum of Principal Minors): All three principal minors are identical: $\begin{vmatrix} 2 & 1 \\ 1 & 2 \end{vmatrix} = 4 - 1 = 3$. This gives $S_2 = 3 + 3 + 3 = 9$.
 Step 3: Calculate $S_3$ (Determinant): $|A| = 2(4-1) - 1(2-1) + 1(1-2) = 2(3) - 1(1) + 1(-1) = 6 - 1 - 1 = 4$.
 Step 4: Assemble the characteristic equation: $\lambda^3 - 6\lambda^2 + 9\lambda - 4 = 0$.
 Step 5: Find the roots: The sum of all coefficients is $1 - 6 + 9 - 4 = 0$, so $\lambda = 1$ is an eigenvalue. Factoring out $(\lambda - 1)$ leaves $\lambda^2 - 5\lambda + 4 = 0$, which factors into $(\lambda - 1)(\lambda - 4) = 0$. This gives the final eigenvalues: $\lambda = 1, 1, 4$.

---

Q12. Solve for the unknown column vector $X$ in the matrix equation $AX = B$ using the direct adjugate multiplication method:


$$\begin{pmatrix} 3 & 2 \\ 4 & 3 \end{pmatrix} X = \begin{pmatrix} 12 \\ 17 \end{pmatrix}$$


Answer:

 Step 1: Calculate the determinant of matrix $A$: $|A| = (3 \times 3) - (2 \times 4) = 9 - 8 = 1$.
 Step 2: Find the adjugate matrix by swapping the main diagonal elements and flipping the signs of the off-diagonal elements: $\text{adj}(A) = \begin{pmatrix} 3 & -2 \\ -4 & 3 \end{pmatrix}$.
 Step 3: Multiply the adjugate matrix by vector $B$ to find $X$: $X = \frac{1}{1} \begin{pmatrix} 3 & -2 \\ -4 & 3 \end{pmatrix} \begin{pmatrix} 12 \\ 17 \end{pmatrix} = \begin{pmatrix} (3 \times 12) + (-2 \times 17) \\ (-4 \times 12) + (3 \times 17) \end{pmatrix} = \begin{pmatrix} 36 - 34 \\ -48 + 51 \end{pmatrix} = \begin{pmatrix} 2 \\ 3 \end{pmatrix}$.
Final Solution: $X = \begin{pmatrix} 2 \\ 3 \end{pmatrix}$

---

Q13. Evaluate the determinant of the $3 \times 3$ matrix below using the extended Sarrus-Vedic column grid method:


$$M = \begin{pmatrix} 1 & 2 & -1 \\ 3 & 4 & 2 \\ 5 & 0 & 1 \end{pmatrix}$$


Answer:

 Set up the extended grid by appending the first two columns to the right:

$$\begin{matrix}
1 & 2 & -1 & 1 & 2 \\
3 & 4 & 2 & 3 & 4 \\
5 & 0 & 1 & 5 & 0
\end{matrix}$$


 Sum the downward diagonal products: $D = (1 \times 4 \times 1) + (2 \times 2 \times 5) + (-1 \times 3 \times 0) = 4 + 20 + 0 = 24$.
 Sum the upward diagonal products: $U = (5 \times 4 \times -1) + (0 \times 2 \times 1) + (1 \times 3 \times 2) = -20 + 0 + 6 = -14$.
 Calculate the final determinant: $\det(M) = D - U = 24 - (-14) = 24 + 14 = 38$.

---

---

# PART 5: TEACHER'S GUIDE & CLASSROOM ACTIVITIES

---

## 22.7 — Advanced Classroom Activities

### Activity 1: The Matrix Product Relay Race

 Objective: Master single-line matrix multiplication using the Urdhva-Tiryak cross-wise method.
 Procedure: Divide the classroom into teams of four. Write a $2 \times 2$ matrix multiplication problem on the board. Each student in a team is responsible for calculating exactly one cell of the resulting matrix ($C_{11}, C_{12}, C_{21}$, or $C_{22}$) using mental arithmetic. The student must run up and fill in their cell before passing the chalk to the next teammate. The team that correctly completes the entire matrix first wins.
 Duration: 20 minutes.

### Activity 2: The 5-Second Determinant Showdown

 Objective: Build speed and accuracy when evaluating $2 \times 2$ determinants mentally.
 Procedure: Two students step up to the board. The teacher calls out four numbers to form a $2 \times 2$ matrix (e.g., "Five, three, two, four!"). The first student to mentally compute the cross-wise determinant ($(5 \times 4) - (3 \times 2) = 14$) and write it down wins the round. Repeat with new pairs of students to keep the activity fast and engaging.
 Duration: 15 minutes.

---

## 22.8 — Common Student Mistakes & Corrections

1. Mixing up Diagonal Signs during Matrix Inversion
 Error: Students often confuse the operations for the main and off diagonals when inverting a $2 \times 2$ matrix (e.g., flipping the signs of the main diagonal instead of swapping the elements).
 Correction: Use the simple visual reminder: "Swap the main diagonal, change the signs of the off diagonal." Have students draw arrows for swapping and minus signs for the off-diagonal terms until the habit is solid.


2. Forgetting to Subtract the Upward Diagonal Sum in Sarrus-Vedic Computations
 Error: Performing the calculation as $D + U$ instead of $D - U$ when evaluating a $3 \times 3$ determinant, which leads to an incorrect sign for the upward terms.
 Correction: Emphasize that the determinant measures structural area, meaning upward diagonal steps must always subtract from downward diagonal steps: $\det = \text{Down} - \text{Up}$.


3. Row-Column Alignment Errors during Matrix Multiplication
 Error: Trying to match rows with rows or columns with columns when computing the product matrix cells, which breaks the required structural matching.
 Correction: Have students use their left hand to trace across the row of the first matrix, and their right hand to trace down the column of the second matrix. This physical movement helps ensure they pair elements correctly.



---

---

# QUICK REFERENCE CARD

## Module 22 Summary Sheet (Print-Friendly)

```text
╔═════════════════════════════════════════════════════════════════════════╗
║                VEDIC MATHEMATICS — MODULE 22 CHEAT SHEET                ║
╠═════════════════════════════════════════════════════════════════════════╣
║ MENTAL 2x2 MATRIX INVERSION                                             ║
║ Given a matrix A = | a  b |, calculate its determinant: det = ad - bc   ║
║                    | c  d |                                             ║
║ Inverse Matrix A⁻¹ = (1 / det)  |  d  -b |                             ║
║                                  | -c   a |                             ║
║ Rule: Swap the main diagonal elements, flip the signs of off-diagonals. ║
╠════════════════════════════════════════════╚════════════════════════════╣
║ 3x3 SARRUS-VEDIC DETERMINANT GRID                                       ║
║ - Append the first two columns to the right side of the 3x3 matrix.     ║
║ - Sum the products of the 3 downward diagonals (D).                     ║
║ - Sum the products of the 3 upward diagonals (U).                       ║
║ - Final Determinant = D - U                                             ║
╠═════════════════════════════════════════════════════════════════════════╣
║ MATRIX MULTIPLICATION VIA URDHVA-TIRYAK (SUTRA 3)                       ║
║ - Compute each cell C_ij in the resulting matrix in a single step by    ║
║   pairing the i-th row of matrix A with the j-th column of matrix B.    ║
║ - Multiply corresponding elements vertically and sum them mentally:     ║
║   C_ij = (Row_i • Col_j)                                                ║
╠═════════════════════════════════════════════════════════════════════════╣
║ INVARIANT TRACE EIGENVALUE FIELDS (SUTRA 9)                             ║
║ Characteristic equation:  λ³ - S₁λ² + S₂λ - S₃ = 0                      ║
║ - S₁ = Trace of the matrix (sum of the main diagonal elements).         ║
║ - S₂ = Sum of the determinants of the three principal 2x2 minors.       ║
║ - S₃ = Master determinant of the matrix (|A|).                          ║
╚═════════════════════════════════════════════════════════════════════════╝

```
