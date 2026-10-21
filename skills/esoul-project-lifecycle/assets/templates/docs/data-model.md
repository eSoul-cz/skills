# Data model

This is the target data model of {{PROJECT_NAME}}: the entities the application persists, their
columns, and where each rule comes from. **No migration has been written yet**; this document is
what the first migrations are checked against, not a description of a database that already
exists.

<!-- Once migrations exist, replace the paragraph above with: "Maintained from the code. This
     document describes the model as the migrations define it; where the two disagree, the code
     wins and this document is stale." and list the commands that compare the two. -->

## How to read this

- **Maintained in the same pull request as the migration.** A pull request that adds or
  changes a migration, a model, a relation or a stored enum updates the matching section here.
  A reviewer rejects a migration without it.
- **Names.** Table and column names are English and snake_case. The Czech term the client uses
  is given in parentheses where it matters; the mapping is owned by
  [GLOSSARY.md](../GLOSSARY.md).
- **Authority.** Every non-obvious column cites the ADR, the podklady note or the source cell
  (`soubor › list › buňka`) it comes from. A column with no source is a column somebody
  invented, and it does not belong here.
- **Column types** follow the database ADR without exception:

  <!-- Table of quantity → column type from the database and money ADRs, e.g. money as integer
       minor units, rates as exact decimals, timestamps in UTC. No floating-point column. -->

  | Quantity | Type |
  |---|---|

- Every table has `id`, `created_at` and `updated_at` unless stated otherwise; they are
  omitted from the column lists below.

## Main decisions of the model

<!-- Bulleted list of the decisions that shape the whole schema, each with its ADR. -->

## What this model deliberately does not contain

<!-- Things a reader might expect and will not find, each with the ADR, open question (Q-nn)
     or scope decision that keeps it out. -->

---

<!-- One section per domain ("## Domain name") with one subsection per table. Template:

### `table_name`

One sentence on what a row is.

| Column | Type | Notes |
|---|---|---|
| `column_name` | `TYPE`, constraints | Rule and its source — [ADR-NNNN](adr/NNNN-english-slug.md) |

-->

## Enumerations

| Enum | Values | Source |
|---|---|---|

## Relations

<!-- An erDiagram block preceded by a diagram-alt comment that describes the relations in
     words. -->

## Legacy mapping

<!-- optional: only when there is a legacy system. Legacy table or field → new table and
     column, with the transformation and the docs/legacy/ document that describes the source. -->
