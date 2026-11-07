# Navýšení a pravidelná valorizace příspěvku na péči

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

Vláda za účasti ANO přijala plán připravit nový zákon o sociálních službách, který má zahrnovat valorizaci příspěvku; jde zatím o záměr, ne o změnu vyplácených částek. Poslanec Marian Jurečka navrhl zvýšit příspěvek ve IV. stupni pro osoby mimo pobytové služby z 27 000 na 54 000 Kč měsíčně, ale klub ANO tento pozměňovací návrh nepodpořil. ANO hlasovalo také proti návrhům na snížení rozpočtových výdajů na příspěvek o 300 milionů Kč a následně podpořilo státní rozpočet na rok 2026. Výňatek rozpočtu neuvádí schválenou částku na příspěvek, takže dopad tohoto rozhodnutí nelze posoudit; dostupné jednání proto ukazuje spíše odpor k jednomu konkrétnímu navýšení, zatímco valorizace zůstává jen plánem.

Co zůstává nejisté:

- Dodané části státního rozpočtu odkazují na přílohy s výdaji podle kapitol, ale neobsahují částku schválenou na příspěvek na péči. Bez ní nelze určit, zda rozhodnutí o rozpočtu slib podporuje, nebo mu odporuje.
- U pozměňovacích návrhů A4 a A5 jsou doloženy hlasování, ale dodaný výňatek návrhu neukazuje jejich obsah; jejich dopad na slib proto nelze ověřit.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Rozpočtové pozměňovací návrhy se přímo týkaly výdajů na příspěvek na péči, a proto mohou ovlivnit prostor pro jeho navýšení.<br>Dopad: Jde o nový státní rozpočet, takže předchozí znění zákona, s nímž by šlo porovnat změnu, není. Dodané výňatky pouze odkazují na přílohy s výdaji podle kapitol, ale neuvádějí přidělenou částku na příspěvek na péči; skutečný dopad schváleného rozpočtu na slib proto nelze z balíčku určit. | ano: Rozpočet se týká výdajů na příspěvek na péči: předložené pozměňovací návrhy výslovně navrhovaly jejich snížení o 300 milionů Kč.<br>Dopad: Jde o zákon o státním rozpočtu, nikoli o novelu s předchozím zněním pravidla. Dodaný text pouze odkazuje na souhrn výdajů a ukazatele v přílohách, jejichž částky zde nejsou; konečný dopad rozpočtu na příspěvek na péči proto z podkladů nelze určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o sociálních službách](https://www.psp.cz/sqw/text/orig2.sqw?idd=270377) | ano: K návrhu této novely byl předložen pozměňovací návrh, který by zvýšil příspěvek na péči pro část lidí s nejvyšší závislostí, takže může naplnit část slibu.<br>Dopad: Dodaná část navržené novely mění oznamovací povinnosti podle § 21: dříve se propuštění z lůžkové péče oznamovalo úřadu práce do pěti dnů, nově se má ve stanovených případech oznamovat územní správě sociálního zabezpečení rovněž do pěti dnů; podmínky těchto případů nejsou v úplnosti doloženy. Tato změna sama příspěvek nezvyšuje ani nezavádí jeho valorizaci. Samostatný pozměňovací návrh navrhl zvýšit částku ve IV. stupni pro osoby mimo pobytové služby z 27 000 Kč na 54 000 Kč měsíčně; šlo by o zvýšení pro část příjemců, nikoli o pravidelnou valorizaci. | ano: K tomuto návrhu byla předložena změna, která měla zvýšit příspěvek na péči ve čtvrtém stupni závislosti, tedy přímo část slibu o navýšení příspěvku.<br>Dopad: Z dodaného znění a kontextu § 21 vyplývají změny oznamovacích povinností žadatelů a příjemců, nikoli změna částky nebo pravidelné valorizace příspěvku. Pozměňovací návrh A3 k tomuto návrhu zvlášť navrhoval zvýšit u vymezené skupiny příspěvek z 27 000 Kč na 54 000 Kč měsíčně; jde však o návrh změny, nikoli o účinek znění doloženého u této části zákona. |
| [Text usnesení vlády: Usnesení vlády č. 175/2026, Návrh Plánu legislativních prací vlády na zbývající část roku 2026 a návrh Výhledu legislativních prací vlády na léta 2027 až 2029 – Příloha č. 2, Ministr práce a sociálních věcí, úkol č. 3: Návrh zákona o sociálních službách](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/) | ano: Vládní plán výslovně počítá s novým zákonem, jehož součástí má být nastavení valorizace příspěvku na péči.<br>Dopad: Usnesení nemění dosavadní právní nárok ani částku příspěvku; navrhuje přípravu nového zákona, který má upravit mimo jiné financování a valorizaci příspěvku na péči. Jde o návrh na budoucí změnu, nikoli o již zavedené navýšení nebo valorizaci. | ano: Plán legislativních prací výslovně počítá s tím, že nový zákon o sociálních službách bude obsahovat valorizaci příspěvku na péči.<br>Dopad: Usnesení nemění dosavadní právní pravidlo; jako plán navrhuje připravit nový zákon a zahrnout do něj valorizaci příspěvku na péči. Přibližuje se tak části slibu o pravidelné valorizaci, ale samo ji nezavádí ani neurčuje její částku či četnost. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o sociálních službách](https://www.psp.cz/sqw/text/orig2.sqw?idd=270377)
- [Text usnesení vlády: Usnesení vlády č. 175/2026, Návrh Plánu legislativních prací vlády na zbývající část roku 2026 a návrh Výhledu legislativních prací vlády na léta 2027 až 2029 – Příloha č. 2, Ministr práce a sociálních věcí, úkol č. 3: Návrh zákona o sociálních službách](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/)
- [Text pozměňovacího návrhu 70 (sněmovní dokument 579)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268285)
- [Text pozměňovacího návrhu 78 (sněmovní dokument 509)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268103)
- [Text pozměňovacího návrhu A3 (sněmovní dokument 1035)](https://www.psp.cz/sqw/text/orig2.sqw?idd=269981)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=125)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 70](https://public.psp.cz/sqw/hlasy.sqw?g=86910)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 78](https://public.psp.cz/sqw/hlasy.sqw?g=86918)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/)
- [Stanovisko vlády k návrhu zákona, který nepředložila (souhlas)](https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=125&CT1=1)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A3](https://public.psp.cz/sqw/hlasy.sqw?g=87390)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A4](https://public.psp.cz/sqw/hlasy.sqw?g=87391)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A5](https://public.psp.cz/sqw/hlasy.sqw?g=87392)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87394)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

