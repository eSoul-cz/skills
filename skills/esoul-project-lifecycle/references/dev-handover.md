# Development handover (P7, `handover`)

Before the first feature issue goes to an agent, the codebase must make the right thing easy and
the wrong thing fail. VONO called this the "development handover"; Indcom started F1 with a
reference module. Use the stack profile for the exact commands.

## Checklist

- [ ] Local check command runs every gate and prints a PASS/FAIL summary
      (`composer check`, `pnpm check`, or the stack equivalent), named in `AGENTS.md`.
- [ ] Jenkins runs the same gates on every PR and `main`; the `Jenkins` check is required by
      the ruleset.
- [ ] Static analysis at the strictest level the stack profile sets; existing violations, if any,
      are in a ratchet baseline mapped to gap issues.
- [ ] Architecture or structure checks enforce the layer rules from the guidelines, and have a
      test proving they detect a breach.
- [ ] Mutation testing configured as a local soft gate on changed lines, with message-only
      mutants ignored.
- [ ] Parity fixtures for every client calculation, as incomplete tests that name their slice
      and issue (`markTestIncomplete('… slice M1-05, issue #52')` or the stack equivalent).
- [ ] A reference module implements one small slice end to end in the target architecture.
      Guidelines say "new modules follow its shape".
- [ ] Test environment has every external system off, with fakes and a network guard.
- [ ] Seed or fixture data is synthetic; the anonymized dump procedure exists if agents need
      real-shaped data.
- [ ] Docker development environment starts with one command and is documented in the README.
- [ ] Staging deploy path exists (may stay disabled until the first slice ships).
- [ ] `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>` has no errors.

Gate B4 is the lead's approval of this checklist in the handover PR.
