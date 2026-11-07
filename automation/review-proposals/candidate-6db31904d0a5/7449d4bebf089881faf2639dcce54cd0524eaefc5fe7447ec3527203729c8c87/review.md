# Vyšší platy sociálních pracovníků

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

Vláda, v níž SPD působila, přijala nařízení s novými tarifními tabulkami pro zaměstnance ve veřejných službách a správě; podklady ale neobsahují starší tabulky, takže samotné zvýšení nelze ověřit jejich přímým srovnáním. Poslanci SPD zároveň nepodpořili pozměňovací návrhy k rozpočtu, které navrhovaly další prostředky na sociální služby a výslovně je spojovaly s financováním platů. SPD také hlasovala pro státní rozpočet, jehož konkrétní částky pro tyto služby v dodaném výňatku nejsou. Doložen je tedy možný posun v části týkající se platů, nikoli zvýšení odměn pěstounů; úplný závěr omezuje chybějící srovnání tarifů a rozpočtových částek.

Co zůstává nejisté:

- Dodaný text nařízení neobsahuje starší platové tabulky, takže není možné ověřit, o kolik se tarify sociálních pracovníků skutečně změnily ani zda se změna vztahuje na všechny sociální pracovníky.
- Výňatek ze státního rozpočtu odkazuje na přílohy s částkami, ale jejich obsah zde chybí; nelze proto určit, jaké prostředky rozpočet pro sociální služby skutečně schválil.
- Balíček nedokládá žádné rozhodnutí o zvýšení odměn pěstounů.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00) | ano: Rozpočet obsahuje výdajové kapitoly, jejichž navýšení pozměňovací návrhy výslovně spojovaly s financováním platů v sociálních službách, avšak dodaný text rozpočtu uvádí jen odkazy na přílohy.<br>Dopad: Jde o nový státní rozpočet, nikoli změnu dřívějšího zákona. Dodaný text říká, že přehled výdajů a ukazatele jsou v přílohách č. 3 a 4, ale jejich částky zde chybějí; z poskytnutého znění proto nelze určit, zda rozpočet financování platů sociálních pracovníků zvyšuje nebo snižuje. | ano: Jde o státní rozpočet na rok 2026 a pozměňovací návrhy k této předloze výslovně mířily na financování zvýšených platů a sociálních služeb.<br>Dopad: Jde o nový státní rozpočet, nikoli o změnu dřívějšího zákona; dodaný výňatek pouze odkazuje na přehledy výdajů v přílohách a neuvádí částky pro sociální služby ani platy. Konkrétní dopad schváleného rozpočtu na financování zvýšených platů proto z podkladů nelze určit. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákoníku práce](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ano: Návrh mění pravidla pro platové tarify zaměstnanců ve veřejných službách, a může tak zasahovat do platů části sociálních pracovníků.<br>Dopad: Dříve § 123 odst. 6 obsahoval zvláštní pravidla pro vyjmenované skupiny zaměstnanců a minimální tarify v jednotlivých třídách; návrh přidává mezi skupiny zaměstnance od 11. třídy a mění úpravu tarifních stupnic tak, že výslovně zaručuje nejméně tarif odpovídající minimální mzdě jen pro 1. třídu a 1. stupeň. To samo o sobě nezvyšuje platy sociálních pracovníků a oproti dřívějším minimům může uvolnit omezení pro ostatní třídy; dopad vloženého pravidla o nejméně čtyřprocentním rozdílu mezi třídami nelze porovnat, protože předchozí znění § 123 odst. 5 není dodáno. U některých nově zahrnutých zaměstnanců návrh zajišťuje, že zvláštním způsobem určený tarif nebude nižší než běžný tarif; příslušná ustanovení § 109a a část dalších změn nelze posoudit, protože jejich text je vynechán. | ne: Uvedené změny upravují obecná pravidla platových tarifů a zvláštní způsob jejich určení, ale text ani dodané podklady je přímo nespojují s platy sociálních pracovníků. |
| [Předpis ve Sbírce zákonů: Nařízení vlády č. 16/2026 Sb., Nařízení vlády, kterým se mění nařízení vlády č. 304/2014 Sb., o platových poměrech státních zaměstnanců, ve znění pozdějších předpisů, a nařízení vlády č. 341/2017 Sb., o platových poměrech zaměstnanců ve veřejných službách a správě, ve znění pozdějších předpisů](https://e-sbirka.gov.cz/sb/2026/16/0000-00-00) | ano: Nařízení stanoví nové platové tabulky pro státní zaměstnance a zaměstnance ve veřejných službách a správě, mezi nimiž mohou být sociální pracovníci.<br>Dopad: Nařízení nahrazuje tabulky tarifů obsažené v přílohách č. 1 až 3 nařízení č. 341/2017 Sb. a v příloze č. 1 nařízení č. 304/2014 Sb.; dodaný text uvádí nové částky, například v tabulkách pro zaměstnance ve veřejných službách, ale neobsahuje dosavadní tabulky. Samotné srovnání výše tarifů před změnou a po ní proto z balíčku nelze provést ani potvrdit směr změny. | ano: Nařízení stanoví nové platové tabulky pro zaměstnance veřejných služeb a podklady výslovně spojují jejich zvýšení také se sociálními pracovníky.<br>Dopad: Nařízení stanoví nové měsíční platové tarify v tabulkách pro zaměstnance veřejných služeb a správu. Předchozí znění těchto tabulek není u nařízení v balíčku uvedeno, takže samotné srovnání starých a nových částek a směr změny nelze z jeho textu ověřit; podklady k rozpočtovému pozměňovacímu návrhu však uvádějí zvýšení tabulek o 9 % a 5 %. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Vládní návrh zákona o státním rozpočtu České republiky na rok 2026](https://e-sbirka.gov.cz/sb/2026/38/0000-00-00)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákoníku práce](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436)
- [Předpis ve Sbírce zákonů: Nařízení vlády č. 16/2026 Sb., Nařízení vlády, kterým se mění nařízení vlády č. 304/2014 Sb., o platových poměrech státních zaměstnanců, ve znění pozdějších předpisů, a nařízení vlády č. 341/2017 Sb., o platových poměrech zaměstnanců ve veřejných službách a správě, ve znění pozdějších předpisů](https://e-sbirka.gov.cz/sb/2026/16/0000-00-00)
- [Text pozměňovacího návrhu 12 (sněmovní dokument 432)](https://www.psp.cz/sqw/text/orig2.sqw?idd=267901)
- [Text pozměňovacího návrhu 13 (sněmovní dokument 525)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268136)
- [Text pozměňovacího návrhu 63 (sněmovní dokument 504)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268092)
- [Text pozměňovacího návrhu 75 (sněmovní dokument 577)](https://www.psp.cz/sqw/text/orig2.sqw?idd=268274)
- [Přijetí nařízení vládou](https://e-sbirka.gov.cz/sb/2026/16/0000-00-00)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=94)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 12](https://public.psp.cz/sqw/hlasy.sqw?g=86835)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 12](https://public.psp.cz/sqw/hlasy.sqw?g=86847)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 13](https://public.psp.cz/sqw/hlasy.sqw?g=86848)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 63](https://public.psp.cz/sqw/hlasy.sqw?g=86902)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu 75](https://public.psp.cz/sqw/hlasy.sqw?g=86915)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=86957)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=300)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

