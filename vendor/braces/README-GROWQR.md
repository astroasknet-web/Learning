# braces 3.0.4 (GrowQR patched copy)

Upstream braces <= 3.0.3 has a stack-exhaustion denial of service on deeply nested patterns (GHSA-vfj7-8cjw-p6xm) and **no patched release exists** (first_patched_version is null).
This copy is braces 3.0.3 with one change: `lib/parse.js` throws a SyntaxError when brace nesting exceeds 64 levels. Nothing else differs.

It is wired in through `overrides` in the root package.json. It is only used at build time (tailwindcss > chokidar/micromatch), never by the running site.
When upstream publishes a fixed release, delete this folder and the override.
