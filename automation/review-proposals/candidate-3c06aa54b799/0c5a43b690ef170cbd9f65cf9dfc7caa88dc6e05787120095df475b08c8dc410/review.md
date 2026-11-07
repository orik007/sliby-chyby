# Budování aktivních záloh

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

Vláda předložila změnu pravidel státního rozpočtu: ta sice rozšiřuje možnost financovat obranu nad 2 % HDP, ale zároveň ruší dosavadní možnost upravit výdajový rámec kvůli zhoršení bezpečnostní situace; poslanci ANO pro konečné znění hlasovali. Při projednávání rozpočtu na rok 2026 poslanci ANO nepodpořili návrh na zvýšení obranných výdajů o 21 miliard korun, který výslovně zmiňoval i přípravu záloh; rozpočet jako celek později podpořili. Ministerstvo obrany také vydalo vyhlášku upravující prohlídky žadatelů o vstup do aktivní zálohy, její dopad oproti dosavadním podmínkám ale z dodaných podkladů nelze určit. Celkové částky rozpočtu pro obranu ani předchozí znění pravidel pro tyto prohlídky zde nejsou uvedeny, takže výsledný dopad na slib nelze plně ověřit.

Co zůstává nejisté:

- Dodané části státního rozpočtu na rok 2026 odkazují na přílohy s rozpočtovými částkami, ale přílohy ani výdaje kapitoly Ministerstva obrany zde nejsou. Nelze proto posoudit dopad schváleného rozpočtu na přípravu armády.
- U vyhlášky o lékařských prohlídkách není dodáno předchozí znění pravidel. Není tedy možné ověřit, zda změna podmínky pro žadatele o aktivní zálohu jejich nástup usnadňuje, nebo ztěžuje.
- Změna rozpočtových pravidel současně rozšiřuje zvláštní možnost financovat obranu a ruší jinou možnost upravit výdajový rámec z bezpečnostních důvodů. Podklady neumožňují určit výsledný dopad těchto ustanovení na konkrétní počty vojáků nebo aktivní zálohy.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna rozpočtových pravidel](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00) | ano: Změna pravidel pro výdaje na obranu a zvláštní rozpočtová pravidla při zhoršené bezpečnostní situaci mohou ovlivnit financování přípravy armády.<br>Dopad: Dosavadní § 8 odst. 2 umožňoval upravit výdajový rámec také podle zhoršení bezpečnostní situace spojeného s opatřeními ke zvýšení obranyschopnosti; navržené znění tuto položku vypouští a váže výdaje na výdajový rámec. Schválené a vyhlášené znění však nově dovoluje pro roky 2026–2036 zvýšit výdaje o obranné výdaje nad 2 % HDP; předchozí znění tuto výjimku obsahovalo jen pro roky 2026–2033. To rozšiřuje možnost financovat obranu nad touto hranicí, ale současně zužuje dřívější možnost upravit rámec kvůli bezpečnostní situaci; celek má tedy smíšený účinek a sám nezajišťuje zvýšení počtu vojáků ani budování záloh. Nové zvláštní pravidlo dovoluje při vymezených bezpečnostních okolnostech překročit celkové výdaje až o 10 %; předchozí znění této části není v podkladech, takže směr této změny nelze určit. Výjimka pro dopravní a energetickou infrastrukturu se slibu netýká. | ano: Změna výdajových pravidel výslovně rozšiřuje prostor pro financování obrany, a tím se věcně dotýká přípravy armády, i když přímo nezmiňuje aktivní zálohu ani počet vojáků.<br>Dopad: Dosavadní pravidlo dovolovalo pro roky 2026 až 2033 zvýšit celkové výdaje o obranné výdaje nad 2 % HDP; schválené znění možnost prodlužuje do roku 2036 a přidává výjimku pro vyjmenované dopravní, vodní a energetické stavby. Obranný limit je tedy pro roky 2034 až 2036 volnější, ale změna sama nepřiděluje peníze na vojáky z povolání ani aktivní zálohu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Státní rozpočet obsahuje rozdělení výdajů podle kapitol, které může souviset s přípravou armády, ale poskytnutý text konkrétní částky neuvádí.<br>Dopad: Jde o nový státní rozpočet na rok 2026, nikoli o změnu dřívějšího znění. Dodané části pouze odkazují na přílohy s přehledem výdajů a ukazateli podle kapitol; hodnoty těchto příloh chybějí, takže nelze určit, jaké výdaje pro obranu rozpočet stanoví ani jak se vztahují k přípravě armády či k navýšení počtu vojáků. | ano: Státní rozpočet na rok 2026 se týká výdajů na obranu a jeho pozměňovací návrh výslovně spojil navýšení výdajů s přípravou záloh.<br>Dopad: Jde o nový státní rozpočet, nikoli o změnu dřívějšího znění zákona; dodaný výňatek pouze odkazuje na přehledy výdajů v přílohách a neuvádí konkrétní částky pro obranu. Pozměňovací návrh usiloval o navýšení výdajů kapitoly Ministerstva obrany o 21 miliard Kč, z toho 4,4 miliardy na rozvoj systému obrany státu, a výslovně zmiňoval přípravu záloh; protože návrh nebyl přijat, z poskytnutého znění nelze určit, jaké výdaje rozpočet nakonec na tento účel stanovil. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 105/2026 Sb., Vyhláška, kterou se mění vyhláška č. 288/2024 Sb.,  o zdravotní způsobilosti k výkonu vojenské činné služby a o rozsahu preventivní péče poskytované vojákům v činné službě nad rámec hrazených služeb z veřejného zdravotního pojištění](https://e-sbirka.gov.cz/sb/2026/105/0000-00-00) | ano: Vyhláška výslovně upravuje lékařské prohlídky občanů žádajících o zařazení do aktivní zálohy.<br>Dopad: Nové znění stanoví, že žadatel o zařazení do aktivní zálohy, který absolvoval prohlídku nejdéle pět let před podáním žádosti, nemusí znovu absolvovat vyšetření podle § 9 odst. 1 písm. c) až f). Předchozí znění těchto ustanovení v podkladech chybí, takže nelze určit, zda jde oproti němu o uvolnění, zpřísnění, nebo zachování podmínek. | ano: Vyhláška upravuje lékařské prohlídky občanů žádajících o zařazení do aktivní zálohy.<br>Dopad: Nové znění stanoví, že žadatel o zařazení do aktivní zálohy, který absolvoval prohlídku nejvýše pět let před podáním žádosti, nemusí podstoupit vyšetření uvedená v § 9 odst. 1 písm. c) až f). Předchozí znění tohoto ustanovení v balíčku chybí, takže nelze určit, zda se tím podmínky pro vstup do zálohy uvolnily, zpřísnily, nebo zůstaly stejné. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna rozpočtových pravidel](https://e-sbirka.gov.cz/sb/2026/155/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Předpis ve Sbírce zákonů: Vyhláška č. 105/2026 Sb., Vyhláška, kterou se mění vyhláška č. 288/2024 Sb.,  o zdravotní způsobilosti k výkonu vojenské činné služby a o rozsahu preventivní péče poskytované vojákům v činné službě nad rámec hrazených služeb z veřejného zdravotního pojištění](https://e-sbirka.gov.cz/sb/2026/105/0000-00-00)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=277454)
- [Text pozměňovacího návrhu 34 (sněmovní dokument 360)](https://www.psp.cz/sqw/text/orig2.sqw?idd=267639)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=90)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 34](https://public.psp.cz/sqw/hlasy.sqw?g=86873)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87430)
- [Vydání vyhlášky: Ministerstvo obrany po dohodě s Ministerstvem zdravotnictví](https://e-sbirka.gov.cz/sb/2026/105/0000-00-00)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88105)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88416)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

