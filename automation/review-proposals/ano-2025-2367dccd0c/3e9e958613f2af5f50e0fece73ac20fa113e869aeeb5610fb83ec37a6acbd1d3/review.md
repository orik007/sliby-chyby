# Implementace Národního onkologického a kardiovaskulárního plánu

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Poslanec Adam Vojtěch navrhl do vládního návrhu zákona o evidenci tržeb doplnit daňové zvýhodnění pro zaměstnavatele, kteří poskytují onkologický screening a vyšetření kardiovaskulárního rizika; poslanci ANO návrh podpořili. Sněmovna návrh zákona schválila a po vrácení Senátem na něm setrvala, takže tato dílčí podpora zůstala v jeho znění. Vláda také schválila převod prostředků na pokrytí již vynaložených výdajů na onkologický plán, včetně 517,8 milionu Kč pro Ministerstvo zdravotnictví a 20,7 milionu Kč pro Ústav zdravotnických informací a statistiky. Jde o doložené kroky k prevenci a onkologickému plánu, ale důkazy nepotvrzují úplnou implementaci obou plánů ani konkrétní výsledky péče.

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

- U vyhlášek o kompetencích lékařů, vzdělávání a lékařském ozáření balíček neobsahuje předchozí znění pravidel; nelze proto určit, zda a v jakém rozsahu jejich přijetí oproti dřívějšku změnilo přístup k péči nebo její kvalitu.
- Doložené prostředky na onkologický plán kryjí skutečně vynaložené výdaje, ale balíček neukazuje, jaké služby byly díky nim poskytnuty, ani nedokládá implementaci Národního kardiovaskulárního plánu jako celku.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278478) | ano: Schválená verze výslovně zahrnuje onkologický screening a vyšetření kardiovaskulárního rizika, tedy prevenci, kterou slib zmiňuje.<br>Dopad: Dříve § 6 odst. 7 mezi příjmy mimo předmět daně tyto zdravotní služby neuváděl; schválené znění je doplňuje a příloha vyjmenovává onkologické screeningy i vyšetření kardiovaskulárního rizika. Podle návrhu se na tato plnění nebude vztahovat daň z příjmů ze závislé činnosti ani dosavadní limit osvobození, což může usnadnit jejich poskytování zaměstnavateli; jde však jen o dílčí daňovou podporu, nikoli o samotnou implementaci obou plánů. | ano: Schválené znění umožňuje osvobodit od daně zaměstnanecké zdravotní benefity zahrnující onkologický screening a vyšetření kardiovaskulárního rizika, což se přímo týká prevence a dostupnosti péče popsané ve slibu.<br>Dopad: Dosavadní znění považovalo plnění zaměstnavatele pro zaměstnance obecně za příjem; schválená změna z daňového základu vyjímá vyjmenovanou péči o zdraví zaměstnanců, včetně onkologického screeningu a vyšetření kardiovaskulárního rizika. Daňové omezení poskytování těchto vyšetření tím zmírňuje, ale nezakládá nárok na vyšetření ani sama neprokazuje provádění obou národních plánů. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 577/2025 Sb., Vyhláška o stanovení činností, které může vykonávat lékař bez odborného dohledu po získání certifikátu o absolvování základního kmene otorinolaryngologického](https://e-sbirka.gov.cz/sb/2025/577/0000-00-00) | ano: Vyhláška mezi činnostmi lékaře bez odborného dohledu uvádí biopsie a odstraňování kožních nádorů, což se přímo týká diagnostiky a léčby nádorů.<br>Dopad: Vyhláška stanoví, že lékař po absolvování základního kmene v otorinolaryngologii může bez odborného dohledu provádět mimo jiné biopsie kožních a slizničních lézí a resekovat benigní i maligní kožní nádory. Předchozí znění pravidel package neuvádí, takže nelze určit, zda se tím rozsah oprávnění oproti dřívějšku rozšířil; uvedené činnosti se týkají části onkologické péče, nikoli implementace celého plánu. | ano: Vyhláška výslovně umožňuje lékaři po absolvování základního kmene v ORL bez odborného dohledu provádět biopsii a resekci kožních či slizničních nádorů, tedy činnosti vztahující se k léčbě nádorových onemocnění.<br>Dopad: Vyhláška stanoví, že lékař s příslušným certifikátem může bez odborného dohledu provádět uvedené biopsie a resekce, včetně maligních nádorů. Předchozí znění pravidla není v podkladech uvedeno, takže nelze určit, zda se oproti němu možnost lékařů rozšířila, zúžila, nebo zůstala stejná. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 578/2025 Sb., Vyhláška, kterou se mění vyhláška č. 397/2020 Sb., o vzdělávání v základních kmenech lékařů, ve znění vyhlášky č. 386/2024 Sb.](https://e-sbirka.gov.cz/sb/2025/578/0000-00-00) | ano: Text učebních požadavků výslovně zahrnuje onkochirurgii a nádorová onemocnění a v urgentní medicíně také akutní koronární syndrom.<br>Dopad: Vyhláška stanoví výukové požadavky zahrnující mimo jiné onkochirurgii a nádory a v části urgentní medicíny akutní koronární syndrom. Předchozí znění upravovaných učebních požadavků v balíčku chybí, takže nelze určit, zda se obsah výuky v těchto oblastech oproti předchozímu stavu změnil ani jakým směrem; text se týká jen dílčí odborné přípravy. | ano: Změněné vzdělávací osnovy výslovně zahrnují onkochirurgii a nádory i kardiovaskulární akutní stavy, takže se týkají kvality péče o obě skupiny onemocnění uvedené ve slibu.<br>Dopad: Text stanoví výuková témata z onkochirurgie, nádorů a kardiovaskulárních akutních stavů, ale předchozí znění měněných osnov není v podkladech uvedeno. Nelze proto určit, zda změna rozsah či náročnost přípravy v těchto oblastech zvětšila, zmenšila, nebo zachovala. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 579/2025 Sb., Vyhláška o lékařském ozáření](https://e-sbirka.gov.cz/sb/2025/579/0000-00-00) | ano: Vyhláška upravuje lékařské ozáření včetně radioterapie a stanoví kontroly kvality péče, sledování výsledků léčby a komplikací.<br>Dopad: Vyhláška stanoví postupy pro odůvodnění a optimalizaci lékařského ozáření, klinické audity a kontrolu péče po radioterapii včetně sledování léčebných výsledků a komplikací. Předchozí pravidla nejsou v balíčku uvedena, takže nelze určit, zda je nová úprava přísnější či volnější; její ustanovení se však přímo týkají kvality části onkologické léčby. | ano: Vyhláška výslovně upravuje klinické audity pracovišť radiační onkologie, která poskytují léčbu nádorových onemocnění zářením, a přímo se tak vztahuje ke kvalitě onkologické péče.<br>Dopad: Jde o novou vyhlášku, která stanoví pravidla radiační ochrany a klinických auditů; u radioterapie audity zahrnují mimo jiné personální a technické zabezpečení, dodržování postupů, péči po léčbě a vyhodnocování jejích výsledků. Pro tuto novou úpravu není v balíčku předchozí znění, takže nelze provést srovnání se stavem před změnou; její pravidla se však přímo týkají kvality radioterapie, nikoli dostupnosti péče ani uskutečňování obou plánů jako celku. |
| [Text usnesení vlády: Usnesení vlády č. 506/2026, XI. zpráva o realizaci Národního plánu obnovy](https://odok.gov.cz/portal/zvlady/usneseni/2026/506/) | ano: Příloha usnesení výslovně uvádí Národní plán na posílení onkologické prevence a péče a částky přidělované Ministerstvu zdravotnictví a Ústavu zdravotnických informací a statistiky.<br>Dopad: Usnesení rozděluje celkem 10 160 830 520,85 Kč z Nástroje pro oživení a odolnost podle skutečně vynaložených výdajů a ukládá jejich převod příslušným organizačním složkám státu. V příloze je pro onkologický plán uvedeno 517 802 966,73 Kč pro Ministerstvo zdravotnictví a 20 672 615,44 Kč pro Ústav zdravotnických informací a statistiky; jde o krytí již vynaložených výdajů, nikoli o doložení úplné realizace plánu nebo o financování kardiovaskulárního plánu. | ano: Usnesení rozděluje prostředky výslovně vedené na Národní plán na posílení onkologické prevence a péče, což je konkrétní finanční krok v oblasti onkologické prevence a léčby.<br>Dopad: Usnesení rozděluje a ukládá převést 10 160 830 520,85 Kč z prostředků Nástroje pro oživení a odolnost podle skutečně vynaložených výdajů. Z uvedených položek náleží Ministerstvu zdravotnictví 517 802 966,73 Kč a Ústavu zdravotnických informací a statistiky ČR 20 672 615,44 Kč na Národní plán na posílení onkologické prevence a péče. Slib nestanoví finanční částku; usnesení představuje konkrétní podporu onkologické části, ale nedokládá odpovídající krok pro kardiovaskulární plán. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278478)
- [Předpis ve Sbírce zákonů: Vyhláška č. 577/2025 Sb., Vyhláška o stanovení činností, které může vykonávat lékař bez odborného dohledu po získání certifikátu o absolvování základního kmene otorinolaryngologického](https://e-sbirka.gov.cz/sb/2025/577/0000-00-00)
- [Předpis ve Sbírce zákonů: Vyhláška č. 578/2025 Sb., Vyhláška, kterou se mění vyhláška č. 397/2020 Sb., o vzdělávání v základních kmenech lékařů, ve znění vyhlášky č. 386/2024 Sb.](https://e-sbirka.gov.cz/sb/2025/578/0000-00-00)
- [Předpis ve Sbírce zákonů: Vyhláška č. 579/2025 Sb., Vyhláška o lékařském ozáření](https://e-sbirka.gov.cz/sb/2025/579/0000-00-00)
- [Text usnesení vlády: Usnesení vlády č. 506/2026, XI. zpráva o realizaci Národního plánu obnovy](https://odok.gov.cz/portal/zvlady/usneseni/2026/506/)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279108)
- [Text pozměňovacího návrhu A (sněmovní dokument 1546)](https://www.psp.cz/sqw/text/orig2.sqw?idd=277972)
- [Vydání vyhlášky: Ministerstvo zdravotnictví](https://e-sbirka.gov.cz/sb/2025/577/0000-00-00)
- [Vydání vyhlášky: Ministerstvo zdravotnictví](https://e-sbirka.gov.cz/sb/2025/578/0000-00-00)
- [Vydání vyhlášky: Ministerstvo zdravotnictví v dohodě se Státním úřadem pro jadernou bezpečnost](https://e-sbirka.gov.cz/sb/2025/579/0000-00-00)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=189)
- [Pozměňovací návrh poslanců A ve druhém čtení](https://www.psp.cz/sqw/sd.sqw?cd=1546&o=10)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A](https://public.psp.cz/sqw/hlasy.sqw?g=88280)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88356)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/506/)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88456)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

