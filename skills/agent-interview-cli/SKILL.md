---
name: agent-interview-cli
description: Present interactive web forms to gather structured user input. Use when choosing between approaches, gathering requirements, exploring tradeoffs, or when decisions have multiple dimensions. Prefer over back-and-forth chat for structured input.
---

# agent-interview-cli

Standalone CLI that opens a browser form, collects responses, returns JSON on stdout.

## Invocation

```bash
echo '<questions_json>' | interview --stdin --pretty 2>/dev/null
interview /tmp/questions.json --pretty 2>/dev/null
```

Output: `{ "status": "completed", "responses": [{ "id": "q1", "value": "Option A" }] }`

Status: `completed`, `cancelled`, `timeout`, or `aborted`. Image responses are file paths.

## Questions Format

```json
{
  "title": "Decision Title",
  "description": "Review my suggestions and adjust as needed",
  "questions": [
    { "id": "q1", "type": "single", "question": "Which approach?", "options": ["A", "B"], "recommended": "A", "conviction": "strong", "weight": "critical" },
    { "id": "q2", "type": "multi", "question": "Include which?", "options": ["X", "Y", "Z"], "recommended": ["X", "Z"] },
    { "id": "q3", "type": "text", "question": "Additional context?" },
    { "id": "q4", "type": "image", "question": "Upload reference" },
    { "id": "q5", "type": "info", "question": "Analysis", "media": { "type": "table", "table": { "headers": ["Option", "Pros", "Cons"], "rows": [["A", "Fast", "Complex"], ["B", "Simple", "Slow"]] } } }
  ]
}
```

## Question Types

| Type | Description |
|------|------------|
| `single` | Radio — pick one from `options` |
| `multi` | Checkbox — pick many from `options` |
| `text` | Freeform textarea |
| `image` | File upload (paths returned) |
| `info` | Non-interactive panel for context/analysis |

## Key Patterns

**Recommendations** — always set `recommended` on single/multi with reasoning in `context`.
- `conviction: "strong"` — pre-selects, badge
- `conviction: "slight"` — badge only, no pre-select
- Omit — pre-selects (normal confidence)

**Weight** — `"critical"` = prominent card, `"minor"` = compact card.

**Rich options** with code: `{ "label": "Approach A", "code": { "code": "const x = 1", "lang": "ts" } }`

**Info panels** — use `info` type to show analysis alongside decisions. Media types:
- `{ "type": "table", "table": { "headers": [...], "rows": [...] } }`
- `{ "type": "mermaid", "mermaid": "graph LR\n  A-->B" }`
- `{ "type": "image", "src": "path.png" }`
- `{ "type": "html", "html": "..." }`

Media accepts `position: "above" | "below" | "side"` and `caption`.

**Code blocks** — `codeBlock: { "code": "...", "lang": "ts" }` on any question shows code above options.

**Description** — when questions have recommendations, set the form's `description` to guide review (e.g., "Review my suggestions and adjust as needed").
