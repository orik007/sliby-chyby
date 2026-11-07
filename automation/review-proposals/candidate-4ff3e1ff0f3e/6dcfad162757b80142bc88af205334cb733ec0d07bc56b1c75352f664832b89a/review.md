# Ochrana kritických systémů proti hybridním útokům

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

*Nevznikl žádný návrh veřejného hodnocení ani vysvětlení.*

## Co má zkontrolovat reviewer

- Odpovídá navržené hodnocení metodice SLAVA Indexu?
- Je jednání správně připsáno sledované straně?
- Je veřejné vysvětlení pochopitelné samo o sobě a říká, kdo co udělal a jak to souvisí se slibem?
- Jsou zkratky, právní pojmy a úřední označení při prvním použití vysvětlené?
- Dokládají uvedené zdroje všechna podstatná tvrzení a nechybí rozporný podklad?

## Technické podklady pro reviewera

- Výsledek automatického procesu: oba automatické posudky označily podklady za nedostatečné
- Interní stav: bez kandidátního stavu
- Důvod výsledku: `insufficient-evidence`
- Úplný strojový audit: `assessment-run.json`
- Přesný balíček posuzovaných podkladů: `evidence-package.json`

### Shoda hodnotitelů

Oba nezávislí hodnotitelé dospěli ke stejnému výsledku: **podklady nestačí pro automatický návrh hodnocení**.

Vláda, v níž Motoristé sobě působí, přijala usnesení o zřízení zmocněnce a zadala přípravu koncepcí hybridní obrany a odolnosti kritických objektů; jde o přípravu, ne o hotovou ochranu. Ministerstvo vnitra vydalo vyhlášku, která subjektům kritické infrastruktury ukládá hodnotit i hybridní hrozby a plánovat opatření k odolnosti, což představuje konkrétní, ale jen dílčí krok. Vláda také předložila dohodu o spolupráci proti kyberkriminalitě, která zmiňuje ochranu kritické infrastruktury. Poslanci Motoristů nepodpořili několik návrhů na navýšení prostředků pro kybernetickou bezpečnost a ochranu kritické infrastruktury. Strana zároveň hlasovala pro státní rozpočet na rok 2026, ale dodané části rozpočtu neukazují příslušné částky, takže jeho dopad nelze posoudit.

Co zůstává nejisté:

- Schválený státní rozpočet na rok 2026 nebyl v dodaných pasážích doložen v relevantních rozpočtových položkách ani částkách. Proto nelze určit, jak působí závěrečné hlasování Motoristů pro rozpočet; tento nedostatek může změnit celkové hodnocení.
- Poslanci Motoristů nepodpořili návrhy na navýšení prostředků pro kybernetickou obranu a bezpečnostní instituce, přestože vláda a ministerstvo přijaly jiné kroky podporující odolnost kritické infrastruktury.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Rozpočet na rok 2026 je podkladem pro návrhy, které přímo měnily financování kybernetické obrany a ochrany kritické infrastruktury.<br>Dopad: Návrh i schválené znění stanoví výdaje státního rozpočtu na rok 2026 a odkazují na jejich rozpis v přílohách, ale dodané pasáže neuvádějí příslušné částky ani konkrétní rozpočtové položky. Proto nelze z těchto znění určit, zda rozpočet prostředky na ochranu kritických systémů zvyšuje, snižuje či ponechává beze změny, ani posoudit jeho účinek vůči slibu. | ano: Státní rozpočet může ovlivnit kapacity institucí zajišťujících ochranu před hybridními hrozbami a doložené rozpočtové pozměňovací návrhy výslovně míří na kybernetickou obranu a ochranu kritické infrastruktury.<br>Dopad: Jde o nový státní rozpočet, nikoli změnu dřívějšího znění zákona. Dodané části uvádějí jen to, že přehledy a ukazatele výdajů jsou v přílohách; konkrétní rozpočtové částky pro dotčené instituce zde nejsou, takže z těchto částí nelze určit, zda schválený rozpočet ochranu posiluje, nebo oslabuje. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ne: Změna upravuje testovací identity a testovací údaje pro ověřování registrů a informačních systémů, ale dodané znění ji nespojuje s ochranou kritických systémů před hybridními útoky. | ano: Nová pravidla pro testovací údaje se týkají testování bezpečnosti základních registrů a agendových informačních systémů, tedy konkrétního dílčího způsobu prověřování systémů.<br>Dopad: Dosavadní znění § 4 a § 4a neobsahovalo uvedené testovací identity a testovací údaje; změna umožňuje jejich vytváření a používání výhradně pro testování, včetně bezpečnosti, a zakazuje jejich záměnu za skutečné údaje. Tím se přidává možnost bezpečnostního testování, ale text nezavádí obecnou povinnost ochrany před hybridními útoky, takže jeho účinek na celý slib je jen dílčí. |
| [Změna zákona v návrhu projednávaném Sněmovnou: SVOBODA, BEZPEČNOST A PRÁVO](https://www.psp.cz/sqw/text/orig2.sqw?idd=281029) | ano: Dohoda výslovně zahrnuje spolupráci v prevenci a potírání kyberkriminality s důrazem na ochranu kritické infrastruktury, což pokrývá část slibu.<br>Dopad: Jde o návrh mezinárodní dohody, nikoli změnu dosavadního znění zákona. Ustanovuje spolupráci a výměnu informací a zkušeností při prevenci a potírání kyberkriminality, včetně důrazu na ochranu kritické infrastruktury, ale sama nepředstavuje úplnou ochranu systémů před hybridními útoky. | ano: Dohoda výslovně počítá se spoluprací proti kyberkriminalitě a zmiňuje ochranu kritické infrastruktury, což může přispět k dílčí ochraně systémů před kybernetickou složkou hybridních hrozeb.<br>Dopad: Jde o návrh mezinárodní dohody, nikoli změnu dosavadního českého zákona. Předložený text stanoví spolupráci a výměnu informací při prevenci a potírání kyberkriminality, včetně odborné přípravy a ochrany kritické infrastruktury; nepředkládá však konkrétní povinnosti pro ochranu systémů před všemi hybridními útoky. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 122/2026 Sb., Vyhláška o plánu odolnosti, posouzení rizik, opatřeních k zajištění odolnosti subjektů kritické infrastruktury a o hlášení incidentu](https://e-sbirka.gov.cz/sb/2026/122/0000-00-00) | ano: Vyhláška ukládá subjektům kritické infrastruktury hodnotit i hybridní hrozby a přijímat opatření k řízení rizik a zajištění odolnosti.<br>Dopad: Vyhláška jako nová závazná úprava stanoví povinnosti k posuzování rizik, výslovně včetně hybridních hrozeb, a k zavádění systému řízení rizik, přípravě na incidenty, zajištění kontinuity činností a ochraně kritické infrastruktury. Předchozí znění těchto povinností balíček nedodává; vyhláška však přímo ukládá část opatření potřebných pro ochranu, nikoli zajištění ochrany před všemi hybridními útoky. | ano: Vyhláška ukládá subjektům kritické infrastruktury posuzovat i hybridní hrozby a zavádět řízení rizik, odolnost a postupy pro reakci na incidenty.<br>Dopad: Jde o novou vyhlášku, takže balíček neposkytuje předchozí znění těchto povinností. Vyhláška nově stanoví posuzování hybridních hrozeb, řízení nepřijatelných a podmínečně přijatelných rizik, opatření pro kontinuitu činností a přípravu na incidenty; jde o konkrétní zpřísnění požadavků na odolnost kritické infrastruktury, avšak jen o část celkového slibu. |
| [Text usnesení vlády: Usnesení vlády č. 22/2026, Vytvoření funkce a jmenování vládního zmocněnce pro digitalizaci a strategickou bezpečnost](https://odok.gov.cz/portal/zvlady/usneseni/2026/22/) | ano: Usnesení zahrnuje přípravu koncepcí národní hybridní obrany a odolnosti kritických objektů, tedy postupů souvisejících s částí slibu.<br>Dopad: Vláda zřizuje funkci zmocněnce a ukládá mu koordinaci a přípravu koncepcí, mimo jiné národní hybridní obrany a odolnosti kritických objektů. Jde o přípravu budoucích opatření, nikoli o přímé zavedení ochrany systémů; usnesení proto posouvá přípravu, ale samo závazek ochrany nedodává. | ano: Usnesení vytváří koordinační funkci pro strategickou bezpečnost a ukládá přípravu koncepcí obrany proti hybridním hrozbám a odolnosti kritických objektů.<br>Dopad: Jde o vládní usnesení, nikoli změnu právního předpisu. Zřizuje vládního zmocněnce a ukládá přípravu koncepcí, mimo jiné národní hybridní obrany a posílení odolnosti kritických objektů; jde o přípravu budoucích kroků, nikoli o samo provedené zabezpečení systémů. |

### Vyřazené změny zákonů

Tyto změny v balíčku nebyly, protože je oba hodnotitelé dřívějšího posouzení tohoto slibu shodně označili za nesouvisející. Vrátí se, jakmile se změní jejich text, kontext, znění slibu nebo pokyny hodnotitelů.

- **187: ČÁST DEVÁTÁ – Změna zákona, kterým se mění zákon o poštovních službách** (posouzení candidate-4ff3e1ff0f3e--795f002ed995): Změna přechodných pravidel pro nároky držitelů poštovní licence se netýká ochrany kritických systémů před hybridními útoky. / Dodané znění ruší přechodné pravidlo o posuzování nákladů poštovní licence; ochrany systémů ani hybridních útoků se netýká.

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625)
- [Změna zákona v návrhu projednávaném Sněmovnou: SVOBODA, BEZPEČNOST A PRÁVO](https://www.psp.cz/sqw/text/orig2.sqw?idd=281029)
- [Předpis ve Sbírce zákonů: Vyhláška č. 122/2026 Sb., Vyhláška o plánu odolnosti, posouzení rizik, opatřeních k zajištění odolnosti subjektů kritické infrastruktury a o hlášení incidentu](https://e-sbirka.gov.cz/sb/2026/122/0000-00-00)
- [Text usnesení vlády: Usnesení vlády č. 22/2026, Vytvoření funkce a jmenování vládního zmocněnce pro digitalizaci a strategickou bezpečnost](https://odok.gov.cz/portal/zvlady/usneseni/2026/22/)
- [Text pozměňovacího návrhu 7 (sněmovní dokument 523)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268131)
- [Text pozměňovacího návrhu 34 (sněmovní dokument 360)](https://www.psp.cz/sqw/text/orig2.sqw?idd=267639)
- [Text pozměňovacího návrhu 81 (sněmovní dokument 551)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268197)
- [Text pozměňovacího návrhu 82 (sněmovní dokument 552)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268199)
- [Text pozměňovacího návrhu 95 (sněmovní dokument 454)](https://www.psp.cz/sqw/text/orig2.sqw?idd=267979)
- [Text pozměňovacího návrhu 107 (sněmovní dokument 520)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268125)
- [Text pozměňovacího návrhu 114 (sněmovní dokument 569)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268255)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/22/)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 7](https://public.psp.cz/sqw/hlasy.sqw?g=86842)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 34](https://public.psp.cz/sqw/hlasy.sqw?g=86873)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 81](https://public.psp.cz/sqw/hlasy.sqw?g=86921)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 82](https://public.psp.cz/sqw/hlasy.sqw?g=86922)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 95](https://public.psp.cz/sqw/hlasy.sqw?g=86935)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 107](https://public.psp.cz/sqw/hlasy.sqw?g=86947)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 114](https://public.psp.cz/sqw/hlasy.sqw?g=86954)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Vydání vyhlášky: Ministerstvo vnitra](https://e-sbirka.gov.cz/sb/2026/122/0000-00-00)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88528)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=331)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

