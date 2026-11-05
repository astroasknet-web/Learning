/**
 * Capitalize each word in a person's name without lowercasing intentional
 * casing such as "McDonald" or initials. Also handles hyphenated and
 * apostrophized names.
 */
export function formatPersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase()}`
    );
}

/**
 * Tidy a name that came from a free-text form, for use in a greeting.
 *
 * Booking forms store whatever people type, so the same column holds
 * "Vanapalli Madhu Kishore " with a trailing space and "PREM PATIL" in caps.
 * Neither is wrong as data, but "Dear PREM PATIL ," is wrong in a letter.
 *
 * Only uniformly-cased words are re-cased, so "McDonald" and "d'Souza" survive
 * untouched, and short all-caps tokens are left alone because they are far more
 * likely to be initials than shouting.
 */
export function normalizePersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const letters = word.replace(/[^\p{L}]/gu, "");
      if (letters.length <= 3) return word;
      const upper = word.toLocaleUpperCase();
      const lower = word.toLocaleLowerCase();
      if (word !== upper && word !== lower) return word;
      return formatPersonName(lower);
    })
    .join(" ");
}
