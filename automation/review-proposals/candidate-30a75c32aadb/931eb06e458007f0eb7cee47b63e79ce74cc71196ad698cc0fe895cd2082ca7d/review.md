# Pravidla ochrany uživatelů digitálních aktiv

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Poslanci ANO hlasovali pro schválení návrhu zákona o smlouvách na dálku, který posiluje některé informace a práva spotřebitelů při finančních službách. Zároveň tentýž návrh zavádí výjimky z těchto pravidel pro některé obchody s kryptoaktivy, čímž oslabuje ochranu části uživatelů, kterou slib výslovně zmiňuje. Vláda také předložila návrh mezinárodní dohody s pravidly proti podvodům v elektronickém obchodě, ale tato dohoda nestanoví zvláštní krypto pravidla. Rozhodující je proto schválení, které v části jde proti slibu.

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

- U změn § 1846 až 1848 a § 1850 nejsou v podkladech předchozí znění, takže jejich přesný účinek nelze porovnat.
- Dohoda o elektronickém obchodě může zasáhnout i některé transakce s digitálními aktivy, ale předložený text je výslovně neuvádí.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna občanského zákoníku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Změna pravidel pro distančně sjednávané finanční služby se týká spotřebitelské ochrany v části fintech trhu, na kterou slib míří.<br>Dopad: Předchozí znění občanského zákoníku už vyžadovalo u finančních služeb řadu informací a upravovalo odstoupení od smlouvy; schválené znění rozšiřuje předsmluvní informace, zavádí výrazné tlačítko pro odstoupení, bezplatné vysvětlení služby a důkazní povinnost podnikatele. Tím v těchto oblastech posiluje ochranu spotřebitele. U telefonického sjednávání však mění, které informace lze sdělit před uzavřením smlouvy, a některé další údaje připouští až následně, takže účinek v této části není jednoznačně přísnější. U změn § 1846 až 1848 a § 1850 balíček nedodává předchozí znění; směr těchto změn proto nelze z poskytnutých podkladů určit. | ano: Mění ochranu spotřebitelů při uzavírání smluv o finančních službách na dálku, a tím se týká alespoň části slibu o ochraně uživatelů fintech služeb.<br>Dopad: Dosavadní úprava vyžadovala u finančních služeb některé informace před uzavřením smlouvy a upravovala odstoupení od smlouvy; nově se například rozšiřují povinné informace, zakazuje skrývání vybraných údajů ve vrstvách a spotřebitel získává právo na srozumitelné vysvětlení, případně člověkem, i na tlačítko pro odstoupení. To posiluje část informační a spotřebitelské ochrany relevantní pro fintech. Nové výjimky pro finanční služby z obecné úpravy jsou v textu zároveň upraveny tak, že se na ně má vztahovat § 1830a o odstoupení; u změn § 1846 až § 1848 a § 1850 však podklady neuvádějí předchozí znění, takže směr těchto změn nelze určit. U § 1844a se mění rozsah informací sdělovaných během hovoru a jejich následné poskytnutí, ale z dodaného kontextu nelze bezpečně určit celkový dopad. Změna § 1849 upravuje okamžik platby a podmínky nároku podnikatele; bez jistého srovnání všech souvisejících pravidel nelze její směr spolehlivě určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o implementaci předpisů Evropské unie v oblasti digitalizace finančního trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470) | ano: Tato změna výslovně upravuje výjimky z ochrany spotřebitele u kryptoaktiv, a proto se přímo týká uživatelů digitálních aktiv.<br>Dopad: Před změnou § 8 zákona o digitalizaci finančního trhu ukládal vybraným subjektům poskytovat České národní bance informace; nově vložený § 8a stanoví, že při povinnosti zveřejnit bílou knihu kryptoaktiva se nepoužijí většina uvedených informačních ustanovení občanského zákoníku a při některých právech na odstoupení se nepoužijí příslušná pravidla pro finanční služby na dálku. Jde o nové výjimky, které v těchto situacích zužují spotřebitelskou ochranu a transparentní informace, tedy působí proti části slibu. | ano: Výslovně upravuje, kdy se na smlouvy týkající se kryptoaktiv nepoužijí některá ustanovení občanského zákoníku, a proto se přímo dotýká ochrany uživatelů digitálních aktiv.<br>Dopad: Předchozí znění § 8a neexistovalo; nová úprava stanoví, že při povinnosti zveřejnit bílou knihu kryptoaktiva se nepoužijí §§ 1843 až 1844a občanského zákoníku, s výjimkou uvedené informační povinnosti, a v popsaném případě práva na odstoupení podle evropského nařízení se nepoužijí ani pravidla pro odstoupení od smlouvy o finančních službách na dálku a příslušná informační povinnost. Tím se zužuje použití těchto vnitrostátních spotřebitelských pravidel pro některé situace s kryptoaktivy, tedy omezuje část ochrany, kterou slib směřuje uživatelům digitálních aktiv. |
| [Změna zákona v návrhu projednávaném Sněmovnou: DIGITÁLNÍ OBCHOD](https://www.psp.cz/sqw/text/orig2.sqw?idd=281029) | ano: Navržená dohoda se vztahuje na obchod elektronickými prostředky a obsahuje závazky k ochraně spotřebitelů před podvodnými praktikami, což může zahrnout i část digitálního trhu.<br>Dopad: Jde o návrh mezinárodní dohody, nikoli o změnu dřívějšího českého zákonného znění. Její kapitola o ochraně spotřebitelů na internetu zavazuje strany přijmout nebo zachovat opatření podporující důvěru spotřebitelů, včetně zákazů podvodných a klamavých praktik v elektronickém obchodě; to podporuje prot podvodnou část slibu, ale nestanoví zvláštní pravidla pro kryptoaktiva. | ne: Dodané části dohody požadují obecná opatření proti podvodům při elektronickém obchodování, ale neuvádějí, že se vztahují právě na uživatele digitálních aktiv nebo fintech služby. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna občanského zákoníku](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o implementaci předpisů Evropské unie v oblasti digitalizace finančního trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=278470)
- [Změna zákona v návrhu projednávaném Sněmovnou: DIGITÁLNÍ OBCHOD](https://www.psp.cz/sqw/text/orig2.sqw?idd=281029)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88256)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=331)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

