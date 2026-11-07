# Automatizace agend státu pomocí umělé inteligence

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Při hlasování o novele stavebního zákona, tedy zákona upravujícího povolování a další postupy ve výstavbě, poslanci Motoristů hlasovali pro znění, které připouští automatizované úkony správních orgánů za stanovených podmínek. Senát návrh odmítl, ale Sněmovna na něm následně setrvala a Motoristé jej znovu podpořili. Vláda také schválila statut vládního zmocněnce, který má podporovat zavádění AI do veřejné správy a koordinovat kompetenční centrum. Jde o kroky podporující část slibu, nikoli o doklad, že AI už automatizuje agendy nebo přináší miliardové úspory a rychlejší služby.

## Co má zkontrolovat reviewer

- Odpovídá navržené hodnocení metodice SLAVA Indexu?
- Je jednání správně připsáno sledované straně?
- Je veřejné vysvětlení pochopitelné samo o sobě a říká, kdo co udělal a jak to souvisí se slibem?
- Jsou zkratky, právní pojmy a úřední označení při prvním použití vysvětlené?
- Dokládají uvedené zdroje všechna podstatná tvrzení a nechybí rozporný podklad?

## Technické podklady pro reviewera

- Výsledek automatického procesu: oba automatické posudky se shodly
- Interní stav: `moving-towards`
- Důvod výsledku: `assessor-consensus`
- Úplný strojový audit: `assessment-run.json`
- Přesný balíček posuzovaných podkladů: `evidence-package.json`

### Shoda hodnotitelů

Oba nezávislí hodnotitelé dospěli ke stejnému výsledku: **Směřuje ke splnění (+1)**.

Co zůstává nejisté:

- Novela dovoluje automatizované úkony, ale nepožaduje použití umělé inteligence; dodané podklady proto nedokládají, že tato možnost sama vede k zavádění AI.
- Podklady nedokládají skutečné nasazení AI v agendách státu ani dosažení miliardových úspor či rychlejších služeb.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Schválené znění novely stavebního zákona výslovně umožňuje automatizované provádění některých úkonů správních orgánů, což se týká automatizace státních agend.<br>Dopad: Dřívější § 311 upravoval vztah ke správnímu řádu a automatizované úkony v něm výslovně neupravoval. Nové odstavce doplňují mimo jiné možnost provést úkon bez úřední osoby automatizovaně, pokud nevyžaduje správní uvážení a nejsou ohrožena práva dotčených osob ani veřejný zájem; tím se možnost automatizace rozšiřuje, ale zákon ji nenařizuje ani nevyžaduje použití AI. Další doplněná pravidla upravují videokonferenční jednání a elektronické předávání spisů. | ne: Schválené znění umožňuje automatizovat některé úkony stavebního úřadu, ale text nespojuje tuto automatizaci s umělou inteligencí, kterou slib výslovně uvádí. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ne: Ustanovení umožňuje automatické tlumočení technickým zařízením, ale dodané znění nespojuje toto zařízení s umělou inteligencí, kterou slib výslovně uvádí. | ne: Návrh umožňuje automatické tlumočení pomocí technického zařízení, ale nedokládá využití umělé inteligence ani širší automatizaci agend slíbenou stranou. |
| [Text usnesení vlády: Usnesení vlády č. 26/2026, Návrh na změnu ve funkci vládního zmocněnce pro umělou inteligenci](https://odok.gov.cz/portal/zvlady/usneseni/2026/26/) | ano: Usnesení vlády stanoví úkoly vládního zmocněnce zaměřené na podporu zavádění umělé inteligence do veřejné správy a koordinaci kompetenčního centra.<br>Dopad: Jde o usnesení vlády, které nepřepisuje dřívější znění zákona. Přijatý statut svěřuje zmocněnci podporu zavádění AI do procesů veřejné správy a koordinaci zřízení a činnosti kompetenčního centra; jde o organizační podporu a přípravný krok, nikoli o samotnou automatizaci agend nebo doložené úspory. | ano: Usnesení přímo upravuje podporu zavádění umělé inteligence ve veřejné správě, a tím se vztahuje k prostředku i oblasti uvedeným ve slibu.<br>Dopad: Jde o usnesení, které nemění dřívější znění zákona; schvaluje statut vládního zmocněnce pro umělou inteligenci, podle něhož má zmocněnec podporovat zavádění AI do procesů veřejné správy a koordinovat zřízení a činnost kompetenčního centra. Vytváří tak podpůrnou a koordinační strukturu, ale samo nezavádí automatizaci konkrétních agend ani nedokládá miliardové úspory či rychlejší služby. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Text usnesení vlády: Usnesení vlády č. 26/2026, Návrh na změnu ve funkci vládního zmocněnce pro umělou inteligenci](https://odok.gov.cz/portal/zvlady/usneseni/2026/26/)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/26/)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

