# Stack profile: Lunar

Laravel e-shop on Lunar with an Inertia 3 and Vue 3 storefront; Lunar owns the admin panel. The
rules live in the guideline layers `framework/laravel` and `package/lunar` (`architecture.md`,
`testing.md`, `integrations.md`), plus `package/filament` (added by `init` whenever it detects
`lunarphp/lunar`), `package/laravel-inertia` and `package/inertia-vue`. Read
[laravel.md](laravel.md) for everything that holds for a Laravel application; this profile adds
only the Lunar specifics.

## When this profile applies

`composer.json` requires `lunarphp/lunar`. Record `Stack: lunar` and `Product type: eshop` in
`CONTEXT.md › ## Project profile`. The process tier is `full`.

## Bootstrap specifics

1. Start from the published template variant `laravel-lunar`
   ([root-files.md](../root-files.md) explains how to read a `template-<variant>` repository); it
   adds the Lunar layer on top of the Laravel base and the Inertia Vue layer. Do not rebuild it by
   hand.
2. `esoul-guidelines init` detects Lunar and adds `package/lunar` and `package/filament`; confirm
   the layers ([guidelines.md](../guidelines.md)). Pin the minor line of `lunarphp/lunar` in
   `composer.json`; a move to another major is an ADR, never a dependency bump.
3. Plan the integrations early. Payment gateways, carriers and ERP export follow
   `package/lunar` › `integrations.md` (ports and fakes, the outbox, idempotency keys); each
   external system is an ADR topic and a slice.
4. Public storefront: the AI-readiness slices apply (`Product type: eshop` adds `AI-06`, the
   feeds); see [ai-readiness.md](../ai-readiness.md).

## Development handover checklist

- [ ] Everything in the Laravel handover checklist ([laravel.md](laravel.md)).
- [ ] The tests that pin Lunar behaviour exist (`package/lunar` › `testing.md`, Pinning Lunar
      behaviour) so an upgrade shows what changed.
- [ ] Published `config/lunar/*.php` committed and diffed against the vendor defaults at every
      upgrade.
- [ ] Each integration sits behind a port with a real and a fake adapter, and the outbox exists
      where a write to an external system must not be lost.

## Typical ADR topics

- Lunar major and upgrade policy; which Lunar addons the shop uses.
- Money, currencies and tax mode (Lunar's calculation pipeline versus project rules).
- Payment gateways, carriers and ERP: system of record, transport, retry and reconciliation.
- Search engine and storefront rendering (SSR or not).

## Pitfalls

- Requiring Lunar's sub-packages, Filament or Livewire directly instead of following Lunar's pins.
- Editing `vendor/` or Lunar's pipeline in place instead of an extension point.
- Queries inside a loop over candidate shipping options or rows in a modifier: a `Major` review
  finding (`architecture.md › Calculation cost` of the layer).
