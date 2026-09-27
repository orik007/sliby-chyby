# Odmítnutí neustálých zásahů do daní

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Vláda předložila návrh na obnovení evidence tržeb a poslanci ANO jej schválili i poté, co Senát vrátil návrh s úpravami. Evidence ukládá podnikatelům posílat údaje o tržbách správci daně, takže zvyšuje daňovou administrativu, proti níž se slib vymezuje. Jiné kroky měly opačný směr: vláda navrhla smlouvy o zamezení dvojímu zdanění a poslanci ANO podpořili také změnu daňového režimu pro ukládání elektřiny. Rozhodující hlasování o evidenci tržeb však představuje konkrétní postup proti části slibu.

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

- Zákon o evidenci tržeb obsahuje také výjimky, daňovou slevu a další úpravy, které mohou část zátěže zmírňovat; Senát navrhl další výjimky. Základní evidence tržeb a povinnost předávat údaje ale zůstaly zachovány.
- Vláda zároveň navrhla smlouvy, které mohou omezit dvojí zdanění přeshraničních příjmů, a poslanci ANO podpořili daňovou úlevu pro ukládání elektřiny; tyto kroky jsou v napětí s negativním hodnocením evidence tržeb.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o stabilizaci veřejných rozpočtů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Změna upravuje daňové zacházení s elektřinou ukládanou do baterií a některé související evidenční povinnosti, takže může snížit část daňové a administrativní zátěže. | ano: Mění daňový režim skladování elektřiny, mimo jiné rozšiřuje daňové úlevy a ruší některé evidenční povinnosti, takže může snížit daňovou administrativu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi vládou České republiky a vládou Tanzanské sjednocené republiky o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Dar es Salaam dne 14. května 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=266872) | ano: Smlouva s Tanzanií mění pravidla zdanění přeshraničních příjmů a může omezit dvojí zdanění podniků a investorů. | ne: Návrh smlouvy rozděluje daňová práva mezi Českou republiku a Tanzanii a brání dvojímu zdanění, ale text nedokládá nové české povinnosti ani zvýšení daňové administrativy pro investory. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 164/2013 Sb., o mezinárodní spolupráci při správě daní a o změně dalších souvisejících zákonů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=267358) | ano: Návrh rozšiřuje daňové oznamování a ukládá nové evidenční a desetileté archivační povinnosti, tedy přímo zasahuje do administrativní zátěže daňových subjektů. | ano: Návrh rozšiřuje daňové oznamování a ukládá některým subjektům nové záznamní a desetileté archivační povinnosti, což může zvýšit jejich administrativní zátěž. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o některých pravidlech pro mechanismus uhlíkového vyrovnání na hranicích](https://www.psp.cz/sqw/text/orig2.sqw?idd=267657) | ne: Text upravuje správu evropského mechanismu uhlíkového vyrovnání při dovozu, nikoli změny daní ani daňovou administrativu slíbenou v programu. | ano: Návrh upravuje povinnosti dovozců v uhlíkovém vyrovnání na hranicích včetně jistoty a nákupu certifikátů, tedy zavádí nové náklady a administrativní úkony pro podniky. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ne: Změna upravuje elektronickou identitu a služby vytvářející důvěru, nikoli daně ani daňovou zátěž. | ne: Tato část upravuje elektronickou identitu a služby vytvářející důvěru, nikoli daně ani povinnosti daňové správy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ne: Text zvyšuje správní poplatek za konkrétní zápis, ale nejde o změnu daně ani o daňovou administrativu. | ne: Mění správní poplatek za zápis poskytovatelů elektronických služeb, nejde však o změnu daní ani daňové administrativy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Zavádí evidenci tržeb, povinnost posílat údaje správci daně a další povinnosti podnikatelů, což přímo rozšiřuje daňovou administrativu. | ano: Zavádí evidenci podnikatelských tržeb a povinnost elektronicky předávat údaje o platbách správci daně, což přímo rozšiřuje administrativní povinnosti podnikatelů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Mění zákon o daních z příjmů včetně nové přirážky spojené s evidencí tržeb a daňových slev, takže přímo mění daňová pravidla. | ano: Mění daň z příjmů v návaznosti na evidenci tržeb, včetně přirážky a slevy na její zavedení, a tím mění daňové zatížení i související administrativu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o dani z přidané hodnoty](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Mění pravidla DPH včetně sazeb na vybrané nápoje a odpočtů, a proto představuje konkrétní zásah do daní. | ano: Mění pravidla DPH pro odpočty, nedobytné pohledávky a sazby u nápojů, tedy přímo mění daňové podmínky podnikání. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Finanční správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Rozšiřuje působnost finanční správy v souvislosti s evidencí tržeb a upravuje práci s údaji daňových subjektů. | ano: Upravuje působnost finanční správy a přístup k údajům pro evidenci tržeb, takže tvoří součást nové daňové kontrolní a evidenční povinnosti. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Celní správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Přidává celní správě úkoly při evidenci tržeb, tedy související daňovou kontrolu a správu. | ano: Rozšiřuje úkoly Celní správy o evidenci tržeb, a tím zajišťuje kontrolní a sankční část nového režimu pro podnikatele. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313) | ne: Změny se týkají zejména dočasné ochrany, zdravotního pojištění a registrace vozidel, nikoli daňových zásahů nebo administrativy podnikatelů. | ne: Upravuje pobytová pravidla a registraci vozidel, nikoli daňové podmínky nebo administrativu investorů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 235/2004 Sb., o dani z přidané hodnoty, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=271423) | ano: Návrh mění pravidla DPH pro digitální obchod a režimy přiznávání daně, takže může ovlivnit daňové povinnosti a jejich administraci. | ano: Mění pravidla DPH pro přeshraniční prodej a zvláštní režim jednoho správního místa, tedy daňové a vykazovací podmínky podniků. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Argentinskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti a Protokol k ní, které byly podepsány v Buenos Aires dne 14. dubna 2026](https://www.psp.cz/sqw/text/orig2.sqw?idd=278338) | ano: Smlouva s Argentinou mění zdanění přeshraničních příjmů a majetku a může ovlivnit daňové podmínky investorů. | ne: Návrh smlouvy s Argentinou upravuje rozdělení daňových práv a zamezení dvojímu zdanění, ale text neukazuje na vznik nových českých povinností ani na zvýšení daňové zátěže. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232) | ne: Text upravuje registraci a technické podmínky vozidel, nikoli daně nebo daňovou administrativu. | ne: Mění pravidla registrace a provozu vozidel, nikoli daně nebo daňové povinnosti podniků. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ano: Změna zákona o daních z příjmů upravuje daňové oznamovací povinnosti a přidává údaje, které mají být předávány správci daně. | ano: Mění zákon o daních z příjmů a obsahuje nové elektronické oznamovací povinnosti vůči správci daně pro finanční a předškolní instituce. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Upravuje výjimku ze správního poplatku za úkon obecného správce daně, nikoli samotnou daň ani daňovou povinnost podnikatelů. | ano: Vylučuje osvobození od správního poplatku za úkony obecného správce daně, takže může zvýšit náklady spojené s daňovou administrativou. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna daňového řádu](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Mění postupy při daňové kontrole a přiřazování plateb, ale text nedokládá změnu daňové povinnosti ani zvýšení administrativy podnikatelů. | ne: Mění postupy při pořizování záznamů a započítávání daňových plateb, ale nevytváří v textu nové daňové povinnosti ani prokazatelně nezvyšuje administrativu podniků. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o jednotném měsíčním hlášení zaměstnavatele](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Upravuje údaje v jednotném měsíčním hlášení zaměstnavatele a související evidenci, nikoli konkrétní daňové pravidlo. | ano: Mění pravidla jednotného měsíčního hlášení zaměstnavatelů a rozsah evidovaných osob, což se přímo týká administrativního vykazování zaměstnavatelů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: DALŠÍ POVINNOSTI PLATFOREM](https://www.psp.cz/sqw/text/orig2.sqw?idd=279465) | ano: Návrh ukládá platformám oznamovat údaje také správci daně, čímž vytváří novou povinnost související s daňovou administrativou. | ano: Ukládá platformám povinnost předávat údaje mimo jiné správci daně, včetně pravidelných aktualizací, což rozšiřuje administrativní povinnosti podniků. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o stabilizaci veřejných rozpočtů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi vládou České republiky a vládou Tanzanské sjednocené republiky o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Dar es Salaam dne 14. května 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=266872)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 164/2013 Sb., o mezinárodní spolupráci při správě daní a o změně dalších souvisejících zákonů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=267358)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o některých pravidlech pro mechanismus uhlíkového vyrovnání na hranicích](https://www.psp.cz/sqw/text/orig2.sqw?idd=267657)
- [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o dani z přidané hodnoty](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Finanční správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Celní správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 235/2004 Sb., o dani z přidané hodnoty, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=271423)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Argentinskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti a Protokol k ní, které byly podepsány v Buenos Aires dne 14. dubna 2026](https://www.psp.cz/sqw/text/orig2.sqw?idd=278338)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o jednotném měsíčním hlášení zaměstnavatele](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Změna zákona v návrhu projednávaném Sněmovnou: DALŠÍ POVINNOSTI PLATFOREM](https://www.psp.cz/sqw/text/orig2.sqw?idd=279465)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279108)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=84)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=98)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=114)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=189)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=218)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=256)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88356)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=300)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=301)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88456)

