# Vyrovnané či přebytkové rozpočty v období růstu

> Nezveřejněný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

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

Vláda předložila změnu rozpočtových pravidel a poslanci SPD ji podpořili; nová pravidla mění výdajové limity, ale výslovně nezavádějí vyrovnané či přebytkové rozpočty při růstu. Poslanci SPD také hlasovali pro státní rozpočet na rok 2026 se schodkem 310 miliard Kč a vláda předložila na rok 2027 návrh se schodkem 386 miliard Kč. To jsou známky postupu proti slibu, pokud v těchto letech ekonomika poroste. Dodané podklady však neukazují, zda ekonomika v letech 2026 a 2027 roste, takže rozpor s podmínkou slibu nelze potvrdit.

Co zůstává nejisté:

- Balíček neobsahuje údaj o tom, zda ekonomika v letech 2026 a 2027 roste; bez něj nelze rozhodnout, zda schodkové rozpočty porušují výslovně podmíněnou část slibu.
- Změny pravidel rozpočtové odpovědnosti mění výdajové limity a výjimky, ale jejich dopad na dosažení vyrovnaných či přebytkových rozpočtů při růstu z textu samotného nelze určit.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Návrh poslanců Radka Vondráčka, Andreje Babiše, Tomia Okamury, Petra Macinky, Marka Bendy, Taťány Malé, Radima Fialy a Borise Šťastného na vydání zákona, kterým se mění zákon č. 90/1995 Sb., o jednacím řádu Poslanecké sněmovny, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=278476) | ne: Změny jednacího řádu upravují postup a řečnická práva ve Sněmovně, nikoli pravidla pro vyrovnané či přebytkové rozpočty. | ne: Návrh mění jednací řád Sněmovny, nikoli pravidla rozpočtové odpovědnosti ani vyrovnanost rozpočtů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna rozpočtových pravidel](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00) | ano: Mění pravidla, podle nichž se stanovují celkové výdaje státního rozpočtu, což přímo souvisí s prosazováním rozpočtové odpovědnosti.<br>Dopad: Dříve se celkové výdaje státního rozpočtu odvozovaly od vládou schváleného výdajového rámce a upravovaly se mimo jiné podle cyklicky očištěných příjmů a vyjmenovaných výjimek; nově se výdaje státního rozpočtu a státních fondů stanovují v souladu s výdajovým rámcem pro následující rok. Schválená a vyhlášená verze navíc umožňuje rámec pro roky 2026–2036 navýšit o obranné výdaje nad 2 % HDP a o výdaje na vyjmenovanou dopravní, vodní a energetickou infrastrukturu; Senát u infrastruktury přidal podmínku projednání a hranici 1 % HDP, po jejíž překročení se výdaje teprve započítávají do navýšení. Tato pravidla nestanovují vyrovnaný či přebytkový rozpočet v době růstu a z dodaného textu nelze určit, zda celkově zpřísňují nebo uvolňují právě takovou povinnost. | ano: Mění pravidla pro určování výdajů státního rozpočtu a zavádí výjimky, které mohou umožnit výdaje nad běžným výdajovým rámcem.<br>Dopad: Dříve se výdaje státního rozpočtu určovaly podle výdajového rámce s úpravami mimo jiné o hospodářský cyklus a mimořádné vlivy; nově se stanoví v souladu s rámcem, ale lze jej navýšit o obranné výdaje nad 2 % HDP a o vyjmenované výdaje na dopravní, vodní a energetickou infrastrukturu. Rozsah povolených výdajů se tím u těchto položek rozšiřuje, takže omezení výdajů je volnější; balíček však neumožňuje spočítat celkový dopad změněného rámce. Nová pravidla také dovolují za určitých bezpečnostních okolností překročit výdaje státního rozpočtu až o 10 %; předchozí znění této části zákona v balíčku chybí, takže směr změny vůči staré úpravě nelze přesně určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o rozpočtových pravidlech územních rozpočtů](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00) | ne: Část o územních rozpočtech rozšiřuje především výjimky pro financování projektů a plnění rozhodnutí orgánů veřejné moci, nestanoví však pravidlo vyrovnaného či přebytkového rozpočtu v období růstu. | ano: Mění podmínky, za nichž mohou obce a kraje schválit schodkový rozpočet, tedy část pravidel pro vyrovnanost veřejných rozpočtů.<br>Dopad: Dříve mohl územní samosprávný celek při uplatnění pravidel rozpočtové odpovědnosti schválit schodek jen při úhradě penězi z minulých let nebo návratnou finanční výpomocí; úvěr či půjčka byly povoleny pouze pro předfinancování projektů EU. Nově se výjimky rozšiřují také na financování z mechanismů EHP a Norska a ze švýcarsko-českého programu a na plnění rozhodnutí soudu či jiného orgánu veřejné moci. Omezení schodkových rozpočtů se tím v těchto případech uvolňuje. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o pravidlech rozpočtové odpovědnosti](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00) | ano: Mění zákonný rámec rozpočtové odpovědnosti a způsob odvozování výdajových limitů, tedy pravidla přímo související s rozpočtovou kázní.<br>Dopad: Předchozí znění odvozovalo celkové výdaje sektoru veřejných institucí z příjmů očištěných o hospodářský cyklus a stanovilo pro některé roky limit 1,75 %, 1,25 % HDP a další hodnoty; upravovalo také nápravnou složku a výdajový rámec. Nové znění odvozuje rámec od primárního strukturálního salda a pravidel čistých výdajů, zavádí únikové doložky pro bezpečnostní výdaje, katastrofy a závažné zhoršení ekonomiky a mění možnosti úprav výdajového rámce. Změna se týká rozpočtových omezení, ale její text nepřikazuje vyrovnané ani přebytkové rozpočty při růstu; směr jejího vlivu na tuto konkrétní povinnost proto nelze z balíčku určit. | ano: Nahrazuje dosavadní výpočet výdajových limitů novým rámcem založeným na primárním strukturálním saldu a upravuje výjimky z rozpočtových omezení.<br>Dopad: Dříve se celkové výdaje sektoru veřejných institucí omezovaly podle příjmů upravených o hospodářský cyklus a jednorázové vlivy, s limitem vyjádřeným podílem HDP; nově se výdajový rámec odvozuje od primárního strukturálního salda a evropského plánu čistých výdajů. Balíček neobsahuje hodnoty potřebné k porovnání přísnosti těchto dvou výpočtů jako celku. Nová úniková pravidla dovolují zohlednit řadu krizových a mimořádných výdajů a výdajový rámec lze při změně státního rozpočtu v určitých případech navýšit; pravidlo tak obsahuje výjimky, které jeho omezení uvolňují, ale samo nezavádí povinnost vyrovnaného či přebytkového rozpočtu v době růstu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Zákon stanoví příjmy a výdaje státního rozpočtu na rok 2026, takže přímo ukazuje jeho plánované saldo.<br>Dopad: Jde o nový zákon bez předchozího znění, který pro rok 2026 stanoví příjmy přibližně 2,118 bilionu Kč, výdaje přibližně 2,428 bilionu Kč a schodek 310 miliard Kč. Pokud by rok 2026 byl obdobím ekonomického růstu, schodkový rozpočet by byl v rozporu s příslibem vyrovnaného či přebytkového rozpočtu; dodané podklady však růst ekonomiky nedokládají. | ano: Státní rozpočet na rok 2026 stanoví konkrétní příjmy, výdaje a schodek, a proto přímo ukazuje plánovaný rozpočtový výsledek.<br>Dopad: Jde o nový zákon o státním rozpočtu, nikoli změnu dřívějšího znění. Pro rok 2026 stanoví příjmy 2 117,8 mld. Kč, výdaje 2 427,8 mld. Kč a schodek 310 mld. Kč; pokud by šlo o období ekonomického růstu, schodkový rozpočet by byl v rozporu se slibem vyrovnaných či přebytkových rozpočtů. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2027](https://www.psp.cz/sqw/text/orig2.sqw?idd=280787) | ano: Návrh státního rozpočtu na rok 2027 přímo stanoví plánované příjmy, výdaje a saldo.<br>Dopad: Jde o nový návrh rozpočtu bez předchozího znění: pro rok 2027 počítá s příjmy přibližně 2,199 bilionu Kč, výdaji přibližně 2,585 bilionu Kč a schodkem 386 miliard Kč. Pokud by rok 2027 byl obdobím ekonomického růstu, návrh by odporoval slibu vyrovnaného či přebytkového rozpočtu; balíček ale nedokládá, zda v tomto roce ekonomika poroste. | ano: Vládní návrh rozpočtu na rok 2027 stanoví plánovaný schodek, který je v případě ekonomického růstu v rozporu se slibovaným pravidlem.<br>Dopad: Jde o nový návrh státního rozpočtu, nikoli změnu dřívějšího znění. Návrh na rok 2027 počítá s příjmy 2 198,6 mld. Kč, výdaji 2 584,6 mld. Kč a schodkem 386 mld. Kč; při ekonomickém růstu by takový plán neodpovídal slibu vyrovnaného či přebytkového rozpočtu. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Návrh poslanců Radka Vondráčka, Andreje Babiše, Tomia Okamury, Petra Macinky, Marka Bendy, Taťány Malé, Radima Fialy a Borise Šťastného na vydání zákona, kterým se mění zákon č. 90/1995 Sb., o jednacím řádu Poslanecké sněmovny, ve znění pozdějších předpisů

### Zdroje použité při hodnocení

- [Původní volební slib](https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna rozpočtových pravidel](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o rozpočtových pravidlech územních rozpočtů](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o pravidlech rozpočtové odpovědnosti](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2027](https://www.psp.cz/sqw/text/orig2.sqw?idd=280787)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=277454)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=90)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87430)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88105)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88416)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=324)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

