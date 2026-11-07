# Blockchainová technologie ve státní správě

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda předložila návrh cizineckého zákona, který požaduje evidovat změny údajů i záznamy o jejich poskytnutí v jednom informačním systému; poslanci ANO pak hlasovali pro schválení tohoto návrhu. Jde o dílčí podporu zpětné dohledatelnosti, ale ustanovení se týkají jen tohoto systému a nezavádějí blockchain. Vláda také předložila návrh změny zákona o elektronické identifikaci, který by pro systém digitální peněženky zavedl evidenci identifikátorů transakcí a kryptografických otisků; v balíčku není doloženo jeho schválení. Dosavadní doložené kroky tedy podporují pouze část slibu, nikoli nasazení blockchainu napříč státní správou ani neměnnost a transparentnost všech procesů.

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

- U cizineckého informačního systému balíček neobsahuje předchozí znění dotčených pravidel, takže nelze určit, jak velkou změnu nové požadavky představují.
- Záznamy o údajích a transakcích zvyšují dohledatelnost, ale předložené texty nedokládají, že by byly zajištěny blockchainem, neměnností či veřejnou transparentností.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: INFORMAČNÍ SYSTÉMY A ZPRACOVÁNÍ ÚDAJŮ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Ustanovení ukládají vést záznamy o změnách údajů a o poskytnutí údajů v konkrétním informačním systému, což přímo podporuje jejich zpětnou dohledatelnost.<br>Dopad: Navržené i schválené znění vyžaduje evidovat známé změny údajů včetně dne jejich vzniku a zaznamenat den, hodinu, rozsah poskytnutých údajů i orgán, který je obdržel. Předchozí znění těchto pravidel v balíčku chybí, takže nelze určit, jak se oproti němu mění míra povinnosti; text se týká jen konkrétního cizineckého informačního systému a nestanoví blockchain ani neměnnost či obecnou transparentnost záznamů. | ano: Ustanovení vyžadují zaznamenávat změny údajů a také čas, rozsah a příjemce jejich poskytnutí, což přímo podporuje dohledatelnost části správních procesů.<br>Dopad: Jde o část nového cizineckého zákona a balíček nedodává předchozí znění těchto ustanovení, takže změnu oproti dosavadní úpravě nelze určit. Navržené i schválené znění stanoví evidenci změn údajů a záznam o čase, rozsahu a příjemci poskytnutých údajů; tím zajišťuje dílčí dohledatelnost, ale nestanoví blockchain, neměnnost záznamů ani transparentnost všech procesů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Navrhovaný systém pro digitální peněženku má zaznamenávat identifikátory transakcí a další údaje umožňující zpětné dohledání, tedy řeší část slibu týkající se dohledatelnosti.<br>Dopad: Navržené nové § 24b vytváří informační systém pro digitální peněženku a stanoví, že bude uchovávat mimo jiné kryptografické otisky, identifikátory transakcí a údaje o vydávání či ověřování elektronických potvrzení; některé údaje se mají uchovávat deset let. Protože jde o nová ustanovení a předchozí znění § 24b neexistovalo, nelze srovnat změnu oproti dřívější právní povinnosti. Návrh by zlepšil dohledatelnost v omezeném okruhu úkonů, ale nestanoví nasazení blockchainu ani nepokrývá veškeré transakce a procesy státní správy. | ano: Navržený informační systém zaznamenává identifikátory transakcí a kryptografické otisky, které umožňují zpětné dohledání části úkonů veřejného sektoru.<br>Dopad: Kontext uvádí, že nové § 24a a § 24b dosud nemají předchozí znění, takže nelze porovnat starou a novou úpravu; návrh zřizuje informační systém pro digitální peněženku a stanoví vedení identifikátorů transakcí, kryptografických otisků a uchovávání údajů. To podporuje dohledatelnost a částečně kontrolovatelnost konkrétních úkonů, nikoli však nasazení blockchainu ani neměnnost všech státních transakcí a procesů. Některé údaje mají být neveřejné a žádosti a odpovědi se nemají vést v otevřené podobě, což omezuje jejich otevřenost; z textu ale nelze určit, nakolik tím bude omezena transparentnost samotných procesů. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: INFORMAČNÍ SYSTÉMY A ZPRACOVÁNÍ ÚDAJŮ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=154)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

