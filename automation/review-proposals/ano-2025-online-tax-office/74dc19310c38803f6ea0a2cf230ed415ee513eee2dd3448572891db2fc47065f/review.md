# Dokončení on-line finančního úřadu s mobilní aplikací

> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.

## Návrh pro veřejný web

Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.

### Hodnocení

**Směřuje ke splnění (+1)**

### Vysvětlení

Vláda ANO předložila nový zákon, který zavádí elektronické zasílání údajů o evidovaných tržbách a zpřístupňuje informace o nich přes daňovou informační schránku. Poslanci ANO zákon podpořili při schvalování i při rozhodování po jeho vrácení Senátem, tedy horní komorou Parlamentu. Jde o posun v elektronické daňové komunikaci, která je částí slíbené on-line agendy, nikoli však o dokončení přehledného on-line finančního úřadu. Dodané podklady nedokládají jeho dokončení ani vznik mobilní aplikace.

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

- Podklady neukazují, zda už existuje nebo se dokončuje přehledné rozhraní on-line finančního úřadu ani slíbená mobilní aplikace.
- Zákon o evidenci tržeb dokládá pouze dílčí elektronickou komunikaci a poskytování údajů přes daňovou informační schránku; z podkladů nelze určit, zda se tyto funkce začlení do slíbeného finančního úřadu.

Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.

### Souvisí změny zákonů se slibem?

| Změna zákona | První posudek | Druhý posudek |
| --- | --- | --- |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce](https://www.psp.cz/sqw/text/orig2.sqw?idd=268960) | ne: Změna upravuje elektronická potvrzení atributů a digitální peněženku, ale dodané znění ji nespojuje s daňovou agendou ani finančním úřadem. | ne: Návrh upravuje elektronickou peněženku a služby důvěry, ale text jej nespojuje s daňovou agendou ani s projektem on-line finančního úřadu. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=269547) | ne: Změna odstraňuje některé údaje pro elektronickou identifikaci ze základních registrů, avšak balíček nedokládá, že se to týká přístupu k on-line finančnímu úřadu. | ne: Změna odstraňuje některé údaje a možnosti elektronické identifikace ze základních registrů, avšak podklady neukazují, že by tím přímo měnila nebo omezovala slíbený on-line finanční úřad. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech](https://www.psp.cz/sqw/text/orig2.sqw?idd=280625) | ne: Změna zavádí testovací identity a údaje pro zkoušení informačních systémů, nikoli funkci daňové agendy nebo mobilní aplikaci. | ne: Ustanovení vytváří testovací identity a údaje pro základní registry a agendové systémy, ale nespojuje testování s daňovou agendou ani slíbeným projektem. |
| [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ano: Nový zákon o evidenci tržeb rozšiřuje elektronické vyřizování daňových záležitostí a poskytování údajů přes daňovou informační schránku, což představuje část slíbené on-line daňové agendy.<br>Dopad: Jde o nový zákon, takže balíček nedodává předchozí znění, s nímž by šlo změnu porovnat; zákon nově ukládá evidovat určené tržby zasláním datové zprávy správci daně nejpozději při jejich uskutečnění, při překročení doby odezvy nejpozději do 48 hodin, a ukládá správci daně poskytovat evidujícím poplatníkům údaje o jejich tržbách prostřednictvím daňové informační schránky. Tím přidává elektronické daňové úkony a přístup k údajům, ale nezřizuje slíbený přehledný on-line finanční úřad ani mobilní aplikaci. | ano: Nový zákon zavádí elektronické předávání údajů o tržbách a poskytování informací o nich přes daňovou informační schránku, což představuje konkrétní, byť dílčí část on-line daňové agendy.<br>Dopad: Jde o nový zákon, takže podklady nedávají předchozí znění, s nímž by šlo nové povinnosti přímo porovnat. Zavádí evidenci vymezených tržeb s automatizovaným sběrem údajů: poplatník získává certifikát přes daňovou informační schránku a zasílá údaje správci daně elektronickou datovou zprávou ve formátu XML; při překročení doby odezvy je musí odeslat nejpozději do 48 hodin. Správce daně má přes schránku poskytovat informace o evidovaných tržbách a za porušení povinností může být uložena pokuta až 500 000 Kč. Pro slib to podporuje elektronickou dostupnost jedné části daňových informací, ale současně zavádí evidenční povinnosti a nedokládá jednodušší či přehlednější agendu ani mobilní aplikaci. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002) | ne: Změny zákona o daních z příjmů upravují zejména slevy a přirážku související s evidencí tržeb, ale samy nezavádějí ani nemění slíbené on-line daňové rozhraní. | ne: Změna zákona o daních z příjmů upravuje zejména daňové slevy, příplatky a osvobození; podklady neukazují, že by tyto úpravy samy zajišťovaly slíbený on-line finanční úřad nebo jeho mobilní aplikaci. |
| [Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů](https://www.psp.cz/sqw/text/orig2.sqw?idd=279436) | ne: Navržené změny upravují náhrady, daňové bonusy a oznamovací povinnosti v daních z příjmů, nikoli uživatelskou on-line daňovou agendu nebo její mobilní aplikaci. | ne: Změny daně z příjmů se týkají náhrad za účast na úředním úkonu, daňových bonusů a oznamování údajů, nikoli slíbené on-line daňové agendy. |

Oba hodnotitelé tyto změny shodně označili za nesouvisející, proto je další balíčky tohoto slibu vynechají, dokud se nezmění jejich text, kontext, znění slibu nebo pokyny hodnotitelů:

- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o službách vytvářejících důvěru pro elektronické transakce
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o základních registrech
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů
- Změna zákona v návrhu projednávaném Sněmovnou: Změna zákona o daních z příjmů

### Zdroje použité při hodnocení

- [Původní volební slib](https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf)
- [Změna zákona v návrhu projednávaném Sněmovnou: EVIDENCE TRŽEB](https://www.psp.cz/sqw/text/orig2.sqw?idd=280002)
- [Usnesení Senátu, kterým vrátil návrh Sněmovně](https://www.psp.cz/sqw/text/orig2.sqw?idd=279108)
- [Průběh projednávání návrhu ve Sněmovně](https://public.psp.cz/sqw/historie.sqw?o=10&t=189)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88356)
- [Výsledek hlasování Poslanecké sněmovny](https://public.psp.cz/sqw/hlasy.sqw?g=88456)

Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.

