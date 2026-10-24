# Moderní síť chránící státní systémy a osobní údaje před kybernetickými hrozbami

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Poslanci ANO podpořili zákon o správě dat, který ukládá správcům chránit data a nastavuje pravidla pro zabezpečený přístup k údajům veřejné správy. Hlasovali také pro úpravu základních registrů, která umožňuje testovat jejich bezpečnost, a pro cizinecký zákon s možností omezit účty při bezpečnostním incidentu. Vláda navrhla i změny digitální identity a důvěryhodných služeb, které mohou posílit ochranu údajů. Jde o dílčí opatření, nikoli o doložené vybudování celé ochranné sítě slíbené ANO.

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

- Vládní návrh změn registrů a digitálních služeb ruší některá dosavadní pravidla a údaje pro elektronické ověřování identity. Z dodaných podkladů není možné určit, zda tím ochranu proti kybernetickým hrozbám celkově oslabuje, nebo zda jde o změnu způsobu ověřování; návrhy proto zůstávají v rozporu s podpůrnými kroky viditelnými v záznamech.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: SPRÁVA DAT A ŘÍZENÝ PŘÍSTUP K DATŮM](https://www.psp.cz/sqw/text/orig2.sqw?idd=269522) | ano: Návrh upravuje zabezpečený přístup k datům veřejné správy, povinnosti chránit jejich důvěryhodnost a omezení přístupu k osobním údajům, takže se týká části slibu o ochraně státních systémů a osobních údajů. | ne: Návrh upravuje správu dat a jejich zpřístupňování, ale jeho ustanovení nedokládají ochranu státních systémů či osobních údajů před kybernetickými hrozbami. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Úprava cizineckých účtů umožňuje při neoprávněném zásahu nebo hrozbě nefunkčnosti systému omezit jejich použití, a tím se přímo dotýká zabezpečení digitálního systému veřejné správy. | ano: Návrh vytváří cizinecké účty v integrovaném systému a umožňuje jejich omezení při neoprávněném zásahu nebo hrozící nefunkčnosti systému. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Návrh posiluje bezpečnost služeb digitální důvěry a oddělování osobních údajů, což může přispět k ochraně osobních údajů před kybernetickými hrozbami. | ano: Návrh ukládá pravidla pro kryptografickou bezpečnost služeb elektronické důvěry a stanoví povinnosti související s ochranou dat a narušením bezpečnosti. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Návrh upravuje digitální identitu a bezpečnostní povinnosti související s digitální peněženkou, včetně reakce na narušení její bezpečnosti, takže má věcnou vazbu na ochranu údajů a systémů. | ano: Návrh vytváří pravidla pro digitální peněženky a elektronickou identifikaci, včetně bezpečnostních povinností a postupů při narušení bezpečnosti. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ne: Tato část mění pouze správní poplatky za žádosti související s kvalifikovanými poskytovateli a neobsahuje opatření na ochranu systémů nebo osobních údajů před kybernetickými hrozbami. | ne: Tato část mění pouze správní poplatky za žádosti a nepřináší opatření k ochraně systémů nebo osobních údajů před kybernetickými hrozbami. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Návrh ruší evidenci údajů používaných pro elektronickou identifikaci a autentizaci v registru obyvatel, tedy mění prvek související s bezpečným ověřováním přístupu. | ano: Návrh odstraňuje z registru obyvatel data potřebná pro elektronickou identifikaci, což může omezit množství citlivých údajů vystavených případnému napadení. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o právu na digitální služby](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Návrh ruší dosavadní pravidla pro dodatečné ověřování identity při některých úkonech, což se může týkat ochrany digitálních služeb a osobních údajů. | ano: Návrh ruší možnost vyžadovat dodatečné ověření totožnosti před digitálním úkonem, což se může dotknout zabezpečení přístupu k digitálním službám. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ano: Schválená úprava zavádí testovací identity a údaje pro ověřování dostupnosti, funkčnosti a bezpečnosti registrů a informačních systémů veřejné správy. | ano: Schválená část zavádí testovací identity a údaje k ověřování bezpečnosti, funkčnosti a dostupnosti základních registrů a dalších informačních systémů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=278932) | ne: Tato změna upravuje evidenci orgánů veřejné moci a jejich kontaktní údaje, nikoli ochranu systémů nebo osobních údajů před kybernetickými hrozbami. | ne: Změny se týkají hlavně údajů o orgánech veřejné moci a jejich evidenci, nikoli kybernetické ochrany systémů nebo osobních údajů. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: SPRÁVA DAT A ŘÍZENÝ PŘÍSTUP K DATŮM](https://www.psp.cz/sqw/text/orig2.sqw?idd=269522)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o právu na digitální služby](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86767)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=154)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=172)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88528)

