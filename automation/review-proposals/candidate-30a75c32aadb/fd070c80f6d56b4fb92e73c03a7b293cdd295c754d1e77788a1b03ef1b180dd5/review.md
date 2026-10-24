# Pravidla ochrany uživatelů digitálních aktiv

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Poslanci ANO hlasovali pro vládní návrh, který Poslanecká sněmovna schválila; návrh zakazuje manipulativní online rozhraní při finančních smlouvách na dálku a rozšiřuje informační povinnosti vůči spotřebitelům. Současně však pro některé smlouvy s kryptoaktivy vylučuje část těchto informačních pravidel a pravidel pro odstoupení od smlouvy. Návrh také ruší dosavadní omezení některých nevyžádaných obchodních sdělení. Protože schválený balíček vedle posílení ochrany obsahuje i oslabení pravidel přímo pro část trhu s kryptoaktivy, hlasování směřuje proti části slibu.

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

- Přesný dosah nových pravidel na jednotlivé poskytovatele digitálních aktiv není z dodaných textů ve všech případech zřejmý.
- U některých změn občanského zákoníku nejsou v balíčku uvedena předchozí znění, takže jejich účinek nelze určit; schválený text navíc uvádí účinnost od 1. ledna 2027.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o ochraně spotřebitele](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Zavádí zákaz klamavých a manipulativních online rozhraní při uzavírání finančních smluv na dálku a sankce za jeho porušení, což posiluje ochranu uživatelů finančních služeb.<br>Dopad: Před změnou zvláštní zákaz těchto rozhraní v uvedeném zákoně nebyl; nově je zakazuje a porušení výslovně označuje za přestupek, přičemž dozorové a sankční odkazy rozšiřuje i na nové povinnosti. Povinnost a ochrana spotřebitele se tím zpřísňují; úprava se týká finančních služeb na dálku a její konkrétní dosah na jednotlivé poskytovatele digitálních aktiv není z textu plně zřejmý. | ano: Ustanovení se vztahují na uzavírání finančních služeb na dálku a posilují ochranu jejich uživatelů před manipulativním online prostředím, což představuje část slibované ochrany klientů finančních a krypto služeb.<br>Dopad: Dříve zákon o ochraně spotřebitele neobsahoval zvláštní zákaz klamavých či manipulativních online rozhraní při uzavírání finančních služeb; nově se takové rozhraní zakazuje a zakazuje se i klamavé přednostní zvýrazňování voleb, což ochranu zpřísňuje. Dřívější ustanovení o dozoru a přestupcích neobsahovala tyto nové povinnosti a jejich porušení jako samostatně vymezené delikty; změna rozšiřuje dohled a sankcionování, tedy posiluje vymahatelnost. Další úpravy především doplňují odkazy a přečíslovávají související ustanovení. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podnikání na kapitálovém trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ne: Změna upravuje informační povinnosti obchodníků s cennými papíry, ale balíček nepropojuje tuto úpravu s ochranou uživatelů digitálních aktiv ani s poskytovateli těchto služeb. | ne: Změna se týká povinností obchodníků s cennými papíry, ale dodané znění ji nespojuje s ochranou uživatelů digitálních aktiv ani s konkrétní částí slibu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna občanského zákoníku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Mění pravidla pro spotřebitelské finanční smlouvy, včetně smluv souvisejících s kryptoaktivy, a proto přímo zasahuje do ochrany uživatelů digitálních aktiv.<br>Dopad: Dosavadní pravidla už zahrnovala smlouvy týkající se kryptoaktiv, ale před uzavřením finanční smlouvy vyžadovala užší rozsah informací; nově stanoví obsáhlejší seznam sdělovaných údajů, omezí jejich skrývání ve vrstvách a posílí vysvětlovací povinnost podnikatele i jeho důkazní břemeno. Nové právo odstoupit tlačítkem zvyšuje přístupnost odstoupení; výjimka pro finanční služby se nově na toto tlačítko nevztahuje. Zároveň se ruší dosavadní zákaz některých nevyžádaných obchodních sdělení, což tuto ochranu uvolňuje. U změn ustanovení o odstoupení (§ 1846–1848), § 1850 a ustanovení o pojištění (§ 2774 a § 2808) předchozí znění v balíčku chybí, takže směr jejich účinku nelze určit; u § 1849 lze z uvedeného znění určit jen dílčí změny, nikoli jejich celkový dopad. | ano: Změna upravuje informační povinnosti a odstoupení od smluv o finančních službách a její výchozí znění výslovně zahrnuje i smlouvy týkající se kryptoaktiv.<br>Dopad: Dříve měl spotřebitel při smlouvách o finančních službách užší soubor předsmluvních informací a při online uzavírání smlouvy nebylo nutné nabídnout zvláštní tlačítko pro odstoupení; nově se rozšiřují a zpřesňují informace, zavádí se snadno dostupné tlačítko a možnost lidského vysvětlení při použití automatizovaného nástroje, což ochranu a transparentnost zpřísňuje. Nová pravidla také omezují vrstvení klíčových informací, rozšiřují důkazní povinnost podnikatele a upravují lhůty pro odstoupení, včetně prodloužení nejzazší lhůty při chybějící informaci o tomto právu; celkově tedy posilují spotřebitelská práva. Změny některých dalších ustanovení, například o penzijních službách či pojistných smlouvách, samy o sobě směr slibu nemění. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o investičních společnostech a investičních fondech](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ne: Upravuje povinnosti administrátorů investičních fondů a jejich investorů, avšak text ani další dodané důkazy je nespojují s uživateli digitálních aktiv. | ne: Text upravuje povinnosti administrátorů investičních fondů, ale nedokládá přímou vazbu na ochranu uživatelů digitálních aktiv nebo na konkrétní krypto či fintech službu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o platebním styku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ne: Změna se týká informování uživatelů platebních služeb, ale balíček neprokazuje, že se tato pravidla vztahují k uživatelům digitálních aktiv nebo k jejich ochraně. | ne: Změna se týká poskytovatelů platebních služeb, ale dodaný text ji nespojuje s digitálními aktivy ani s konkrétní částí slibu o jejich uživatelích. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o implementaci předpisů Evropské unie v oblasti digitalizace finančního trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Výslovně upravuje výjimky z občanského zákoníku pro trhy s kryptoaktivy, a proto přímo mění ochranu jejich uživatelů.<br>Dopad: Dosud tato zvláštní výjimka pro případy zveřejnění bílé knihy kryptoaktiva v zákoně nebyla; nově se v takovém případě nepoužijí většina uvedených informačních povinností, s výjimkou jednoho údaje o právu odstoupit. Pokud má spotřebitel právo na odstoupení podle předpisu EU o trzích s kryptoaktivy, návrh navíc vylučuje pravidla občanského zákoníku pro odstoupení od finančních smluv uzavíraných na dálku. Povinnosti vůči uživatelům a jejich ochrana se tím v těchto případech zmenšují. | ano: Změna výslovně stanoví výjimky z informačních a odstupovacích pravidel občanského zákoníku pro některé smlouvy týkající se kryptoaktiv.<br>Dopad: Před touto novou úpravou zde nebyla výjimka, která by pro případy povinného zveřejnění bílé knihy kryptoaktiva vylučovala obecné informační povinnosti podle § 1843 až 1844a občanského zákoníku; nově zůstává jen uvedená informační povinnost o možnosti odstoupit podle § 1843 odst. 1 písm. q). Pokud má spotřebitel právo na odstoupení podle přímo použitelného evropského nařízení, nová úprava dále vylučuje obecná pravidla občanského zákoníku pro odstoupení od finančních smluv uzavřených na dálku nebo mimo obchodní prostory. Jde o novou výjimku, která zmenšuje rozsah obecné ochrany a transparentnosti pro dotčené případy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podnikání na kapitálovém trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=268780) | ne: Rozsáhlá úprava kapitálového trhu řeší zejména požadavky na obchodníky, tržní infrastrukturu a investiční výzkum; text ji nespojuje s ochranou uživatelů digitálních aktiv. | ne: Návrh mění řadu pravidel kapitálového trhu, ale jeho dodané znění neukazuje přímý dopad na ochranu uživatelů digitálních aktiv nebo na krypto a fintech služby. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279316) | ne: Návrh se týká odpovědnosti za škodu způsobenou vadnými výrobky a digitálním softwarem, nikoli ochrany uživatelů kryptoaktiv před podvody či nelegálními praktikami. | ne: Návrh rozšiřuje odpovědnost za škodu způsobenou vadnými výrobky včetně softwaru, ale nespojuje tuto úpravu s uživateli kryptoaktiv ani s podvody na digitálním trhu. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podnikání na kapitálovém trhu
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o investičních společnostech a investičních fondech
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o platebním styku
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podnikání na kapitálovém trhu
- Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o ochraně spotřebitele](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna občanského zákoníku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o implementaci předpisů Evropské unie v oblasti digitalizace finančního trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88256)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

