import { readFile, writeFile } from "node:fs/promises";

const auditPath = new URL("../research/2025-election/promise-category-audit.json", import.meta.url);
const outputPath = new URL("../data/promise-categories.json", import.meta.url);

const categories = [
  ["public-finance-and-taxes", "Veřejné finance a daně"],
  ["economy-business-and-innovation", "Ekonomika, podnikání a inovace"],
  ["work-social-affairs-and-pensions", "Práce, sociální věci a důchody"],
  ["health-and-care", "Zdravotnictví a péče"],
  ["housing-and-regional-development", "Bydlení a regionální rozvoj"],
  ["education-science-and-sport", "Vzdělávání, věda a sport"],
  ["culture-and-media", "Kultura a média"],
  ["transport-and-infrastructure", "Doprava a infrastruktura"],
  ["energy-climate-and-environment", "Energie, klima a životní prostředí"],
  ["agriculture-and-food", "Zemědělství a potraviny"],
  ["security-defence-and-migration", "Bezpečnost, obrana a migrace"],
  ["justice-democracy-and-rights", "Právo, demokracie a svobody"],
  ["state-and-digital-public-services", "Stát a digitální veřejné služby"],
  ["eu-and-foreign-policy", "Evropská a zahraniční politika"]
].map(([id, labelCz], index) => ({ id, labelCz, order: index + 1 }));

// Introductory programme pages mix several subjects. These explicit item decisions
// make their primary public category clear instead of inventing a party-specific one.
const introductoryAssignments = {
  "candidate-000ca3edac7f": "state-and-digital-public-services",
  "candidate-25edf9883039": "state-and-digital-public-services",
  "candidate-302c9498c3a2": "energy-climate-and-environment",
  "candidate-4540bec68687": "housing-and-regional-development",
  "candidate-4b02c939ec11": "work-social-affairs-and-pensions",
  "candidate-758a6c111d5e": "economy-business-and-innovation",
  "candidate-77d45b8b7ed6": "justice-democracy-and-rights",
  "candidate-7e4842c197af": "public-finance-and-taxes",
  "candidate-87a1ab000ff3": "energy-climate-and-environment",
  "candidate-b3645cef0b14": "housing-and-regional-development",
  "candidate-b3db7861173a": "work-social-affairs-and-pensions",
  "candidate-d312a3359a69": "security-defence-and-migration",
  "candidate-df0291f69e00": "public-finance-and-taxes",
  "candidate-48310b6fb028": "economy-business-and-innovation",
  "candidate-4f924e49b227": "security-defence-and-migration",
  "candidate-6f027ab1ccec": "security-defence-and-migration",
  "candidate-d94fe83521ca": "health-and-care",
  "candidate-ba6682fea600": "energy-climate-and-environment",
  "candidate-f117b42627b5": "work-social-affairs-and-pensions",
  "candidate-226d131047ef": "public-finance-and-taxes",
  "candidate-5b5059fe91b0": "health-and-care",
  "candidate-d47d4b1ae94f": "energy-climate-and-environment",
  "candidate-dfd58ddcd549": "transport-and-infrastructure"
};

const audit = JSON.parse(await readFile(auditPath, "utf8"));
const categoryIds = new Set(categories.map(({ id }) => id));
const mappings = audit.rows.map((row) => {
  const policyCategoryId = row.proposedPolicyCategoryId ?? introductoryAssignments[row.promiseId];
  if (!categoryIds.has(policyCategoryId)) throw new Error(`Missing policy category for ${row.promiseId}`);
  return {
    promiseId: row.promiseId,
    policyCategoryId,
    sourceProgrammeChapter: row.programmeChapter,
    sourceProgrammeChapterOrder: row.programmeChapterOrder,
    sourceSection: row.sourceSection,
    sourceSectionOrder: row.sourceSectionOrder,
    sourceOrder: row.sourceOrder
  };
});

if (Object.keys(introductoryAssignments).length !== audit.counts.withoutProposedCategory) throw new Error("Every unassigned audit row needs an explicit category decision.");
if (new Set(mappings.map(({ promiseId }) => promiseId)).size !== mappings.length) throw new Error("Policy category mappings must have unique promise IDs.");

await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, categories, mappings }, null, 2)}\n`);
console.log(JSON.stringify({ categories: categories.length, mappings: mappings.length }));
