import { z } from "zod";

export const policyCategoryIds = [
  "public-finance-and-taxes", "economy-business-and-innovation", "work-social-affairs-and-pensions", "health-and-care", "housing-and-regional-development", "education-science-and-sport", "culture-and-media", "transport-and-infrastructure", "energy-climate-and-environment", "agriculture-and-food", "security-defence-and-migration", "justice-democracy-and-rights", "state-and-digital-public-services", "eu-and-foreign-policy",
];

const policyCategoryIdSchema = z.enum(policyCategoryIds);
const positiveIntegerSchema = z.number().int().positive();
const sourceMetadataReviewSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), note: z.null() }),
  z.object({ status: z.literal("verified"), note: z.string().min(1) }),
]);
const auditRowSchema = z.object({
  promiseId: z.string().min(1), partyId: z.enum(["ano", "spd", "motoriste"]), sourceId: z.string().min(1), sourcePage: positiveIntegerSchema.nullable(),
  programmeChapter: z.string().min(1).nullable(), programmeChapterOrder: positiveIntegerSchema.nullable(), programmeChapterPages: z.object({ firstPage: positiveIntegerSchema, lastPage: positiveIntegerSchema }).nullable(),
  sourceSection: z.string().min(1).nullable(), sourceSectionOrder: positiveIntegerSchema.nullable(), sourceOrder: positiveIntegerSchema.nullable(), proposedPolicyCategoryId: policyCategoryIdSchema.nullable(), possibleHeadingPrefix: z.string().min(1).nullable(), requiresItemReview: z.literal(true),
  sourceMetadataReview: sourceMetadataReviewSchema,
  sourceReview: z.object({ status: z.literal("pending"), note: z.null() }), originalTextCz: z.string().min(1),
}).superRefine((row, context) => {
  const sourceMetadataIsPresent = row.sourceSection !== null || row.sourceSectionOrder !== null || row.sourceOrder !== null;
  if (row.sourceMetadataReview.status === "pending" && sourceMetadataIsPresent) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceMetadataReview"], message: "Pending source metadata must remain empty." });
  if (row.sourceMetadataReview.status === "verified" && (row.sourceSection === null || row.sourceSectionOrder === null || row.sourceOrder === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceMetadataReview"], message: "Verified source metadata requires a section and both ordering values." });
});

export const categoryAuditSchema = z.object({
  schemaVersion: z.literal(1), purpose: z.string().min(1), sourceCatalogue: z.literal("research/2025-election/promises.json"),
  counts: z.object({ confirmedPromises: z.number().int().nonnegative(), requiringItemReview: z.number().int().nonnegative(), withoutProposedCategory: z.number().int().nonnegative(), possibleHeadingPrefixes: z.number().int().nonnegative() }),
  rows: z.array(auditRowSchema),
}).superRefine((audit, context) => {
  const ids = new Set();
  for (const [index, row] of audit.rows.entries()) {
    if (ids.has(row.promiseId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rows", index, "promiseId"], message: "Promise IDs must be unique." });
    ids.add(row.promiseId);
  }
  const expected = { confirmedPromises: audit.rows.length, requiringItemReview: audit.rows.length, withoutProposedCategory: audit.rows.filter(({ proposedPolicyCategoryId }) => proposedPolicyCategoryId === null).length, possibleHeadingPrefixes: audit.rows.filter(({ possibleHeadingPrefix }) => possibleHeadingPrefix !== null).length };
  if (JSON.stringify(audit.counts) !== JSON.stringify(expected)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["counts"], message: "Audit counts must be derived from rows." });
});

const programmeMaps = {
  ano: [[3, 3, "Úvod", null], [4, 5, "Finance a hospodaření státu", "public-finance-and-taxes"], [6, 7, "Hospodářství, průmysl a energetika", "economy-business-and-innovation"], [8, 9, "Zdravotnictví", "health-and-care"], [10, 11, "Sociální politika", "work-social-affairs-and-pensions"], [12, 13, "Doprava", "transport-and-infrastructure"], [14, 16, "Vnitro", "security-defence-and-migration"], [17, 18, "Vzdělávání", "education-science-and-sport"], [19, 20, "Bydlení a regionální rozvoj", "housing-and-regional-development"], [21, 22, "Životní prostředí", "energy-climate-and-environment"], [23, 24, "Obrana", "security-defence-and-migration"], [25, 26, "Zemědělství", "agriculture-and-food"], [27, 28, "Spravedlnost", "justice-democracy-and-rights"], [29, 29, "Digitalizace", "state-and-digital-public-services"], [30, 30, "Zahraniční politika", "eu-and-foreign-policy"], [31, 32, "Kultura", "culture-and-media"], [33, 34, "Sport", "education-science-and-sport"], [35, 35, "Ochrana spotřebitele", "economy-business-and-innovation"], [36, 36, "Věda a výzkum", "education-science-and-sport"], [37, 37, "Krypto & fintech", "economy-business-and-innovation"]],
  spd: [[2, 4, "Volební desatero a preambule", null], [5, 5, "Levné potraviny a potravinová bezpečnost", "agriculture-and-food"], [6, 6, "Nízké ceny energií, konec Green Dealu a emisních povolenek", "energy-climate-and-environment"], [7, 7, "Spravedlivé důchody a pomoc zdravotně postiženým", "work-social-affairs-and-pensions"], [8, 8, "Dostupné bydlení a sociální politika", "housing-and-regional-development"], [9, 9, "Práce pro naše občany, férové mzdy, omezení levné pracovní síly z ciziny", "work-social-affairs-and-pensions"], [10, 12, "Dostupné zdravotnictví a léky", "health-and-care"], [13, 13, "Zahraniční politika bez války a zbytečných výdajů na zbrojení", "eu-and-foreign-policy"], [14, 16, "Bezpečnost, ochrana hranic, migrace", "security-defence-and-migration"], [17, 18, "Stop cenzuře, spravedlnost a svoboda projevu", "justice-democracy-and-rights"], [19, 19, "Zákon o referendu", "justice-democracy-and-rights"], [20, 21, "Ekonomika, daně a finance – konec zadlužování", "public-finance-and-taxes"], [22, 23, "Školství, vlastenecká výchova a sport", "education-science-and-sport"], [24, 24, "Doprava a infrastruktura", "transport-and-infrastructure"], [25, 26, "Kultura a média", "culture-and-media"], [27, 27, "Veřejná správa – efektivní stát ve službách občanů", "state-and-digital-public-services"]],
  motoriste: [[2, 2, "Recept na levnější život", null], [3, 5, "Stojíme na straně podnikatelů", "economy-business-and-innovation"], [6, 8, "Konsolidace veřejných financí: do čtyř let vyrovnaný rozpočet", "public-finance-and-taxes"], [9, 10, "Geopolitické ukotvení České republiky", "eu-and-foreign-policy"], [11, 12, "Školství: návrat vzdělanosti, kvality a řemesla", "education-science-and-sport"], [13, 14, "Podpora bydlení a rozvoj stavebnictví", "housing-and-regional-development"], [15, 16, "Český průmysl jako základ prosperity a stability", "economy-business-and-innovation"], [17, 18, "Levné energie? Budoucnost je v jádru, ale fosilní zdroje jsou zatím nenahraditelné", "energy-climate-and-environment"], [19, 21, "Motorismus, svoboda pohybu a doprava", "transport-and-infrastructure"], [22, 23, "Pragmatická ochrana přírody místo zeleného extremismu", "energy-climate-and-environment"], [24, 25, "Stabilní a špičkové zdravotnictví pro všechny generace", "health-and-care"], [26, 27, "Úcta k seniorům a spravedlnost v sociální péči", "work-social-affairs-and-pensions"], [28, 29, "Zemědělství: zdravý rozum místo ideologie", "agriculture-and-food"], [30, 31, "Spravedlnost a bezpečnost: stát, který chrání, ne šikanuje", "security-defence-and-migration"], [32, 34, "Digitální stát, který šetří čas i peníze občanů", "state-and-digital-public-services"], [35, 36, "Bohatá kultura bez politických filtrů", "culture-and-media"], [37, 38, "Armáda pro obranu, ne pro útok", "security-defence-and-migration"]],
};

const knownSourceSections = {
  "candidate-aafc1d1e345b": { sourceSection: "Kyberbezpečnost a moderní hrozby", sourceSectionOrder: 6, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official Motoristé programme, page 31." } },
  "candidate-ae84cf104aa1": { sourceSection: "VYLÉČÍME NEMOCNOU EKONOMIKU", sourceSectionOrder: 1, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-not-adopt-euro": { sourceSection: "ČESKÁ KORUNA, NE EURO", sourceSectionOrder: 2, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-digital-tax-cobra": { sourceSection: "BOJ PROTI ŠEDÉ EKONOMICE", sourceSectionOrder: 3, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-eet-2": { sourceSection: "EET 2.0", sourceSectionOrder: 4, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-restore-kindergarten-tax-credit": { sourceSection: "SNÍŽÍME DANĚ", sourceSectionOrder: 5, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-restore-working-student-tax-credit": { sourceSection: "SNÍŽÍME DANĚ", sourceSectionOrder: 5, sourceOrder: 2, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-stop-2026-self-employed-contribution-increase": { sourceSection: "SNÍŽÍME DANĚ", sourceSectionOrder: 5, sourceOrder: 3, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-remove-leisure-benefit-cap": { sourceSection: "SNÍŽÍME DANĚ", sourceSectionOrder: 5, sourceOrder: 4, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-corporate-income-tax-19": { sourceSection: "SNÍŽÍME DANĚ", sourceSectionOrder: 5, sourceOrder: 5, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-restaurant-nonalcoholic-vat-12": { sourceSection: "SNÍŽÍME DANĚ", sourceSectionOrder: 5, sourceOrder: 6, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 4." } },
  "ano-2025-tax-exempt-voluntary-tips": { sourceSection: "OSVOBODÍME SPROPITNÉ V GASTRONOMII OD DANĚ A POJISTNÝCH", sourceSectionOrder: 6, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 5." } },
  "ano-2025-online-tax-office": { sourceSection: "JEDNODUŠŠÍ DAŇOVÁ PŘIZNÁNÍ", sourceSectionOrder: 7, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 5." } },
  "ano-2025-retail-state-bonds": { sourceSection: "STÁTNÍ DLUHOPISY PRO OBČANY", sourceSectionOrder: 8, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 5." } },
  "ano-2025-customs-entry-salary-50000": { sourceSection: "OCENĚNÍ PRÁCE CELNÍKŮ", sourceSectionOrder: 11, sourceOrder: 1, sourceMetadataReview: { status: "verified", note: "Verified against the official ANO programme, page 5." } },
};
const commitmentVerbs = ["Budeme", "Dokončíme", "Nabídneme", "Navrhneme", "Nechceme", "Odmítneme", "Podpoříme", "Posílíme", "Prosadíme", "Snížíme", "Umožníme", "Vrátíme", "Vytvoříme", "Zajistíme", "Zastropujeme", "Zavedeme", "Zvýšíme", "Zrušíme"];

function getProgrammeChapter(promise) {
  const page = promise.locator?.page;
  const index = programmeMaps[promise.partyId]?.findIndex(([firstPage, lastPage]) => page >= firstPage && page <= lastPage) ?? -1;
  if (index < 0) return null;
  const [firstPage, lastPage, programmeChapter, proposedPolicyCategoryId] = programmeMaps[promise.partyId][index];
  return { programmeChapter, programmeChapterOrder: index + 1, programmeChapterPages: { firstPage, lastPage }, proposedPolicyCategoryId };
}

function getPossibleHeadingPrefix(text) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const index = words.findIndex((word, position) => position > 0 && commitmentVerbs.includes(word.replace(/^[„“(]/, "")));
  return index >= 2 && index <= 12 ? words.slice(0, index).join(" ") : null;
}

export function createCategoryAudit(catalogue) {
  const rows = catalogue.promises.filter(({ status }) => status === "confirmed").map((promise) => {
    const chapter = getProgrammeChapter(promise) ?? { programmeChapter: null, programmeChapterOrder: null, programmeChapterPages: null, proposedPolicyCategoryId: null };
    const knownSection = knownSourceSections[promise.id] ?? { sourceSection: null, sourceSectionOrder: null, sourceOrder: null, sourceMetadataReview: { status: "pending", note: null } };
    return { promiseId: promise.id, partyId: promise.partyId, sourceId: promise.sourceId, sourcePage: promise.locator?.page ?? null, ...chapter, ...knownSection, possibleHeadingPrefix: getPossibleHeadingPrefix(promise.originalTextCz), requiresItemReview: true, sourceReview: { status: "pending", note: null }, originalTextCz: promise.originalTextCz };
  }).sort((a, b) => a.partyId.localeCompare(b.partyId) || (a.sourcePage ?? 0) - (b.sourcePage ?? 0) || a.promiseId.localeCompare(b.promiseId));
  return categoryAuditSchema.parse({ schemaVersion: 1, purpose: "Non-public source review audit. Chapter-level category hints, source sections, and heading boundaries require item-level review; public categories are decided in data/promise-categories.json.", sourceCatalogue: "research/2025-election/promises.json", counts: { confirmedPromises: rows.length, requiringItemReview: rows.length, withoutProposedCategory: rows.filter(({ proposedPolicyCategoryId }) => proposedPolicyCategoryId === null).length, possibleHeadingPrefixes: rows.filter(({ possibleHeadingPrefix }) => possibleHeadingPrefix !== null).length }, rows });
}
