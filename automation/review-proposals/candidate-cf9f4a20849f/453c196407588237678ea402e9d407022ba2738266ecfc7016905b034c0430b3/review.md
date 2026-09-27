# Automatizace agend státu pomocí umělé inteligence

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Poslanci Motoristů sobě předložili změnu stavebního zákona, která umožňuje provést některé úřední úkony automatizovaně; při jejím schválení hlasovala většina jejich klubu pro. Senát návrh odmítl, ale poslanci Motoristů sobě následně podpořili jeho přijetí i po tomto odmítnutí. V pozdějším hlasování o zákoně o pobytu cizinců, který umožňuje automatické tlumočení ve správním řízení, však pro návrh hlasovalo jen 6 z 13 poslanců klubu, tedy nikoli většina. Strana také předložila návrh na automatické vyřizování některých žádostí v registru vozidel, ale tento návrh nepřevažuje nad jejím pozdějším hlasováním bez většinové podpory automatického tlumočení.

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

- Zákony popisují automatizované úkony a automatické tlumočení, ale výslovně nepotvrzují, že využívají umělou inteligenci; poskytnuté podklady také nedokládají dosažení miliardových úspor ani rychlejších služeb.
- Dřívější většinová podpora automatizace ve stavebním zákoně je v napětí s pozdější absencí většinové podpory zákona umožňujícího automatické tlumočení; aktuální hodnocení vychází z pozdějšího rozhodujícího hlasování.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Návrh mění stavební řízení a v obou verzích umožňuje automatizovat úkon správního orgánu bez úřední osoby, pokud nevyžaduje správní uvážení, což je konkrétní část automatizace státní agendy. | ano: Návrh i schválené znění umožňují automatizovat některé úkony stavebního úřadu bez úřední osoby, a tím mohou naplnit část slibu o automatizaci státní agendy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o informačních systémech veřejné správy](https://www.psp.cz/sqw/text/orig2.sqw?idd=280393) | ne: Text této části pouze ruší blíže neuvedenou poslední větu ustanovení o informačních systémech veřejné správy, takže z něj nelze doložit vztah k automatizaci pomocí AI ani ke slíbeným výsledkům. | ne: Text pouze ruší poslední větu ustanovení zákona o informačních systémech veřejné správy a neukazuje, že by měnil automatizaci agend, využití AI nebo rychlost služeb. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Návrh dovoluje správním orgánům využít zařízení pro automatické tlumočení v reálném čase, což představuje konkrétní automatizaci úkonu ve správním řízení. | ano: Návrh i schválené znění dovolují využít technické zařízení k automatickému tlumočení při správním řízení, což automatizuje dílčí úkon veřejné služby. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ne: Navržené změny upravují vydávání a správu cestovních dokladů, včetně digitálního zpracování podpisu, ale neobsahují konkrétní automatizaci agendy pomocí AI. | ne: Ustanovení o vydávání a správě cestovních dokladů neobsahují automatizaci úkonů pomocí AI ani změnu, která by sama představovala část tohoto slibu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona, kterým se mění některé zákony v souvislosti s další elektronizací postupů orgánů veřejné moci](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ne: Text pouze posouvá termíny zavádění některých elektronizovaných postupů, aniž stanoví automatizaci státní agendy nebo využití AI. | ne: Předložené i schválené znění se týká časových pravidel další elektronizace postupů, nikoli automatizace agend pomocí AI nebo konkrétního urychlení služeb. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232) | ano: Navržená úprava registru vozidel umožňuje automaticky vyřídit bez úřední osoby některé bezvadné elektronické žádosti a oznámení, což je konkrétní část automatizace státní agendy. | ano: Návrh umožňuje automatizované vyřízení některých elektronicky podaných žádostí v registru vozidel bez účasti úřední osoby, což může uskutečnit část slibu o automatizaci agend. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=67)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=293)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

