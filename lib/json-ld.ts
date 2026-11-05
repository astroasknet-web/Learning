/**
 * Serialize a value as JSON for embedding inside an inline
 * `<script type="application/ld+json">` tag.
 *
 * `JSON.stringify` alone is unsafe here: it does not escape `<`, `>` or `&`,
 * so a string field containing `</script>` closes the tag early and any markup
 * after it runs as HTML. Our JSON-LD is built from database fields (expert
 * bios, event titles, review author names — some originating from public
 * intake forms), so that is a stored-XSS vector.
 *
 * Escaping those characters to their JSON unicode escapes produces fully
 * equivalent JSON: parsers — and Google — read the exact same values, so the
 * emitted structured data is unchanged, but `</script>` can no longer break
 * out of the tag. The U+2028 / U+2029 line separators are also escaped: they
 * are legal inside JSON strings but terminate a line within a `<script>`,
 * breaking some parsers.
 *
 * Mirrors the escaping already applied to HTML output in `lib/escape-html.ts`;
 * this is the JSON-LD counterpart.
 */
export function serializeJsonLd(data: unknown): string {
  // Built from code points so no literal U+2028/U+2029 ever appears in this
  // source file (a literal line separator inside a regex is a syntax error).
  const lineSep = String.fromCharCode(0x2028);
  const paraSep = String.fromCharCode(0x2029);
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(lineSep)
    .join("\\u2028")
    .split(paraSep)
    .join("\\u2029");
}
