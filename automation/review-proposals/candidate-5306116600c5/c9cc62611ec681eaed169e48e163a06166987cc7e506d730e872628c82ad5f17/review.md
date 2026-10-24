# Žádné zvýšení přímých plateb pacientů

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

*Nevznikl žádný návrh veřejného hodnocení ani vysvětlení.*

## Co má zkontrolovat reviewer

- Odpovídá navržené hodnocení metodice SLAVA Indexu?
- Je jednání správně připsáno sledované straně?
- Je veřejné vysvětlení pochopitelné samo o sobě a říká, kdo co udělal a jak to souvisí se slibem?
- Jsou zkratky, právní pojmy a úřední označení při prvním použití vysvětlené?
- Dokládají uvedené zdroje všechna podstatná tvrzení a nechybí rozporný podklad?

## Technické podklady pro reviewera

- Výsledek automatického procesu: oba automatické posudky označily podklady za nedostatečné
- Interní stav: bez kandidátního stavu
- Důvod výsledku: `insufficient-evidence`
- Úplný strojový audit: `assessment-run.json`
- Přesný balíček posuzovaných podkladů: `evidence-package.json`

### Shoda hodnotitelů

Oba nezávislí hodnotitelé dospěli ke stejnému výsledku: **podklady nestačí pro automatický návrh hodnocení**.

SPD ve vládě předložilo návrhy, které mění přístup některých skupin k veřejnému zdravotnímu pojištění; jeden z nich rozšiřuje výjimku z pojištění na další osoby pracující nelegálně. Poslanci SPD také podpořili nový cizinecký zákon, který v jednom výslovně vymezeném případě ukládá cizincům hradit zdravotní péči. To působí proti části slibu o nezvyšování přímých plateb, ale u nového zákona chybí srovnání s dosavadními pravidly, takže nelze ověřit, zda platby skutečně zvýšil. Celkový závěr je proto předběžný.

Co zůstává nejisté:

- U nového cizineckého zákona balíček neuvádí předchozí znění pravidel pro zdravotní péči hrazenou cizinci po skončení azylového řízení; nelze proto ověřit, zda povinnost platit v přijímacím středisku na letišti znamená zvýšení přímých plateb oproti dřívějšímu stavu.
- U rozšíření výjimky z veřejného zdravotního pojištění pro osoby vykonávající nelegální práci balíček nedokládá, zda tyto osoby následně skutečně platí péči přímo ani v jaké výši.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o pravidlech rozpočtové odpovědnosti](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00) | ne: Změna upravuje rozpočtové limity a plánování úhrad zdravotních pojišťoven, ale nestanoví ani nemění přímé platby pacientů. | ne: Změna upravuje pravidla rozpočtové odpovědnosti a financování zdravotních pojišťoven, ale její text nemění přímé platby pacientů ani jejich úhradu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: ÚVODNÍ USTANOVENÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ne: Nový cizinecký zákon upravuje zajištění zdravotních služeb cizinců a pojištění, nikoli přímé platby pacientů za péči. | ne: Ustanovení o povinném zajištění zdravotních služeb cizinců upravují jejich pojištění a pojistné krytí, nikoli přímé platby za péči při jejím čerpání. |
| [Změna zákona v návrhu projednávaném Sněmovnou: STRPĚNÍ NA ÚZEMÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Ustanovení o veřejném zdravotním pojištění pro některé osoby s osvědčením o strpění se přímo dotýká toho, zda tito lidé musí péči hradit sami.<br>Dopad: Jde o nová ustanovení bez předchozího znění dodaného v balíčku: žadatelé o osvědčení zpravidla dokládají zajištění zdravotních služeb, ale osoby, které kvůli překážce vycestování nebo účasti v trestním řízení prokážou, že náklady nemohou hradit a nelze je zajistit jinak, tuto povinnost nemají. Za stejných vymezených podmínek se některé osoby pro účely veřejného zdravotního pojištění považují za osoby s trvalým pobytem; pravidlo tak může rozšířit veřejné krytí a omezit nutnost přímé úhrady, ale směr změny oproti dřívějšímu stavu nelze z balíčku určit. | ano: Nová pravidla osvědčení o strpění zahrnují podmíněný přístup některých cizinců k veřejnému zdravotnímu pojištění, což se může týkat toho, zda za péči platí přímo.<br>Dopad: Nová úprava stanoví, že některé osoby s osvědčením o strpění se za podmínek § 332 považují pro účely veřejného zdravotního pojištění za osoby s trvalým pobytem; mimo jiné musí doložit, že náklady nemohou hradit samy a nelze je zajistit jinak. Jde o nový zákon a balíček neuvádí předchozí znění, takže nelze určit, zda se tím oproti dosavadnímu stavu jejich nárok na veřejné pojištění zvětšuje, zmenšuje, nebo zůstává stejný. |
| [Změna zákona v návrhu projednávaném Sněmovnou: NÁVRAT](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621) | ano: Nový zákon výslovně ukládá některým cizincům hradit zdravotní služby, takže se přímo dotýká přímých plateb pacientů.<br>Dopad: Jde o nový právní rámec a balíček neuvádí předchozí znění dotčených pravidel. Nová ustanovení stanoví, že stát hradí vymezenou neodkladnou péči při zajištění a některou péči během doby k vycestování, zatímco cizinec v přijímacím středisku na mezinárodním letišti po pravomocném skončení řízení o mezinárodní ochraně hradí pobyt i poskytnutou zdravotní péči; pokud tyto náklady nezvládne a nejsou zajištěny jinak, nese je stát. Pravidlo tedy v určitém případě ukládá přímou úhradu pacientovi, ale bez předchozího znění nelze určit, zda jde o její zvýšení oproti dosavadnímu stavu. | ano: Nová pravidla výslovně určují, kdy zdravotní péči cizinců hradí stát a kdy ji může hradit samotný cizinec.<br>Dopad: Nový zákon stanoví, že stát hradí vymezenou neodkladnou péči a některou akutní péči cizincům v zajištění nebo v době před vycestováním (§ 489–492), zatímco cizinec v přijímacím středisku na mezinárodním letišti po pravomocném ukončení řízení o mezinárodní ochraně hradí zdravotní péči sám, nemůže-li platit, náklady nese stát (§ 493). Jde o nový zákon bez předchozího znění v balíčku; ustanovení tedy vytváří případ přímé úhrady pacientem, ale nelze určit, zda jde o zvýšení oproti dřívějším pravidlům. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313) | ano: Ustanovení o tom, kdo má nárok na veřejné zdravotní pojištění při dočasné ochraně, může ovlivnit, zda lidé hradí péči přímo.<br>Dopad: Před změnou se lidé s dočasnou ochranou od jejího udělení považovali pro účely veřejného zdravotního pojištění za osoby podle uvedené kategorie zákona o veřejném zdravotním pojištění; dospělí od 18 do 65 let se po 90 dnech považovali za osoby s trvalým pobytem. Výjimkou byli lidé, jejichž závažný zdravotní stav dlouhodobě znemožňoval práci, a jedna osoba, která o ně pečovala. Návrh zachovává obecné pravidlo, ale výjimku vymezuje jako osoby s omezením soběstačnosti alespoň ve stupni 2 a osoby, které o ně samostatně pečují; protože balíček neukazuje, jak se tato kritéria překrývají s předchozí výjimkou, směr změny nároku a případných přímých plateb nelze určit. | ano: Návrh mění, kdo z držitelů dočasné ochrany má veřejné zdravotní pojištění, což může ovlivnit, zda tito lidé hradí péči přímo.<br>Dopad: Předchozí § 7 odst. 2 považoval osoby ve věku 18–64 let za osoby s trvalým pobytem pro účely veřejného zdravotního pojištění po 90 dnech, ale vylučoval osoby s dlouhodobě závažným zdravotním stavem znemožňujícím práci a jednu osobu, která o ně pečuje. Návrh místo toho stanoví výjimku pro osoby s omezením soběstačnosti alespoň ve stupni 2 a pro jejich pečující osoby. Nárok se proto mění podle toho, zda konkrétní člověk spadá do nové či dosavadní výjimky; směr změny pro všechny dotčené určit nelze. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o azylu](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313) | ano: Přechodné ustanovení zachovává veřejné zdravotní pojištění určité skupině žadatelů o mezinárodní ochranu, a může tak zabránit jejich přímému placení péče.<br>Dopad: Jde o nové přechodné ustanovení bez předchozího znění v balíčku: osoby, které se dříve považovaly za osoby s trvalým pobytem pro účely veřejného zdravotního pojištění, zůstávají pojištěny po dobu příslušného řízení, případně do konce následujícího kalendářního měsíce. Pro vymezenou skupinu tedy výslovně zachovává veřejné krytí a může omezit potřebu přímé úhrady; oproti předchozímu stavu ale směr změny nelze určit. | ano: Přechodná ustanovení výslovně zachovávají veřejné zdravotní pojištění některým žadatelům o mezinárodní ochranu, a tím se dotýkají jejich možné přímé úhrady péče.<br>Dopad: Předchozí znění příslušného ustanovení v balíčku chybí. Návrh stanoví, že osoby, které kvůli dřívější změně přestaly být považovány za osoby s trvalým pobytem pro účely veřejného zdravotního pojištění, zůstanou pojištěny po dobu řízení, případně do konce následujícího kalendářního měsíce; u části žadatelů zachovává pojištění od 12. června 2026. Pro tyto skupiny je zachování pojištění podpůrným opatřením, ale jeho změnu oproti dřívějšímu stavu nelze z balíčku úplně určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o organizaci a provádění sociálního zabezpečení](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Změna upravuje sociální zabezpečení a povinnosti spojené s nelegální či nehlášenou prací, nikoli přímé platby pacientů. | ne: Změny správy sociálního zabezpečení a odvodů za nelegální práci v dodaném textu nemění pravidla přímých plateb pacientů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o veřejném zdravotním pojištění](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ano: Návrh rozšiřuje okruh osob vyňatých z veřejného zdravotního pojištění, což může zvýšit jejich potřebu hradit zdravotní péči přímo.<br>Dopad: Před změnou § 2 odst. 5 vyjímal z veřejného zdravotního pojištění osoby vykonávající nelegální práci podle § 5 písm. e) bodu 3 zákona o zaměstnanosti. Návrh před slova „bodu“ doplňuje „2 a“, takže výjimku rozšiřuje i na osoby podle bodu 2. Tím se zpřísňuje přístup této skupiny k veřejnému pojištění a může se zvýšit její vystavení přímým úhradám; balíček však nedokládá, zda a jak se to promítne do skutečných plateb za péči. | ano: Návrh rozšiřuje okruh osob vyloučených z veřejného zdravotního pojištění, čímž může zmenšit skupinu pacientů, jejichž péči toto pojištění kryje.<br>Dopad: Dosavadní § 2 odst. 5 zákona o veřejném zdravotním pojištění vylučoval osoby vykonávající nelegální práci podle § 5 písm. e) bodu 3 zákona o zaměstnanosti a další vyjmenované skupiny. Návrh k bodu 3 přidává také bod 2, takže se okruh osob vyloučených z veřejného zdravotního pojištění zvětšuje; pro nově zahrnuté osoby se tím zmenšuje přístup k tomuto zdroji úhrady péče a může se zvýšit riziko přímých plateb. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o pravidlech rozpočtové odpovědnosti
- Změna zákona v návrhu projednávaném Sněmovnou: ÚVODNÍ USTANOVENÍ
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o organizaci a provádění sociálního zabezpečení

### Zdroje použité při hodnocení

- [Původní volební slib](https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: STRPĚNÍ NA ÚZEMÍ](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: NÁVRAT](https://www.psp.cz/sqw/text/orig2.sqw?idd=280621)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o některých opatřeních v souvislosti s ozbrojeným konfliktem na území Ukrajiny vyvolaným invazí vojsk Ruské federace](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o azylu](https://www.psp.cz/sqw/text/orig2.sqw?idd=271313)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o veřejném zdravotním pojištění](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=144)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=213)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=300)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88522)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

