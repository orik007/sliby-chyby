# Systém detekce dronů a ochrany kritických objektů

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda usnesením pověřila svého zmocněnce přípravou koncepce systému detekce dronů a ochrany kritických objektů, takže jde o krok k naplnění slibu, ne o zavedení systému. Ministerstvo vnitra poté vydalo vyhlášku o odolnosti kritické infrastruktury, která mezi možná technická opatření výslovně řadí detekční systémy cizích dronů a bezpečnostní bezpilotní systémy. To naplňuje část slibu, ale nedokládá, že už funguje jednotný systém pro všechny kritické objekty. Poslanci ANO nepodpořili dva rozpočtové návrhy na financování obrany proti dronům; schválený rozpočet však v poskytnutém výňatku neukazuje konkrétní související částky.

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

- Výňatek státního rozpočtu neobsahuje konkrétní položky ani částky související s detekcí dronů a ochranou kritických objektů, takže nelze posoudit dopad schváleného rozpočtu na tuto část slibu.
- Podklady potvrzují přípravu koncepce a pravidla pro vybraná opatření u kritické infrastruktury, nikoli dokončené zavedení jednotného systému; rozsah uskutečnění slibu proto není doložen.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Jde o státní rozpočet a předložené pozměňovací návrhy k němu výslovně počítají s výdaji na obranu proti dronům, tedy s prostředky souvisejícími s částí slibu.<br>Dopad: Rozpočtový návrh uvádí, že celkový přehled výdajů a ukazatele podle kapitol jsou v přílohách č. 3 a 4; konkrétní rozpočtové položky ani částky v poskytnutém výňatku nejsou, takže nelze určit, zda schválený rozpočet financování systému detekce či ochrany kritických objektů zvyšuje nebo snižuje. | ne: Dodané části rozpočtu pouze odkazují na přehledy výdajů a ukazatele v přílohách; neukazují opatření ani výdaje, které by bylo možné spojit se systémem detekce dronů a ochranou kritických objektů. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 122/2026 Sb., Vyhláška o plánu odolnosti, posouzení rizik, opatřeních k zajištění odolnosti subjektů kritické infrastruktury a o hlášení incidentu](https://e-sbirka.gov.cz/sb/2026/122/0000-00-00) | ano: Vyhláška stanoví bezpečnostní opatření pro subjekty kritické infrastruktury a výslovně uvádí detekční systémy cizích dronů.<br>Dopad: Vyhláška ukládá subjektům kritické infrastruktury v rámci fyzické bezpečnosti předcházet narušení a stanovovat systém fyzické ochrany; jako technická opatření uvádí, pokud je to technicky možné nebo účelné, také bezpečnostní bezpilotní systémy k monitoringu chráněných prostor a detekční systémy cizích bezpilotních systémů. Protože jde o novou vyhlášku a balíček neobsahuje předchozí znění těchto pravidel, nelze určit změnu oproti dřívějšímu stavu; její obsah ale zavádí opatření odpovídající části slibu, nikoli doložený jednotný systém pro všechny kritické objekty. | ano: Vyhláška upravuje fyzickou bezpečnost subjektů kritické infrastruktury a výslovně zmiňuje detekční systémy cizích bezpilotních prostředků.<br>Dopad: Jde o novou vyhlášku, takže balíček neobsahuje předchozí znění, s nímž by šlo změnu porovnat. Stanoví fyzická bezpečnostní opatření subjektů kritické infrastruktury, pokud jsou technicky možné nebo účelné, a mezi technickými prostředky uvádí systémy detekce cizích bezpilotních prostředků; jde o dílčí rámec ochrany, nikoli o zavedení celého systému ani o povinnost každého subjektu pořídit právě takový detektor. |
| [Text usnesení vlády: Usnesení vlády č. 22/2026, Vytvoření funkce a jmenování vládního zmocněnce pro digitalizaci a strategickou bezpečnost](https://odok.gov.cz/portal/zvlady/usneseni/2026/22/) | ano: Usnesení vlády výslovně zadává přípravu koncepce systému dronové detekce a posílení odolnosti kritických objektů.<br>Dopad: Usnesení pověřuje vládního zmocněnce zpracovat a předložit vládě koncepci systému dronové detekce a posílení odolnosti kritických objektů. Jde o přípravu návrhu, nikoli o zavedení systému; přímo posouvá práci ke slibu, ale samo ještě nezajišťuje jeho uskutečnění. | ano: Usnesení ukládá připravit koncepci systému detekce dronů a posílení odolnosti kritických objektů, tedy přímo odpovídá tématu slibu.<br>Dopad: Jde o nové usnesení, nikoli změnu dřívějšího právního znění. Ukládá vládnímu zmocněnci zpracovat a předložit koncepci dronové detekce a odolnosti kritických objektů; posouvá přípravu slibovaného řešení, ale samo systém nezavádí. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Předpis ve Sbírce zákonů: Vyhláška č. 122/2026 Sb., Vyhláška o plánu odolnosti, posouzení rizik, opatřeních k zajištění odolnosti subjektů kritické infrastruktury a o hlášení incidentu](https://e-sbirka.gov.cz/sb/2026/122/0000-00-00)
- [Text usnesení vlády: Usnesení vlády č. 22/2026, Vytvoření funkce a jmenování vládního zmocněnce pro digitalizaci a strategickou bezpečnost](https://odok.gov.cz/portal/zvlady/usneseni/2026/22/)
- [Text pozměňovacího návrhu 7 (sněmovní dokument 523)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268131)
- [Text pozměňovacího návrhu 65 (sněmovní dokument 526)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268139)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/22/)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 7](https://public.psp.cz/sqw/hlasy.sqw?g=86842)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 65](https://public.psp.cz/sqw/hlasy.sqw?g=86904)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Vydání vyhlášky: Ministerstvo vnitra](https://e-sbirka.gov.cz/sb/2026/122/0000-00-00)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

