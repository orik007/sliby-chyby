# Automatizace agend státu pomocí umělé inteligence

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Motoristé se podíleli na předložení vládního návrhu cizineckého zákona, který umožňuje automatizovat některé úřední úkony. Při závěrečném hlasování pro něj hlasovalo jen šest ze třinácti poslanců strany, takže jej strana jako celek většinově nepodpořila. Naopak poslanci Motoristů většinově podpořili novelu stavebního zákona, která automatizaci některých úkonů bez úředníka výslovně dovoluje; Senát návrh zamítl a Sněmovna na něm následně setrvala. Předložené zákony ale nedokládají využití umělé inteligence ani slibované úspory či rychlejší služby.

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

- Poslanci Motoristů většinově podpořili automatizované úkony ve stavebním řízení, ale u cizineckého zákona strana při závěrečném hlasování nedala většinu; tyto protichůdné kroky zůstávají součástí hodnocení.
- Zákonné texty zmiňují automatizaci a digitální nástroje, nikoli výslovné nasazení umělé inteligence, ani nedokládají dosažené úspory nebo zrychlení služeb.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Schválený text stavebního zákona umožňuje, aby některé úkony úřadu proběhly automatizovaně bez úřední osoby, což je skutečná část slibu o automatizaci státních agend. | ne: Novela mění organizaci stavební správy a stavební řízení, ale její ustanovení o digitálních systémech nedokládají využití umělé inteligence ani automatizaci agend v uvedeném slibu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona č. 152/2025 Sb.](https://www.psp.cz/sqw/text/orig2.sqw?idd=270375) | ne: Změna ruší vybrané budoucí úpravy dávek, ale její text nedokládá využití umělé inteligence ani automatizaci agend. | ne: Tato část upravuje změny zákonů souvisejících se státní sociální podporou, nikoli využití umělé inteligence k automatizaci agend státu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Návrh obsahuje digitální cizinecký účet a možnost automatického tlumočení při řízení, tedy prvky automatizace státní agendy, byť umělou inteligenci výslovně nezmiňuje. | ano: Návrh umožňuje automatické tlumočení mluvené řeči v reálném čase při cizineckých řízeních, což může automatizovat dílčí úkon státní správy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: POVINNOSTI A PŘESTUPKY](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Návrh umožňuje automatizovaně vydávat výzvu cizinci na základě údajů v evidencích, což přímo přispívá k automatizaci úředního postupu. | ano: Návrh umožňuje vydávat některé výzvy automatizovaně na základě údajů v úředních evidencích, což představuje automatizaci dílčí agendy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ne: Úpravy cestovních dokladů se týkají jejich vydávání a evidence, ale předložený text neobsahuje podstatný prvek automatizace agend ani využití umělé inteligence. | ne: Novela upravuje vydávání a evidenci cestovních dokladů, ale její ustanovení nedokládají automatizaci agend pomocí umělé inteligence. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232) | ano: Návrh umožňuje automatizované vyřízení některých žádostí v registru vozidel bez úřední osoby, což je část slibované automatizace státních služeb. | ano: Návrh umožňuje automaticky vyřídit některé jednoduché žádosti a oznámení v registru vozidel, což je dílčí automatizace úřední agendy. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona č. 152/2025 Sb.
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: POVINNOSTI A PŘESTUPKY](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=67)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=293)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

