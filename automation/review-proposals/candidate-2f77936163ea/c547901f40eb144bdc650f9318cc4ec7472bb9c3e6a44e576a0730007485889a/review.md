# Centralizovaná správa dat podle principu „jen jednou a dost“

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Vláda předložila návrh zákona o pobytu cizinců, který zavádí společný informační systém pro cizineckou agendu a zpřístupňuje jeho údaje dalším orgánům. Při závěrečném hlasování o tomto návrhu neměla strana většinovou podporu, a tím neprosadila opatření, které částečně odpovídá slibu. Vedle toho vláda podpořila automatické opakované použití biometrických údajů při žádosti o občanský průkaz a cestovní doklad a zařadila do legislativního výhledu návrh zákona o správě dat. Vláda také souhlasila s posunem termínů pro předávání matričních údajů, který centralizaci v této oblasti odkládá.

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

- U hlasování o pozměňovacím návrhu k zákonu o podpoře bydlení jsou zaznamenány varianty E1, E3 a E4, ale balíček neobsahuje jejich samostatné texty, takže jejich samostatný dopad nelze určit; závěrečné hlasování o schváleném zákoně je doloženo.
- U hlasování o zákonu měnícím pravidla pro matriční údaje neměla strana většinu hlasů, takže z tohoto hlasování nelze určit její většinovou volbu.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ne: Dodané změny upravují data a geoportál územního plánování, nikoli údaje občanů ani jejich předávání mezi úřady podle slibu. | ne: Změny údajů a databáze národního geoportálu se týkají územního plánování, nikoli toho, aby občané zadávali údaje jednou a úřady si je předávaly. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ne: Navržené spojování informačních systémů se týká pouze stavební správy a text nedokládá systém, v němž by si úřady předávaly občanem jednou zadané údaje. | ano: Navržené spojování informačních systémů veřejné správy se dotýká centralizace, byť jen v omezeném rozsahu.<br>Dopad: Navržený text nově dovoluje Úřadu sdružit informační systémy a vést více systémů jako jeden společný systém veřejné správy; předchozí znění § 267 takovou možnost výslovně neobsahovalo. Schválený text tuto možnost v dodaných odstavcích neobsahuje a místo toho upravuje vkládání písemností a údajů do národního geoportálu územního plánování, včetně možnosti vložit další písemnosti. Návrh tedy rozšiřoval možnost centralizace, ale nelze z dodaného schváleného znění vyvodit, že tento prvek byl přijat. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ne: Změna prodlužuje přechodné období pro systémy územního plánování, ale neřeší předávání údajů zadaných občany. | ano: Schválené znění ukládá předávat elektronické spisy mezi orgány elektronicky, což je dílčí podoba předávání informací mezi úřady.<br>Dopad: Dřívější dodané znění § 311 obsahovalo pouze odstavce 1 až 3; schválené znění nově stanoví, že spis vedený elektronicky se všem orgánům předává výhradně elektronicky. Jde o zpřísnění povinnosti předávat elektronický spis elektronicky a o dílčí podporu předávání mezi úřady, nikoli však o obecné pravidlo, že občan zadá údaje jen jednou. Změny přechodného období současně prodlužují možnost využívat jiné systémy, ale týkají se stavební správy a geoportálu, nikoli obecného předávání občanských údajů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ne: Přechodná ustanovení převádějí dokumenty, databáze a systémy územního plánování, nikoli údaje občanů předávané mezi úřady. | ne: Předání dokumentů, spisů a provozovaných systémů novému Úřadu a převod územně analytických podkladů jsou změny organizace stavební správy, nikoli slibované opakované předávání občanských údajů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podpoře bydlení](https://www.psp.cz/sqw/text/orig2.sqw?idd=271821) | ano: Schválená verze umožňuje při rozhodování použít také údaje vedené v integrovaném systému Ministerstva práce a sociálních věcí.<br>Dopad: Před změnou bylo možné vydat rozhodnutí jako první úkon jen na základě podkladů předložených účastníkem; nově lze vycházet také z údajů v integrovaném systému Ministerstva práce a sociálních věcí. Rozšiřuje se tak okruh již dostupných podkladů a v tomto omezeném případě se snižuje potřeba opakovaného předkládání údajů občanem, což částečně odpovídá slibu. | ano: Schválené změny umožňují při rozhodování využít údaje z informačního systému Ministerstva práce a sociálních věcí a rozšiřují přístup k údajům v evidenci.<br>Dopad: Dosavadní § 138 dovoloval vydat rozhodnutí jako první úkon jen na základě podkladů předložených účastníkem; schválený text připouští také údaje vedené v Integrovaném informačním systému Ministerstva práce a sociálních věcí. Tím se v tomto typu řízení rozšiřuje možnost úřadu použít již dostupné údaje místo jejich opětovného předložení. Změna § 132 navíc přidává Ministerstvo práce a sociálních věcí mezi orgány oprávněné upravit neúplné či nesprávné údaje v evidenci; jde o dílčí, nikoli všeobecný systém sdílení. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých podmínkách podnikání a o výkonu některých činností v oblasti cestovního ruchu](https://www.psp.cz/sqw/text/orig2.sqw?idd=267575) | ne: Návrh vytváří registr ubytování a údajů o ubytovaných, ale údaje do něj zapisují ubytovatelé a text nedokládá předávání občanem jednou zadaných údajů mezi úřady. | ne: Návrh registru se týká údajů o ubytování, ubytovatelích a hostech, nikoli opakovaného zadávání občanských údajů při jednání s úřady. |
| [Změna zákona v návrhu projednávaném Sněmovnou: INFORMAČNÍ SYSTÉMY A ZPRACOVÁNÍ ÚDAJŮ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Návrh zřizuje integrovaný informační systém cizinecké agendy, který vede údaje o žadatelích a zpřístupňuje je více orgánům.<br>Dopad: Jde o nový systém, takže balíček neposkytuje dřívější znění, s nímž by šlo pravidlo porovnat. Návrh stanoví evidenci údajů o cizincích a nepřetržitý dálkový přístup vybraných orgánů; jde o částečný krok ke sdílení dat v jedné agendě, nikoli o obecný systém ani o zajištění principu „jen jednou a dost“ pro občany. | ano: Nový integrovaný systém pro cizineckou agendu soustřeďuje údaje a umožňuje jejich dálkový přístup více orgánům, což odpovídá části slibu.<br>Dopad: Jde o novou právní úpravu bez předchozího znění, které by balíček poskytoval k porovnání. Ustanovuje Integrovaný cizinecký agendový systém jako informační systém veřejné správy, vede v něm údaje související s cizineckou agendou a přiznává dálkový přístup vyjmenovaným orgánům. Jde o dílčí centralizaci a sdílení údajů, nikoli o obecný systém pro všechny občanské údaje ani o obecné pravidlo jejich jednorázového zadání. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Návrh dovoluje použít biometrické údaje pořízené při žádosti o občanský průkaz také při žádosti o cestovní doklad podané tentýž den.<br>Dopad: Dosavadní § 21a ukládal pořídit biometrické údaje pro cestovní doklad; nově se při dřívější žádosti o občanský průkaz použijí údaje pořízené pro ni místo nového pořízení. Tím se omezuje opakované získávání téhož údaje a naplňuje se část slibu. | ano: Návrh umožňuje použít při žádosti o cestovní doklad biometrické údaje pořízené tentýž den při žádosti o občanský průkaz.<br>Dopad: Dřívější § 21a ukládal pořídit biometrické údaje při žádosti o cestovní doklad; nový odstavec stanoví, že se při splnění uvedené podmínky znovu nepořídí a využijí se údaje pořízené při žádosti o občanský průkaz. V tomto omezeném případě se tedy snižuje potřeba opakovaného pořízení údajů a úkon občana. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o občanských průkazech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ano: Návrh obdobně dovoluje použít při žádosti o občanský průkaz biometrické údaje již pořízené při žádosti o cestovní doklad téhož dne.<br>Dopad: Dosavadní § 19 ukládal pořídit biometrické údaje žadatele o občanský průkaz; nově se při dřívější žádosti o cestovní doklad použijí údaje pořízené pro něj místo nového pořízení. Opakované pořizování údajů se tak v této situaci omezuje a změna částečně odpovídá slibu. | ano: Návrh umožňuje použít pro občanský průkaz biometrické údaje pořízené tentýž den při žádosti o cestovní doklad.<br>Dopad: Dosavadní § 19 ukládal pořídit biometrické údaje žadatele o občanský průkaz; nový odstavec stanoví, že se při uvedené žádosti údaje znovu nepořídí a využijí se údaje z žádosti o cestovní doklad. V tomto omezeném případě se tedy snižuje potřeba opakovaného pořízení údajů a úkon občana. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona, kterým se mění zákon o matrikách, jménu a příjmení](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ano: Změna prodlužuje lhůty pro převod matričních údajů do systému ministerstva a posouvá účinnost souvisejících pravidel.<br>Dopad: Dosavadní přechodná pravidla počítala s předáním údajů do 31. prosince 2026 a s účinností některých pravidel od roku 2027; návrh posouvá předání do 30. června 2028, některé účinnosti na 1. července 2028 a jednu na 1. ledna 2030. V této části se tedy centralizace matričních údajů a navazující pravidla odkládají, což postup proti slibu zpomaluje. | ano: Změna odkládá harmonogram předání matričních údajů do připravovaného centrálního informačního systému, a tím přímo ovlivňuje jeho zavedení.<br>Dopad: Předchozí úprava požadovala předání matričních údajů ministerstvu do konce roku 2026 a počítala s účinností navazujících změn od ledna 2027. Návrh posouvá předání do roku 2028 a některé navazující termíny dále, až na rok 2030. Odkládá tak centralizaci těchto údajů, a tedy působí proti dílčímu postupu k centrální správě dat. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313) | ano: Návrh rozšiřuje předávání daňových údajů mezi finanční správou a Ministerstvem vnitra při posuzování podmínek registrace k pobytu.<br>Dopad: Před změnou už finanční správa na žádost předávala Ministerstvu vnitra některé údaje o daňovém základu; návrh doplňuje také datum podání přiznání a údaj o nedoplatku. Rozsah úředního předávání údajů se v této konkrétní agendě zvětšuje, což je dílčí posun směrem k tomu, aby potřebné údaje získaly úřady samy. | ano: Návrh počítá s předáváním daňových údajů mezi finanční správou a Ministerstvem vnitra pro posouzení podmínek pobytu, což je dílčí předávání údajů mezi úřady.<br>Dopad: Dřívější znění umožňovalo Ministerstvu vnitra získat určité daňové údaje na žádost; návrh rozšiřuje předávané údaje například o datum podání daňového přiznání a informaci o evidovaném nedoplatku. Jde o rozšíření konkrétního předávání údajů pro cizineckou agendu, nikoli o všeobecný systém ani o pravidlo jednorázového zadání. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 37/2021 Sb., o evidenci skutečných majitelů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278412) | ano: Návrh rozšiřuje přístup veřejných orgánů k údajům v centrální evidenci skutečných majitelů a propojuje ji se systémem evidencí EU.<br>Dopad: Dosavadní znění umožňovalo dálkový přístup vyjmenovaným orgánům a osobám; návrh přidává další orgány a zpřístupnění údajů prostřednictvím propojení evidencí. Sdílení údajů z této jediné evidence se rozšiřuje, což představuje jen omezenou část slibu. | ne: Změny rozšiřují přístup k evidenci skutečných majitelů a její propojení s evropskými evidencemi, nikoli opakované předávání občanem zadaných údajů mezi českými úřady. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna obecního zřízení](https://www.psp.cz/sqw/text/orig2.sqw?idd=278932) | ano: Návrh stanoví, že některé údaje v rejstříku svazků obcí se automaticky změní při změně odpovídajícího údaje v základním registru.<br>Dopad: Dosavadní znění stanovilo zápis údajů do rejstříku a povinnost svazku navrhnout změnu zapisovaných údajů; návrh nově u údajů statutárního orgánu a členských obcí stanoví změnu v rejstříku bez řízení, pokud se změní údaj v základním registru. Tím se v této úzce vymezené situaci omezuje nutnost opakovaně změnu hlásit a data se mezi evidencemi aktualizují automaticky. | ano: Návrh zřizuje informační systém rejstříku svazků obcí a stanoví automatickou změnu údajů podle základního registru.<br>Dopad: Dosavadní § 49 upravoval veřejný rejstřík vedený krajským úřadem; návrh nově zavádí rejstřík jako informační systém veřejné správy spravovaný Ministerstvem vnitra. Změna některých údajů v základním registru se má v rejstříku projevit bez řízení. Jde o dílčí centralizaci a automatické předávání změny mezi evidencemi, nikoli o obecný systém pro všechny údaje občanů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích](https://www.psp.cz/sqw/text/orig2.sqw?idd=279232) | ne: Dodané body upravují evidenci vozidel a přístup celních orgánů k jednomu údaji, ale nedokládají obecné předávání občanem zadaných údajů mezi úřady. | ne: Předložené změny se týkají evidence vozidel a poskytování údajů celním orgánům, nikoli jednorázového zadávání občanských údajů. |
| [Text usnesení vlády: Usnesení vlády č. 175/2026, Návrh Plánu legislativních prací vlády na zbývající část roku 2026 a návrh Výhledu legislativních prací vlády na léta 2027 až 2029 – Příloha č. 4: VÝHLED IMPLEMENTAČNÍCH PRACÍ VLÁDY](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/) | ano: Vládní legislativní výhled výslovně zařazuje návrh zákona o správě dat a řízeném přístupu k datům.<br>Dopad: Usnesení samo žádné pravidlo nemění a balíček neobsahuje předchozí znění; zařazuje pouze budoucí legislativní úkol „Návrh zákona o správě dat a řízeném přístupu k datům“. Jde o návrh dalšího postupu, nikoli o zavedený systém nebo uskutečněné předávání údajů. | ano: Vládní výhled výslovně zařazuje návrh zákona o správě dat a řízeném přístupu k datům, který se týká slíbené centrální správy.<br>Dopad: Příloha uvádí návrh zákona o správě dat a řízeném přístupu k datům jako legislativní úkol. Jde o plánovaný návrh, nikoli o platné pravidlo; konkrétní obsah, povinnosti ani rozsah systému z dodaného textu určit nelze. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona
- Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých podmínkách podnikání a o výkonu některých činností v oblasti cestovního ruchu
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podmínkách provozu vozidel na pozemních komunikacích

### Vyřazené změny zákonů

Tyto změny v balíčku nebyly, protože je oba hodnotitelé dřívějšího posouzení tohoto slibu shodně označili za nesouvisející. Vrátí se, jakmile se změní jejich text, kontext, znění slibu nebo pokyny hodnotitelů.

- **Vyhláška č. 153/2026 Sb., Vyhláška o stanovení postupu a podmínek pro získání přístupových údajů do informačního systému Administrace vzdělávání ve zdravotnictví a o rozsahu vedených údajů** (posouzení candidate-2f77936163ea--efdea36745db): Vyhláška upravuje přístup a rozsah údajů v systému vzdělávání zdravotníků, ale nedokládá předávání občanských údajů mezi úřady podle slibu. / Vyhláška upravuje přístupové údaje a evidované položky konkrétního systému vzdělávání zdravotníků, ale nedokládá převzetí údajů znovu zadávaných občany ani jejich sdílení mezi úřady.
- **67: ČÁST OSMÁ, body k § 57 až § 77 – Změna zákona o ochraně přírody a krajiny** (posouzení candidate-2f77936163ea--efdea36745db): Dodané části upravují evidenci druhové ochrany a záchranné stanice, nikoli předávání údajů občanů mezi úřady. / Dodané změny upravují evidenci ochrany přírody a péči o živočichy, nikoli předávání občanem jednou zadaných údajů mezi úřady.
- **67: ČÁST OSMÁ, body k § 87 až § 90 – Změna zákona o ochraně přírody a krajiny** (posouzení candidate-2f77936163ea--efdea36745db): Dodaná ustanovení se týkají evidence odebraných chráněných živočichů a souvisejícího přestupkového řízení, ne slibu o datech občanů. / Změna se týká zajištění a předávání informací o odebraných chráněných živočiších, což není slíbený systém sdílení údajů občanů.
- **67: ČÁST OSMÁ, Čl. XV – Změna zákona o ochraně přírody a krajiny** (posouzení candidate-2f77936163ea--efdea36745db): Přechodná ustanovení převádějí dokumentaci do registru krajiny, což samo o sobě nesouvisí s opakovaným předáváním údajů občanů úřadům. / Přechodné ustanovení převádí dokumentaci k vybraným chráněným územím do registru krajiny, nikoli údaje, které občan předává úřadům.
- **67: ČÁST DVACÁTÁ ŠESTÁ – Změna zákona o pozemkových úpravách** (posouzení candidate-2f77936163ea--efdea36745db): Dodaná verze neobsahuje žádný odstavec, který by doloženě přispíval k centralizovanému předávání údajů slíbenému občanům. / Tato změna je relevantní pouze skrze pozměňovací návrhy, ale dodaný text návrhu upravuje elektronické předávání spisů v jiné části zákona, ne změnu zákona o pozemkových úpravách.
- **67: ČÁST ČTYŘICÁTÁ PRVNÍ – Zrušení zákona o jednotném environmentálním stanovisku** (posouzení candidate-2f77936163ea--efdea36745db): Dodaná verze neobsahuje žádný odstavec, který by doloženě souvisel se slibovaným systémem správy údajů občanů. / Tato změna je relevantní pouze skrze pozměňovací návrhy, jejichž dodaný text neukazuje změnu rušící zákon o jednotném environmentálním stanovisku, která by naplňovala tento slib.
- **82: ČÁST DRUHÁ – Změna zákona o Úřadu práce České republiky** (posouzení candidate-2f77936163ea--efdea36745db): Schválené doplnění pouze rozšiřuje působnost Úřadu práce o podporu bydlení a samo neupravuje předávání ani opakované zadávání údajů. / Změna svěřuje Úřadu práce působnost v podpoře bydlení, ale dodaný text nestanoví sdílení ani centralizaci údajů.

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o podpoře bydlení](https://www.psp.cz/sqw/text/orig2.sqw?idd=271821)
- [Změna zákona v návrhu projednávaném Sněmovnou: INFORMAČNÍ SYSTÉMY A ZPRACOVÁNÍ ÚDAJŮ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o cestovních dokladech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o občanských průkazech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona, kterým se mění zákon o matrikách, jménu a příjmení](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 37/2021 Sb., o evidenci skutečných majitelů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278412)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna obecního zřízení](https://www.psp.cz/sqw/text/orig2.sqw?idd=278932)
- [Text usnesení vlády: Usnesení vlády č. 175/2026, Návrh Plánu legislativních prací vlády na zbývající část roku 2026 a návrh Výhledu legislativních prací vlády na léta 2027 až 2029 – Příloha č. 4: VÝHLED IMPLEMENTAČNÍCH PRACÍ VLÁDY](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Text pozměňovacího návrhu B (sněmovní dokument 762)](https://www.psp.cz/sqw/text/orig2.sqw?idd=269125)
- [Text pozměňovacího návrhu P1 (sněmovní dokument 1172)](https://www.psp.cz/sqw/text/orig2.sqw?idd=270687)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=67)
- [Stanovisko vlády k návrhu zákona, který nepředložila (souhlas)](https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=67&CT1=1)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=82)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=172)
- [Stanovisko vlády k návrhu zákona, který nepředložila (souhlas)](https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=187&CT1=1)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=213)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu B](https://public.psp.cz/sqw/hlasy.sqw?g=87603)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu E3](https://public.psp.cz/sqw/hlasy.sqw?g=87604)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu E1](https://public.psp.cz/sqw/hlasy.sqw?g=87605)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu E4](https://public.psp.cz/sqw/hlasy.sqw?g=87608)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87617)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu P1](https://public.psp.cz/sqw/hlasy.sqw?g=88143)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=260)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=277)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88528)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

