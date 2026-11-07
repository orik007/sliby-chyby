# Investice do modernizace techniky a digitalizace armády

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

Vláda schválila pro program spojovacího vojska, informatizace ministerstva obrany a informačních a kybernetických sil financování až 81,5 miliardy Kč do roku 2034; to podporuje část slibu, ale nepokrývá jej celý. Ministerstvo obrany také vydalo vyhlášku, která stanoví pravidla provozu vojenských dronů, a vláda rozšířila do roku 2036 možnost vyloučit výdaje na obranu nad 2 % HDP z výdajového rámce. Poslanci Motoristů zároveň nepodpořili několik rozpočtových návrhů na drony, kybernetickou obranu a digitalizaci bojiště. Konečné rozpočtové tabulky pro tyto oblasti však v podkladech chybějí, a proto nelze určit dopad jejich hlasování pro státní rozpočet jako celek.

Co zůstává nejisté:

- Poskytnutý text schváleného rozpočtu na rok 2026 odkazuje na přílohy s částkami, ale tyto údaje v balíčku nejsou; proto nelze ověřit, jaké prostředky rozpočet nakonec přidělil modernizaci armády, dronům, digitalizaci či kybernetické obraně, ani přesně posoudit hlasování pro rozpočet jako celek.
- Poslanci Motoristů nepodpořili pozměňovací návrhy na financování dronů, kybernetické obrany a digitalizace, přestože vláda později schválila dílčí programové financování odpovídající části slibu.
- U pravidel pro vojenská bezpilotní letadla a nového § 31 rozpočtových pravidel balíček neobsahuje předchozí znění, takže nelze určit, zda tato ustanovení oproti dřívějším pravidlům rozšiřují, nebo omezují možnosti.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna rozpočtových pravidel](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00) | ano: Změna výslovně upravuje výdajový rámec pro financování obrany, a může tak ovlivnit prostor pro obranné investice, i když konkrétní modernizační projekty neurčuje.<br>Dopad: Dosavadní § 8 odst. 2 umožňoval upravovat výdajový rámec mimo jiné podle zhoršení bezpečnostní situace; nové znění tuto výslovnou úpravu vypouští. Současně se výjimka pro obranné výdaje nad 2 % HDP rozšiřuje z let 2026–2033 na 2026–2036, což naopak zvětšuje prostor pro obranné výdaje; nové pravidlo zahrnuje také výjimku pro dopravní a další infrastrukturu. U nového § 31, který dovoluje za zvláštních bezpečnostních okolností překročit celkové výdaje až o 10 %, balíček neposkytuje předchozí znění, takže změnu oproti dosavadnímu stavu nelze určit; celkový směr změny pro investice do armádní techniky proto není jednoznačný. | ano: Změna pravidel rozpočtového hospodaření upravuje prostor pro výdaje na obranu, takže se může týkat financování investic do armády.<br>Dopad: Dříve se výdaje státního rozpočtu pro roky 2026–2033 mohly zvýšit o výdaje na obranu nad 2 % HDP; schválené znění možnost prodlužuje do roku 2036, což tuto možnost rozšiřuje. Zároveň dřívější § 8 odst. 2 výslovně umožňoval upravit výdajovou částku mimo jiné podle zhoršení bezpečnostní situace, zatímco nové znění ji váže na stanovený výdajový rámec; tento postup může prostor pro takovou úpravu omezit. Nové § 31 dovoluje za mimořádné bezpečnostní situace překročit výdaje až o 10 %, ale předchozí znění tohoto ustanovení balíček nedokládá, takže směr této změny nelze určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda o posíleném partnerství a spolupráci mezi Evropskou unií a jejími členskými státy na jedné straně a Republikou Uzbekistán na straně druhé](https://www.psp.cz/sqw/text/orig2.sqw?idd=267249) | ne: Preambule dohody zmiňuje kybernetickou bezpečnost jako součást zahraničněpolitického dialogu s Uzbekistánem, ale nepřináší investice do armádní techniky ani integraci kybernetické obrany do českých vojenských a civilních struktur. | ne: Doložená pasáž dohody se týká obecného dialogu EU a Uzbekistánu o bezpečnostní a kybernetické politice, nikoli investic ani začlenění kybernetické obrany do české armády. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Státní rozpočet na rok 2026 může přímo určit prostředky na obrannou techniku a digitalizaci, přičemž související pozměňovací návrhy v balíčku výslovně navrhují výdaje na drony, kybernetickou obranu a digitalizaci bojiště.<br>Dopad: Jde o státní rozpočet, který stanovuje výdaje na rok 2026, nikoli o změnu dřívějšího právního znění. Poskytnutý text pouze odkazuje na rozpočtové přílohy, ale neobsahuje příslušné částky pro armádu, takže z balíčku nelze zjistit, jaké výdaje rozpočet na slibované oblasti skutečně stanovil. | ano: Státní rozpočet na rok 2026 může přímo určit prostředky na obranu a související technologie, které slib pokrývá.<br>Dopad: Jde o nový roční rozpočet, takže nemá předchozí znění, s nímž by šlo porovnat změnu. Poskytnutý výňatek pouze odkazuje na přílohy s výdaji podle kapitol a neobsahuje příslušné částky ani jejich určení; z balíčku proto nelze zjistit, zda rozpočet investice do modernizace, digitalizace, dronů či kybernetické obrany zvyšuje, nebo snižuje. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda mezi vládou České republiky a vládou Keňské republiky o spolupráci v oblasti obrany](https://www.psp.cz/sqw/text/orig2.sqw?idd=269201) | ano: Dohoda výslovně zahrnuje obranný výzkum a vývoj i pořizování vojenského vybavení, tedy oblasti, které mohou být součástí modernizace techniky.<br>Dopad: Dohoda vytváří rámec pro obrannou spolupráci zahrnující obranný výzkum a vývoj a pořizování vojenského vybavení, jeho údržbu a opravy. Protože nejde o změnu dřívějšího zákona, předchozí znění neexistuje; dohoda sama nestanoví výši investic ani nezaručuje pořízení konkrétní moderní techniky. | ano: Dohoda výslovně zahrnuje obranný výzkum a vývoj i pořizování vojenského vybavení, což může být cestou k modernizaci techniky, byť není zaměřena na konkrétní technologie ze slibu.<br>Dopad: Jde o novou dohodu, která vytváří rámec pro obrannou spolupráci, včetně výzkumu, vývoje a pořizování vybavení; částky ani konkrétní investice nestanoví. Předchozí znění takové dohody balíček nedokládá, a proto nelze určit změnu oproti dřívějšímu stavu. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 80/2026 Sb., Vyhláška,  kterou se mění vyhláška č. 154/2011 Sb., o vojenské letecké technice, schvalování technické způsobilosti vojenské letecké techniky, provádění pravidelných technických prohlídek a zkoušek technických zařízení vojenské letecké techniky, provozování a kontrolách vojenské letecké techniky a pověřování a osvědčování právnických a fyzických osob, a o vojenském leteckém rejstříku (o vojenské letecké technice)](https://e-sbirka.gov.cz/sb/2026/80/0000-00-00) | ano: Vyhláška upravuje vojenská bezpilotní letadla, jejich provoz a hodnocení rizik, což se přímo týká využití dronů zmíněného ve slibu.<br>Dopad: Vyhláška stanoví kategorie vojenských bezpilotních letadel, podmínky jejich provozu a postupy pro povolování a hodnocení rizik. Balíček neobsahuje předchozí znění vyhlášky, takže nelze určit, zda výsledná pravidla rozšiřují, nebo omezují dosavadní možnosti jejich využití; sama o sobě také nepřikazuje jejich pořízení ani investice. | ano: Vyhláška stanoví pravidla pro vojenská bezpilotní letadla, tedy pro technologii, jejíž využívání slib výslovně zmiňuje.<br>Dopad: Vyhláška zavádí členění vojenských bezpilotních letadel, pravidla posuzování rizik a podmínky jejich provozu, včetně povolování. Předchozí znění měněné vyhlášky není v balíčku dodáno, takže nelze určit, zda jsou nová pravidla oproti dosavadním volnější, nebo přísnější; sama vyhláška však nákup ani investice do dronů nenařizuje. |
| [Text usnesení vlády: Usnesení vlády č. 197/2026, Stanovení výše účasti státního rozpočtu na financování programu reprodukce majetku 107V470 „Spojovací vojsko AČR, informatizace MO a informační a kybernetické síly AČR“](https://odok.gov.cz/portal/zvlady/usneseni/2026/197/) | ano: Vláda schválila financování programu, jehož výslovným obsahem jsou spojovací vojsko, informatizace ministerstva obrany a informační a kybernetické síly armády.<br>Dopad: Usnesení stanoví účast státního rozpočtu na programu do výše 81 504,139 mil. Kč s realizací do 31. prosince 2034. Jde o konkrétní finanční rámec pro informatizaci, spojovací a kybernetické schopnosti armády, tedy o významný, ale pouze dílčí příspěvek ke slibu; usnesení neuvádí, že by pokrývalo všechny jeho oblasti. | ano: Usnesení přímo stanoví financování programu zaměřeného na spojovací vojsko, informatizaci ministerstva obrany a informační a kybernetické síly armády.<br>Dopad: Usnesení stanoví účast státního rozpočtu na programu do výše 81 504,139 mil. Kč s realizací do 31. prosince 2034. Jde o přímé finanční zajištění části digitalizace a kybernetických schopností armády, nikoli však o doložené financování všech technologií a závazků uvedených ve slibu. |
| [Text usnesení vlády: Usnesení vlády č. 375/2026, Zapojení České republiky do nástroje Bezpečnostní akce pro Evropu (SAFE)](https://odok.gov.cz/portal/zvlady/usneseni/2026/375/) | ne: Usnesení schvaluje zapojení do půjčky SAFE ve výši 2,06 mld. EUR pro blíže nepopsané projekty; poskytnutý text je nespojuje s modernizací techniky, digitalizací ani kybernetickou obranou uvedenou ve slibu. | ne: Doložené usnesení schvaluje půjčku na blíže nepopsané vyzbrojovací projekty a dopravní infrastrukturu, ale nespojuje je s digitalizací, drony ani kybernetickou obranou uvedenou ve slibu. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda o posíleném partnerství a spolupráci mezi Evropskou unií a jejími členskými státy na jedné straně a Republikou Uzbekistán na straně druhé
- Text usnesení vlády: Usnesení vlády č. 375/2026, Zapojení České republiky do nástroje Bezpečnostní akce pro Evropu (SAFE)

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna rozpočtových pravidel](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda mezi vládou České republiky a vládou Keňské republiky o spolupráci v oblasti obrany](https://www.psp.cz/sqw/text/orig2.sqw?idd=269201)
- [Předpis ve Sbírce zákonů: Vyhláška č. 80/2026 Sb., Vyhláška,  kterou se mění vyhláška č. 154/2011 Sb., o vojenské letecké technice, schvalování technické způsobilosti vojenské letecké techniky, provádění pravidelných technických prohlídek a zkoušek technických zařízení vojenské letecké techniky, provozování a kontrolách vojenské letecké techniky a pověřování a osvědčování právnických a fyzických osob, a o vojenském leteckém rejstříku (o vojenské letecké technice)](https://e-sbirka.gov.cz/sb/2026/80/0000-00-00)
- [Text usnesení vlády: Usnesení vlády č. 197/2026, Stanovení výše účasti státního rozpočtu na financování programu reprodukce majetku 107V470 „Spojovací vojsko AČR, informatizace MO a informační a kybernetické síly AČR“](https://odok.gov.cz/portal/zvlady/usneseni/2026/197/)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=277454)
- [Text pozměňovacího návrhu 7 (sněmovní dokument 523)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268131)
- [Text pozměňovacího návrhu 34 (sněmovní dokument 360)](https://www.psp.cz/sqw/text/orig2.sqw?idd=267639)
- [Text pozměňovacího návrhu 65 (sněmovní dokument 526)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268139)
- [Text pozměňovacího návrhu 78 (sněmovní dokument 509)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268103)
- [Text pozměňovacího návrhu 81 (sněmovní dokument 551)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268197)
- [Text pozměňovacího návrhu 82 (sněmovní dokument 552)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268199)
- [Text pozměňovacího návrhu 95 (sněmovní dokument 454)](https://www.psp.cz/sqw/text/orig2.sqw?idd=267979)
- [Text pozměňovacího návrhu 107 (sněmovní dokument 520)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268125)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=90)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 7](https://public.psp.cz/sqw/hlasy.sqw?g=86842)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 34](https://public.psp.cz/sqw/hlasy.sqw?g=86873)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 65](https://public.psp.cz/sqw/hlasy.sqw?g=86904)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 78](https://public.psp.cz/sqw/hlasy.sqw?g=86918)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 81](https://public.psp.cz/sqw/hlasy.sqw?g=86921)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 82](https://public.psp.cz/sqw/hlasy.sqw?g=86922)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 95](https://public.psp.cz/sqw/hlasy.sqw?g=86935)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 107](https://public.psp.cz/sqw/hlasy.sqw?g=86947)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/197/)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=165)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87430)
- [Vydání vyhlášky: Ministerstvo obrany](https://e-sbirka.gov.cz/sb/2026/80/0000-00-00)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88105)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88416)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

