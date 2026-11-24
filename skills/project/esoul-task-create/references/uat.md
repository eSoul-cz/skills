# The `## UAT` section

Verification of user-facing work is a `## UAT` section, the one format every eSoul skill uses
(lifecycle, UAT bugs, `freelo-only` descriptions, issues):

```md
## UAT

**Role:** chovatel (Breeder)
**Předpoklad:** existuje zvíře bez skutečné ušní známky
<one line per UAT dimension from `CONTEXT.md › ## Project profile`, e.g. kanál / jazyk / měna>

1. [ ] Otevři detail takového zvířete.
   → V poli ušní známky je „známka neuvedena“.
```

- One empty checkbox per step; the expected result on the indented `→` line, not its own
  checkbox.
- Concrete values; a negative scenario when another role, channel or currency must not see the
  result; amounts with currency and VAT mode for anything touching money.
- No SQL, shell or logs in the steps; those belong to the acceptance criteria.
- Purely technical work with no visible effect says so explicitly (`**Role:** vývojář eSoul` or
  „Bez uživatelsky viditelného dopadu“) and gives a concrete technical check.
