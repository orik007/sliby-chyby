# Širší využití českých technologií ve veřejné správě

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

Poslanci Motoristů ve třetím čtení schválili novelu stavebního zákona, která mimo jiné zavádí sledování řízení přes Portál stavebníka; po zamítnutí Senátem podpořili i setrvání na návrhu. U změn státní sociální podpory hlasovali pro digitální postupy, ale návrh současně ruší část dříve plánované širší digitalizace. Při závěrečném hlasování o vládním cizineckém zákoně klub neměl potřebnou většinu hlasů pro, přestože návrh zavádí elektronické účty a úkony. Tyto kroky se týkají digitálních nástrojů veřejné správy, ale podklady nedokládají, zda jde o české technologie ani zda se jejich využívání skutečně rozšířilo; proto nelze ověřit podstatný posun v přesně formulovaném slibu.

Co zůstává nejisté:

- Podklady popisují digitální nástroje veřejné správy, ale neuvádějí, zda jsou českého původu nebo zda podporují širší využívání českých nápadů; jde o podstatnou část slibu.
- U novely cizineckého zákona hlasovalo pro šest z třinácti poslanců Motoristů, což nebyla většina klubu; při určování dopadu na přesný slib však chybí spojení s českým původem technologií.
- U hlasování o novele zákona o Sbírce zákonů je v balíčku zaznamenáno pouze hlasování v prvním čtení, nikoli závěrečné rozhodnutí Sněmovny.
- Pozitivní podpora stavebního zákona, digitálních postupů u dávek a návrhů na elektronické nástroje zůstává v rozporu s některými omezeními digitálního prostředí; samotná tato opatření ale neprokazují využití českých technologií.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Sbírce zákonů a mezinárodních smluv](https://www.psp.cz/sqw/text/orig2.sqw?idd=269520) | ano: Upravuje přímo používání elektronického systému pro tvorbu právních předpisů, tedy konkrétní digitální nástroj veřejné správy.<br>Dopad: Dříve se státní rozpočet vyhlašoval elektronicky bez systému tvorby předpisů jen v mimořádné situaci; nově je tato výjimka výslovná i pro rozpočet a jeho změny, takže se použití systému zužuje. Nový § 22a navíc pro rozpočet vylučuje postupy podle § 16 až 21; dřívější znění § 22a nebylo, takže jde o novou výjimku. § 18 dříve ukládal po odstranění překážky vložit do systému předpis či návrh i související dokumenty, nově jen v rozsahu nezbytném pro další projednávání, což povinnost zmenšuje. | ne: Změna upravuje postupy tvorby a vyhlašování právních předpisů, ale nepropojuje je s využíváním českých technologií ve veřejné správě. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Mění digitální nástroje stavební správy a pravidla pro elektronické úkony, takže zasahuje do prostředí pro používání technologií ve veřejné správě.<br>Dopad: Dosavadní zákon umožňoval podání přes Portál stavebníka a ukládal zveřejňovat plánovací dokumenty v geoportálu; schválený text rozšiřuje digitální postupy, mimo jiné zavádí v Portálu stavebníka sledování stavu řízení a upravuje vkládání údajů do geoportálu. Jde o posílení digitálního prostředí veřejné správy, nikoli však o pravidlo, které by samo nařizovalo širší používání českých technologií. | ne: Návrh mění organizaci stavební správy a upravuje její digitální systémy, ale neobsahuje vazbu na širší využívání českých technologií či nápadů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o informačních systémech veřejné správy](https://www.psp.cz/sqw/text/orig2.sqw?idd=280393) | ne: Ruší pouze pravidlo, že v čele vládní Rady pro informační společnost stojí člen vlády; dodaný text nedokládá změnu používání technologií ve veřejné správě. | ne: Zrušení ustanovení o vedení poradního orgánu vlády se netýká využívání technologií ve veřejné správě. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o státní sociální podpoře](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375) | ano: Zavádí elektronické podání, zpracování a doručování u části dávek státní sociální podpory, což je konkrétní digitalizace agendy veřejné správy.<br>Dopad: Text nově rozlišuje digitalizovanou dávku a stanoví, že se žádost podává prostřednictvím informačního systému; u této dávky se také zavádí elektronické doručování a elektronický spis. Předchozí znění některých dotčených ustanovení v balíčku chybí, takže nelze úplně porovnat původní pravidla; návrh však výslovně zřizuje konkrétní digitální postupy. | ne: Změny pravidel státní sociální podpory zavádějí digitální postupy pro některé dávky, ale nespojují je s českými technologiemi ani nápady. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona č. 152/2025 Sb.](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375) | ano: Ruší část dříve přijaté širší digitalizace dávkového řízení a mění tak rozsah používání digitálních nástrojů v této veřejné agendě.<br>Dopad: Dřívější úprava zákona č. 152/2025 Sb. počítala mimo jiné s elektronickým podáváním žádostí, elektronickým doručováním a vedením elektronického spisu. Návrh ruší body, které tyto změny zaváděly, takže jejich plánované zavedení omezuje; současně první část téhož návrhu zavádí digitální postup pro nově vymezenou dávku. | ne: Změna ruší vybraná ustanovení dřívějšího zákona o dávce státní sociální pomoci, ale neřeší české technologie ve veřejné správě. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Upravuje elektronické účty a úkony v řízeních o pobytu cizinců, tedy přímé digitální rozhraní mezi veřejnou správou a jejími klienty.<br>Dopad: Nové ustanovení vytváří cizinecký účet a navazující pravidla pro elektronická podání, doručování a vedení spisů. Jde o novou digitální infrastrukturu, nikoli o změnu dříve uvedených pravidel; její předchozí znění proto balíček neposkytuje. | ne: Návrh upravuje řízení o pobytu cizinců včetně elektronického účtu, avšak nepřipojuje tuto úpravu k využívání českých technologií či nápadů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Umožňuje elektronické prokazování údajů peněženkou digitální identity a ukládá veřejným orgánům tuto možnost připustit.<br>Dopad: Dřívější § 12 upravoval ověřování elektronických podpisů; nově zavádí online prokazování skutečností elektronickými potvrzeními atributů přes peněženku a ukládá orgánům veřejné moci tuto možnost umožnit. Jde o rozšíření digitálního nástroje, jehož propojení s českým původem však text neprokazuje. | ne: Návrh upravuje elektronická potvrzení a jejich použití s digitální peněženkou, ale nedokládá souvislost s využíváním českých technologií ve veřejné správě. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Rozšiřuje právní rámec elektronické identifikace o peněženku digitální identity a její využití při prokazování totožnosti.<br>Dopad: Dříve bylo elektronické prokázání totožnosti možné jen prostřednictvím kvalifikovaného systému; návrh vedle něj připouští také peněženku, byť veřejný orgán ji mimo kvalifikovaný systém přijmout nesmí. Zároveň ukládá povinnost umožnit prokázání i dalším osobám, které mají totožnost ověřovat, takže možnosti elektronické identifikace rozšiřuje. | ne: Návrh mění pravidla elektronické identifikace a digitálních peněženek, ale nevymezuje podporu českých technologií či nápadů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Zavádí poplatky pro poskytovatele elektronických potvrzení atributů, které jsou součástí navrhované digitální identity.<br>Dopad: Návrh zvyšuje poplatek v položce 22 z 25 000 Kč na 50 000 Kč a přidává poplatek 50 000 Kč za zápis poskytovatele kvalifikovaných potvrzení atributů. Vyšší nebo nově zavedené náklady mohou omezovat vstup poskytovatelů; původní sazba pro novou kategorii v balíčku uvedena není. | ne: Změna stanovuje správní poplatky za žádosti související s elektronickými potvrzeními atributů, nikoli podmínky pro širší využití českých technologií. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Navrhuje odstranit ze základního registru údaje používané pro elektronickou identifikaci a autentizaci, čímž zasahuje do digitálního zázemí veřejné správy.<br>Dopad: Dříve se v registru vedla data potřebná pro elektronickou identifikaci a autentizaci, včetně údaje o případném požadavku na fyzické ověření; návrh tato data i související pravidla pro jejich zápis a použití ruší. Jde o zmenšení tohoto prostředku elektronické identifikace. | ne: Návrh odstraňuje údaje související s elektronickou identifikací ze základních registrů, ale balíček nedokládá vazbu na české technologie ani nápady. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správě voleb](https://www.psp.cz/sqw/text/orig2.sqw?idd=271817) | ano: Navrhuje nástroj pro sestavování elektronických petic a digitální náhled hlasovacího lístku, tedy konkrétní digitální nástroje pro veřejné procesy.<br>Dopad: Dřívější úprava neobsahovala grafický kód k náhledu hlasovacího lístku ani povinnost vytvořit nástroj pro elektronické petice. Návrh obojí zavádí a ukládá ministerstvu vytvořit petiční nástroj do 12 měsíců; jde o nový digitální prostředek. | ne: Změna zavádí grafický kód na některých hlasovacích lístcích a posouvá elektronické petice, aniž by je spojovala s českými technologiemi. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronických úkonech a autorizované konverzi dokumentů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278932) | ano: Rozšiřuje okruh subjektů veřejné správy oprávněných používat datové schránky na společenství obcí.<br>Dopad: Dosavadní pravidlo zahrnovalo územní samosprávné celky; návrh výslovně přidává společenství obcí. Tím rozšiřuje okruh veřejných subjektů, které mohou využívat elektronické úkony prostřednictvím datových schránek. | ne: Návrh umožňuje společenstvím obcí využívat datové schránky, ale neřeší širší využívání českých technologií či nápadů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232) | ano: Zavádí elektronické podávání žádostí a automatizované vyřízení některých úkonů v registru vozidel.<br>Dopad: Nový § 14b umožňuje podávat žádosti nebo oznámení přes ministerstvem určené online rozhraní a za stanovených podmínek je vyřídit automatizovaně. Jde o nový postup; dřívější znění této úpravy balíček neposkytuje. | ne: Návrh upravuje evidenci a provoz silničních vozidel, nikoli využívání českých technologií ve veřejné správě. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o silniční dopravě](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Zavádí povinnost zpřístupnit datovou schránku pro konkrétního zprostředkovatele taxislužby, ale nedokládá rozšíření používání technologií či nápadů ve veřejné správě. | ne: Návrh ukládá některým zprostředkovatelům taxislužby povinnost mít datovou schránku, ale neřeší české technologie či nápady ve veřejné správě. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o informačních systémech veřejné správy
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o silniční dopravě

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Sbírce zákonů a mezinárodních smluv](https://www.psp.cz/sqw/text/orig2.sqw?idd=269520)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o informačních systémech veřejné správy](https://www.psp.cz/sqw/text/orig2.sqw?idd=280393)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o státní sociální podpoře](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona č. 152/2025 Sb.](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správě voleb](https://www.psp.cz/sqw/text/orig2.sqw?idd=271817)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronických úkonech a autorizované konverzi dokumentů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278932)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o silniční dopravě](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86432)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=67)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=154)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=172)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87387)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87594)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=277)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=293)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

