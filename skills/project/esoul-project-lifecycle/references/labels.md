# GitHub labels

The one place that names the label set. `bootstrap` creates the labels, `tasking` applies them,
`audit` and `conformance.mjs` check them. The Freelo side keeps its own labels by UUID in
`CONTEXT.md › ## Freelo` (`esoul-task-create`).

| Group | Labels | Use |
|---|---|---|
| Category (exactly one on a work item) | `frontend`, `backend`, `data-migration`, `infrastructure`, `documentation` | What kind of work it is. Slice categories map `fe` → `frontend`, `be` → `backend`, `data` → `data-migration` ([plan-and-slices](plan-and-slices.md)) |
| Add-on | `integration`, `bug` | Work on an external system; a defect |
| Question | `question` | An open decision of the client or eSoul ([questions-and-client](questions-and-client.md)). Not work: no category label, no `## UAT` |
| Triage | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` | Readiness, below |
| Renovate | `dependencies` | Set by `renovate.json5` |

## Readiness

- A new issue is `needs-triage`, or `needs-info` when it waits on a `question` issue or a
  `proposed` ADR.
- `ready-for-agent` needs all of: a `## UAT` section, verified paths in *Affected areas*, no
  open `blocked_by` issue, no open `question` issue and no `proposed` ADR behind it. At gate B5,
  after the completeness audit, `tasking` flips the issues that meet this.
- `ready-for-human` marks work an agent cannot do (credentials, client calls, design).
- `wontfix` marks work that will not be done; close the issue with the reason.
