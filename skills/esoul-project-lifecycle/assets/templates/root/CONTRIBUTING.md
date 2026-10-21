# Contributing to {{PROJECT_NAME}}

Tento dokument **specializuje** firemní standardy eSoul pro tento projekt. Samotné standardy žijí
na https://dev.docs.esoul.cz (Procesy → Git a GitHub, CI/CD, Freelo; Standardy → Psaní kódu)
a nekopírují se sem, protože kopie se rozcházejí. Projektové konvence (Freelo, tasking, commity,
jazyky, rozměry UAT) jsou v [CONTEXT.md](CONTEXT.md), inženýrská pravidla v [AGENTS.md](AGENTS.md).

## Než začneš

```bash
gh auth status                                                 # GitHub
freelo tasklists list --project {{FREELO_PROJECT_ID}} --agent  # Freelo
git lfs install                                                # jednou na stroj (design, podklady)
```

Pak nastav lokální prostředí podle [README.md](README.md). Přečti si [GLOSSARY.md](GLOSSARY.md):
bez něj snadno zavedeš synonyma, která review vrátí.

## Zdroje pravdy a pořadí čtení

1. **[GLOSSARY.md](GLOSSARY.md)** — závazné názvosloví.
2. **[docs/adr/](docs/adr/index.md)** — rozhodnutí; index je jediný zdroj jejich stavu. ADR ve
   stavu `accepted` je cílový kontrakt, i když se kód liší: rozdíl zapiš jako implementační gap,
   **ADR nikdy neoslabuj podle kódu**. ADR ve stavu `proposed` není specifikace k implementaci.
3. **[AGENTS.md](AGENTS.md)** a **[docs/project_guidelines/](docs/project_guidelines/index.md)** —
   inženýrská pravidla, včetně míst, kde je kód zatím nedodržuje.
4. **Design** v `docs/design_pencil/` — soubor `.pen` vyhrává nad tokeny i nad každým souhrnem.
5. **[docs/plan/](docs/plan/README.md)** a issue — co je rozhodnuté, v jakém pořadí a co ještě
   blokuje.
6. **[docs/podklady/](docs/podklady/README.md)** a `docs/legacy/` — jak klient pracuje dnes.
   Jsou to důkazy, ne specifikace. Nejasnost nebo chyba v nich jde do
   [docs/podklady/otevrene-otazky.md](docs/podklady/otevrene-otazky.md) a odpovídá na ni klient,
   ne my.

Když si dva zdroje odporují, nahlas rozpor místo tichého výběru jednoho z nich.

## Každá práce je pár

Každá práce má **GitHub issue** (technická specifikace, akceptační kritéria, UAT) a **Freelo úkol**
(plánování, odhad, stav, výkazy). Nikdy nezakládej jen jednu stranu. Jedinou výjimkou je slice
kategorie `pm` (plánování nebo práce s klientem bez kódu), který je jen Freelo úkolem, a PR od
Dependabotu. Freelo popis odkazuje na issue v prvním řádku, issue odkazuje zpět v poli `Freelo`.

Agenti zakládají páry skillem `esoul-tasking` v režimu z
[CONTEXT.md](CONTEXT.md#tasking-convention), vždy po odsouhlaseném náhledu; viz
[docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Názvy

- Tvar `Kontext: Akční výsledek` česky, například `Košík: Přepočítat dopravu po změně množství`.
- Stejný název na issue, Freelo úkolu i PR.
- Žádný prefix kategorie (`[FE]`, `[BE]`, `[DATA]`) a žádné ID slice v názvu. ID slice patří do
  hlavičky issue (`**Slice:** F1-17 · **Fáze:** F1 (brána G1) · **Rozsah:** S`) a na první
  řádek Freelo popisu.
- Když má práce dvě skutečné poloviny (formulář a endpoint), vzniknou dva závislé páry.

### Štítky

- Kategorie je štítek na obou stranách. Na GitHubu právě jeden z `frontend`, `backend`,
  `data-migration`, `infrastructure`, `documentation`; práce na externím systému navíc
  `integration`, chyba navíc `bug`. Mapování na Freelo štítky je v
  [CONTEXT.md](CONTEXT.md#tasking-convention); Freelo štítky se přidávají podle UUID a nové se
  nezakládají.
- Štítek `data-migration` spouští datové pravidlo: datová práce nemění přímo aplikační kód ani
  datový model, potřebná změna se zapíše jako návrh a vznikne pro ni nový pár.
- Triage štítky (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)
  popisuje [docs/agents/triage-labels.md](docs/agents/triage-labels.md). Dependabot používá
  `dependencies`.

### Závislosti

Závislosti jsou nativní GitHub issue dependencies (`blocked_by`) a ty jsou zdrojem pravdy;
relace ve Freelu je jejich zrcadlo. Žádné dočasné komentáře „vytvořit vazbu ručně“. Úkol
s otevřeným blokujícím issue, otevřenou otázkou nebo `proposed` ADR není `ready-for-agent`.

## Branches

- Never push directly to `main`. Every change goes through a pull request.
- Name: `<prefix>/<issue-number>-<english-kebab-case>` without diacritics, derived from the
  title, for example `feature/142-cart-shipping-recalculation`.
- Prefix by work type: `feature/`, `fix/`, `chore/`, `data/`, `docs/` or `design/`.
- One branch equals one task. If separate work emerges, create another issue/task pair.

## Commits

- Format and allowed scopes are in [CONTEXT.md](CONTEXT.md#commit-convention):
  `:gitmoji: [scope] imperative message`, for example
  `:sparkles: [cart] recalculate shipping after a quantity change`.
- English, imperative (`add`, `fix`, `remove`; not `added` or `adding`).
- Exactly one Gitmoji per commit; prefer several focused commits over a large one. Add a body with
  bullet points when a commit needs more explanation; when it changes a calculation, name the
  source in `docs/podklady/` it now reproduces.
- Every push starts Jenkins, so do not push every commit separately. Push after a coherent unit
  is complete, but **at least once per day** so progress remains visible.

## Checks

`{{CHECK_COMMAND}}` runs all local checks and must pass before each commit. The binding list of
checks, with when to run each one, is in
[docs/project_guidelines/tools.md](docs/project_guidelines/tools.md); how to write and run tests
is in [docs/project_guidelines/testing.md](docs/project_guidelines/testing.md). List every check
you ran, with its result, in the pull request.

## Pull requesty

- Název PR je **shodný s názvem issue a Freelo úkolu**.
- Popis vychází ze [šablony](.github/PULL_REQUEST_TEMPLATE.md), obsahuje `Closes #<issue>`
  a odkaz na Freelo úkol.
- Rozhodnutí, která jsi v rámci issue musel udělat sám, vypiš v sekci „Rozhodnutí v rámci issue“
  k potvrzení; zamítnuté nálezy review vypiš s důvodem.
- Do *Assignees* přidej všechny, kdo na práci dělali, včetně sebe.
- PR otevři, až práce splňuje Definition of Done; rozpracovanou práci drž jako draft.
- Nemíchej feature s refaktoringem nesouvisejícího kódu; refaktoring má vlastní pár a PR.
- PR, který mění zhruba víc než 30 souborů, rozděl. Když to nejde, popiš v PR, jak ho
  procházet po částech.
- PR od Dependabotu nemá issue; vše ostatní platí: changelog, kontroly, review, zelený `Jenkins`.
  Čas se vykazuje na Freelo úkol údržby závislostí v `LTT`.

### Merge

- Na `main` platí ruleset: povinný check `Jenkins` a jedno lidské schválení, bez bypassu pro
  sdílený účet `esoul-cz-user`.
- **Agent nikdy nemerguje** a nikdy nepoužije bypass. Merguje člověk ze svého osobního účtu po
  schválení a zeleném `Jenkins`.
- Vždy **squash merge** se subjektem `:gitmoji: <název PR> (#N)`.

## Code review

- Každý PR reviewuje **CodeRabbit** (nastavení v [.coderabbit.yaml](.coderabbit.yaml)) a alespoň
  jeden člověk. Agent dokončuje PR skillem `final-pr-review`: každý platný nález opraví, na
  neplatný odpoví s důkazem. Když CodeRabbit napíše jen souhrn, je povinné lokální AI review
  (`coderabbit review --agent` nebo skill `code-review`). Schválení CodeRabbitem nenahrazuje
  lidské review.
- Před diffem si přečti issue a jeho UAT.
- Nálezy klasifikuj jako `Blocker`, `High`, `Medium` nebo `Low`; viz
  [code-review.md](docs/project_guidelines/code-review.md). `Blocker` a `High` brání merge.
  `Blocker` je výchozí pro nález, který může způsobit špatnou částku, rozbít klíčový tok,
  zpřístupnit osobní nebo cizí data nebo prozradit tajemství.
- Nález popisuje **jeden problém s jednou hranicí nápravy**, ne jeden dotčený soubor.
- Změněný výpočet se reviewuje proti zdroji v `docs/podklady/`, ne proti intuici.
- Čas review vykaž přímo na Freelo úkol s poznámkou. Když review najde vady, vrať úkol do
  `In progress`.

## Definition of Done

Úkol je hotový, jen když platí všechno:

- [ ] Kód dodržuje [AGENTS.md](AGENTS.md) a `docs/project_guidelines/`.
- [ ] `{{CHECK_COMMAND}}` prošel lokálně a check `Jenkins` je zelený.
- [ ] Nová nebo změněná doménová logika má test; oprava chyby má regresní test, který bez opravy
      padá. Testy netestují text chybových hlášek.
- [ ] Nový nebo změněný výpočet je ověřený proti zdroji v `docs/podklady/` a test ho pojmenovává.
- [ ] V kódu, testech, fixtures, issue ani PR nejsou reálná data klienta.
- [ ] Názvosloví odpovídá [GLOSSARY.md](GLOSSARY.md); nový pojem je doplněný ve stejném PR.
- [ ] Změna cílového kontraktu má ADR v tomto PR, nebo odkazuje na existující `accepted` ADR.
- [ ] Texty pro uživatele odpovídají jazykům projektu a designu.
{{DOD_STACK_ITEMS}}
- [ ] PR vypisuje spuštěné kontroly a AI review s výsledky a zamítnuté nálezy s důvodem.
- [ ] UAT scénář z issue je proklikaný a v issue zaškrtnutý.
- [ ] Ve Freelu je vykázaný čas a stav úkolu odpovídá realitě.

## Freelo: stavy, odhady, výkazy

Úkoly procházejí seznamy `Backlog` → `To Do` → `In progress` → `Code review` → `Testing` →
`Done`; opakovaná a dlouhodobá práce žije v `LTT` a zůstává otevřená.

| Stav | Kdy do něj úkol patří |
|---|---|
| `Backlog` | Založený pár, ještě nepřipravený k práci. |
| `To Do` | Má popis, řešitele a schválený odhad; nemá otevřený blokující úkol. |
| `In progress` | Existuje větev; řešitel je přiřazený na issue i ve Freelu. |
| `Code review` | PR je otevřený a CI zelené. |
| `Testing` | PR je mergnutý a nasazený na staging nebo preview; čeká na UAT. |
| `Done` | UAT z issue je odškrtané; úkol je ve Freelu označený jako dokončený. |

- **Odhad je lidský čas**, ne čas implementace: zadání agentovi, kontrola, review, UAT a opravy.
  Zadává se po 15 minutách; nad 4 h lidského času navrhni rozdělení. Skutečný čas jsou výkazy
  ve Freelu.
- Ideálně má každý vývojář na projektu **jeden** úkol v `In progress`.

## Nikdy nedělej

- Nepushuj přímo do `main` a nemerguj jako agent; nepoužívej bypass rulesetu.
- Necommituj `.env`, databázové exporty ani soubory s osobními údaji. Podklady klienta patří jen
  do `docs/podklady/` a `assets/` (LFS), a nové přidávej jen po domluvě.
- Nekopíruj reálná jména, kontakty ani částky z podkladů do kódu, testů, fixtures, seedů, issue
  ani PR. Agent pracuje jen s anonymizovaným dumpem.
- Neměň výpočet tak, aby přestal odpovídat zdroji v podkladech, bez odpovědi klienta a ADR.
- Nespouštěj příkaz, který zapisuje do produkčního systému nebo produkční integrace klienta.
- Nepoužívej synonyma zakázaná v [GLOSSARY.md](GLOSSARY.md).
- Neotvírej PR bez odkazu na issue i Freelo úkol (kromě Dependabotu).
- Neupravuj `GLOSSARY.md`, `CONTEXT.md`, ADR, `docs/project_guidelines/` ani `AGENTS.md` mimochodem
  při nesouvisející práci.
- Neupravuj ručně vygenerované bloky v `AGENTS.md`.
- Nepřidávej závislost ani novou složku nejvyšší úrovně bez souhlasu správce projektu.
- Nestav nic, co rozsah zakázky vylučuje (viz [docs/plan/](docs/plan/README.md)).
