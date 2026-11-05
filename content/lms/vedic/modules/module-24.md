# 🕉️ VEDIC MATHEMATICS — LEVEL 3: ADVANCED
# MODULE 24: Calculus — Vedic Integral Calculus
## Complete Study Material | Theory + Examples + Practice + Test Bank

---

> "Integration is the art of seeing the whole from its infinitesimal parts. Puranapuranabhyam teaches us that by completing what is missing, we reveal the complete picture."
> — Vedic Mathematics Teacher's Manual

---

## 📋 MODULE AT A GLANCE

| Item | Details |
|------|---------|
| Level | Advanced (Level 3) |
| Module Number | 24 of 10 (Level 3, Module 4) |
| Target Age | 16+ years (Class 11–12 students, JEE aspirants) |
| Duration | 6–7 hours (Theory: 2.5 hrs, Practice: 2.5 hrs, Test: 1.5 hrs) |
| Prerequisites | Level 1 & 2 completion, Basic differentiation, Basic integration formulas, Limits |
| Sutra Focus | Sutra 8 — Puranapuranabhyam; Sutra 9 — Chalana-Kalanabhyam; Sub-Sutra 11 — Lopana-Sthapanabhyam |
| Next Module | Module 25: Calculus — Differential Equations |

---

## 🎯 LEARNING OUTCOMES

By the end of this module, the student will be able to:

1. Apply Puranapuranabhyam (completion) to integrate quadratic denominators
2. Perform integration by parts using the Vedic ILATE sequence
3. Evaluate definite integrals using symmetry and Lopana-Sthapanabhyam
4. Decompose partial fractions using Vedic cross-multiplication
5. Compute area under curves using Vedic summation patterns
6. Derive reduction formulae using Sutra 9 (Chalana-Kalanabhyam)
7. Solve basic double integrals using the Cartesian product view
8. Complete integration problems in 50% less time than conventional methods

---

# PART 1: THEORY

---

## 1.1 — Introduction to Vedic Integral Calculus

### What is Integral Calculus?

Integral calculus is the study of accumulation — finding the whole from its infinitesimal parts. It is the inverse of differentiation.

### The Vedic Perspective

| Conventional Approach | Vedic Approach |
|----------------------|----------------|
| Memorize dozens of integration formulas | Derive patterns from sutras |
| Step-by-step substitution | Complete the square (Puranapuranabhyam) |
| Trial and error for partial fractions | Cross-multiplication (Urdhva) |
| Lengthy reduction derivations | Pattern recognition (Chalana-Kalanabhyam) |

---

## 1.2 — Sutra 8: Puranapuranabhyam

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| पूरणापूरणाभ्याम् | Puranapuranabhyam | By completion or non-completion |

### What Does This Mean?

This sutra teaches us to:
- Complete what is missing (add a term to make a perfect square)
- Non-complete by subtracting what was added

In integral calculus, this is most powerful for integrating expressions involving quadratic denominators.

### Application: Completing the Square

For an integral of the form:

$$\int \frac{dx}{ax^2 + bx + c}$$

We complete the square:

$$ax^2 + bx + c = a\left[\left(x + \frac{b}{2a}\right)^2 + \left(\frac{c}{a} - \frac{b^2}{4a^2}\right)\right]$$

Then use standard formulas for $\int \frac{dx}{x^2 + k^2}$ or $\int \frac{dx}{x^2 - k^2}$.

---

### Example 1: $\int \frac{dx}{x^2 + 4x + 13}$

Step 1: Complete the square
$x^2 + 4x + 13 = (x^2 + 4x + 4) + 9 = (x + 2)^2 + 3^2$

Step 2: Recognize formula $\int \frac{dx}{x^2 + a^2} = \frac{1}{a}\tan^{-1}\frac{x}{a}$

$$\int \frac{dx}{(x+2)^2 + 3^2} = \frac{1}{3}\tan^{-1}\frac{x+2}{3} + C$$ ✓

---

### Example 2: $\int \frac{dx}{x^2 + 6x + 25}$

Complete square: $x^2 + 6x + 25 = (x+3)^2 + 16 = (x+3)^2 + 4^2$

$$\int \frac{dx}{(x+3)^2 + 4^2} = \frac{1}{4}\tan^{-1}\frac{x+3}{4} + C$$ ✓

---

### Example 3: $\int \frac{dx}{4x^2 + 4x + 2}$

First factor out 4: $4x^2 + 4x + 2 = 4\left(x^2 + x + \frac{1}{2}\right)$

Complete square inside: $x^2 + x + \frac{1}{2} = \left(x + \frac{1}{2}\right)^2 + \frac{1}{4}$

So integral = $\frac{1}{4} \int \frac{dx}{\left(x + \frac{1}{2}\right)^2 + \left(\frac{1}{2}\right)^2} = \frac{1}{4} \times \frac{1}{1/2} \tan^{-1}\frac{x+1/2}{1/2} = \frac{1}{2}\tan^{-1}(2x+1) + C$ ✓

---

### Example 4: $\int \frac{dx}{\sqrt{9 - (x-2)^2}}$

This is already in the form $\int \frac{dx}{\sqrt{a^2 - u^2}} = \sin^{-1}\frac{u}{a}$

$$\int \frac{dx}{\sqrt{9 - (x-2)^2}} = \sin^{-1}\frac{x-2}{3} + C$$ ✓

---

## 1.3 — Integration of Linear/Quadratic: Puranapuranabhyam Extended

For integrals of the form $\int \frac{px + q}{ax^2 + bx + c} dx$, we split into two parts:

$$\int \frac{px + q}{ax^2 + bx + c} dx = \int \frac{\frac{p}{2a}(2ax + b) + \left(q - \frac{pb}{2a}\right)}{ax^2 + bx + c} dx$$

The first part integrates to $\frac{p}{2a} \ln|ax^2 + bx + c|$

The second part uses completing the square (Puranapuranabhyam)

---

### Example: $\int \frac{x + 3}{x^2 + 4x + 13} dx$

Step 1: Write numerator in terms of derivative of denominator
$d/dx(x^2+4x+13) = 2x+4$

$x + 3 = \frac{1}{2}(2x+4) + 1$

Step 2: Split integral
$$\int \frac{x+3}{x^2+4x+13} dx = \frac{1}{2} \int \frac{2x+4}{x^2+4x+13} dx + \int \frac{dx}{x^2+4x+13}$$

Step 3: First part = $\frac{1}{2} \ln|x^2+4x+13|$

Step 4: Second part: Complete square $(x+2)^2 + 3^2$ → $\frac{1}{3}\tan^{-1}\frac{x+2}{3}$

Step 5: Combine: $\frac{1}{2}\ln|x^2+4x+13| + \frac{1}{3}\tan^{-1}\frac{x+2}{3} + C$ ✓

---

## 1.4 — Integration by Parts: Vedic ILATE Sequence

### Sutra 11: Vyashti Samashti (Part and Whole)

In integration by parts, we break the product into parts and then combine.

### The ILATE Rule (Vedic Sequencing)

| Letter | Meaning | Priority |
|--------|---------|----------|
| I | Inverse trigonometric | Highest |
| L | Logarithmic | |
| A | Algebraic | |
| T | Trigonometric | |
| E | Exponential | Lowest |

Rule: Choose first function (u) as the one with higher priority in ILATE.

$$\int u \cdot v \, dx = u \int v \, dx - \int \left( \frac{du}{dx} \int v \, dx \right) dx$$

---

### Example 1: $\int x \cdot e^x dx$

Here: x (Algebraic — priority A), e^x (Exponential — priority E)
A comes before E, so u = x, v = e^x

$$\int x e^x dx = x e^x - \int 1 \cdot e^x dx = x e^x - e^x + C = e^x(x-1) + C$$ ✓

---

### Example 2: $\int x \sin x \, dx$

u = x (Algebraic), v = sin x (Trigonometric)

$$\int x \sin x \, dx = x(-\cos x) - \int 1 \cdot (-\cos x) dx = -x\cos x + \sin x + C$$ ✓

---

### Example 3: $\int \ln x \, dx$

Write as $\int 1 \cdot \ln x \, dx$
u = ln x (Logarithmic — priority L), v = 1 (Algebraic — priority A)
L > A, so u = ln x

$$\int \ln x \, dx = x \ln x - \int x \cdot \frac{1}{x} dx = x \ln x - x + C$$ ✓

---

### Example 4: $\int x^2 e^x dx$

u = x², v = e^x

$$\int x^2 e^x dx = x^2 e^x - \int 2x e^x dx = x^2 e^x - 2\left[x e^x - e^x\right] + C = e^x(x^2 - 2x + 2) + C$$ ✓

---

### Example 5: $\int e^x \sin x \, dx$ (Cyclic)

Here both functions (exponential and trigonometric) have equal priority. Use the cyclic method:

Let I = $\int e^x \sin x \, dx$
u = sin x, v = e^x

I = $e^x \sin x - \int e^x \cos x \, dx$

Now integrate $\int e^x \cos x \, dx$:
= $e^x \cos x + \int e^x \sin x \, dx = e^x \cos x + I$

Substitute back:
I = $e^x \sin x - [e^x \cos x + I] = e^x \sin x - e^x \cos x - I$

2I = $e^x(\sin x - \cos x)$

I = $\frac{e^x}{2}(\sin x - \cos x) + C$ ✓

---

## 1.5 — Definite Integrals: Lopana-Sthapanabhyam

### Sub-Sutra 11: Lopana-Sthapanabhyam

| Sanskrit | Transliteration | English Meaning |
|----------|-----------------|-----------------|
| लोपन-स्थापनाभ्याम् | Lopana-Sthapanabhyam | By alternate elimination and retention |

### Application to Definite Integrals

This sutra suggests using symmetry to eliminate (lopana) certain terms and retain (sthapana) others.

### Property 1: Even and Odd Functions

| Function type | Property | $\int_{-a}^{a} f(x) dx$ |
|---------------|----------|------------------------|
| Even: $f(-x) = f(x)$ | Symmetric | $2\int_{0}^{a} f(x) dx$ |
| Odd: $f(-x) = -f(x)$ | Anti-symmetric | $0$ |

### Example 1: $\int_{-2}^{2} x^3 dx$

$x^3$ is odd → integral = 0 ✓

---

### Example 2: $\int_{-1}^{1} (x^4 + x^2) dx$

Both are even functions:
= $2\int_{0}^{1} (x^4 + x^2) dx = 2\left[\frac{x^5}{5} + \frac{x^3}{3}\right]_0^1 = 2\left(\frac{1}{5} + \frac{1}{3}\right) = 2\left(\frac{3+5}{15}\right) = \frac{16}{15}$ ✓

---

### Property 2: $\int_{0}^{a} f(x) dx = \int_{0}^{a} f(a-x) dx$

This is the King's rule — a Vedic insight using Lopana-Sthapanabhyam.

### Example 3: $\int_{0}^{\pi/2} \frac{\sin x}{\sin x + \cos x} dx$

Let I = $\int_{0}^{\pi/2} \frac{\sin x}{\sin x + \cos x} dx$

Using $x \to \pi/2 - x$:
I = $\int_{0}^{\pi/2} \frac{\cos x}{\cos x + \sin x} dx$

Add the two expressions:
2I = $\int_{0}^{\pi/2} \frac{\sin x + \cos x}{\sin x + \cos x} dx = \int_{0}^{\pi/2} 1 dx = \frac{\pi}{2}$

I = $\pi/4$ ✓

---

### Example 4: $\int_{0}^{\pi/2} \frac{dx}{1 + \tan x}$

I = $\int_{0}^{\pi/2} \frac{dx}{1 + \tan x}$

Using $x \to \pi/2 - x$, $\tan(\pi/2 - x) = \cot x$:

I = $\int_{0}^{\pi/2} \frac{dx}{1 + \cot x} = \int_{0}^{\pi/2} \frac{\tan x}{1 + \tan x} dx$

Add: 2I = $\int_{0}^{\pi/2} \frac{1 + \tan x}{1 + \tan x} dx = \int_{0}^{\pi/2} 1 dx = \frac{\pi}{2}$

I = $\pi/4$ ✓

---

## 1.6 — Partial Fractions: Vedic Decomposition (Urdhva)

### Sutra 3: Urdhva-Tiryagbhyam

For rational functions $\frac{P(x)}{(x-a)(x-b)(x-c)}$, the partial fractions coefficients can be found by cross-multiplication.

### Formula for Distinct Linear Factors

$$\frac{P(x)}{(x-a)(x-b)(x-c)} = \frac{A}{x-a} + \frac{B}{x-b} + \frac{C}{x-c}$$

Where:
$A = \frac{P(a)}{(a-b)(a-c)}$, $B = \frac{P(b)}{(b-a)(b-c)}$, $C = \frac{P(c)}{(c-a)(c-b)}$

This is a direct Vedic cross-multiplication result!

---

### Example 1: $\frac{x+3}{(x-1)(x-2)}$

A = $\frac{1+3}{(1-2)} = \frac{4}{-1} = -4$
B = $\frac{2+3}{(2-1)} = \frac{5}{1} = 5$

So $\frac{x+3}{(x-1)(x-2)} = \frac{-4}{x-1} + \frac{5}{x-2}$ ✓

Check: $(-4)(x-2) + 5(x-1) = -4x+8+5x-5 = x+3$ ✓

---

### Example 2: $\frac{2x+1}{(x-1)(x+2)}$

A = $\frac{2(1)+1}{(1+2)} = \frac{3}{3} = 1$
B = $\frac{2(-2)+1}{(-2-1)} = \frac{-4+1}{-3} = \frac{-3}{-3} = 1$

So = $\frac{1}{x-1} + \frac{1}{x+2}$ ✓

---

### Example 3: $\int \frac{dx}{x^2 - 4}$

First factor: $x^2 - 4 = (x-2)(x+2)$

Partial fractions: $\frac{1}{(x-2)(x+2)} = \frac{A}{x-2} + \frac{B}{x+2}$

A = $\frac{1}{(2+2)} = \frac{1}{4}$, B = $\frac{1}{(-2-2)} = -\frac{1}{4}$

So = $\frac{1}{4(x-2)} - \frac{1}{4(x+2)}$

Integrate: $\frac{1}{4} \ln|x-2| - \frac{1}{4} \ln|x+2| + C = \frac{1}{4} \ln\left|\frac{x-2}{x+2}\right| + C$ ✓

---

## 1.7 — Area Under Curves: Vedic Computation

### The Fundamental Concept

Area under curve y = f(x) from x = a to x = b:

$$A = \int_a^b f(x) dx$$

### Vedic Symmetry Shortcuts

For symmetric functions over symmetric intervals:

| Function type | Area shortcut |
|---------------|---------------|
| Even over [-a,a] | $2\int_0^a f(x)dx$ |
| Odd over [-a,a] | 0 |
| Periodic over one period | Single period integration |

### Example 1: Area under y = x² from x = -2 to 2

Even function: $2\int_0^2 x^2 dx = 2\left[\frac{x^3}{3}\right]_0^2 = 2 \times \frac{8}{3} = \frac{16}{3}$ ✓

---

### Example 2: Area of circle $x^2 + y^2 = a^2$

$y = \sqrt{a^2 - x^2}$ (upper half)

Area of circle = $4 \int_0^a \sqrt{a^2 - x^2} dx$

Using substitution $x = a\sin\theta$, $dx = a\cos\theta d\theta$:

= $4 \int_0^{\pi/2} a\cos\theta \cdot a\cos\theta d\theta = 4a^2 \int_0^{\pi/2} \cos^2\theta d\theta$

= $4a^2 \times \frac{\pi}{4} = \pi a^2$ ✓

---

## 1.8 — Reduction Formulae: Sutra 9 Patterns

### Sutra 9: Chalana-Kalanabhyam (Differences)

This sutra suggests finding patterns by examining differences between successive terms.

### Reduction Formula for $\int \sin^n x \, dx$

Let $I_n = \int \sin^n x \, dx$

$I_n = -\frac{1}{n} \sin^{n-1} x \cos x + \frac{n-1}{n} I_{n-2}$

### Derivation using Chalana-Kalanabhyam pattern

Example: $\int \sin^3 x \, dx$

Using reduction formula with n=3:
$I_3 = -\frac{1}{3} \sin^2 x \cos x + \frac{2}{3} I_1$
$I_1 = -\cos x$

$I_3 = -\frac{1}{3} \sin^2 x \cos x - \frac{2}{3} \cos x + C$
= $-\frac{\cos x}{3}(\sin^2 x + 2) + C = -\frac{\cos x}{3}(3 - \cos^2 x) + C$ ✓

---

### Reduction Formula for $\int \tan^n x \, dx$

$I_n = \int \tan^n x \, dx = \frac{\tan^{n-1} x}{n-1} - I_{n-2}$

Example: $\int \tan^3 x \, dx$

$I_3 = \frac{\tan^2 x}{2} - I_1$
$I_1 = \int \tan x \, dx = -\ln|\cos x|$

So $I_3 = \frac{\tan^2 x}{2} + \ln|\cos x| + C$ ✓

---

## 1.9 — Double Integrals: Introductory Vedic View

### The Cartesian Product Concept

A double integral over a rectangle:

$$\iint_R f(x,y) \, dA = \int_{x=a}^{b} \int_{y=c}^{d} f(x,y) \, dy \, dx$$

### Vedic Insight: Separation of Variables

If $f(x,y) = g(x) \cdot h(y)$, then:

$$\iint_R g(x)h(y) \, dA = \left(\int_a^b g(x) dx\right) \left(\int_c^d h(y) dy\right)$$

### Example 1: $\iint_R xy \, dA$ over R: x=[0,2], y=[0,3]

= $\left(\int_0^2 x dx\right) \left(\int_0^3 y dy\right) = \left[\frac{x^2}{2}\right]_0^2 \times \left[\frac{y^2}{2}\right]_0^3 = \left(\frac{4}{2}\right) \times \left(\frac{9}{2}\right) = 2 \times \frac{9}{2} = 9$ ✓

---

### Example 2: $\iint_R x^2 y^3 \, dA$ over R: x=[1,2], y=[0,1]

= $\left(\int_1^2 x^2 dx\right) \left(\int_0^1 y^3 dy\right) = \left[\frac{x^3}{3}\right]_1^2 \times \left[\frac{y^4}{4}\right]_0^1 = \left(\frac{8-1}{3}\right) \times \frac{1}{4} = \frac{7}{3} \times \frac{1}{4} = \frac{7}{12}$ ✓

---

## 1.10 — Summary: Sutra Applications in Integral Calculus

| Sutra | Application |
|-------|-------------|
| Sutra 8 — Puranapuranabhyam | Completing the square for quadratic denominators |
| Sutra 11 — Vyashti Samashti | ILATE sequence for integration by parts |
| Sub-Sutra 11 — Lopana-Sthapanabhyam | Symmetry in definite integrals |
| Sutra 3 — Urdhva-Tiryagbhyam | Partial fraction coefficients |
| Sutra 9 — Chalana-Kalanabhyam | Reduction formulae patterns |

---

# PART 2: WORKED EXAMPLES

---

## Section A: Integration by Completing Square (Puranapuranabhyam)

### Example 1

Question: $\int \frac{dx}{x^2 + 2x + 10}$

Answer:

Complete square: $x^2 + 2x + 10 = (x+1)^2 + 9 = (x+1)^2 + 3^2$

$$\int \frac{dx}{(x+1)^2 + 3^2} = \frac{1}{3} \tan^{-1} \frac{x+1}{3} + C$$ ✓

---

### Example 2

Question: $\int \frac{dx}{4x^2 - 8x + 5}$

Answer:

Factor 4: $4\left(x^2 - 2x + \frac{5}{4}\right) = 4\left[(x-1)^2 + \frac{1}{4}\right] = 4\left[(x-1)^2 + \left(\frac{1}{2}\right)^2\right]$

$$\int \frac{dx}{4[(x-1)^2 + (1/2)^2]} = \frac{1}{4} \times \frac{1}{1/2} \tan^{-1} \frac{x-1}{1/2} = \frac{1}{2} \tan^{-1}(2x-2) + C$$ ✓

---

### Example 3

Question: $\int \frac{dx}{\sqrt{5 - 4x - x^2}}$

Answer:

Complete square inside square root:
$5 - 4x - x^2 = -(x^2 + 4x - 5) = -[(x+2)^2 - 9] = 9 - (x+2)^2$

$$\int \frac{dx}{\sqrt{9 - (x+2)^2}} = \sin^{-1} \frac{x+2}{3} + C$$ ✓

---

## Section B: Integration of Linear/Quadratic (Puranapuranabhyam)

### Example 4

Question: $\int \frac{2x+1}{x^2 + 4x + 5} dx$

Answer:

Derivative of denominator: $2x+4$

$2x+1 = (2x+4) - 3$

$$\int \frac{2x+1}{x^2+4x+5} dx = \int \frac{2x+4}{x^2+4x+5} dx - 3\int \frac{dx}{x^2+4x+5}$$

First part = $\ln|x^2+4x+5|$

Complete square for second: $x^2+4x+5 = (x+2)^2 + 1$

So second part = $3 \tan^{-1}(x+2)$

Answer = $\ln|x^2+4x+5| - 3\tan^{-1}(x+2) + C$ ✓

---

### Example 5

Question: $\int \frac{3x+5}{x^2 + 2x + 10} dx$

Answer:

Derivative of denominator: $2x+2$

$3x+5 = \frac{3}{2}(2x+2) + 2$ (since $\frac{3}{2} \times 2 = 3$, $\frac{3}{2} \times 2 = 3$, then $5 - 3 = 2$)

$$\int \frac{3x+5}{x^2+2x+10} dx = \frac{3}{2} \int \frac{2x+2}{x^2+2x+10} dx + 2\int \frac{dx}{x^2+2x+10}$$

First part = $\frac{3}{2} \ln|x^2+2x+10|$

Second: $x^2+2x+10 = (x+1)^2 + 3^2$ → $2 \times \frac{1}{3} \tan^{-1}\frac{x+1}{3} = \frac{2}{3} \tan^{-1}\frac{x+1}{3}$

Answer = $\frac{3}{2} \ln|x^2+2x+10| + \frac{2}{3} \tan^{-1}\frac{x+1}{3} + C$ ✓

---

## Section C: Integration by Parts (ILATE Sequence)

### Example 6

Question: $\int x \cos x \, dx$

Answer:

u = x (Algebraic), v = cos x (Trigonometric)

$$\int x \cos x \, dx = x \sin x - \int 1 \cdot \sin x \, dx = x \sin x + \cos x + C$$ ✓

---

### Example 7

Question: $\int x^2 e^{3x} dx$

Answer:

u = x², v = e^{3x}
$\int x^2 e^{3x} dx = x^2 \cdot \frac{e^{3x}}{3} - \int 2x \cdot \frac{e^{3x}}{3} dx = \frac{x^2 e^{3x}}{3} - \frac{2}{3} \int x e^{3x} dx$

Now $\int x e^{3x} dx = \frac{x e^{3x}}{3} - \int \frac{e^{3x}}{3} dx = \frac{x e^{3x}}{3} - \frac{e^{3x}}{9}$

Substitute back:
= $\frac{x^2 e^{3x}}{3} - \frac{2}{3} \left( \frac{x e^{3x}}{3} - \frac{e^{3x}}{9} \right) = \frac{x^2 e^{3x}}{3} - \frac{2x e^{3x}}{9} + \frac{2e^{3x}}{27} + C$

= $e^{3x} \left( \frac{x^2}{3} - \frac{2x}{9} + \frac{2}{27} \right) + C$ ✓

---

### Example 8

Question: $\int e^{2x} \cos 3x \, dx$ (Cyclic)

Answer:

Let I = $\int e^{2x} \cos 3x \, dx$

Using integration by parts:
I = $e^{2x} \cdot \frac{\sin 3x}{3} - \int 2e^{2x} \cdot \frac{\sin 3x}{3} dx = \frac{e^{2x} \sin 3x}{3} - \frac{2}{3} \int e^{2x} \sin 3x dx$

Now J = $\int e^{2x} \sin 3x dx = e^{2x} \cdot \frac{-\cos 3x}{3} - \int 2e^{2x} \cdot \frac{-\cos 3x}{3} dx = -\frac{e^{2x} \cos 3x}{3} + \frac{2}{3} I$

Substitute: I = $\frac{e^{2x} \sin 3x}{3} - \frac{2}{3} \left( -\frac{e^{2x} \cos 3x}{3} + \frac{2}{3} I \right)$

I = $\frac{e^{2x} \sin 3x}{3} + \frac{2e^{2x} \cos 3x}{9} - \frac{4}{9} I$

$I + \frac{4}{9}I = \frac{13}{9}I = \frac{e^{2x}}{9}(3\sin 3x + 2\cos 3x)$

I = $\frac{e^{2x}}{13}(3\sin 3x + 2\cos 3x) + C$ ✓

---

## Section D: Definite Integrals — Symmetry (Lopana-Sthapanabhyam)

### Example 9

Question: $\int_{-\pi/2}^{\pi/2} \sin^3 x \, dx$

Answer:

$\sin^3 x$ is odd (since $\sin(-x) = -\sin x$, cube preserves oddness)

Integral over symmetric interval = 0 ✓

---

### Example 10

Question: $\int_{-2}^{2} (x^5 + x^3 + x) dx$

Answer:

All terms are odd functions → integral = 0 ✓

---

### Example 11

Question: $\int_{0}^{\pi} \frac{x \sin x}{1 + \cos^2 x} dx$

Answer:

Use property $\int_0^a f(x) dx = \int_0^a f(a-x) dx$

Let I = $\int_{0}^{\pi} \frac{x \sin x}{1 + \cos^2 x} dx$

Replace x → π−x: I = $\int_{0}^{\pi} \frac{(\pi-x) \sin(\pi-x)}{1 + \cos^2(\pi-x)} dx = \int_{0}^{\pi} \frac{(\pi-x) \sin x}{1 + \cos^2 x} dx$

Add: 2I = $\int_{0}^{\pi} \frac{\pi \sin x}{1 + \cos^2 x} dx = \pi \int_{0}^{\pi} \frac{\sin x}{1 + \cos^2 x} dx$

Let u = cos x, du = −sin x dx, limits: x=0 → u=1, x=π → u=-1

2I = $\pi \int_{1}^{-1} \frac{-du}{1+u^2} = \pi \int_{-1}^{1} \frac{du}{1+u^2} = \pi \left[\tan^{-1}u\right]_{-1}^{1} = \pi \left(\frac{\pi}{4} - \left(-\frac{\pi}{4}\right)\right) = \pi \times \frac{\pi}{2} = \frac{\pi^2}{2}$

I = $\frac{\pi^2}{4}$ ✓

---

## Section E: Partial Fractions

### Example 12

Question: $\int \frac{5x+1}{(x-2)(x+3)} dx$

Answer:

Find A and B: $\frac{5x+1}{(x-2)(x+3)} = \frac{A}{x-2} + \frac{B}{x+3}$

A = $\frac{5(2)+1}{2+3} = \frac{11}{5}$
B = $\frac{5(-3)+1}{-3-2} = \frac{-15+1}{-5} = \frac{-14}{-5} = \frac{14}{5}$

So = $\frac{11}{5(x-2)} + \frac{14}{5(x+3)}$

Integrate: $\frac{11}{5} \ln|x-2| + \frac{14}{5} \ln|x+3| + C$ ✓

---

### Example 13

Question: $\int \frac{dx}{x^2 - 9}$

Answer:

$\frac{1}{(x-3)(x+3)} = \frac{A}{x-3} + \frac{B}{x+3}$

A = $\frac{1}{3+3} = \frac{1}{6}$, B = $\frac{1}{-3-3} = -\frac{1}{6}$

= $\frac{1}{6} \ln|x-3| - \frac{1}{6} \ln|x+3| + C = \frac{1}{6} \ln\left|\frac{x-3}{x+3}\right| + C$ ✓

---

## Section F: Reduction Formulae

### Example 14

Question: Find reduction formula for $I_n = \int \cos^n x \, dx$

Answer:

$I_n = \int \cos^{n-1} x \cdot \cos x \, dx$

Using integration by parts: u = cos^{n-1}x, v = cos x

$I_n = \cos^{n-1}x \sin x - \int (n-1)\cos^{n-2}x (-\sin x) \sin x \, dx$

$= \cos^{n-1}x \sin x + (n-1) \int \cos^{n-2}x \sin^2 x \, dx$

$= \cos^{n-1}x \sin x + (n-1) \int \cos^{n-2}x (1 - \cos^2 x) dx$

$= \cos^{n-1}x \sin x + (n-1) I_{n-2} - (n-1) I_n$

$I_n + (n-1)I_n = \cos^{n-1}x \sin x + (n-1) I_{n-2}$

$n I_n = \cos^{n-1}x \sin x + (n-1) I_{n-2}$

$I_n = \frac{\cos^{n-1}x \sin x}{n} + \frac{n-1}{n} I_{n-2}$ ✓

---

### Example 15

Question: Find $\int \cos^4 x \, dx$ using reduction formula

Answer:

Using $I_n = \frac{\cos^{n-1}x \sin x}{n} + \frac{n-1}{n} I_{n-2}$

$I_4 = \frac{\cos^3 x \sin x}{4} + \frac{3}{4} I_2$

$I_2 = \frac{\cos x \sin x}{2} + \frac{1}{2} I_0 = \frac{\cos x \sin x}{2} + \frac{x}{2}$

So $I_4 = \frac{\cos^3 x \sin x}{4} + \frac{3}{4} \left( \frac{\cos x \sin x}{2} + \frac{x}{2} \right)$

$= \frac{\cos^3 x \sin x}{4} + \frac{3 \cos x \sin x}{8} + \frac{3x}{8} + C$ ✓

---

# PART 3: PRACTICE EXERCISES

---

## Exercise Set A: Integration by Completing Square (15 Questions)

Integrate using Puranapuranabhyam.

A1. $\int \frac{dx}{x^2 + 6x + 10}$
A2. $\int \frac{dx}{x^2 - 8x + 25}$
A3. $\int \frac{dx}{2x^2 + 4x + 3}$
A4. $\int \frac{dx}{x^2 + 2x + 2}$
A5. $\int \frac{dx}{4x^2 - 12x + 10}$
A6. $\int \frac{dx}{\sqrt{4 - (x-1)^2}}$
A7. $\int \frac{dx}{\sqrt{9 - x^2 + 4x}}$
A8. $\int \frac{dx}{\sqrt{x^2 + 2x + 5}}$
A9. $\int \frac{x+1}{x^2 + 2x + 5} dx$
A10. $\int \frac{2x+3}{x^2 + 4x + 13} dx$
A11. $\int \frac{3x-1}{x^2 + 6x + 10} dx$
A12. $\int \frac{x}{x^2 + 2x + 2} dx$
A13. $\int \frac{2x+5}{x^2 + 4x + 8} dx$
A14. $\int \frac{dx}{(x-1)^2 + 4}$
A15. $\int \frac{dx}{\sqrt{25 - (x+2)^2}}$

---

## Exercise Set B: Integration by Parts (10 Questions)

Use ILATE sequence.

B1. $\int x e^x dx$
B2. $\int x \sin 2x dx$
B3. $\int x^2 \ln x dx$
B4. $\int \ln x dx$
B5. $\int x \tan^{-1} x dx$
B6. $\int e^x \cos x dx$
B7. $\int \sin^{-1} x dx$
B8. $\int x^3 e^x dx$
B9. $\int e^{ax} \sin bx dx$
B10. $\int x^n \ln x dx$

---

## Exercise Set C: Definite Integrals — Symmetry (10 Questions)

Use Lopana-Sthapanabhyam.

C1. $\int_{-3}^{3} x^5 dx$
C2. $\int_{-2}^{2} (x^4 + x^2) dx$
C3. $\int_{-\pi/2}^{\pi/2} \cos x dx$
C4. $\int_{-\pi}^{\pi} \sin^5 x dx$
C5. $\int_{0}^{\pi/2} \frac{\sin^3 x}{\sin^3 x + \cos^3 x} dx$
C6. $\int_{0}^{\pi/2} \frac{dx}{1 + \tan^3 x}$
C7. $\int_{0}^{\pi} \frac{x}{1 + \sin x} dx$
C8. $\int_{0}^{\pi/2} \ln(\sin x) dx$
C9. $\int_{0}^{\pi/2} \frac{\cos x}{\cos x + \sin x} dx$
C10. $\int_{-a}^{a} \sqrt{a^2 - x^2} dx$ (area of semicircle)

---

## Exercise Set D: Partial Fractions (10 Questions)

Decompose and integrate.

D1. $\int \frac{dx}{(x-1)(x-2)}$
D2. $\int \frac{x+2}{(x-3)(x+1)} dx$
D3. $\int \frac{2x+5}{(x-1)(x+2)} dx$
D4. $\int \frac{3x-2}{(x-4)(x+5)} dx$
D5. $\int \frac{x^2}{(x-1)(x-2)} dx$ (Note: improper fraction first)
D6. $\int \frac{dx}{x^2 - 1}$
D7. $\int \frac{dx}{x^2 - 4}$
D8. $\int \frac{dx}{x^2 + x - 2}$
D9. $\int \frac{dx}{2x^2 - 3x - 2}$
D10. $\int \frac{x^2 + 1}{(x-1)(x+2)} dx$

---

## Exercise Set E: Reduction Formulae (5 Questions)

E1. Derive reduction formula for $I_n = \int \tan^n x dx$
E2. Find $\int \tan^4 x dx$
E3. Find $\int \sin^4 x dx$
E4. Find $\int \sec^3 x dx$ (requires IBP)
E5. Find $\int \sin^6 x dx$

---

## Exercise Set F: Double Integrals (5 Questions)

F1. $\iint_R xy^2 dA$ over R: x=[0,2], y=[0,3]
F2. $\iint_R x^2 y dA$ over R: x=[1,3], y=[0,2]
F3. $\iint_R e^{x+y} dA$ over R: x=[0,1], y=[0,1]
F4. $\iint_R \cos x \sin y dA$ over R: x=[0,π/2], y=[0,π/2]
F5. $\iint_R (x+y) dA$ over R: x=[0,1], y=[0,1]

---

## Answer Key for Practice Exercises

### Set A Answers:
A1. $\frac{1}{2}\tan^{-1}\frac{x+3}{2}+C$ | A2. $\frac{1}{3}\tan^{-1}\frac{x-4}{3}+C$ | A3. $\frac{1}{\sqrt{2}}\tan^{-1}\frac{2x+2}{\sqrt{2}}+C$ | A4. $\tan^{-1}(x+1)+C$ | A5. $\frac{1}{2}\tan^{-1}(2x-3)+C$ | A6. $\sin^{-1}\frac{x-1}{2}+C$ | A7. $\sin^{-1}\frac{x-2}{3}+C$ | A8. $\sinh^{-1}\frac{x+1}{2}+C$ | A9. $\frac{1}{2}\ln|x^2+2x+5| + C$ | A10. $\ln|x^2+4x+13| + \frac{3}{2}\tan^{-1}\frac{x+2}{3}+C$ | A11. $\frac{3}{2}\ln|x^2+6x+10| - \frac{10}{2}\tan^{-1}(x+3)+C$ | A12. $\frac{1}{2}\ln|x^2+2x+2| - \tan^{-1}(x+1)+C$ | A13. $\ln|x^2+4x+8| + \frac{3}{2}\tan^{-1}\frac{x+2}{2}+C$ | A14. $\frac{1}{2}\tan^{-1}\frac{x-1}{2}+C$ | A15. $\sin^{-1}\frac{x+2}{5}+C$

### Set B Answers:
B1. $e^x(x-1)+C$ | B2. $-\frac{x}{2}\cos 2x + \frac{1}{4}\sin 2x + C$ | B3. $\frac{x^3}{3}\ln x - \frac{x^3}{9}+C$ | B4. $x\ln x - x + C$ | B5. $\frac{x^2}{2}\tan^{-1}x - \frac{x}{2} + \frac{1}{2}\tan^{-1}x + C$ | B6. $\frac{e^x}{2}(\sin x + \cos x)+C$ | B7. $x\sin^{-1}x + \sqrt{1-x^2}+C$ | B8. $e^x(x^3 - 3x^2 + 6x - 6)+C$ | B9. $\frac{e^{ax}}{a^2+b^2}(a\sin bx - b\cos bx)+C$ | B10. $\frac{x^{n+1}}{n+1}\ln x - \frac{x^{n+1}}{(n+1)^2}+C$

### Set C Answers:
C1. 0 | C2. $\frac{272}{15}$ | C3. 2 | C4. 0 | C5. $\frac{\pi}{4}$ | C6. $\frac{\pi}{4}$ | C7. $\pi$ | C8. $-\frac{\pi}{2}\ln 2$ | C9. $\frac{\pi}{4}$ | C10. $\frac{\pi a^2}{2}$

### Set D Answers:
D1. $\ln\left|\frac{x-2}{x-1}\right|+C$ | D2. $\frac{5}{4}\ln|x-3| - \frac{1}{4}\ln|x+1|+C$ | D3. $\frac{7}{3}\ln|x-1| - \frac{1}{3}\ln|x+2|+C$ | D4. $\frac{10}{9}\ln|x-4| + \frac{17}{9}\ln|x+5|+C$ | D5. $x + 2\ln|x-1| + \frac{4}{3}\ln|x-2|+C$ | D6. $\frac{1}{2}\ln\left|\frac{x-1}{x+1}\right|+C$ | D7. $\frac{1}{4}\ln\left|\frac{x-2}{x+2}\right|+C$ | D8. $\frac{1}{3}\ln\left|\frac{x-1}{x+2}\right|+C$ | D9. $\frac{1}{5}\ln\left|\frac{2x+1}{x-2}\right|+C$ | D10. $x - \frac{2}{3}\ln|x-1| + \frac{5}{3}\ln|x+2|+C$

### Set E Answers:
E1. $I_n = \frac{\tan^{n-1}x}{n-1} - I_{n-2}$ | E2. $\frac{\tan^3 x}{3} - \tan x + x + C$ | E3. $\frac{3x}{8} - \frac{\sin 2x}{4} + \frac{\sin 4x}{32} + C$ | E4. $\frac{1}{2}\sec x \tan x + \frac{1}{2}\ln|\sec x + \tan x| + C$ | E5. $\frac{5x}{16} - \frac{\sin 2x}{4} + \frac{\sin 4x}{64} + \frac{\sin^3 2x}{48} + C$

### Set F Answers:
F1. 9 | F2. $\frac{32}{3}$ | F3. $(e-1)^2$ | F4. 1 | F5. 1

---

# PART 4: ONLINE TEST BANK

---

## 📝 TEST 1: Integration by Completing Square (Puranapuranabhyam)
Format: Multiple Choice Questions
Total Marks: 20 | Time: 20 minutes

---

Q1. [EASY] $\int \frac{dx}{x^2 + 4} = ?$
- A) $\frac{1}{2}\tan^{-1}\frac{x}{2} + C$ ✅
- B) $\tan^{-1}\frac{x}{2} + C$
- C) $\frac{1}{4}\tan^{-1}x + C$
- D) $\frac{1}{2}\tan^{-1}x + C$

Q2. [MEDIUM] $\int \frac{dx}{x^2 + 6x + 13} = ?$
- A) $\frac{1}{2}\tan^{-1}\frac{x+3}{2} + C$ ✅
- B) $\frac{1}{3}\tan^{-1}\frac{x+3}{2} + C$
- C) $\frac{1}{2}\tan^{-1}\frac{x-3}{2} + C$
- D) $\tan^{-1}(x+3) + C$

Q3. [MEDIUM] $\int \frac{dx}{\sqrt{9 - x^2}} = ?$
- A) $\sin^{-1}\frac{x}{3} + C$ ✅
- B) $\cos^{-1}\frac{x}{3} + C$
- C) $\frac{1}{3}\sin^{-1}x + C$
- D) $\sin^{-1}x + C$

Q4. [HARD] $\int \frac{2x+1}{x^2 + 4x + 13} dx = ?$
- A) $\ln|x^2+4x+13| - \frac{5}{3}\tan^{-1}\frac{x+2}{3} + C$
- B) $\ln|x^2+4x+13| - \frac{3}{2}\tan^{-1}\frac{x+2}{3} + C$
- C) $\ln|x^2+4x+13| - 3\tan^{-1}\frac{x+2}{3} + C$
- D) $\ln|x^2+4x+13| - \frac{7}{3}\tan^{-1}\frac{x+2}{3} + C$ ✅

Q5. [EASY] Sutra 8 "Puranapuranabhyam" means:
- A) By addition and subtraction
- B) By completion or non-completion ✅
- C) By transposition
- D) By mere observation

---

## 📝 TEST 2: Integration by Parts & ILATE
Format: Fill in the blank
Total Marks: 20 | Time: 15 minutes

---

Q1. [EASY] In ILATE, the letter 'I' stands for _____.
Answer: Inverse trigonometric

Q2. [EASY] $\int x e^x dx = e^x(x - 1) + \_\_\_$.
Answer: C

Q3. [MEDIUM] $\int \ln x dx = x \ln x - \_\_\_ + C$.
Answer: x

Q4. [MEDIUM] $\int x \sin x dx = -x \cos x + \_\_\_ + C$.
Answer: sin x

Q5. [HARD] $\int e^x \cos x dx = \frac{e^x}{2}(\sin x + \_\_\_) + C$.
Answer: cos x

---

## 📝 TEST 3: Definite Integrals & Symmetry
Format: MCQ
Total Marks: 20 | Time: 15 minutes

---

Q1. [EASY] $\int_{-2}^{2} x^3 dx = ?$
- A) 0 ✅
- B) 16
- C) 8
- D) -8

Q2. [MEDIUM] $\int_{-1}^{1} (x^4 + x^2) dx = ?$
- A) $\frac{8}{15}$ 
- B) $\frac{16}{15}$ ✅
- C) $\frac{4}{15}$
- D) $\frac{2}{5}$

Q3. [MEDIUM] $\int_{0}^{\pi/2} \frac{\sin x}{\sin x + \cos x} dx = ?$
- A) 0
- B) $\frac{\pi}{2}$
- C) $\frac{\pi}{4}$ ✅
- D) $\pi$

Q4. [HARD] $\int_{0}^{\pi} x \sin x dx = ?$
- A) $\pi$ ✅
- B) $2\pi$
- C) $0$
- D) $\frac{\pi}{2}$

Q5. [EASY] Sub-Sutra "Lopana-Sthapanabhyam" means:
- A) By completion
- B) By elimination and retention ✅
- C) By cross-multiplication
- D) By ratio

---

## 📝 TEST 4: Comprehensive Module Test
Format: Mixed
Total Marks: 40 | Time: 30 minutes

---

Section 1: MCQ (10 marks)

Q1. $\int \frac{dx}{x^2 + 4x + 8} = \frac{1}{2}\tan^{-1}\frac{x+2}{2} + C$ (True/False)
Q2. $\int x^2 e^x dx = e^x(x^2 - 2x + 2) + C$ (True/False)
Q3. $\int_{-1}^{1} x^5 dx = 2\int_0^1 x^5 dx$ (True/False) → False (odd function → 0)

---

Section 2: Fill in the Blank (10 marks)

Q4. $\int \frac{x}{x^2+4} dx = \frac{1}{2}\ln|\_\_\_| + C$
Q5. $\int \frac{dx}{x^2-1} = \frac{1}{2}\ln\left|\frac{x-1}{x+1}\right| + \_\_\_$

---

Section 3: Short Answer (10 marks)

Q6. Compute $\int \frac{x+2}{x^2+4x+13} dx$
Q7. Compute $\int x^2 \cos x dx$
Q8. Evaluate $\int_{0}^{\pi/2} \frac{\cos x}{\cos x + \sin x} dx$
Q9. Decompose $\frac{3x+7}{(x-1)(x+2)}$ into partial fractions
Q10. State the reduction formula for $\int \sin^n x dx$

---

Section 4: Long Answer (10 marks)

Q11. Derive the integration by parts formula from the product rule of differentiation. Then use it to evaluate $\int x^3 \ln x dx$.

---

# PART 5: TEACHER'S GUIDE

---

## Common Mistakes & Corrections

| Mistake | Correction |
|---------|-----------|
| Forgetting to adjust for coefficient when completing square | Always factor out leading coefficient first |
| Misidentifying u and v in ILATE | Follow priority: I > L > A > T > E |
| Sign errors in integration by parts | Remember: $\int u dv = uv - \int v du$ |
| Forgetting absolute values in log integrals | $\int \frac{dx}{x} = \ln|x| + C$ |
| Missing constant of integration | Always add $+C$ for indefinite integrals |

---

## Sutra Summary for Calculus

| Sutra | Application |
|-------|-------------|
| Puranapuranabhyam (8) | Completing the square |
| Vyashti Samashti (11) | ILATE sequence |
| Lopana-Sthapanabhyam (Sub 11) | Definite integral symmetry |
| Urdhva-Tiryagbhyam (3) | Partial fractions |
| Chalana-Kalanabhyam (9) | Reduction formulae |

---

# QUICK REFERENCE CARD

```
╔═══════════════════════════════════════════════════════════════════════╗
║                 MODULE 24 — CALCULUS: VEDIC INTEGRAL CALCULUS          ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  PURANAPURANABHYAM (Completion):                                      ║
║  ∫ dx/(ax²+bx+c) → Complete square → arctan or log form               ║
║                                                                       ║
║  ILATE SEQUENCE (Integration by Parts):                               ║
║  I > L > A > T > E (choose u as higher priority)                      ║
║                                                                       ║
║  LOPANA-STHAPANABHYAM (Symmetry):                                     ║
║  • Odd function over [-a,a] → 0                                       ║
║  • Even function over [-a,a] → 2∫₀ᵃ                                    ║
║  • ∫₀ᵃ f(x)dx = ∫₀ᵃ f(a-x)dx                                        ║
║                                                                       ║
║  PARTIAL FRACTIONS (Urdhva):                                          ║
║  For (x-a)(x-b), A = P(a)/(a-b), B = P(b)/(b-a)                       ║
║                                                                       ║
║  REDUCTION FORMULAE (Chalana-Kalanabhyam):                            ║
║  Iₙ = ∫ sinⁿ x dx = -1/n sinⁿ⁻¹x cos x + (n-1)/n Iₙ₋₂                 ║
║                                                                       ║
║  DOUBLE INTEGRALS (Separation):                                       ║
║  If f(x,y)=g(x)h(y), ∬ = ∫g(x)dx × ∫h(y)dy                           ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```
