# Méně administrativy a výkaznictví pro učitele

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

Vláda, v níž SPD působí, předložila návrh zákona o registrech ve vzdělávání, který by vyňal údaje vedené v těchto registrech z části povinného předávání školních údajů; to částečně směřuje ke snížení administrativy. Ministerstvo obrany vydalo vyhlášku č. 111/2026 Sb., která mimo jiné upravuje zaznamenávání výchovných opatření a dokumentaci poradenských služeb ve školách. Ministerstvo školství vydalo vyhlášku č. 170/2026 Sb., jejíž dodané části upravují písemné záznamy a předávání informací o prevenci. U obou vyhlášek chybí předchozí znění dotčených ustanovení, takže nelze spolehlivě určit, zda jejich změny administrativní povinnosti zvyšují, nebo snižují; proto je závěr předběžný.

Co zůstává nejisté:

- U vyhlášky č. 111/2026 Sb. balíček neobsahuje předchozí znění měněných ustanovení. Nelze proto určit, zda povinnosti zaznamenávat výchovná opatření a vést dokumentaci představují nové či rozšířené povinnosti, nebo změnu dosavadní úpravy.
- U vyhlášky č. 170/2026 Sb. balíček neobsahuje předchozí znění měněných ustanovení. Nelze proto určit, zda uvedené písemné záznamy a předávání informací zvyšují administrativní zátěž oproti dosavadnímu stavu.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna školského zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=277289) | ano: Změna upravuje předávání údajů školami a výslovně vyjímá údaje vedené v registrech ve vzdělávání, což přímo souvisí s výkaznictvím škol.<br>Dopad: Dosavadní § 28 odst. 5 ukládal školám předávat stanovené údaje z dokumentace a školních matrik ministerstvu a v některých případech také krajským či obecním úřadům. Návrh doplňuje výjimku pro údaje vedené v registrech ve vzdělávání, takže předávací povinnost pro tuto skupinu údajů zužuje a částečně snižuje administrativní zátěž. | ano: Výjimka pro údaje vedené v registrech vzdělávání se týká povinnosti škol předávat údaje, a může tak omezit duplicitní výkaznictví.<br>Dopad: Před změnou školy předávaly ministerstvu údaje z dokumentace a školních matrik; nově se tato povinnost nevztahuje na údaje vedené v registrech vzdělávání. Povinnost se tedy v tomto rozsahu zužuje, což může omezit opakované předávání údajů. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 111/2026 Sb., Vyhláška, kterou se mění vyhláška č. 405/2024 Sb., o vzdělávání ve středních a vyšších odborných školách a o školských zařízeních zřizovaných Ministerstvem obrany](https://e-sbirka.gov.cz/sb/2026/111/0000-00-00) | ano: Dodané části vyhlášky upravují zaznamenávání výchovných opatření a dokumentaci poradenských služeb ve škole, tedy úkony související s evidencí a administrativou pedagogických pracovníků.<br>Dopad: Předchozí znění měněných ustanovení v balíčku chybí, takže nelze určit směr změny. Přijaté znění uvádí, že se výchovná opatření zaznamenávají do školní matriky nebo dokumentace domova mládeže a že škola vede dokumentaci o poradenských službách a podpůrných opatřeních. | ano: Ustanovení se týkají zaznamenávání výchovných opatření a dokumentace poradenských služeb, tedy administrativní práce ve škole.<br>Dopad: Předložený text ukládá zaznamenat výchovná opatření do školní matriky nebo dokumentace domova mládeže; znění dotčených ustanovení před změnou není v podkladech, takže nelze určit, zda se tím rozsah administrativy zvětšil, zmenšil, nebo nezměnil. |
| [Předpis ve Sbírce zákonů: Vyhláška č. 170/2026 Sb., Vyhláška, kterou se mění vyhláška č. 72/2005 Sb., o poskytování poradenských služeb ve školách a školských poradenských zařízeních, ve znění pozdějších předpisů](https://e-sbirka.gov.cz/sb/2026/170/0000-00-00) | ano: Vyhláška upravuje písemné záznamy školního metodika prevence a výchovného poradce i předávání informací o preventivních aktivitách, což se přímo dotýká školního výkaznictví a administrativy.<br>Dopad: Předchozí znění měněných ustanovení v balíčku chybí, takže nelze určit, zda vyhláška povinnosti rozšiřuje, zužuje, nebo pouze mění jejich podobu. Dodaný text požaduje písemné záznamy o činnosti výchovného poradce a školního metodika prevence a předávání informací prostřednictvím systému evidence preventivních aktivit. | ano: Text upravuje písemné záznamy o práci výchovného poradce a školního metodika prevence i předávání informací prostřednictvím systému evidence preventivních aktivit.<br>Dopad: Nové znění vyžaduje písemné záznamy o činnosti těchto pracovníků a předávání určitých informací prostřednictvím systému evidence preventivních aktivit; předchozí znění přílohy není v podkladech, a proto nelze určit, zda se administrativní povinnost změnila ani kterým směrem. |

### Zdroje použité při hodnocení

- [Původní volební slib](https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: Změna školského zákona](https://www.psp.cz/sqw/text/orig2.sqw?idd=277289)
- [Předpis ve Sbírce zákonů: Vyhláška č. 111/2026 Sb., Vyhláška, kterou se mění vyhláška č. 405/2024 Sb., o vzdělávání ve středních a vyšších odborných školách a o školských zařízeních zřizovaných Ministerstvem obrany](https://e-sbirka.gov.cz/sb/2026/111/0000-00-00)
- [Předpis ve Sbírce zákonů: Vyhláška č. 170/2026 Sb., Vyhláška, kterou se mění vyhláška č. 72/2005 Sb., o poskytování poradenských služeb ve školách a školských poradenských zařízeních, ve znění pozdějších předpisů](https://e-sbirka.gov.cz/sb/2026/170/0000-00-00)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=228)
- [Vydání vyhlášky: Ministerstvo obrany](https://e-sbirka.gov.cz/sb/2026/111/0000-00-00)
- [Vydání vyhlášky: Ministerstvo školství, mládeže a tělovýchovy](https://e-sbirka.gov.cz/sb/2026/170/0000-00-00)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

