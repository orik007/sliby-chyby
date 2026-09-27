# Zavedení Digitální daňové kobry

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda předložila smlouvy s Tanzanií a Argentinou, které počítají s výměnou daňových informací a opatřeními proti daňovým únikům. Předložila také návrh na automatické oznamování transakcí s kryptoaktivy pro správu daní. Poslanci ANO hlasovali pro zákon o evidenci tržeb, který zavádí automatizované zjišťování údajů a jejich využití k ověřování daňových povinností; po vrácení návrhu Senátem podpořili zachování sněmovního znění. Jde o dílčí kroky k získávání a využívání daňových údajů, nikoli o doložené zavedení slibovaného analytického systému s umělou inteligencí.

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

- Podklady nedokládají, zda byl skutečně zaveden systém Digitální daňové kobry ani zda používá pokročilé analytické nástroje a umělou inteligenci; doložené kroky proto potvrzují jen dílčí posun.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o dohledu v oblasti kapitálového trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=271819) | ne: Změna upravuje dohled nad kapitálovým trhem, ale nestanoví sběr ani analytické vyhodnocování údajů k odhalování fiktivních obchodů či daňové optimalizace. | ano: Novela umožňuje určité zapojení správce daně do komunikace s dohledem nad kapitálovým trhem, což může podpořit předávání informací pro odhalování daňových praktik, ale nezavádí analytické nástroje ani umělou inteligenci. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi vládou České republiky a vládou Tanzanské sjednocené republiky o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Dar es Salaam dne 14. května 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=266872) | ano: Navržená smlouva s Tanzanií umožňuje výměnu daňových informací a odmítnutí výhod při zneužívajících uspořádáních, což může pomoci odhalovat daňové úniky a nezákonnou optimalizaci. | ano: Smlouva s Tanzanií upravuje výměnu daňových informací a výslovně míří na daňové úniky a vyhýbání se daňové povinnosti, tedy na část cíle slibu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 164/2013 Sb., o mezinárodní spolupráci při správě daní a o změně dalších souvisejících zákonů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=267358) | ano: Návrh zavádí automatické oznamování údajů o transakcích s kryptoaktivy a jejich uchovávání pro správu daní, tedy zdroj údajů využitelný při odhalování daňových úniků. | ano: Návrh zavádí automatické oznamování údajů o transakcích s kryptoaktivy a jejich předávání správci daně, což může poskytnout podklady k odhalování daňových úniků či optimalizací. |
| [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Zákon zavádí automatizované shromažďování údajů o evidovaných tržbách a výslovně je spojuje s účinnějším ověřováním daňových povinností. | ano: Evidence tržeb má automatizovaně shromažďovat údaje o tržbách a zefektivnit ověřování daňových povinností, což představuje část kontroly, kterou slib předpokládá. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Finanční správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Změna umožňuje finanční správě získávat údaje od daňových subjektů při plnění povinností evidence tržeb, což je relevantní podpůrný zdroj údajů pro daňovou kontrolu. | ano: Změna upravuje pravomoci Finanční správy při získávání údajů od daňových subjektů pro evidenci tržeb, a může tak podpořit ověřování jejich daňových povinností. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Celní správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ne: Změna pouze svěřuje celní správě kontrolu a sankcionování povinností evidence tržeb, ale neřeší zjišťování ani analýzu fiktivních obchodů či nezákonné daňové optimalizace. | ano: Změna svěřuje Celní správě kontrolu evidence tržeb a ukládání pokut, čímž posiluje kontrolní část slibu, nikoli však jeho analytickou či umělou inteligencí podporovanou část. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Argentinskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti a Protokol k ní, které byly podepsány v Buenos Aires dne 14. dubna 2026](https://www.psp.cz/sqw/text/orig2.sqw?idd=278338) | ano: Navržená smlouva s Argentinou upravuje výměnu daňových informací a obsahuje ustanovení proti vyhýbání se daňové povinnosti, což může přispět k odhalování daňových úniků. | ano: Smlouva s Argentinou umožňuje výměnu daňových informací a obsahuje ustanovení proti daňovým únikům a vyhýbání se daňové povinnosti, což odpovídá části cíle slibu. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o dohledu v oblasti kapitálového trhu](https://www.psp.cz/sqw/text/orig2.sqw?idd=271819)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi vládou České republiky a vládou Tanzanské sjednocené republiky o zamezení dvojímu zdanění v oboru daní z příjmu a o zabránění daňovému úniku a vyhýbání se daňové povinnosti, která byla podepsána v Dar es Salaam dne 14. května 2025](https://www.psp.cz/sqw/text/orig2.sqw?idd=266872)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona, kterým se mění zákon č. 164/2013 Sb., o mezinárodní spolupráci při správě daní a o změně dalších souvisejících zákonů, ve znění pozdějších předpisů](https://www.psp.cz/sqw/text/orig2.sqw?idd=267358)
- [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Finanční správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o Celní správě České republiky](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Smlouva mezi Českou republikou a Argentinskou republikou o zamezení dvojímu zdanění v oboru daní z příjmu a z majetku a o zabránění daňovému úniku a vyhýbání se daňové povinnosti a Protokol k ní, které byly podepsány v Buenos Aires dne 14. dubna 2026](https://www.psp.cz/sqw/text/orig2.sqw?idd=278338)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279108)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=84)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=98)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=189)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87503)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=256)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88356)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88456)

