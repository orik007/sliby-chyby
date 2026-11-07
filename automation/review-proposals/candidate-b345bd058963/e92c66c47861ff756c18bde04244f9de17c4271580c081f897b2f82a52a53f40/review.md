# Jednotné digitální rozhraní pro stavební řízení

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje proti slibu (−1)**

### Vysvětlení

Poslanci Motoristů se podíleli na předložení novely stavebního zákona a vláda s ní souhlasila; klub Motoristů ji podpořil při schválení i poté, co ji Senát zamítl. Novela přidává portálu službu sledování stavu řízení, tedy naplňuje část slibu. Zároveň ale ruší povinnost dotčených orgánů vložit stanoviska do evidence a doručit je žadateli, ruší povinnost ukládat některé dokumentace do elektronické evidence a odstraňuje výslovnou možnost podat přes portál určitou žádost o povolení zařízení. Protože prosazená novela současně přidává sledování řízení, ale oslabuje záruku získání úplných digitálních výstupů, převažuje její účinek proti slibu.

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

- Výřez neuvádí celé nové znění § 172 odst. 2 ani § 181 odst. 2 stavebního zákona, takže přesný dopad těchto změn na podávání a doručování nelze určit; závěr vychází zejména z výslovně zrušené povinnosti doručovat stanoviska podle § 173 odst. 3.
- U přechodného ustanovení o souběžném používání dosavadních systémů chybí předchozí znění i délka přechodného období, takže nelze přesně posoudit rozsah ani trvání dopadu na jednotnost rozhraní.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Změny přímo upravují podávání žádostí, ukládání dokumentace a doručování stanovisek v digitálním stavebním řízení.<br>Dopad: Dosavadní § 172 odst. 1 pouze umožňoval podání přes portál; nově se u podání obsahujících dokumentaci pro povolení záměru a u osob s datovou schránkou vyžaduje digitální úkon, s uvedenými výjimkami, což zpřísňuje formu podání, nikoli však výslovně použití portálu. Z § 172 odst. 2 se vypouští výslovná možnost podat žádost elektronicky přes portál nebo listinně; protože výsledné znění odstavce není v dodaném výřezu, nelze určit, jak se tím pravidlo změnilo. Dosavadní § 172 odst. 4 ukládal vložit dokumentaci do evidence elektronických dokumentací; jeho zrušením tato povinnost odpadá, takže je menší záruka, že dokumentace bude v evidenci. Dosavadní § 173 odst. 3 ukládal dotčenému orgánu vložit stanovisko či závazné stanovisko do evidence stavebních postupů a doručit je žadateli; jeho zrušení tuto povinnost i odpovídající záruku získání výstupu oslabuje. U § 181 odst. 2 se nahrazuje formulace „Má se za to, že žádost“ slovem „Žádost“; dodaný text neukazuje celé výsledné pravidlo, takže změnu jeho praktického účinku nelze určit. | ano: Upravuje podávání přes portál stavebníka a ukládání či doručování dokumentů a stanovisek, tedy části slibu o podání žádostí a získání výstupů.<br>Dopad: Dosavadní § 172 odst. 1 pouze umožňoval podání také přes portál; schválená verze přidává povinně digitální úkon pro podání s dokumentací pro povolení záměru a pro osoby s datovou schránkou, s uvedenými výjimkami. To posiluje digitální podávání pro tuto skupinu. Dřívější § 172 odst. 2 výslovně připouštěl podání elektronicky přes portál nebo listinně; novela tuto formulaci vypouští, ale z dodaného výňatku nelze určit, jaký režim ji nahrazuje. Původní § 172 odst. 4 ukládal vložit projektovou dokumentaci do elektronické evidence; schválená verze celý odstavec ruší, a tím tuto povinnost zmenšuje. Původní § 173 odst. 3 ukládal dotčenému orgánu vložit předem podané vyjádření či závazné stanovisko do evidence stavebních postupů a doručit je žadateli; novela odstavec ruší, takže tato povinnost slábne. V § 181 odst. 2 se formulace „Má se za to, že žádost“ mění na „Žádost“; pravidlo o doručení okamžikem odeslání zůstává podle dodaného znění věcně obdobné. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Změna přímo doplňuje do portálu stavebníka funkci sledování stavu řízení, tedy jednu z výslovně slíbených funkcí rozhraní.<br>Dopad: Dosavadní § 268 vyjmenovával úkony portálu a odkazoval podrobnosti jeho provozu na prováděcí předpis, ale službu sledování stavu řízení výslovně nestanovil. Nový odstavec tuto službu účastníkům řízení výslovně přidává, a rozšiřuje tak funkčnost portálu o část slibu. | ano: Přidává portálu stavebníka službu sledování stavu řízení, kterou slib výslovně uvádí.<br>Dopad: Dosavadní § 268 vyjmenovával funkce portálu, ale sledování stavu řízení mezi nimi nebylo. Nové ustanovení ukládá, aby portál tuto službu účastníkům řízení poskytoval; rozšiřuje tedy jeho funkce a naplňuje část slibu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Přechodné ustanovení výslovně umožňuje vedle zákonných informačních systémů používat dosavadní systémy a komunikační kanály, což se dotýká jednotnosti digitálního rozhraní.<br>Dopad: Schválené znění do uplynutí přechodného období dovoluje vedle nových systémů používat i jiné dosavadní informační systémy, datové schránky a jiné způsoby komunikace. Předchozí znění ustanovení není v balíčku uvedeno, takže směr změny vůči předchozímu pravidlu nelze určit; dodaný text však výslovně připouští souběh více kanálů po dobu přechodného období. | ano: Schválené přechodné pravidlo výslovně umožňuje používat vedle nových systémů také dosavadní systémy a způsoby komunikace, což se dotýká jednotnosti rozhraní.<br>Dopad: Schválená verze dovoluje do konce přechodného období používat vedle systémů podle stavebního zákona také jiné informační systémy, datové schránky a další způsoby komunikace. Předchozí znění ustanovení v balíčku chybí, takže nelze určit, jak se toto pravidlo oproti němu mění; pravidlo, jak je zde uvedeno, však po přechodnou dobu připouští souběh kanálů místo výhradního využití jednotného rozhraní. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o ochraně veřejného zdraví](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Změna ruší ustanovení, které umožňovalo podat přes portál žádost o stanovisko orgánu ochrany veřejného zdraví, a zároveň mění, jak se tato stanoviska ve stavebním řízení nahrazují.<br>Dopad: Dosavadní § 77 odst. 2 dovoloval podat přes portál žádost o stanovisko orgánu ochrany veřejného zdraví potřebné pro povolení záměru; schválené znění tento odstavec ruší a stanoví výjimku z působnosti orgánu v řízeních podle stavebního zákona. Dosavadní § 82b se vztahoval jen na vyhrazené stavby, zatímco nové znění stanoví, že stavební úřady rozhodnutím o záměru nahrazují příslušná stanoviska a další úkony obecně pro záměry povolované podle stavebního zákona. Samostatná cesta k podání a získání těchto stanovisek se tedy mění a zužuje; z dodaného textu ale nelze určit, jaké výstupy má slíbené rozhraní v novém režimu zpřístupňovat. | ano: Mění pravidla pro závazná stanoviska orgánu ochrany veřejného zdraví a pro jejich nahrazování rozhodnutím stavebního úřadu, což se dotýká slibu o kompletních výstupech včetně závazných stanovisek.<br>Dopad: Původní § 77 odst. 2 výslovně umožňoval podat žádost o stanovisko orgánu ochrany veřejného zdraví přes portál; schválená verze tento odstavec ruší, takže toto výslovné ustanovení o podání přes portál mizí. Schválená verze také vyjímá řízení podle stavebního zákona z pravidla § 77 odst. 1 o stanoviscích tohoto orgánu. Původní § 82b svěřoval nahrazování stanovisek stavebnímu úřadu jen u vyhrazených staveb dopravního a energetického stavebního úřadu; nová verze stanoví nahrazování pro záměry povolované podle stavebního zákona obecně. Změny tak rozšiřují případy, kdy stanoviska či jiné úkony nahrazuje rozhodnutí stavebního úřadu, a mění, jaké samostatné stanovisko bude mezi výstupy k dispozici. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o odpadech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389) | ano: Jde o žádost o povolení zařízení, které vyžaduje povolení podle stavebního zákona, a změna přímo ruší možnost podat ji prostřednictvím portálu stavebníka.<br>Dopad: Dosavadní § 21 odst. 2 zákona o odpadech výslovně umožňoval podat přes portál žádost o povolení provozu zařízení, pokud zařízení vyžadovalo povolení podle stavebního zákona. Zrušením poslední věty tato výslovná možnost odpadá, takže se zmenšuje rozsah žádostí, pro něž zákon zaručoval podání přes portál. | ano: Ruší výslovnou možnost podat přes portál žádost o povolení provozu zařízení, které potřebuje povolení podle stavebního zákona.<br>Dopad: Předchozí § 21 odst. 2 zákona o odpadech výslovně dovoloval podat přes portál stavebníka žádost o povolení provozu zařízení vyžadujícího povolení podle stavebního zákona. Novela tuto poslední větu ruší, takže výslovné oprávnění využít portál pro tento typ žádosti odpadá; z dodaného textu nelze určit, zda pro něj zůstane jiná možnost podání přes portál. |
| [Text usnesení vlády: Usnesení vlády č. 506/2026, XI. zpráva o realizaci Národního plánu obnovy](https://odok.gov.cz/portal/zvlady/usneseni/2026/506/) | ne: Text usnesení převádí prostředky na úhradu již vynaložených výdajů v rámci plánu obnovy, ale nepropojuje je se slíbeným jednotným rozhraním ani s jeho konkrétní funkcí. | ne: Usnesení rozděluje prostředky na obnovu a uvádí výdaje ministerstva na digitalizaci stavebního řízení, ale dodaný text je nespojuje s konkrétním jednotným rozhraním ze slibu. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Text usnesení vlády: Usnesení vlády č. 506/2026, XI. zpráva o realizaci Národního plánu obnovy

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna stavebního zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o ochraně veřejného zdraví](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o odpadech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280389)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279114)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=67)
- [Stanovisko vlády k návrhu zákona, který nepředložila (souhlas)](https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=67&CT1=1)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88252)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88454)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

