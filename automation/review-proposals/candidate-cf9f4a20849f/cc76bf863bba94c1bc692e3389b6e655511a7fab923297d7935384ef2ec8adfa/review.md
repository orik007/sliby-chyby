# Automatizace agend státu pomocí umělé inteligence

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Poslanci Motoristů předložili a podpořili novelu stavebního zákona, která rozšiřuje digitální práci s agendami; po zamítnutí Senátem také hlasovali pro setrvání na návrhu. Vláda zároveň navrhla automatický překlad při úředním jednání a automatické vyřizování některých výzev v cizinecké agendě, avšak při závěrečném hlasování pro návrh neměla strana většinové stanovisko. Poslanci také podpořili zrušení plánovaných elektronických postupů u dávek státní sociální podpory. Celkově tedy doložené kroky obsahují dílčí podporu automatizace, ale poslední rozhodující hlasování na této agendě znamenalo, že strana nedala většinovou podporu opatření, které automatizaci posouvá.

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

- Žádný z posuzovaných textů výslovně neukládá používat umělou inteligenci; automatický překlad a automatizované vyřizování jsou pouze dílčí automatizace a z balíčku nelze určit, zda využívají AI.
- Balíček nedokládá, že by automatizace již byla zavedena, vedla k miliardovým úsporám nebo zrychlila služby.
- U nových ustanovení cizineckého zákona a zákona o vozidlech není v balíčku uvedeno dřívější znění; lze popsat jen nově navrhované možnosti automatizace.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Novela stavebního zákona rozšiřuje elektronické podávání a práci s digitálními systémy a daty, což může být podpůrnou částí automatizace státní agendy, byť AI výslovně nezavádí.<br>Dopad: Před změnou zákon umožňoval elektronická podání zejména přes portál stavebníka a digitální zpracování se týkalo vybraných územně plánovacích dokumentů; nově se pro vymezená podání stanoví povinná digitální forma a zákon umožní sloučit informační systémy a sledovat stav řízení. To rozšiřuje digitální infrastrukturu a možnosti automatizace, ale samo nezavádí AI ani nezaručuje úspory či rychlejší služby. | ne: Novela upravuje stavební řízení a digitální systémy, ale nepředepisuje ani nezavádí využití umělé inteligence k automatizaci agend státu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona č. 152/2025 Sb.](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375) | ano: Zrušení připravovaných elektronických postupů u státní sociální podpory přímo omezuje digitalizaci konkrétní agendy státu, která může být součástí její automatizace.<br>Dopad: Rušené body změny zákona měly od 1. července 2026 zavést elektronické podávání žádostí a další práci s informačním systémem, včetně elektronického spisu a doručování; tato změna jejich zavedení odstraňuje. Přesnou podobu pravidel, která po zrušení zůstanou platit, nelze z poskytnutého kontextu určit; změna však zužuje plánované možnosti digitálního vyřizování agendy. | ne: Změna ruší některá budoucí pravidla sociální podpory, avšak text nedokládá souvislost s využitím umělé inteligence při automatizaci státních agend. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Nový cizinecký zákon umožňuje automatický překlad při jednání správního orgánu, což je dílčí automatizace úředního postupu, i když text AI výslovně nezmiňuje.<br>Dopad: Jde o novou úpravu bez předchozího znění uvedeného v balíčku: správní orgán bude moci při tlumočení použít zařízení, které automaticky překládá mluvenou řeč v reálném čase. Tím se rozšiřuje možnost automatizovat část jednání, ale ustanovení nepožaduje AI a samo nestanoví úsporu ani zrychlení služby. | ano: Nová úprava umožňuje automatizované tlumočení při řízeních s cizinci, což se týká dílčí automatizace úřední agendy a rychlejšího vyřizování.<br>Dopad: Jde o novou právní úpravu bez předchozího znění uvedeného v balíčku. Schválený text umožňuje správnímu orgánu použít technické zařízení k automatickému tlumočení mluveného cizího jazyka do češtiny a zpět v reálném čase; jde o dílčí automatizaci, ale text nepožaduje použití AI ani neuvádí úspory či zrychlení jako zaručený výsledek. |
| [Změna zákona v návrhu projednávaném Sněmovnou: POVINNOSTI A PŘESTUPKY](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Nový cizinecký zákon dovoluje automatizované vydání některých výzev podle údajů v informačních systémech, tedy automatizaci konkrétního úředního postupu.<br>Dopad: Jde o novou úpravu bez předchozího znění uvedeného v balíčku: ministerstvo bude moci na základě údajů v informačním systému automatizovaně vyzvat cizince k úhradě částky za vybrané nesplněné povinnosti. Tato možnost rozšiřuje automatizované vyřizování, ale text nezmiňuje AI ani nedokládá výsledné úspory nebo rychlejší služby. | ne: Tato část upravuje povinnosti, hlášení a přestupky, nikoli využití umělé inteligence k automatizaci státních agend. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ne: Změny pravidel pro vydávání cestovních dokladů a jejich evidenci nemají v poskytnutém textu konkrétní vazbu na využití AI nebo automatizaci agend. | ne: Novela cestovních dokladů mění jejich vydávání a evidenci, ale text neukládá ani nezavádí automatizaci agend pomocí umělé inteligence. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232) | ano: Návrh změny zákona o vozidlech výslovně umožňuje automatické vyřízení některých elektronických žádostí, tedy dílčí automatizaci státní agendy.<br>Dopad: Nové ustanovení umožní bez účasti úřední osoby automaticky vyřídit některé žádosti podané přes elektronické rozhraní, pokud nevyžadují přílohy a splňují stanovené podmínky. Jde o novou možnost bez předchozího znění uvedeného v balíčku; rozšiřuje automatizaci, ale AI ani úspory či rychlejší služby výslovně nestanoví. | ano: Nová pravidla registrace vozidel umožňují automatické vyřízení některých bezpřílohových podání, což se přímo týká dílčí automatizace státní agendy.<br>Dopad: Nový § 14b nemá v balíčku uvedeno předchozí znění. Návrh umožňuje automatizované vyřízení některých podání k registraci vozidel bez účasti úřední osoby, pokud neobsahují přílohy a netýkají se vyjmenovaných případů; jde o dílčí posun k automatizaci, ale AI ani miliardové úspory text nestanoví. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona č. 152/2025 Sb.](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: POVINNOSTI A PŘESTUPKY](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=67)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87387)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=293)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

