# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the
actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding
label string from this table.

Triage labels are independent of the work-category labels (`frontend`, `backend`,
`data-migration`, `infrastructure`, `documentation`, plus `integration` and `bug`) and of
Dependabot's `dependencies` — see
[CONTRIBUTING.md](../../CONTRIBUTING.md#každá-práce-je-pár).

An issue is `ready-for-agent` only when it has a UAT section, verified paths in *Dotčené
oblasti*, and no open `blocked_by` issue. An issue that depends on an open question in
`docs/podklady/otevrene-otazky.md` or on a `proposed` ADR stays `needs-info` until the point is
decided.
