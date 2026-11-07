# Osobní zdravotní asistent pro seniory

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

Vláda přijala plán přípravy nového zákona o sociálních službách, který počítá s rozvojem terénní péče, a ministerstvo vydalo vyhlášku rozšiřující úkony péče o zdraví a odbornou praxi v domácí péči. Jde o dílčí posun v domácí péči, nikoli o zavedení osobní zdravotní služby pro seniory ani o zrušení DPH na léky na předpis. Poslanci Motoristů většinově nepodpořili pozměňovací návrh na zdvojnásobení příspěvku pro část lidí odkázaných na nepobytovou péči; tento návrh se nestal součástí schváleného zákona. Dostupné podklady proto dokládají dílčí posun, ale neumožňují ověřit všechny části slibu.

Co zůstává nejisté:

- Balíček neobsahuje relevantní změnu ani jednání týkající se zrušení DPH na léky na předpis, takže tuto část slibu nelze posoudit.
- Doložená vyhláška rozšiřuje úkony péče a odbornou přípravu, ale balíček nedokládá zavedení samostatné služby osobního zdravotního asistenta určené seniorům.
- Text vládního stanoviska potvrzuje souhlas s návrhem zákona, ale dodaný výňatek navrženého znění je neúplný. U hlasování o variantách A4 a A5 není v dodaném výňatku zřejmé, které konkrétní ustanovení se hlasovalo.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o sociálních službách](https://www.psp.cz/sqw/text/orig2.sqw?idd=270377) | ano: Je relevantní pro domácí péči, protože pozměňovací návrh k novele navrhoval zvýšit příspěvek na péči lidem žijícím mimo pobytové služby, ale toto zvýšení se do schváleného znění nedostalo.<br>Dopad: Schválené znění § 21 nově ukládá žadateli označit osoby, které poskytují nebo budou poskytovat pomoc, uvést její rozsah a doložit jejich písemný souhlas; dodané předchozí znění tyto požadavky neobsahuje. Jde o přísnější administrativní povinnost, nikoli o vznik nároku na osobního zdravotního asistenta nebo rozvoj domácí péče. Pozměňovací návrh navíc navrhoval zvýšit příspěvek ve IV. stupni pro nepobytovou péči z 27 000 Kč na 54 000 Kč měsíčně, ale schválený text tuto změnu neobsahuje. | ne: Dodané změny řeší zejména postupy a odkazy v zákoně o sociálních službách, ale nedokládají zavedení osobního zdravotního asistenta, rozvoj domácí péče ani změnu DPH na léky. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 100/2026 Sb., Vyhláška,  kterou se mění vyhláška č. 505/2006 Sb., kterou se provádějí některá ustanovení zákona o sociálních službách, ve znění pozdějších předpisů](https://e-sbirka.gov.cz/sb/2026/100/0000-00-00) | ano: Vyhláška přímo rozšiřuje úkony péče o zdraví v sociálních službách a zavádí přípravu pracovníků zahrnující praxi v domácí péči.<br>Dopad: Vyhláška nově uvádí pomoc s užitím léku a s výměnou či vypuštěním sběrného sáčku mezi úkony péče o zdraví a stanoví specializovaný kurz s nejméně 12 hodinami praxe při poskytování domácí péče. Předchozí znění vyhlášky není v balíčku dodáno, takže směr změny vůči dosavadním pravidlům nelze z balíčku určit; doložené nové úkony a výcvik však představují dílčí rozvoj domácí péče. | ano: Vyhláška upravuje úkony péče o zdraví a odbornou přípravu pracovníků, včetně praxe v domácí péči, takže se týká části slibu o jejím rozvoji.<br>Dopad: Vyhláška nově popisuje pomoc při užívání léků a při manipulaci se sběrnými sáčky a stanoví specializovaný kurz včetně nejméně 12 hodin praxe v domácí péči. Předchozí znění vyhlášky balíček neobsahuje, takže nelze porovnat, jak se pravidla oproti dosavadnímu stavu změnila; přijaté znění však upravuje konkrétní úkony a přípravu pracovníků, které mohou domácí péči podpořit. |
| [Text usnesení vlády: Usnesení vlády č. 175/2026, Návrh Plánu legislativních prací vlády na zbývající část roku 2026 a návrh Výhledu legislativních prací vlády na léta 2027 až 2029 – Příloha č. 2, Ministr práce a sociálních věcí, úkol č. 3: Návrh zákona o sociálních službách](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/) | ano: Vládní plán výslovně počítá s návrhem zákona a klade důraz na rozvoj terénní a ambulantní péče.<br>Dopad: Usnesení ukládá připravit návrh nového zákona o sociálních službách a počítá mimo jiné s nástroji pro rozvoj terénních služeb a s podporou pečujících; další část plánu zdůrazňuje péči, která lidem umožní zůstat v přirozeném prostředí. Nejde o účinné rozšíření služby, ale o přípravu budoucí změny, která se týká části slibu o domácí péči. | ano: Vládní plán navrhuje připravit zákon zaměřený mimo jiné na rozvoj terénních služeb, a tím se týká části slibu o rozvoji domácí péče.<br>Dopad: Jde o návrh legislativní práce, nikoli o změnu již platného zákona. Plán ukládá připravit nový zákon, který má mimo jiné rozvíjet dostupnost terénních a ambulantních služeb a podporu pečujících osob; ve vztahu ke slibu je to návrh směřující k rozvoji domácí péče, nikoli již uskutečněná změna. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o sociálních službách](https://www.psp.cz/sqw/text/orig2.sqw?idd=270377)
- [Předpis ve Sbírce zákonů: Vyhláška č. 100/2026 Sb., Vyhláška,  kterou se mění vyhláška č. 505/2006 Sb., kterou se provádějí některá ustanovení zákona o sociálních službách, ve znění pozdějších předpisů](https://e-sbirka.gov.cz/sb/2026/100/0000-00-00)
- [Text usnesení vlády: Usnesení vlády č. 175/2026, Návrh Plánu legislativních prací vlády na zbývající část roku 2026 a návrh Výhledu legislativních prací vlády na léta 2027 až 2029 – Příloha č. 2, Ministr práce a sociálních věcí, úkol č. 3: Návrh zákona o sociálních službách](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/)
- [Text pozměňovacího návrhu A3 (sněmovní dokument 1035)](https://www.psp.cz/sqw/text/orig2.sqw?idd=269981)
- [Přijetí usnesení vládou](https://odok.gov.cz/portal/zvlady/usneseni/2026/175/)
- [Stanovisko vlády k návrhu zákona, který nepředložila (souhlas)](https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=125&CT1=1)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A3](https://public.psp.cz/sqw/hlasy.sqw?g=87390)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A4](https://public.psp.cz/sqw/hlasy.sqw?g=87391)
- [Hlasování Poslanecké sněmovny o pozměňovacím návrhu A5](https://public.psp.cz/sqw/hlasy.sqw?g=87392)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=87394)
- [Vydání vyhlášky: Ministerstvo práce a sociálních věcí](https://e-sbirka.gov.cz/sb/2026/100/0000-00-00)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

