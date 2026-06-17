<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ESLint policy

Run ESLint only in these cases:

1. When there is an actual error to investigate or fix.
2. Before a push (run it first as a pre-push check).

Do not run ESLint again just to re-check after a fix has already come back clean. No gratuitous runs.
