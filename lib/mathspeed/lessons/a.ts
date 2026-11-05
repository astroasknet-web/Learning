import type { Lesson } from "../curriculum";

/** Level A: Number Foundations. */
export const LESSONS_A: Record<string, Lesson> = {
  "A-01": {
    blurb: "Know what each digit in a number is worth.",
    learn: [
      "A digit's value depends on where it sits. In 4,732 the 7 is in the hundreds place, so it is worth 700, not 7.",
      "Places run in groups of ten, from the right: ones, tens, hundreds, thousands, ten-thousands. Each place is worth ten times the one to its right.",
    ],
    steps: ["Find the digit you are asked about.", "Count its place from the right: ones, tens, hundreds, thousands.", "Write the digit followed by that many zeros (ones place has no zeros).", "Say the value out loud: seven hundred."],
    understand: [
      "Our number system is built on tens. Moving one place left multiplies by 10; moving one place right divides by 10. That is why 70 is ten times 7 and 700 is ten times 70.",
      "A zero holds a place. In 4,032 the zero says there are no hundreds, so the 4 stays in the thousands and the 3 in the tens.",
    ],
    mistakes: ["Reading the digit instead of its value: the 7 in 4,732 is 700.", "Counting places from the left. Always start at the ones on the right."],
    tip: "A digit is worth the digit times its place.",
  },
  "A-02": {
    blurb: "Build a number from its parts and read it back.",
    learn: [
      "Any number can be written as a sum of its places. 5,324 is 5 × 1,000 + 3 × 100 + 2 × 10 + 4.",
      "Reading a number in parts is how you add and subtract in your head later: you work with the parts, not the whole number.",
    ],
    steps: ["Write each digit times its place value.", "Skip places that hold a zero.", "Add the parts from the biggest to the smallest.", "Check: does the answer have the right number of digits?"],
    understand: ["Adding the parts rebuilds the number because each place holds a different size. Nothing is lost or counted twice.", "When a place is empty, the part is zero, so you can leave it out of the sum but you must keep the place when writing the number."],
    mistakes: ["Dropping a zero place and writing 5,34 instead of 5,034.", "Mixing up 2 × 10 (twenty) and 2 × 100 (two hundred)."],
    tip: "Add the biggest parts first and the number builds itself.",
  },
  "A-03": {
    blurb: "Spot the rule in a pattern and keep it going, up or down.",
    learn: [
      "A counting pattern changes by the same amount each step: 5, 10, 15, 20 goes up by 5. Find the step by subtracting neighbours.",
      "Patterns can go down too: 90, 80, 70 goes down by 10. Once you know the step, the next number is the last number plus (or minus) the step.",
    ],
    steps: ["Subtract the first number from the second to find the step.", "Check the step is the same between other neighbours.", "Add the step to the last number (or subtract it if the pattern goes down).", "Say the whole pattern to hear if it fits."],
    understand: ["A fixed step means the numbers are multiples shifted by a starting point, so you can leap ahead: the 6th number is the start plus 5 steps.", "Counting in tens, fives and twos is the base of every times table you will learn later."],
    mistakes: ["Using the gap between the wrong pair of numbers.", "Forgetting a pattern can go down and adding instead of subtracting."],
    tip: "Find the step once, then use it again and again.",
  },
  "A-04": {
    blurb: "Decide which of two or three numbers is larger or smaller, fast.",
    learn: [
      "Compare numbers from the left. The number with more digits is larger. If the lengths match, compare the first digits; if they match, move one place right.",
      "Do this for two numbers or for three. With three, find the largest by comparing the first two, then comparing the winner with the third.",
    ],
    steps: ["Count the digits. More digits means a bigger number.", "If the digits are equal in number, compare the leftmost digits.", "If they match, compare the next digits, and so on.", "Pick the largest or smallest as the question asks."],
    understand: ["The leftmost digits sit in the biggest places, so they matter most. 9,100 beats 8,999 because one thousand more is worth more than all the smaller digits.", "Comparing from the right gives wrong answers because small places carry little weight."],
    mistakes: ["Comparing the last digits first.", "Answering with the larger number when the question asked for the smaller."],
    tip: "Longer number wins; if equal length, the first different digit decides.",
  },
  "A-05": {
    blurb: "Add single digits instantly, including making ten.",
    learn: [
      "Adding single digits is the engine of every sum you will do. The goal is to know each answer without counting.",
      "A strong trick is making ten. For 8 + 5, take 2 from the 5 to make 10 with the 8, then add the 3 that is left: 13.",
    ],
    steps: ["Pick the bigger number to start with.", "See how many more it needs to make 10.", "Take that amount from the other number.", "Add what is left to 10."],
    understand: ["Ten is easy to work with because our places are tens. Splitting a number to land on 10 turns a hard sum into 10 plus a small number.", "Addition can be done in any order: 3 + 9 and 9 + 3 are the same, so start with the bigger number and count on the smaller."],
    mistakes: ["Counting on fingers instead of using number bonds.", "Starting from the smaller number and counting a long way."],
    tip: "Make ten, then add what is left.",
  },
  "A-06": {
    blurb: "Subtract single digits quickly and check with addition.",
    learn: [
      "Subtraction is addition backwards. 14 - 6 asks: what do I add to 6 to get 14? The answer is 8.",
      "For numbers past ten, take away to ten first: 14 - 6 is 14 - 4 = 10, then 10 - 2 = 8.",
    ],
    steps: ["Think of the missing partner: 6 + ? = 14.", "Or take away to the nearest ten, then take away the rest.", "Check by adding your answer to the number you took away.", "Say the fact: fourteen take away six is eight."],
    understand: ["Every subtraction fact is the other half of an addition fact. Knowing 6 + 8 = 14 gives you 14 - 6 = 8 and 14 - 8 = 6 for free.", "Checking by adding back catches slips instantly."],
    mistakes: ["Subtracting the smaller digit from the bigger without looking at the order (6 - 14).", "Stopping at ten and forgetting the rest."],
    tip: "Subtract by asking what adds back.",
  },
  "A-07": {
    blurb: "Know the pairs that make 10 and 20 without thinking.",
    learn: [
      "A number bond is two numbers that join to make a total. The bonds to 10 are 1 and 9, 2 and 8, 3 and 7, 4 and 6, and 5 and 5.",
      "Bonds to 20 work the same way and just add 10: 12 + 8 = 20 because 2 + 8 = 10.",
    ],
    steps: ["Name the total you want (10 or 20).", "Take the number you have and subtract it from the total.", "That is the missing partner.", "Check: do the two add back to the total?"],
    understand: ["Bonds are the missing-number form of subtraction. 7 + ? = 10 is the same as 10 - 7.", "Knowing bonds to 10 lets you cross the tens barrier in your head: 8 + 5 becomes 8 + 2 + 3."],
    mistakes: ["Guessing instead of subtracting from the total.", "Confusing bonds to 10 with bonds to 20."],
    tip: "The missing partner is the total minus the number you have.",
  },
  "A-08": {
    blurb: "Double and halve numbers with confidence.",
    learn: [
      "To double a number is to add it to itself. To halve is to split it into two equal parts. They undo each other.",
      "For two-digit numbers, work on the tens and ones separately: double 36 is double 30 (60) plus double 6 (12), which is 72.",
    ],
    steps: ["Split the number into tens and ones.", "Double (or halve) each part.", "Join the answers back together.", "For halving odd numbers, check the answer ends in .5 or ask for an even number."],
    understand: ["Doubling is multiplying by 2 and halving is dividing by 2, so you are already meeting the first times table.", "Halving the tens and ones separately works because each place can be split without touching the others, as long as each part is even."],
    mistakes: ["Doubling only the tens and forgetting the ones.", "Halving 50 as 30 instead of 25."],
    tip: "Work on tens and ones separately.",
  },
  "A-09": {
    blurb: "Add and subtract tens and small numbers in your head.",
    learn: [
      "Mental arithmetic means using what you know instead of writing. Start with tens: 40 + 30 is four tens plus three tens, which is seven tens.",
      "With a small number, jump to the next ten first. For 38 + 7, take 2 to make 40 and add the remaining 5: 45.",
    ],
    steps: ["Spot whether you are working with tens or crossing a ten.", "For tens, add or subtract the digits and keep the zero.", "For crossing, jump to the next ten first.", "Say the answer and check it is the right size."],
    understand: ["Tens behave like ones because the places are identical in structure. 40 + 30 is 4 + 3 with a zero on the end.", "Jumping to a ten uses number bonds, which you practised already."],
    mistakes: ["Adding the ones and forgetting to carry over the ten.", "Losing the zero: 40 + 30 = 7 instead of 70."],
    tip: "Jump to the next ten, then add the rest.",
  },
  "A-10": {
    blurb: "Put all your Level A skills together in short, timed rounds.",
    learn: [
      "Speed starts with accuracy. In this module the questions are mixed and the clock is running, but a wrong answer costs more than a slow one.",
      "Aim for rhythm: read, see the method, answer, move on. If you are stuck, skip it and come back to it rather than losing the round.",
    ],
    steps: ["Read the whole question before you start.", "Pick the method you know: make ten, bonds, doubles.", "Type the answer and press Enter.", "Do not stop to check every one; check when the round ends."],
    understand: ["Timing makes you rely on facts you have memorised, which frees your head for harder work later.", "Your speed is compared only with your own earlier results, so there is nothing to lose."],
    mistakes: ["Rushing and typing before reading the sign.", "Spending too long on one question."],
    tip: "Be accurate first; speed follows.",
  },
};
