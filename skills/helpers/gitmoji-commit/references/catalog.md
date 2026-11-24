# Gitmoji catalog

The bundled [`gitmojis.json`](gitmojis.json) is a verbatim snapshot of the official Gitmoji catalog:

- Source: <https://github.com/carloscuesta/gitmoji/blob/master/packages/gitmojis/src/gitmojis.json>
- Retrieved: 2026-08-10
- Entries: 75
- SHA-256: `b7ef2d4879d13ee7e7f8177784ffdb000082d1f22f42617f47fbbb7cadf23167`
- Upstream license: MIT

Use the `code` field as the commit-message shortcode and `description` as its intention. The official catalog is authoritative when meanings overlap.

`tooling/scripts/test_gitmoji_catalog.mjs` in the eSoul skills repository checks that the hash and the entry count above match the file. To refresh the snapshot, replace `gitmojis.json` and update the three values here together.
