# Data analysis

Applies to data analyses, reports, dashboards, and spreadsheet work for eSoul or its clients.

## 1. Pin the question

Before loading data, write down in one or two sentences: the decision the analysis supports, the metric(s) that answer it, the time range, and the audience. If any of these is unclear and cannot be inferred from the request or data, ask once, with a recommended answer for each gap.

## 2. Profile the data first

- Load a sample, then report: row count, columns and types, date range, missing values, duplicates, and obvious outliers.
- Confirm the grain (what one row means) and the join keys before any join. Check row counts before and after every join; an unexpected change is a bug until explained.
- Treat personal data minimally: aggregate or pseudonymize, and never paste raw personal records into chat or reports.

## 3. Analyse reproducibly

- Do the work in a script or notebook (Python with pandas, or SQL), not by hand. Keep raw data untouched; write cleaned data to a new file.
- Record every cleaning rule and assumption as you apply it; they go into the final report.
- Prefer simple, explainable methods. State the method and its limits (sample size, seasonality, missing periods, correlation vs causation).

## 4. Check the numbers

- Recompute key figures a second way (for example, totals from raw data vs from the aggregate) and make sure they match.
- Sanity-check magnitudes against known reference points (last period, invoiced totals, platform dashboards).
- Verify every number that appears in the final text against the computed output programmatically, not by eye.

## 5. Present

- Lead with the answer, then the evidence, then method and caveats.
- Use the `dataviz` skill before building any chart. One message per chart; label units and time ranges.
- Pick the output by use: a reply for a quick answer; a Sheets artifact or `xlsx` (skill) when people will filter or recalculate; a document for a report others will read; a dashboard artifact when it will be revisited with fresh data.
- End with the assumptions list and suggested next questions.
