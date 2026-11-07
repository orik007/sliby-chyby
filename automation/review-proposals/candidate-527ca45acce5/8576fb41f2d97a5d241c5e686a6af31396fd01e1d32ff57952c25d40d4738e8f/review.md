# Blockchainová technologie ve státní správě

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda ANO předložila návrh zákona, který počítá s informačním systémem pro digitální peněženku a evidencí kryptografických otisků a identifikátorů transakcí. To může zlepšit dohledatelnost některých úředních úkonů, ale návrh nestanoví použití blockchainu. Poslanci ANO také hlasovali pro cizinecký zákon, jehož schválená část požaduje evidovat změny údajů a poskytování údajů v cizineckém systému. Jde o dílčí posun, nikoli o nasazení blockchainu pro veškeré transakce a procesy státní správy.

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

- U cizineckého zákona balíček neobsahuje předchozí znění ustanovení, takže nelze ověřit, zda schválená pravidla evidenci skutečně rozšiřují oproti dosavadnímu stavu.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda o posíleném partnerství a spolupráci mezi Evropskou unií a jejími členskými státy na jedné straně a Republikou Uzbekistán na straně druhé](https://www.psp.cz/sqw/text/orig2.sqw?idd=267249) | ne: Preambule dohody se týká podpory elektronické správy a transparentní veřejné správy v Uzbekistánu, nikoli nasazení technologie do české státní správy. | ne: Ustanovení pouze obecně podporuje elektronickou správu a transparentní veřejnou správu v rámci spolupráce s Uzbekistánem, ale nespojuje je s nasazením blockchainu ani s konkrétní evidencí státních procesů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: INFORMAČNÍ SYSTÉMY A ZPRACOVÁNÍ ÚDAJŮ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Ustanovení o evidenci změn údajů a poskytování údajů v cizineckém informačním systému se přímo týkají dohledatelnosti části procesů veřejné správy.<br>Dopad: Schválené znění požaduje evidovat změny údajů včetně dne, kdy nastaly, a zaznamenat den a hodinu poskytnutí údajů, jejich rozsah a orgán, kterému byly poskytnuty. Balíček však neuvádí předchozí znění těchto pravidel, takže nelze určit, zda a jak se oproti dosavadnímu stavu mění povinnost ani její přísnost. | ano: Návrh konkrétně zavádí evidenci změn údajů a záznamů o jejich poskytování v cizineckém informačním systému, což naplňuje část slibu týkající se dohledatelnosti procesů.<br>Dopad: Návrh nového cizineckého zákona stanoví, že se v Integrovaném cizineckém agendovém systému evidují změny údajů včetně data, kdy nastaly, a záznamy o dni, hodině, rozsahu poskytnutých údajů a orgánu, kterému byly poskytnuty. Předchozí znění těchto ustanovení balíček neuvádí, takže změnu oproti dosavadnímu stavu nelze určit; navržená pravidla však zajišťují dohledatelnost v tomto konkrétním systému, nikoli neměnnost záznamů, blockchain ani dohledatelnost všech státních procesů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Návrh zavádí informační systém pro digitální peněženku a v něm evidenci kryptografických otisků a identifikátorů transakcí, což se týká dohledatelnosti a integrity části úředních procesů.<br>Dopad: Podle dodaného kontextu ustanovení § 24a a § 24b dosud neexistovala. Návrh vytváří nový informační systém, který má uchovávat mimo jiné kryptografické otisky a identifikátory transakcí; tím rozšiřuje možnosti dohledání těchto konkrétních úkonů. Návrh ale nenařizuje použití blockchainu a týká se jen systému pro digitální peněženku, nikoli veškerých státních transakcí a procesů. | ano: Návrh vytváří informační systém pro digitální peněženku, který vede identifikátory transakcí a kryptografické otisky, a tím konkrétně podporuje dohledatelnost části veřejných procesů.<br>Dopad: Nové ustanovení § 24b zákona o elektronické identifikaci vytváří informační systém podpory peněženky a ukládá v něm mimo jiné vést identifikátory transakcí umožňující zpětné dohledání vydání údajů či potvrzení a kryptografické otisky; stanoví také desetiletou dobu uchovávání některých údajů. Předchozí znění těchto nových ustanovení neexistuje, takže nelze porovnat změnu vůči dřívější právní úpravě. Návrh rozšiřuje dohledatelnost u omezeného okruhu transakcí, ale nestanoví blockchain ani obecnou neměnnost a některé údaje jsou neveřejné. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda o posíleném partnerství a spolupráci mezi Evropskou unií a jejími členskými státy na jedné straně a Republikou Uzbekistán na straně druhé

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: INFORMAČNÍ SYSTÉMY A ZPRACOVÁNÍ ÚDAJŮ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=154)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

