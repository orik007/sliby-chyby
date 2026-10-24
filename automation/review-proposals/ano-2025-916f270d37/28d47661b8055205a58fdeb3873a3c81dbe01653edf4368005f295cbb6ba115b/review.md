# Moderní síť chránící státní systémy a osobní údaje před kybernetickými hrozbami

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda ANO předložila návrhy, které rozšiřují pravidla pro digitální identitu a správu dat; poslanci ANO podpořili také pravidla pro zabezpečený přístup k datům. V konečném hlasování podpořili nový cizinecký zákon, který umožňuje omezit elektronické účty při napadení nebo poruše systému, a zákon zavádějící bezpečnostní testovací identity pro státní registry. Jde o dílčí kroky, nikoli o doložené vybudování celé ochranné sítě. Jiný vládní návrh přitom ruší dosavadní možnost použít doplňující autentizaci, což působí proti části slibu.

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

- Návrh změny registru obyvatel současně odstraňuje uchovávaná autentizační data a možnost použít autentizaci jako doplněk fyzického ověření; balíček neumožňuje určit, zda tento souběh celkově zvyšuje, nebo snižuje ochranu před kybernetickými hrozbami.
- Návrh ruší dosavadní možnost doplňující autentizace u digitálních úkonů. Jde o návrh vlády, nikoli o doložené konečné rozhodnutí, a proto nemění závěr založený na pozdějších hlasováních pro dílčí bezpečnostní opatření.
- Doložené zákony a hlasování představují jen dílčí opatření; balíček neprokazuje, že už byla vybudována celá slíbená ochranná síť.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: SPRÁVA DAT A ŘÍZENÝ PŘÍSTUP K DATŮM](https://www.psp.cz/sqw/text/orig2.sqw?idd=269522) | ano: Návrh zavádí pravidla správy dat ve státních informačních systémech a zabezpečeného přístupu k nim, což může přispět k ochraně těchto systémů a osobních údajů.<br>Dopad: Jde o novou právní úpravu, takže balíček nedává předchozí znění, s nímž by šlo změnu přímo porovnat. Zavádí povinnost chránit důvěryhodnost a užitečnost dat, udržovat přístup ke spravovaným datům, popisovat je a řídit jejich zabezpečené opakované využití; přístup je omezen na nezbytný rozsah a zpravidla na anonymizovaná data. Vůči slibu jde o dílčí institucionální a bezpečnostní opatření, nikoli o vybudování celé ochranné sítě. | ano: Úprava zabezpečeného přístupu k datům a povinností při jejich ochraně může přispět k ochraně osobních údajů ve státních informačních systémech.<br>Dopad: Jde o nový zákon, takže předchozí znění měněných ustanovení není. Zavádí pravidla správy dat, národní katalog a řízený přístup, při němž se data poskytují zabezpečeně, s omezeními pro ochranu dat a povinnostmi oznamovat některá porušení; tím rozšiřuje prostředky pro ochranu dat, ale samo o sobě nebuduje celostátní kybernetickou síť. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Zřizuje elektronické účty v cizineckém systému a umožňuje omezit jejich využívání při napadení, hrozbě nefunkčnosti nebo zneužití systému, čímž se týká kybernetické odolnosti státního systému.<br>Dopad: Jde o část nového cizineckého zákona a balíček neposkytuje předchozí znění těchto pravidel. Text vytváří elektronické účty a stanoví, že ministerstvo může při neoprávněném zásahu, hrozbě nefunkčnosti, zneužívání nebo zahlcení systému jejich používání omezit či zakázat. Jde o nový nástroj reakce na bezpečnostní incidenty, tedy dílčí posílení ochrany a odolnosti, nikoli o prokázané vybudování celé sítě. | ano: Zákon zavádí elektronický účet a stanoví, jak lze omezit jeho používání při zásahu do systému, nefunkčnosti nebo bezpečnostní hrozbě.<br>Dopad: Jde o novou právní úpravu bez předchozího znění těchto ustanovení. Zakládá elektronický účet pro pobytovou agendu a umožňuje ministerstvu při neoprávněném zásahu, nefunkčnosti systému či dalších uvedených situacích jeho používání dočasně omezit nebo zakázat; vytváří tak dílčí bezpečnostní pojistku pro jeden státní systém, nikoli ochranu všech státních systémů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Změny pravidel pro služby vytvářející důvěru přidávají bezpečnostní povinnosti a ochranu osobních údajů při digitálním ověřování, což je skutečná část ochrany státních systémů a údajů.<br>Dopad: Dosavadní § 2 zákona ukládal kvalifikovaným poskytovatelům poskytovat službu na základě písemné smlouvy; návrh přidává statistické povinnosti a povinnost řídit se pokyny Agentury ke kryptografickým technikám, takže tyto povinnosti rozšiřuje. Dosavadní § 12 upravoval ověřování platnosti elektronických podpisů a pečetí; návrh jej nahrazuje pravidly pro digitální peněženky a elektronická potvrzení atributů, takže rozšiřuje způsoby digitálního ověřování, nikoli sám o sobě ve všech ohledech zpřísňuje zabezpečení. Nové povinnosti v § 17 výslovně postihují mimo jiné nedostatečná bezpečnostní opatření, kombinování osobních údajů a jejich neoddělené uchovávání; zde se ochranné povinnosti zpřísňují. Celkově jde o rozšíření digitální infrastruktury s dílčím zpřísněním bezpečnostních a datových povinností, nikoli o splnění celého slibu. | ano: Návrh rozšiřuje pravidla pro důvěryhodné elektronické služby o digitální peněženku, ochranu osobních údajů a technická bezpečnostní opatření.<br>Dopad: Dosavadní úprava již stanovovala povinnosti poskytovatelů důvěryhodných služeb, uchovávání údajů a dohled Agentury, ale neobsahovala nová pravidla pro elektronická potvrzení atributů a digitální peněženky. Návrh nově zavádí mimo jiné oddělování osobních údajů, bezpečnostní technické pokyny, oznamovací povinnosti a sankce; povinnosti pro zabezpečení této části digitální infrastruktury tedy rozšiřuje a zpřísňuje, avšak neřeší ochranu všech státních systémů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ano: Návrh rozšiřuje elektronickou identifikaci o digitální peněženku a stanoví požadavky a kontrolní pravidla pro její poskytování, což se týká bezpečnosti elektronické identity a osobních údajů.<br>Dopad: Dosavadní § 2 umožňoval elektronické prokázání totožnosti pouze kvalifikovaným systémem; návrh přidává digitální peněženku a ukládá příslušným orgánům umožnit její využití, čímž rozšiřuje dostupné způsoby ověření. Dosavadní pravidla pro kvalifikované systémy návrh doplňuje o certifikaci a posuzování shody peněženek, povinnosti jejich správců a evidenci údajů o uživatelích a peněženkách. Některé části tak zavádějí konkrétnější kontrolní a bezpečnostní požadavky, ale balíček nedokládá, že by peněženka sama představovala úplnou ochrannou síť pro státní systémy. | ano: Návrh zavádí digitální peněženku a pravidla jejího ověřování, evidence a certifikace, což se týká bezpečnosti elektronické identifikace a státních systémů.<br>Dopad: Dosavadní znění umožňovalo elektronickou identifikaci prostřednictvím kvalifikovaného systému; digitální peněženku jako další prostředek a její související systémová pravidla neupravovalo. Návrh zavádí její použití, akreditaci a certifikaci, evidenci a informační systém na podporu peněženky; rozšiřuje tak zabezpečenou digitální infrastrukturu, ale z podkladů nelze určit, zda celkovou úroveň ochrany kybernetických hrozeb zvyšuje. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ne: Upravuje správní poplatky za žádosti o odborná oprávnění a zápis poskytovatele; text nemění ochranu státních systémů ani osobních údajů před kybernetickými hrozbami. | ne: Změna stanoví správní poplatky za související žádosti, ale sama neupravuje zabezpečení státních systémů ani ochranu osobních údajů před kybernetickými hrozbami. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Návrh odstraňuje z registru obyvatel data pro elektronickou identifikaci a související možnost doplnit osobní ověření autentizací, tedy mění bezpečnostní prvek státní digitální identifikace.<br>Dopad: Dosavadní úprava vedla data potřebná pro elektronickou identifikaci a autentizaci, včetně možnosti doplnit fyzické prokázání totožnosti autentizací; autentizační údaj byl veden v jednosměrně šifrované podobě. Návrh tato data a navazující možnost doplnění autentizace odstraňuje a ukládá jejich výmaz do tří měsíců. Tím se snižuje množství uchovávaných autentizačních dat, ale současně se odstraňuje existující možnost použít tento další autentizační prvek; výsledný směr pro ochranu před kybernetickými hrozbami proto nelze z balíčku jednoznačně určit. | ano: Změna se přímo týká údajů používaných pro elektronickou identifikaci a autentizaci v registru obyvatel, tedy bezpečnostně významné části státní digitální infrastruktury.<br>Dopad: Předchozí znění vedlo data potřebná pro elektronickou identifikaci a autentizaci v jednosměrně šifrované a neveřejné podobě a umožňovalo s nimi doplnit fyzické ověření totožnosti. Návrh tato data z registru odstraňuje spolu s navazujícími ustanoveními a ukládá jejich výmaz; snižuje tedy množství zde uchovávaných údajů, ale zároveň ruší část dosavadní autentizační funkce. Celkový dopad na ochranu před kybernetickými hrozbami nelze z balíčku jednoznačně určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o právu na digitální služby](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Návrh ruší dosavadní možnost využívat aplikaci a autentizační data jako doplněk osobního ověření totožnosti, což může odstranit jeden z ochranných prvků digitálních úkonů.<br>Dopad: Dosavadní § 12 dával uživateli služby právo požadovat autentizaci jako podmínku digitálního úkonu, umožňoval Agentuře spravovat autentizační aplikaci a počítal s potvrzením autentizace. Návrh všechny tyto odstavce ruší, a tím zužuje dostupný způsob doplňujícího ověření totožnosti. Současně zvyšuje maximální pokutu z 10 000 Kč na 50 000 Kč a přesouvá projednávání přestupku z ministerstva na obecní úřad obce s rozšířenou působností; změna pokuty zpřísňuje sankci, ale sama nevrací zrušenou autentizační možnost. Ve vztahu k bezpečnostní části slibu je návrh v tomto ohledu dílčím krokem proti ní. | ano: Změna ruší ustanovení o autentizaci při digitálních službách a o autentizační aplikaci, což může ovlivnit ověřování přístupu ke státním službám.<br>Dopad: Předchozí znění dávalo uživateli za stanovených podmínek právo požadovat autentizaci před osobním provedením úkonu a ukládalo Agentuře provozovat příslušnou aplikaci. Návrh ruší tato ustanovení; zmenšuje tedy toto konkrétní oprávnění a ruší související autentizační nástroj, což oslabuje jeden způsob ověřování totožnosti, ačkoli podklady nedokládají, že by šlo o ochranu proti kybernetickým útokům na státní systémy. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ano: Zavádí testovací identity a údaje pro ověřování dostupnosti, funkčnosti, bezpečnosti a propojení základních registrů a agendových systémů, což přímo umožňuje testovat jejich bezpečnost.<br>Dopad: Jde o nové ustanovení a balíček neposkytuje předchozí znění srovnatelných pravidel. Zavádí povinnost vytvářet a spravovat testovací identity a údaje, které nesmějí být zaměnitelné se skutečnými osobami a slouží k testování dostupnosti, funkčnosti, bezpečnosti a interoperability informačních systémů. Jde o nový nástroj pro bezpečnostní testování, tedy dílčí příspěvek ke slibu, nikoli o celé slíbené řešení. | ano: Změna umožňuje testovat dostupnost, funkčnost, bezpečnost a interoperabilitu základních registrů a dalších informačních systémů.<br>Dopad: Jde o novou úpravu, takže předchozí znění těchto ustanovení není. Zavádí testovací identity a údaje, které lze používat výhradně v nezbytném rozsahu pro testování mimo jiné bezpečnosti a funkčnosti registrů a systémů; rozšiřuje tedy možnost bezpečnostního testování, ale sama nezaručuje ochranu systémů před útoky. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=278932) | ne: Mění evidenci orgánů veřejné moci a údajů o jejich představitelích a kontaktech, ale její text neupravuje zabezpečení systémů ani ochranu údajů před kybernetickými hrozbami. | ne: Návrh upravuje evidenci orgánů veřejné moci a jejich kontaktních údajů, nikoli ochranu systémů nebo osobních údajů před kybernetickými hrozbami. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o správních poplatcích
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: SPRÁVA DAT A ŘÍZENÝ PŘÍSTUP K DATŮM](https://www.psp.cz/sqw/text/orig2.sqw?idd=269522)
- [Změna zákona v návrhu projednávaném Sněmovnou: ZVLÁŠTNÍ PRAVIDLA PRO ŘÍZENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o elektronické identifikaci](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o právu na digitální služby](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86767)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=154)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=172)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88528)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

