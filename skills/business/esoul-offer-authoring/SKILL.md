---
name: esoul-offer-authoring
description: "Offer (nabídka, proposal) for an eSoul client: prepare, price or revise it from intake to handover, in Czech or English. Rendering into DOCX is esoul-office-documents; application documentation is esoul-docs."
---

# Offer authoring

An offer is a sales document backed by evidence. The client should recognise their own situation
in it, see what they get for each price, and know what to decide next. This skill owns the content
and the process; `esoul-office-documents` owns the template and the rendering.

Resolve `SKILL_DIR` to the directory that contains this file.

## Where offers live

Offers live in the internal sales repository or folder, outside the project repositories: a client
has no project repository yet, and an offer holds non-public prices and rates
(`docs/project_guidelines/security-and-data.md` › Personal and client data). Ask the user where it
is; never create an offer inside a project repository.

- Source, committed: `<sales>/<client>/nabidka-<topic>.md`.
- Output, a build artifact that is never committed: `<sales>/<client>/eSoul-nabidka-<Client>-<topic>.docx`.

## Workflow

Run the steps in order. Step 2 runs in subagents when the harness offers them (raw pages, HTML and
repository dumps stay out of the main context); otherwise you run its briefs yourself. Step 3 you
always do yourself.

### 1. Intake

Collect from the request, not by asking, whatever is already there:

- client and contact person, what they asked for, and why now (the business trigger),
- which legal entity makes the offer, because the supplier block and the rate follow from it,
- the offer language and currency (Czech and CZK unless the client needs otherwise),
- budget anchors the salesperson gave (target price per package, ceiling),
- required comparisons (platforms, variants) and required sections (sitemap, user flow),
- remarks from colleagues about known problems, quoted verbatim.

Ask the user only for what blocks pricing and cannot be found: the legal entity and the hourly
rate when no previous offer for that entity states them, and the supplier block (company data,
signatories) and payment terms when there is no previous offer. Whatever stays unknown is written
`TBD` (`docs/project_guidelines/documentation.md` › The `TBD` rule) and becomes an open point.

Done when each item is known, asked about, or marked `TBD`.

### 2. Evidence research

Pick the briefs for the offer type from [references/research-briefs.md](references/research-briefs.md),
one subagent per brief. Done when every brief returned verified facts, estimates and what could not
be checked, and each claim of the request is confirmed or corrected.

### 3. Previous offers

Read the most recent offer of the same kind in the sales location as the model for structure,
tone, rate, payment terms and the supplier block. Reuse wording for boilerplate chapters;
client-specific facts stay with their offer. Done when you can state the model's structure, rate,
payment terms and supplier block, or that no model exists.

### 4. Scope and packages

- Derive the scope from the findings: every major finding maps to something the offer delivers, or
  is named as out of scope.
- Design the packages by the policy in [references/terms-and-pricing.md](references/terms-and-pricing.md).

Done when each finding is delivered or out of scope, and the packages are named.

### 5. Pricing

Read [references/terms-and-pricing.md](references/terms-and-pricing.md) first (reserve, operation
variants).

- Price is hours times the hourly rate; give hours and price per line, with a total row. State the
  rate once in the offer and use it on every line.
- Project management, testing, acceptance and documentation are visible lines, not hidden in other
  items.
- Fit a budget anchor by adjusting scope, never by lowering the rate or hiding work. If a requested
  budget is not realistic for the scope, say so to the user with the reason and the scope that does
  fit.
- State what replaces the estimate (a fixed price after analysis). Use ranges in both the lines
  and the summary, or single figures in both.
- After any change of scope, hours or rate, recompute every table and the summary; stale totals
  after an edit are the most common defect of past offers.

### 6. Write the offer

Write the Markdown source with the chapters and rules of
[references/offer-structure.md](references/offer-structure.md), and the mandatory statements of
`terms-and-pricing.md`. Then check it before rendering:

```bash
python3 "$SKILL_DIR/scripts/check_offer.py" nabidka-<topic>.md --rate RATE   # add --lang en --currency EUR when needed
```

The output is the checklist: it recomputes the totals and the hours-times-rate of each line, checks
the reserve, names leftover placeholders and missing statements, and ends with the statements you
verify yourself. Fix the source until it reports `0 problem(s)`; a justified exception is named in
the handover.

### 7. Render and verify

1. Render with `esoul-office-documents` (`md_to_docx.py`, with the same `--lang`) to the output path
   above. DOCX only, unless a PDF is asked for.
2. Check the archive, then the structure: table and heading counts match the source, no Markdown
   markers left in the text.
3. Check the pages through a PDF export. When the export cannot be produced, say so in the reply;
   the layout is then unchecked.
4. Read the document once as the client; remove placeholders and internal remarks, notes to
   yourself, informal address, other clients' names and sample text before sending.

### 8. Hand over

Reply to the user with: the file paths, the package prices, the findings that changed the brief,
the decisions made on their behalf (rate, operating costs, split of packages), the `TBD` items, the
operating prices a colleague must confirm, and what they should confirm before sending. Later
changes go into the Markdown source and the DOCX is rebuilt from it.

## Corrections from earlier offers

- Propose the shortest realistic schedule and state its conditions.
- Say that the solution is built on a proven platform, not that it is taken over from another
  client's project.
- Keep facts consistent between chapters (technology versions, application type).
