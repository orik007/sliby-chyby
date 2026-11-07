# Omezení daňových úniků a efektivnější výběr daní

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda ANO předložila návrhy na rozšíření daňové výměny informací, včetně údajů o kryptoaktivech, a na smluvní spolupráci proti daňovým únikům. Poslanci ANO také hlasovali pro zákon o evidenci tržeb, který zavádí automatizované získávání údajů o tržbách a účinnější ověřování daňových povinností. Senát, tedy horní komora Parlamentu, vrátil tento zákon s pozměňovacími návrhy; poslanci ANO pak hlasovali pro setrvání u původního znění. Jde o posun v nástrojích kontroly, ale předložené podklady nedokládají, že už omezení úniků přineslo slibované desítky miliard korun ročně.

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

- Zákon o evidenci tržeb zároveň vyjímá některé druhy tržeb a umožňuje části drobných podnikatelů povinnosti se zprostit za příplatek; evidence proto dokládá jen dílčí posun, nikoli plné pokrytí tržeb.
- Návrhy na výměnu informací a nové kontrolní povinnosti samy nedokládají, kolik daňových úniků bude odhaleno ani jaký výnos skutečně přinesou.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o dohledu v oblasti kapitálového trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=271819) | ano: Změna umožňuje za stanovených podmínek předávat správci daně informace České národní banky, což může podpořit kontrolu daňových povinností. | ano: Změna umožňuje předávat správci daně některé informace České národní banky, což může podpořit kontrolu plnění daňových povinností. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o stabilizaci veřejných rozpočtů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ne: Úprava daně z elektřiny pro provozovatele zařízení na ukládání energie řeší jejich daňový režim, nikoli omezování úniků nebo účinnější výběr daní. | ne: Změna upravuje daňové zacházení s elektřinou ukládanou do zařízení a související evidenci, nikoli potírání daňových úniků ani obecnou efektivitu výběru daní. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi vládou České republiky a vládou Tanzanské sjednocené republiky o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Dar es Salaam dne 14. května 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=266872) | ano: Návrh smlouvy s Tanzanií výslovně brání daňovým únikům a zavádí výměnu daňových informací mezi státy. | ano: Navržená smlouva s Tanzanií obsahuje výměnu daňových informací a pravidla proti daňovým únikům a vyhýbání se daňové povinnosti. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 164/2013 Sb., o mezinárodní spolupráci při správě daní a o změně dalších souvisejících zákonů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=267358) | ano: Návrh rozšiřuje oznamování a automatickou výměnu daňových údajů, včetně informací o kryptoaktivech, což může pomoci odhalovat nezdaněné příjmy. | ano: Návrh rozšiřuje automatické předávání daňových informací mimo jiné o kryptoaktiva a ukládá poskytovatelům souvisejících služeb oznamovací povinnosti, což může zlepšit odhalování nepřiznaných příjmů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o některých pravidlech pro mechanismus uhlíkového vyrovnání na hranicích](https://www.psp.cz/sqw/text/orig2.sqw?idd=267657) | ne: Návrh upravuje správu mechanismu uhlíkového vyrovnání na hranicích, nikoli výběr daní ani potírání daňových úniků. | ne: Text stanoví pravidla pro uhlíkové certifikáty při dovozu, nikoli opatření proti daňovým únikům nebo efektivnější výběr běžných daní. |
| [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Evidence tržeb má podle návrhu sloužit k automatizovanému získávání informací o tržbách a účinnějšímu ověřování daňových povinností. | ano: Zavádí evidenci vybraných tržeb, jejich automatické zasílání správci daně a sankce za porušení povinností, což přímo podporuje kontrolu daňových povinností. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Daňová část návrhu upravuje příplatek, kterým se někteří poplatníci mohou zprostit povinnosti evidovat tržby, a tím přímo ovlivňuje dosah tohoto kontrolního nástroje. | ano: Změny daně z příjmů vytvářejí daňovou slevu a přirážku navázané na evidenci tržeb, tedy přímo souvisejí s dodržováním této evidenční povinnosti. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Finanční správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Změna rozšiřuje možnosti finanční správy při kontrole evidence tržeb a práci s údaji pro daňovou analýzu. | ano: Rozšiřuje možnosti finanční správy získávat údaje pro analytické účely a provádět kontrolní nákupy při ověřování daňových povinností, včetně evidence tržeb. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Celní správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Změna výslovně rozšiřuje kontrolní nákupy celní správy na oblast evidence tržeb. | ano: Rozšiřuje oprávnění celní správy provádět kontrolní nákupy při ověřování evidence tržeb, čímž podporuje kontrolu daňových povinností. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313) | ne: Daňové nedoplatky se zde používají jako jedna z podmínek pobytového režimu, návrh však nemění výběr daní ani postupy proti únikům. | ne: Změna řeší především pobytová pravidla a vozidla lidí z Ukrajiny; předávání některých daňových údajů pro pobytové podmínky nesměřuje k omezení daňových úniků ani lepšímu výběru daní. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 235/2004 Sb., o dani z přidané hodnoty, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=271423) | ano: Návrh upravuje pravidla DPH pro elektronická rozhraní a prodeje na dálku, čímž může pomoci správně zachytit daň u těchto transakcí. | ne: Návrh upravuje zejména pravidla DPH pro digitální věk a zvláštní režim jednoho správního místa, ale dodané znění nedokládá konkrétní opatření proti únikům či pro efektivnější výběr. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Argentinskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti a Protokol k ní, které byly podepsány v Buenos Aires dne 14. dubna 2026](https://www.psp.cz/sqw/text/orig2.sqw?idd=278338) | ano: Návrh smlouvy s Argentinou výslovně míří na zabránění daňovým únikům a stanoví výměnu daňových informací. | ano: Navržená smlouva s Argentinou obsahuje výměnu daňových informací a výslovná pravidla proti daňovým únikům a vyhýbání se daňové povinnosti. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Změna se týká osvobození náhrady ušlého výdělku a dalších pravidel daně z příjmů, nikoli účinnější kontroly nebo výběru daní. | ano: Návrh ukládá oznamovací povinnosti k některým údajům o úrocích, spoření a výdajích na předškolní zařízení, které mohou správci daně pomoci ověřovat uplatněné daňové nároky. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna daňového řádu](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ano: Návrh umožňuje pořídit záznam při daňovém místním šetření bez vědomí přítomných osob, pokud by jinak nebylo možné dosáhnout účelu prověřování. | ano: Návrh umožňuje pořídit záznam z úkonu správce daně bez vědomí přítomné osoby, pokud jinak nelze dosáhnout účelu vyhledávání, což může podpořit odhalování daňových úniků. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o jednotném měsíčním hlášení zaměstnavatele](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ano: Návrh rozšiřuje údaje v jednotném měsíčním hlášení zaměstnavatelů a mezi jejich uživatele výslovně zahrnuje finanční správu. | ne: Změna upravuje okruh osob a postupy v jednotném měsíčním hlášení zaměstnavatele, ale její text nepřináší doložené opatření zaměřené na potírání daňových úniků nebo lepší výběr daní. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o spotřebních daních](https://www.psp.cz/sqw/text/orig2.sqw?idd=280698) | ano: Návrh zavádí daň z kratomu spolu s evidencí, značením a sankcemi, tedy konkrétními pravidly pro její správu a výběr. | ano: Návrh zavádí spotřební daň z kratomu a pravidla pro její evidenci, značení, kontrolu a sankcionování, tedy přidává konkrétní nástroje pro výběr a kontrolu této daně. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o stabilizaci veřejných rozpočtů
- Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o některých pravidlech pro mechanismus uhlíkového vyrovnání na hranicích
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o dohledu v oblasti kapitálového trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=271819)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi vládou České republiky a vládou Tanzanské sjednocené republiky o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Dar es Salaam dne 14. května 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=266872)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 164/2013 Sb., o mezinárodní spolupráci při správě daní a o změně dalších souvisejících zákonů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=267358)
- [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Finanční správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Celní správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 235/2004 Sb., o dani z přidané hodnoty, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=271423)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Argentinskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti a Protokol k ní, které byly podepsány v Buenos Aires dne 14. dubna 2026](https://www.psp.cz/sqw/text/orig2.sqw?idd=278338)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna daňového řádu](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o jednotném měsíčním hlášení zaměstnavatele](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o spotřebních daních](https://www.psp.cz/sqw/text/orig2.sqw?idd=280698)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279108)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=84)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=98)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=189)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87503)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=218)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=256)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88356)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=300)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88456)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=321)

