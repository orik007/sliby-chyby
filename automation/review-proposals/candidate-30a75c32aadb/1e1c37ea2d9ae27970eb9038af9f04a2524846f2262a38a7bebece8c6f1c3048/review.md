# Pravidla ochrany uživatelů digitálních aktiv

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Poslanci ANO hlasovali pro návrh zákona, který mimo jiné posiluje informační povinnosti a možnosti spotřebitelů odstoupit od finančních smluv uzavřených online. Tentýž návrh ale u vymezených transakcí s kryptoaktivy vylučuje některé z těchto informačních a odstupovacích pravidel. Změny tedy přinášejí obecnou ochranu, ale současně zužují její použití právě v části týkající se kryptoaktiv, což jde proti slibu alespoň v určitém rozsahu.

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

- Z podkladů nelze určit, jaké další ochrany podle pravidel EU pro trhy s kryptoaktivy zůstávají u uvedených transakcí použitelné ani jak široký okruh případů výjimka pokrývá.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna občanského zákoníku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Změna upravuje ochranu spotřebitelů při uzavírání finančních smluv na dálku, a proto se může týkat části ochrany uživatelů digitálních aktiv.<br>Dopad: Dříve § 1820 odst. 1 písm. i) vyžadoval sdělit podmínky a postup pro odstoupení; nově má podnikatel u online smluv uvést také možnost odstoupit tlačítkem a jeho umístění. Nový § 1830a stanoví povinnost takové tlačítko nabídnout, zřetelně je označit a potvrdit přijetí odstoupení, čímž posiluje možnost spotřebitele smlouvu ukončit. Oproti dosavadnímu § 1843 se rozšiřují informace, které musí podnikatel předem poskytnout, mimo jiné o jeho totožnosti a kontaktech, ceně, rizicích a způsobu odstoupení; nový § 1843a omezuje vrstvení některých údajů a vyžaduje možnost zobrazit je jako jeden dokument. Nově se také upravuje informování při hovoru a přibývá bezplatné vysvětlení finanční služby, včetně práva na vysvětlení člověkem při použití automatizovaného nástroje a důkazního břemene podnikatele. Tyto změny zpřísňují informační povinnosti a rozšiřují ochranu spotřebitele; u změn § 1846 až § 1848 a § 1850 však balíček nedodává předchozí znění, takže jejich směr nelze spolehlivě určit. Změna § 1849 upravuje lhůtu placení a podmínku, zda spotřebitel o zahájení plnění výslovně požádal; z poskytnutého srovnání nelze určit celkový směr této úpravy. Jde o obecná pravidla pro finanční služby a z této části samotné nelze určit jejich rozsah pro uživatele digitálních aktiv. | ano: Změny pravidel pro smlouvy o finančních službách na dálku posilují ochranu zákazníků ve fintechu, který slib výslovně zahrnuje.<br>Dopad: Dřívější pravidla už vyžadovala některé informace před uzavřením smlouvy a umožňovala odstoupení; nově se rozšiřují předsmluvní informace, zavádí se snadno dostupné tlačítko pro odstoupení a jeho potvrzení a přibývá povinnost vysvětlit finanční službu, případně člověkem, a důkazní břemeno podnikatele. Omezení vrstvení informací a povinnost zpřístupnit je jako jeden dokument rovněž posilují přehlednost. Změna § 1840 umožňuje použití nového pravidla o odstoupení také u finančních služeb. Ustanovení § 1849 již chránilo spotřebitele před platbou za službu zahájenou bez souhlasu nebo bez řádného poučení; nová formulace mění podmínku na výslovnou žádost spotřebitele a načasování platby, ale z dodaného znění nelze bezpečně určit celkový směr této dílčí změny. U změn ustanovení § 1846–1848 a § 1850 chybí v balíčku jejich předchozí znění, takže jejich dopad nelze porovnat. Celkově jde o částečné posílení ochrany zákazníků finančních služeb, nikoli o úplná pravidla specifická pro digitální aktiva. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o implementaci předpisů Evropské unie v oblasti digitalizace finančního trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Nově vložené ustanovení výslovně upravuje použití pravidel občanského zákoníku při transakcích s kryptoaktivy.<br>Dopad: Dříve § 8 zákona upravoval informační povinnost vůči České národní bance a nové § 8a neexistovalo. Nový § 8a vylučuje použití §§ 1843 až 1844a občanského zákoníku, vyžaduje-li evropský předpis kryptoaktiva zveřejnění bílé knihy, s výjimkou údaje o platbě podle § 1843 odst. 1 písm. q); při právu na odstoupení podle článku 13 nařízení o trzích kryptoaktiv vylučuje také příslušná pravidla o odstoupení. Tím se zužuje použití uvedených informačních a odstupovacích ochran u vymezených transakcí s kryptoaktivy; jaké jiné ochrany mohou zůstat použitelné, balíček neuvádí. | ano: Nové ustanovení výslovně omezuje použití pravidel občanského zákoníku na smlouvy a informační povinnosti spojené s kryptoaktivy.<br>Dopad: Předchozí znění § 8 zákona o digitalizaci finančního trhu upravovalo pouze poskytování informací České národní bance; nové § 8a zavádí výjimky z občanského zákoníku. Pokud unijní pravidla vyžadují zveřejnění bílé knihy kryptoaktiva, nepoužijí se pravidla § 1843 až 1844a, s výjimkou uvedené informační povinnosti; u práva na odstoupení podle unijního nařízení se nepoužijí příslušná pravidla pro odstoupení a další uvedená informační povinnost. Pro uživatele kryptoaktiv tak jde v těchto oblastech o užší ochranu, tedy o krok proti slibu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: DIGITÁLNÍ OBCHOD](https://www.psp.cz/sqw/text/orig2.sqw?idd=281029) | ne: Předložená kapitola se týká obecného elektronického obchodu a ochrany spotřebitelů při něm, ale dodané znění ji nespojuje s ochranou uživatelů digitálních aktiv. | ano: Kapitola o elektronickém obchodování výslovně spojuje důvěru spotřebitelů s opatřeními proti podvodným praktikám, což se částečně týká slibu o fintechu a důvěře na trhu.<br>Dopad: Jde o návrh mezinárodní dohody, která požaduje, aby strany přijímaly nebo zachovávaly transparentní a účinná opatření na podporu důvěry spotřebitelů v elektronickém obchodování, včetně opatření proti podvodným a klamavým praktikám. Předchozí znění zde není, protože jde o návrh smluvního závazku; dodané pasáže stanovují obecnou povinnost, nikoli konkrétní pravidla ochrany uživatelů digitálních aktiv. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna občanského zákoníku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o implementaci předpisů Evropské unie v oblasti digitalizace finančního trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Změna zákona v návrhu projednávaném Sněmovnou: DIGITÁLNÍ OBCHOD](https://www.psp.cz/sqw/text/orig2.sqw?idd=281029)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88256)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=331)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

