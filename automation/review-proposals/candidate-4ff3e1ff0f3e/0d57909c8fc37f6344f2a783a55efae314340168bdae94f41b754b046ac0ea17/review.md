# Ochrana kritických systémů proti hybridním útokům

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Návrh změny zákona o základních registrech zavádí testovací identity a údaje pro ověřování bezpečnosti a dalších vlastností registrů a informačních systémů. Při závěrečném hlasování o návrhu klub Motoristů sobě neměl většinovou volbu pro jeho podporu: pro hlasovalo pět z třinácti členů. Testování bezpečnosti může přispět k ochraně systémů, ale návrh neřeší přímo obranu před hybridními útoky ani ochranu všech kritických systémů. Nepodpora takové dílčí možnosti posouvá stranu proti slibu.

## Co má zkontrolovat reviewer

- Odpovídá navržené hodnocení metodice SLAVA Indexu?
- Je jednání správně připsáno sledované straně?
- Je veřejné vysvětlení pochopitelné samo o sobě a říká, kdo co udělal a jak to souvisí se slibem?
- Jsou zkratky, právní pojmy a úřední označení při prvním použití vysvětlené?
- Dokládají uvedené zdroje všechna podstatná tvrzení a nechybí rozporný podklad?

## Technické podklady pro reviewera

- Výsledek automatického procesu: oba automatické posudky se shodly
- Interní stav: `moving-against`
- Důvod výsledku: `assessor-consensus`
- Úplný strojový audit: `assessment-run.json`
- Přesný balíček posuzovaných podkladů: `evidence-package.json`

### Shoda hodnotitelů

Oba nezávislí hodnotitelé dospěli ke stejnému výsledku: **Směřuje proti slibu (−1)**.

Co zůstává nejisté:

- Balíček nedokládá, zda testované základní registry a agendové informační systémy patří mezi kritické systémy ani zda navržené testování konkrétně míří na hybridní útoky; proto jde jen o možnou dílčí souvislost se slibem.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ne: Změny se týkají hlavně elektronické identifikace a digitálních peněženek; balíček je nespojuje s ochranou kritických systémů před hybridními útoky. | ne: Návrh upravuje elektronickou identifikaci a digitální peněženky, ale podklady je nespojují s ochranou kritických systémů proti hybridním útokům. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ano: Změna výslovně zavádí testování bezpečnosti základních registrů a agendových informačních systémů, což může přispět k ochraně systémů, byť se nezaměřuje přímo na hybridní útoky.<br>Dopad: Dosavadní § 4 zákona o základních registrech uváděl mezi obsahem registrů provozní údaje, nikoli testovací údaje; nově výslovně zahrnuje i testovací údaje. Dosavadní § 4a obecně vymezoval údaje agendových informačních systémů, zatímco nový § 4b umožňuje a upravuje vytváření testovacích identit a údajů výhradně pro testování dostupnosti, funkčnosti, bezpečnosti a interoperability; ukládá také jejich vytvoření na žádost vyjmenovaných institucí. Jde o rozšíření nástrojů pro testování bezpečnosti, nikoli o přímou povinnost zabránit hybridním útokům nebo zajistit ochranu všech kritických systémů. Změna § 7 pouze zkracuje označení Digitální a informační agentury na „Agentura“ a věcnou ochranu nemění. | ano: Ustanovení o testování bezpečnosti základních registrů a agendových informačních systémů představují konkrétní, byť jen dílčí prostředek k posílení ochrany informačních systémů.<br>Dopad: Před změnou § 4 zahrnoval v základních registrech mimo jiné provozní údaje a jiné zákonem stanovené údaje; změna výslovně doplňuje testovací údaje. § 4a již upravoval údaje agendových informačních systémů a nově výslovně zahrne také testovací údaje. Nový § 4b umožňuje a v popsaných případech ukládá vytvářet testovací identity a údaje pro testování dostupnosti, funkčnosti, bezpečnosti a interoperability; některým orgánům, včetně Bezpečnostní informační služby a Vojenského zpravodajství, dává možnost jejich vytvoření požadovat. Oproti předchozímu stavu tak rozšiřuje možnosti bezpečnostního testování, ale nestanoví přímou povinnost zabránit hybridním útokům ani konkrétní úroveň ochrany. Změna § 7 odst. 1 pouze zkracuje označení Digitální a informační agentury zavedením zkráceného označení „Agentura“; věcný rozsah její role se podle dodaných znění nemění. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88528)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

