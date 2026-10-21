# Fáze a milníky

**Stav: plán, nic z popsaného není implementováno.** Dokument rozkládá dodávku na fáze, určuje
brány, kritické cesty, pořadí prací a provozní dopad předání. Úplný seznam slices je v
[seznamu slices](seznam-slices.md), zařazení rozsahu v [rozsahu](rozsah.md), co blokuje klient,
v [podkladech a otázkách](podklady-a-otazky.md).

Fáze se částečně překrývají. O pořadí práce rozhodují závislosti slices, o pořadí **dodání**
smlouva.

## 1. Termín

<!-- Co o termínu říká smlouva (lhůta, od čeho běží, sankce) a jaký pracovní termín stanovil
     eSoul a kdy. Data, která nejsou nikde zaznamenaná, se nedomýšlejí: TBD. -->

**Termín dokončení:** TBD.

## 2. Přehled fází

Každá fáze je milník v GitHubu se stejným názvem.

| Fáze | Cíl | Klíčové výstupy | Drží ji ADR | Blokuje ji | Obrazovky | Brána |
|---|---|---|---|---|---|---|
| **F0 Příprava** | Nultá etapa: nic z toho není funkce pro uživatele a bez toho nezačne žádná. | Rozhodnutí a ADR, podklady od klienta, Freelo projekt a založené úkoly, CI, staging, průřezové základy. | — | — | — | G0 |

<!-- Závazná pořadí uvnitř fází (např. ADR, která musí být přijatá před první migrací, a
     agregát, který jde jako první slice fáze) patří pod tabulku jako krátký odstavec. -->

## 3. Diagram závislostí

Plné šipky jsou závislosti mezi fázemi, přerušované vstupy od klienta. Diagram nevyjadřuje
kalendář.

<!-- diagram-alt: Závislosti fází: F0 Příprava končí branou G0 Připraveno k vývoji, za kterou
začínají další fáze. -->
```mermaid
flowchart LR
  F0["F0 Příprava"]
  G0(["G0 Připraveno k vývoji"])
  F0 --> G0
```

## 4. Brány

Brána je splněná, když platí všechna její kritéria. O splnění rozhoduje eSoul, u akceptace
fáze i klient.

| Brána | Termín | Stav k {{DATE}} |
|---|---|---|
| G0 Připraveno k vývoji | TBD | Otevřená |

**Kritéria:**

1. **G0 Připraveno k vývoji.** ADR, která se po vzniku schématu nemění levně, jsou `accepted`;
   Freelo projekt existuje a slices první fáze mají páry issue + Freelo task; CI blokuje merge
   při červené kontrole; staging se nasazuje z `main`; návrh obrazovek první fáze klient
   schválil; otevřené otázky, které blokují první fázi, mají výchozí stav do odpovědi.

<!-- Další brány: „Gn Akceptace fáze Fn (Fn-nn). Scénáře UAT fáze prošly na stagingu; …“ s
     konkrétními kritérii, ne obecnými. -->

**Co se u každé brány kontroluje:** stav slices na kritických cestách a co je blokuje; otevřené
otázky registru, u kterých se jede podle výchozího stavu, a dopad jejich pozdní odpovědi;
dohoda o navýšení rozsahu; rizika z [rizik](rizika.md); prognóza další brány a termínu — ano, s
rizikem, nebo ne.

## 5. Kritické cesty

Kritická cesta je řetězec závislostí slices, jehož zdržení posune předání.

<!-- Číslovaný seznam řetězců „F0-nn → F1-nn → … → Gn“ s jednou větou, proč je každý kritický,
     a pod ním diagram flowchart TD se subgrafem na každou cestu. Každý diagram má před sebou
     popisek diagram-alt. -->

## 6. Pořadí prací

1. Podklady, registr otázek a ADR.
2. Návrh v Pencilu a jeho schválení klientem.
3. Plán: fáze, brány, rozsah, slices, rizika.
4. Nultá etapa (F0) a založení párů issue + Freelo task ze slices.
5. Fáze v pořadí podle závislostí.
6. Předání.

Slices, které čekají na otevřenou otázku, na `proposed` ADR nebo na dohodu o navýšení, nesou
štítek `needs-info`.

## 7. Předání a provozní dopad

<!-- Co obnáší předání podle smlouvy (nasazení do produkce, import, předání kódů a přístupů,
     zaškolení, dokumentace) a co je potřeba v provozu nad rámec skeletonu, po fázích. -->

| Kdy | Co | Slice |
|---|---|---|
