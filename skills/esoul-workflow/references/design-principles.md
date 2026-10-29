<!-- Condensed from mattpocock/skills v1.3.2, `skills/engineering/codebase-design/SKILL.md` and
     `DEEPENING.md` (MIT License, (c) 2026 Matt Pocock; see LICENSE-mattpocock-skills.md).
     eSoul changes: principles only, without the upstream term list, so Laravel and Vue terms such
     as service and component stay valid; stack profiles and project guidelines take precedence. -->

# Design principles: deep modules and real seams

Use these when the shape of an interface is in question: where a seam goes, what a module
exposes, whether a class earns its place, how an integration is tested. The project's stack
profile (`esoul-project-lifecycle/references/stacks/`), its `docs/project_guidelines/` and its
accepted ADRs come first. In a CQRS project, commands, queries and handlers stay where the
guidelines put them; these principles decide what sits behind them.

## Terms

- **Module:** anything with an interface and an implementation, from a function to a package.
- **Interface:** everything a caller must know to use it correctly: signature, invariants,
  ordering, error modes, configuration, performance. Not just the method list.
- **Depth:** how much behaviour a caller or test gets per unit of interface it must learn. A
  module is deep when a lot of behaviour sits behind a small interface, shallow when the
  interface is nearly as complex as the implementation.
- **Seam:** the place where behaviour can be changed without editing it there, where the
  interface lives. **Adapter:** a concrete thing that satisfies the interface at a seam.

## Principles

- **Prefer deep modules.** Fewer methods, simpler parameters, more complexity hidden inside.
- **Deletion test.** Imagine deleting the module. If the complexity vanishes, it was a
  pass-through (a service that only forwards to a repository that only forwards to the model).
  If the complexity reappears across several callers, it earns its keep.
- **One adapter is a hypothetical seam, two adapters are a real one.** Do not add an interface,
  port or contract that has only one implementation. Production plus a test fake counts as two.
- **The interface is the test surface.** Callers and tests cross the same seam. A test that has
  to reach past the interface means the module has the wrong shape.
- **Accept dependencies, do not create them; return results rather than mutate in place.** Both
  make the module testable through its interface.
- **Depth is a property of the interface.** A deep module may be built from small internal parts
  with internal seams for its own tests; do not expose them through the interface.

## Dependencies decide how to test across a seam

| Dependency | Example | Test across the seam with |
| --- | --- | --- |
| In-process | pricing rules, parsers, state machines | the real code, no adapter |
| Local substitute exists | database with a test database, filesystem | the substitute in the test suite |
| Remote and owned | your own service or queue consumer | a port with an in-memory adapter |
| Third party | payment gateway, ERP, carrier, e-mail | a port with a fake driver; the real driver only in a contract or smoke test |

External integrations therefore get a port with two adapters, the real driver and a fake driver,
and their tests run against the fake. That is a real seam, not speculative indirection.

## Replace, do not layer

When shallow modules are merged into a deeper one, write tests at the new interface and delete
the old unit tests of the shallow parts; they test structure that no longer exists. Tests assert
observable outcomes through the interface and survive internal refactors.

## Exploring alternatives

For a hard interface decision in a size L task, sketch two or three radically different
interfaces and compare them on depth, locality and seam placement before choosing. Do it in the
conversation; parallel subagents are rarely worth their cost for this.
