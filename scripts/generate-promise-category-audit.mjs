import { readFile, writeFile } from "node:fs/promises";

const inputPath = new URL("../research/2025-election/promises.json", import.meta.url);
const outputPath = new URL("../research/2025-election/promise-category-audit.json", import.meta.url);

const programmeMaps = {
  ano: [
    [3, 3, "Úvod", null, true],
    [4, 5, "Finance a hospodaření státu", "public-finance-and-taxes", false],
    [6, 7, "Hospodářství, průmysl a energetika", "economy-business-and-innovation", true],
    [8, 9, "Zdravotnictví", "health-and-care", false],
    [10, 11, "Sociální politika", "work-social-affairs-and-pensions", false],
    [12, 13, "Doprava", "transport-and-infrastructure", false],
    [14, 16, "Vnitro", "security-defence-and-migration", false],
    [17, 18, "Vzdělávání", "education-science-and-sport", false],
    [19, 20, "Bydlení a regionální rozvoj", "housing-and-regional-development", false],
    [21, 22, "Životní prostředí", "energy-climate-and-environment", false],
    [23, 24, "Obrana", "security-defence-and-migration", false],
    [25, 26, "Zemědělství", "agriculture-and-food", false],
    [27, 28, "Spravedlnost", "justice-democracy-and-rights", false],
    [29, 29, "Digitalizace", "state-and-digital-public-services", false],
    [30, 30, "Zahraniční politika", "eu-and-foreign-policy", false],
    [31, 32, "Kultura", "culture-and-media", false],
    [33, 34, "Sport", "education-science-and-sport", false],
    [35, 35, "Ochrana spotřebitele", "economy-business-and-innovation", false],
    [36, 36, "Věda a výzkum", "education-science-and-sport", true],
    [37, 37, "Krypto & fintech", "economy-business-and-innovation", false],
  ],
  spd: [
    [2, 4, "Volební desatero a preambule", null, true],
    [5, 5, "Levné potraviny a potravinová bezpečnost", "agriculture-and-food", false],
    [6, 6, "Nízké ceny energií, konec Green Dealu a emisních povolenek", "energy-climate-and-environment", false],
    [7, 7, "Spravedlivé důchody a pomoc zdravotně postiženým", "work-social-affairs-and-pensions", false],
    [8, 8, "Dostupné bydlení a sociální politika", "housing-and-regional-development", true],
    [9, 9, "Práce pro naše občany, férové mzdy, omezení levné pracovní síly z ciziny", "work-social-affairs-and-pensions", false],
    [10, 12, "Dostupné zdravotnictví a léky", "health-and-care", false],
    [13, 13, "Zahraniční politika bez války a zbytečných výdajů na zbrojení", "eu-and-foreign-policy", true],
    [14, 16, "Bezpečnost, ochrana hranic, migrace", "security-defence-and-migration", false],
    [17, 18, "Stop cenzuře, spravedlnost a svoboda projevu", "justice-democracy-and-rights", false],
    [19, 19, "Zákon o referendu", "justice-democracy-and-rights", false],
    [20, 21, "Ekonomika, daně a finance – konec zadlužování", "public-finance-and-taxes", true],
    [22, 23, "Školství, vlastenecká výchova a sport", "education-science-and-sport", false],
    [24, 24, "Doprava a infrastruktura", "transport-and-infrastructure", false],
    [25, 26, "Kultura a média", "culture-and-media", false],
    [27, 27, "Veřejná správa – efektivní stát ve službách občanů", "state-and-digital-public-services", false],
  ],
  motoriste: [
    [2, 2, "Recept na levnější život", null, true],
    [3, 5, "Stojíme na straně podnikatelů", "economy-business-and-innovation", false],
    [6, 10, "Konsolidace veřejných financí: do čtyř let vyrovnaný rozpočet", "public-finance-and-taxes", true],
    [11, 12, "Školství: návrat vzdělanosti, kvality a řemesla", "education-science-and-sport", false],
    [13, 14, "Podpora bydlení a rozvoj stavebnictví", "housing-and-regional-development", false],
    [15, 16, "Český průmysl jako základ prosperity a stability", "economy-business-and-innovation", true],
    [17, 18, "Levné energie? Budoucnost je v jádru, ale fosilní zdroje jsou zatím nenahraditelné", "energy-climate-and-environment", false],
    [19, 21, "Motorismus, svoboda pohybu a doprava", "transport-and-infrastructure", false],
    [22, 23, "Pragmatická ochrana přírody místo zeleného extremismu", "energy-climate-and-environment", true],
    [24, 25, "Stabilní a špičkové zdravotnictví pro všechny generace", "health-and-care", true],
    [26, 27, "Úcta k seniorům a spravedlnost v sociální péči", "work-social-affairs-and-pensions", false],
    [28, 29, "Zemědělství: zdravý rozum místo ideologie", "agriculture-and-food", false],
    [30, 31, "Spravedlnost a bezpečnost: stát, který chrání, ne šikanuje", "security-defence-and-migration", true],
    [32, 34, "Digitální stát, který šetří čas i peníze občanů", "state-and-digital-public-services", true],
    [35, 36, "Bohatá kultura bez politických filtrů", "culture-and-media", false],
    [37, 38, "Armáda pro obranu, ne pro útok", "security-defence-and-migration", false],
  ],
};

const commitmentVerbs = [
  "Budeme", "Dokončíme", "Nabídneme", "Navrhneme", "Nechceme", "Odmítneme", "Podpoříme", "Posílíme", "Prosadíme", "Snížíme", "Umožníme", "Vrátíme", "Vytvoříme", "Zajistíme", "Zavedeme", "Zvýšíme", "Zrušíme",
];

function getSection(promise) {
  const page = promise.locator?.page;
  return programmeMaps[promise.partyId]?.find(([firstPage, lastPage]) => page >= firstPage && page <= lastPage) ?? null;
}

function getPossibleHeadingPrefix(text) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const index = words.findIndex((word, position) => position > 0 && commitmentVerbs.includes(word.replace(/^[„“(]/, "")));
  if (index < 2 || index > 12) return null;
  return words.slice(0, index).join(" ");
}

const catalogue = JSON.parse(await readFile(inputPath, "utf8"));
const confirmed = catalogue.promises.filter(({ status }) => status === "confirmed");
const rows = confirmed
  .map((promise) => {
    const section = getSection(promise);
    const [firstPage, lastPage, sourceSection, policyCategoryId, requiresItemReview] = section ?? [null, null, null, null, true];
    return {
      promiseId: promise.id,
      partyId: promise.partyId,
      sourceId: promise.sourceId,
      sourcePage: promise.locator?.page ?? null,
      sourceSection,
      sourceSectionPages: firstPage ? { firstPage, lastPage } : null,
      proposedPolicyCategoryId: policyCategoryId,
      possibleHeadingPrefix: getPossibleHeadingPrefix(promise.originalTextCz),
      requiresItemReview,
      originalTextCz: promise.originalTextCz,
    };
  })
  .sort((a, b) => a.partyId.localeCompare(b.partyId) || (a.sourcePage ?? 0) - (b.sourcePage ?? 0) || a.promiseId.localeCompare(b.promiseId));

const result = {
  schemaVersion: 1,
  purpose: "Non-public research audit. Proposed categories and source sections require item-level review before public data changes.",
  sourceCatalogue: "research/2025-election/promises.json",
  counts: {
    confirmedPromises: rows.length,
    requiringItemReview: rows.filter(({ requiresItemReview }) => requiresItemReview).length,
    withoutProposedCategory: rows.filter(({ proposedPolicyCategoryId }) => proposedPolicyCategoryId === null).length,
    possibleHeadingPrefixes: rows.filter(({ possibleHeadingPrefix }) => possibleHeadingPrefix !== null).length,
  },
  rows,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.counts));
