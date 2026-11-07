# Vyšší finanční a daňová podpora penzijního spoření

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

Vláda, v níž SPD působí, předložila návrh na změnu státní podpory doplňkového penzijního spoření. Pro účastníky do 30 let navrhuje vyšší příspěvky a u mladších 18 let i nárok už při nižší měsíční úložce; pro starší účastníky se sazby nemění. Jde tedy o posun ve prospěch části slibu, nikoli o zvýšení podpory pro každého a při každé úložce. Návrh zároveň ruší starší zákon o penzijním připojištění, ale podklady neumožňují určit, jak se tím změní dosavadní nároky na podporu; text dvou předložených daňových smluv také není dostupný.

Co zůstává nejisté:

- Balíček neuvádí znění ustanovení, která by návrh zrušil spolu se zákonem č. 42/1994 Sb.; nelze proto určit, zda a jak návrh v roce 2037 změní podporu účastníků starého penzijního připojištění.
- Úplná znění daňových smluv s Keňou a Maltou nejsou v balíčku dostupná. Nelze tak ověřit jejich případný konkrétní dopad na zdanění penzijních příjmů, ačkoli podklady neukazují jejich vztah k podpoře měsíčních úložek.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Keňskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Nairobi dne 23. září 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=267544) | ne: Dodané znění smlouvy není dostupné a balíček nedokládá, že by se její úprava dvojího zdanění týkala daňové podpory měsíčních příspěvků na penzijní spoření. | ne: Předložený materiál neobsahuje text smlouvy a z dostupných údajů není doloženo, že by se týkala podpory penzijního spoření; její možnou věcnou souvislost proto nelze ověřit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o doplňkovém penzijním spoření](https://www.psp.cz/sqw/text/orig2.sqw?idd=271815) | ne: Navrhuje jednorázové vyrovnání pro vymezené účastníky starších smluv, nikoli vyšší podporu jejich měsíčních úložek. | ne: Změna upravuje jednorázové vyrovnání a vrácení příspěvku ve zvláštních případech, nikoli podporu měsíčních úložek do penzijního spoření. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=271815) | ne: Daňová ustanovení upravují zdanění jednorázového vyrovnání a podmínky daňové podpory při výplatě, nikoli daňovou podporu měsíčních příspěvků. | ne: Daňová ustanovení upravují zdanění jednorázového vyrovnání ve zvláštních případech, ne daňovou podporu měsíčních úložek. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Maltskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Římě dne 24. září 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=270368) | ne: Dodané znění smlouvy není dostupné a balíček nedokládá, že by se její úprava dvojího zdanění týkala daňové podpory měsíčních příspěvků na penzijní spoření. | ne: Předložený materiál neobsahuje text smlouvy a dostupné údaje nedokládají její vztah k podpoře penzijního spoření; možnou věcnou souvislost proto nelze ověřit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o doplňkovém penzijním spoření](https://www.psp.cz/sqw/text/orig2.sqw?idd=279128) | ano: Navržená úprava státního příspěvku přímo zvyšuje podporu měsíčních úložek alespoň některým skupinám účastníků.<br>Dopad: Dosud náležel státní příspěvek při úložce alespoň 500 Kč: činil 20 % z částky 500–1 699 Kč a 340 Kč od 1 700 Kč, bez rozlišení věku. Návrh pro účastníky mladší 18 let stanoví podporu již od 100 Kč, ve výši 40 % příspěvku, nejvýše 680 Kč; pro věk 18–29 let stanoví 40 % od 500 Kč a nejvýše 680 Kč. U účastníků od 30 let zůstávají hranice i částky stejné jako dosud. Podpora se tedy rozšiřuje a zvyšuje pro mladší skupiny, ale nikoli pro všechny účastníky ani při jakékoli úložce; ostatní navržené změny této části nemění uvedené sazby měsíčního státního příspěvku. | ano: Návrh mění výši státního příspěvku k měsíčnímu penzijnímu spoření, tedy přímo jednu část slibované finanční podpory.<br>Dopad: Dosavadní § 14 přiznával státní příspěvek při měsíční úložce alespoň 500 Kč; od 500 do 1 699 Kč činil 20 % úložky a od 1 700 Kč nejvýše 340 Kč, bez rozlišení věku. Návrh pro účastníky mladší 18 let snižuje hranici na 100 Kč a zvyšuje sazbu na 40 % (při úložce od 1 700 Kč až na 680 Kč); pro věk 18 až 29 let zachovává hranici 500 Kč, ale zvyšuje sazbu na 40 % a strop na 680 Kč. U účastníků od 30 let ponechává dosavadní hranici, sazbu i strop. Finanční nárok se tedy zvětšuje pro mladší účastníky, avšak podpora se nezvyšuje pro všechny věkové skupiny ani při každé výši měsíční úložky. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279128) | ne: Upravuje daňové důsledky výplat z penzijního spoření, včetně částečného odbytného, ale nezvyšuje daňovou podporu samotných měsíčních úložek. | ano: Návrh mění daňové zacházení s penzijními dávkami a částečným odbytným, čímž upravuje daňovou podporu související s penzijním spořením.<br>Dopad: Dosavadní § 15b odst. 4 písm. a) vyžadoval vrácení daňové podpory při předčasné výplatě, s vyjmenovanými výjimkami; návrh přidává výjimku pro částečné odbytné, a tím pravidlo uvolňuje. Přechodné ustanovení stanoví, že tato výjimka platí už pro zdaňovací období roku 2026, včetně odpovídajícího postupu při dřívějším zúčtování mzdy. U § 4 odst. 1 písm. k) návrh výslovně doplňuje starobní a výsluhové penze mezi uvedené druhy příjmů, ale předchozí znění již zahrnovalo také „jiné penze“; z dodaného znění proto nelze určit, zda se tím jejich daňové osvobození skutečně rozšiřuje. Změna § 15b však jasně zmenšuje povinnost vracet daňovou podporu, tedy daňové zacházení v tomto konkrétním případě zlepšuje; neváže je ale na výši měsíční úložky. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZRUŠOVACÍ USTANOVENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=279128) | ano: Návrh ruší zákon upravující penzijní připojištění se státním příspěvkem, tedy právní rámec přímo související s finanční podporou tohoto spoření.<br>Dopad: Návrh ruší zákon č. 42/1994 Sb. a další vyjmenované části novel; znění rušených ustanovení ale balíček nedodává, takže nelze porovnat dosavadní nároky na podporu s tím, co je nahradí, ani určit směr změny. Zrušení má podle návrhu nastat v roce 2037; související ustanovení téhož návrhu upravují převod účastníků a prostředků do doplňkového penzijního spoření, ale z poskytnutých podkladů nelze spolehlivě určit, zda výsledná podpora zachová či zvýší dosavadní nároky. | ne: Text ruší starší zákony a jejich ustanovení, ale sám nestanoví zvýšení ani snížení podpory měsíčních úložek; z dostupného znění taková vazba na slib nevyplývá. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Keňskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Nairobi dne 23. září 2025
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o doplňkovém penzijním spoření
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů
- Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Maltskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Římě dne 24. září 2025

### Zdroje použité při hodnocení

- [Původní volební slib](https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Keňskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Nairobi dne 23. září 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=267544)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Maltskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Římě dne 24. září 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=270368)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o doplňkovém penzijním spoření](https://www.psp.cz/sqw/text/orig2.sqw?idd=279128)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279128)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZRUŠOVACÍ USTANOVENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=279128)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=105)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=197)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=285)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

