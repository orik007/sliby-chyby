# 2025 promise category audit

## Status

This is a research proposal. It does not change public promise records, the public site, or the promise-selection rule. Every row in the generated audit is explicitly pending item-level review; a chapter-level proposal is not a completed category decision.

## Finding

The current `category` field is a source label rather than a policy category. It is `Volební program 2025` for every confirmed SPD and Motoristé promise and for 334 of 356 confirmed ANO promises. It cannot group promises by subject.

The current record text also sometimes contains a source heading followed by a commitment. For example, the Motoristé programme has the heading `Kyberbezpečnost a moderní hrozby` followed by the sentence `Posílíme kapacity NÚKIB a dalších složek kybernetické bezpečnosti.` These are distinct source elements and must not be displayed as one promise title.

## Proposed two-layer model

Every promise should eventually have both fields below. The common category supports comparison across parties. The source section preserves the party's own programme organisation. Neither field changes the original source, party, locator, lifecycle, or assessment.

| Field | Purpose | Example for the NÚKIB promise |
| --- | --- | --- |
| `policyCategoryId` | Controlled common category for every party | `security-defence-and-migration` |
| `programmeChapter` | Major chapter in the original party programme, retained as source context | `Spravedlnost a bezpečnost: stát, který chrání, ne šikanuje` |
| `sourceSection` | Exact relevant heading in the original party programme | `Kyberbezpečnost a moderní hrozby` |
| `sourceSectionOrder` | Position of the source section in the programme | programme order |
| `sourceOrder` | Position of the promise within that section | source order |

The later public list should group by `policyCategoryId`, show the source section as context, and order promises by source order. It must not claim an unverified editorial ranking of the individual promises. `sourceSection`, `sourceSectionOrder`, and `sourceOrder` remain `null` in an audit row until a reviewer records the corresponding source-level decision.

## Proposed common categories

The IDs are stable English identifiers; labels shown to readers can remain Czech.

| Order | ID | Czech label |
| ---: | --- | --- |
| 1 | `public-finance-and-taxes` | Veřejné finance a daně |
| 2 | `economy-business-and-innovation` | Ekonomika, podnikání a inovace |
| 3 | `work-social-affairs-and-pensions` | Práce, sociální věci a důchody |
| 4 | `health-and-care` | Zdravotnictví a péče |
| 5 | `housing-and-regional-development` | Bydlení a regionální rozvoj |
| 6 | `education-science-and-sport` | Vzdělávání, věda a sport |
| 7 | `culture-and-media` | Kultura a média |
| 8 | `transport-and-infrastructure` | Doprava a infrastruktura |
| 9 | `energy-climate-and-environment` | Energie, klima a životní prostředí |
| 10 | `agriculture-and-food` | Zemědělství a potraviny |
| 11 | `security-defence-and-migration` | Bezpečnost, obrana a migrace |
| 12 | `justice-democracy-and-rights` | Právo, demokracie a svobody |
| 13 | `state-and-digital-public-services` | Stát a digitální veřejné služby |
| 14 | `eu-and-foreign-policy` | Evropská a zahraniční politika |

## Official programme structure mapped to common categories

The mapping below is a chapter-level starting point, not an automatic assignment. A chapter may contain a promise that belongs to a neighbouring common category; such promises require an explicit promise-level decision.

### ANO 2011

The ANO programme is already divided into clear policy chapters. The chapter order is a useful source-order signal.

| Source chapter | Common category |
| --- | --- |
| Finance a hospodaření státu | `public-finance-and-taxes` |
| Hospodářství, průmysl a energetika | `economy-business-and-innovation` or `energy-climate-and-environment` |
| Zdravotnictví | `health-and-care` |
| Sociální politika | `work-social-affairs-and-pensions` |
| Doprava | `transport-and-infrastructure` |
| Vnitro | `security-defence-and-migration` |
| Vzdělávání | `education-science-and-sport` |
| Bydlení a regionální rozvoj | `housing-and-regional-development` |
| Životní prostředí | `energy-climate-and-environment` |
| Obrana | `security-defence-and-migration` |
| Zemědělství | `agriculture-and-food` |
| Spravedlnost | `justice-democracy-and-rights` |
| Digitalizace | `state-and-digital-public-services` |
| Zahraniční politika | `eu-and-foreign-policy` |
| Kultura | `culture-and-media` |
| Sport | `education-science-and-sport` |
| Ochrana spotřebitele | `economy-business-and-innovation` |
| Věda a výzkum | `education-science-and-sport` or `economy-business-and-innovation` |
| Krypto & fintech | `economy-business-and-innovation` |

### SPD

SPD explicitly describes the programme as fifteen programme areas. Its numbered areas provide the source sections; its separate electoral ten-point list must not replace the detailed source section of a promise.

| Source chapter | Common category |
| --- | --- |
| Levné potraviny a potravinová bezpečnost | `agriculture-and-food` |
| Nízké ceny energií, konec Green Dealu a emisních povolenek | `energy-climate-and-environment` |
| Spravedlivé důchody a pomoc zdravotně postiženým | `work-social-affairs-and-pensions` |
| Dostupné bydlení a sociální politika | `housing-and-regional-development` or `work-social-affairs-and-pensions` |
| Práce pro naše občany, férové mzdy, omezení levné pracovní síly z ciziny | `work-social-affairs-and-pensions` |
| Dostupné zdravotnictví a léky | `health-and-care` |
| Zahraniční politika bez války a zbytečných výdajů na zbrojení | `eu-and-foreign-policy` or `security-defence-and-migration` |
| Bezpečnost, ochrana hranic, migrace | `security-defence-and-migration` |
| Stop cenzuře, spravedlnost a svoboda projevu | `justice-democracy-and-rights` |
| Zákon o referendu | `justice-democracy-and-rights` |
| Ekonomika, daně a finance – konec zadlužování | `public-finance-and-taxes` or `economy-business-and-innovation` |
| Školství, vlastenecká výchova a sport | `education-science-and-sport` |
| Doprava a infrastruktura | `transport-and-infrastructure` |
| Kultura a média | `culture-and-media` |
| Veřejná správa – efektivní stát ve službách občanů | `state-and-digital-public-services` |

### Motoristé sobě

The Motoristé programme has major chapters and smaller headings. Both must be retained: the major chapter can guide the common category and the smaller heading often supplies necessary context for an individual promise.

| Source chapter | Common category |
| --- | --- |
| Stojíme na straně podnikatelů | `economy-business-and-innovation` |
| Konsolidace veřejných financí: do čtyř let vyrovnaný rozpočet | `public-finance-and-taxes` |
| Geopolitické ukotvení České republiky | `eu-and-foreign-policy` |
| Školství: návrat vzdělanosti, kvality a řemesla | `education-science-and-sport` |
| Podpora bydlení a rozvoj stavebnictví | `housing-and-regional-development` |
| Český průmysl jako základ prosperity a stability | `economy-business-and-innovation` |
| Levné energie? Budoucnost je v jádru, ale fosilní zdroje jsou zatím nenahraditelné | `energy-climate-and-environment` |
| Motorismus, svoboda pohybu a doprava / Železnice | `transport-and-infrastructure` |
| Pragmatická ochrana přírody místo zeleného extremismu | `energy-climate-and-environment` |
| Stabilní a špičkové zdravotnictví pro všechny generace | `health-and-care` |
| Úcta k seniorům a spravedlnost v sociální péči | `work-social-affairs-and-pensions` |
| Zemědělství: zdravý rozum místo ideologie | `agriculture-and-food` |
| Spravedlnost a bezpečnost: stát, který chrání, ne šikanuje | `security-defence-and-migration` or `justice-democracy-and-rights` |
| Digitální stát, který šetří čas i peníze občanů | `state-and-digital-public-services` |
| Bohatá kultura bez politických filtrů | `culture-and-media` |
| Armáda pro obranu, ne pro útok | `security-defence-and-migration` |

## Required promise-level audit

Chapter mapping cannot be copied to every promise without review. The confirmed catalogue contains mixed-subject chapters and introductory pages. Examples include ANO's economy-and-energy chapter, SPD's housing-and-social-policy chapter, and Motoristé promises whose extracted text contains a smaller heading. The generated research artifact lists every confirmed promise with:

1. its proposed common category;
2. its exact source section and section order;
3. a possible heading-prefix hint, which is not treated as exhaustive;
4. an explicit pending reviewer-decision field; and
5. `requiresItemReview: true`.

No public promise record should be changed until that list is complete and reviewed.
