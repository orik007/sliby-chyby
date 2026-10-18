import { z } from "zod";

export const assessmentStatusSchema = z.enum(["fulfilled", "moving-towards", "no-progress", "moving-against", "acting-against"]);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const periodSchema = z.object({ id: z.string().min(1), name: z.string().min(1), label: z.string().min(1), current: z.boolean(), isDemo: z.boolean() });
export const partySchema = z.object({ id: z.string().min(1), slug: z.string().min(1), shortName: z.string().min(1), fullName: z.string().min(1), officialUrl: z.url().nullable() });
export const partyPeriodSchema = z.object({ id: z.string().min(1), periodId: z.string().min(1), partyId: z.string().min(1), leaderName: z.string().min(1), portraitImage: z.string().regex(/^\/portraits\/[a-z0-9-]+\.png$/, "Portrait image must use a local public asset"), portraitSourceUrl: z.url(), portraitBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Portrait background must be a hex color"), order: z.number().int().positive(), isDemo: z.boolean() });
export const sourceLocatorSchema = z.object({ page: z.number().int().positive().optional(), paragraph: z.string().min(1).optional(), timestamp: z.string().min(1).optional(), imageRegion: z.string().min(1).optional() }).refine((locator) => Object.values(locator).some(Boolean), "A promise source locator is required");
export const promiseKindSchema = z.enum(["promise", "statement"]);
const maintenanceBaselineSchema = z.object({ preservedStateCz: z.string().min(1), source: z.object({ id: z.string().min(1), url: z.url().startsWith("https://"), publishedAt: z.iso.date(), locator: z.string().min(1), factSummary: z.string().min(1), primary: z.literal(true) }) });
export const promiseSchema = z.object({ id: z.string().min(1), slug: z.string().min(1), partyPeriodId: z.string().min(1), kind: promiseKindSchema, title: z.string().min(1), originalText: z.string().min(1), policyCategoryId: z.string().min(1), primarySourceId: z.string().min(1), sourceLocator: sourceLocatorSchema, sourceOrder: z.number().int().positive(), maintenanceBaseline: maintenanceBaselineSchema.optional(), isDemo: z.boolean() });
export const policyCategorySchema = z.object({ id: z.string().min(1), labelCz: z.string().min(1), order: z.number().int().positive() });
export const policyCategoryDataSchema = z.object({ schemaVersion: z.literal(2), categories: z.array(policyCategorySchema).min(1) }).superRefine((data, context) => {
  const categoryIds = new Set<string>();
  const orders = new Set<number>();
  for (const [index, category] of data.categories.entries()) {
    if (categoryIds.has(category.id)) context.addIssue({ code: "custom", message: "Policy category IDs must be unique.", path: ["categories", index, "id"] });
    if (orders.has(category.order)) context.addIssue({ code: "custom", message: "Policy category order must be unique.", path: ["categories", index, "order"] });
    categoryIds.add(category.id);
    orders.add(category.order);
  }
});
export const sourceSchema = z.object({ id: z.string().min(1), type: z.enum(["programme", "official-record", "roll-call-vote", "article"]), title: z.string().min(1), publisher: z.string().min(1), publishedAt: z.iso.date(), url: z.url().nullable(), primary: z.boolean(), isDemo: z.boolean() });
const officialUrlSchema = z.url().regex(/^https:\/\/(www|public)\.psp\.cz\/sqw\//, "Evidence trail links must point to official psp.cz records");
const versionNoteSchema = z.object({ note: z.enum(["published-version-missing", "removed", "text-not-published", "third-reading-rejection", "promulgated-text"]), lawChangeIds: z.array(z.string().min(1)).min(1) });
// A text psp.cz does not publish links to the act as promulgated in e-Sbírka.
const textUrlSchema = z.union([officialUrlSchema, z.url().regex(/^https:\/\/e-sbirka\.gov\.cz\/sb\/\d{4}\/\d+\/0000-00-00$/, "A text link must point to psp.cz or to an act as promulgated in e-Sbírka")]);
const concernedTextSchema = { version: z.enum(["proposed", "approved", "passed"]), textUrl: textUrlSchema.nullable(), notes: z.array(versionNoteSchema) };
const evidenceTrailStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("submission"), date: z.iso.date(), evidenceId: z.string().min(1), proposal: z.enum(["member-bill", "government-bill", "state-budget", "treaty"]), proposerCz: z.string().min(1).nullable(), ...concernedTextSchema }).strict(),
  z.object({ kind: z.literal("vote"), date: z.iso.date(), evidenceId: z.string().min(1), url: officialUrlSchema, stageCz: z.string().min(1), actionCz: z.string().min(1), club: z.enum(["yes", "no", "no-majority"]), counts: z.object({ yes: z.number().int().nonnegative(), no: z.number().int().nonnegative(), abstained: z.number().int().nonnegative(), notVoting: z.number().int().nonnegative(), absent: z.number().int().nonnegative(), unknown: z.number().int().nonnegative() }).strict(), ...concernedTextSchema }).strict(),
  z.object({ kind: z.literal("senate-resolution"), evidenceId: z.string().min(1), printPartCz: z.string().regex(/^\d+\/\d+$/), url: officialUrlSchema }).strict(),
  z.object({ kind: z.literal("government-opinion"), date: z.iso.date(), evidenceId: z.string().min(1), opinion: z.enum(["agrees", "disagrees"]), printPartCz: z.string().regex(/^\d+\/\d+$/), url: officialUrlSchema, ...concernedTextSchema }).strict(),
]);
export const evidenceTrailPrintSchema = z.object({ printNumber: z.number().int().positive(), printUrl: officialUrlSchema, lawChanges: z.array(z.object({ lawChangeId: z.string().min(1), headingCz: z.string().min(1).nullable(), titleCz: z.string().min(1), amendedActs: z.array(z.string().regex(/^\d+\/\d{4}$/)) }).strict()).min(1), steps: z.array(evidenceTrailStepSchema).min(1) }).strict().superRefine((print, context) => {
  const lawChangeIds = new Set(print.lawChanges.map(({ lawChangeId }) => lawChangeId));
  if (!print.steps.some(({ kind }) => kind !== "senate-resolution")) context.addIssue({ code: "custom", path: ["steps"], message: "An evidence trail print needs attributable conduct" });
  for (const [index, step] of print.steps.entries()) {
    if (step.kind !== "senate-resolution" && step.textUrl === null && step.notes.length === 0) context.addIssue({ code: "custom", path: ["steps", index, "notes"], message: "A step without a text link must say why" });
    if (step.kind !== "senate-resolution" && step.notes.some(({ lawChangeIds: ids }) => ids.some((id) => !lawChangeIds.has(id)))) context.addIssue({ code: "custom", path: ["steps", index, "notes"], message: "A version note must name law changes of this print" });
  }
});
// A government regulation or ministerial decree an assessment relied on: its
// adoption, attributed to every governing party, and its text as promulgated.
export const evidenceTrailRegulationSchema = z.object({ kind: z.literal("regulation"), lawChangeId: z.string().min(1), citationCz: z.string().regex(/^(Nařízení vlády|Vyhláška) č\. \d+\/\d{4} Sb\.$/), titleCz: z.string().min(1), textUrl: z.url().regex(/^https:\/\/e-sbirka\.gov\.cz\/sb\/\d{4}\/\d+\/0000-00-00$/, "A regulation links to its text as promulgated in e-Sbírka"), adoption: z.object({ date: z.iso.date(), evidenceId: z.string().min(1), by: z.enum(["government", "ministry"]), issuerCz: z.string().min(1) }).strict() }).strict();
// A government resolution an assessment relied on: its adoption, attributed
// to every governing party, and its page in the government's zVlády portal.
export const evidenceTrailResolutionSchema = z.object({ kind: z.literal("resolution"), lawChangeId: z.string().min(1), numberCz: z.string().regex(/^Usnesení vlády č\. \d+\/\d{4}$/), titleCz: z.string().min(1), pageUrl: z.url().regex(/^https:\/\/odok\.gov\.cz\/portal\/zvlady\/usneseni\/\d{4}\/\d+\/$/, "A resolution links to its page in zVlády"), adoption: z.object({ date: z.iso.date(), evidenceId: z.string().min(1) }).strict() }).strict();
export const evidenceTrailEntrySchema = z.union([evidenceTrailPrintSchema, evidenceTrailRegulationSchema, evidenceTrailResolutionSchema]);
// A wording of an act in e-Sbírka, optionally scrolled to one provision.
const eSbirkaUrlSchema = z.url().regex(/^https:\/\/e-sbirka\.gov\.cz\/sb\/\d{4}\/\d+\/\d{4}-\d{2}-\d{2}(#[a-z0-9_:-]+)?$/, "Context links must point to a wording in e-Sbírka");
// The wording of provisions an assessment did not have, because its evidence
// package would otherwise have been too large (docs/evidence-pipeline.md, Package).
export const contextOmissionSchema = z.object({ printNumber: z.number().int().positive(), lawChangeId: z.string().min(1), headingCz: z.string().min(1).nullable(), titleCz: z.string().min(1), version: z.enum(["proposed", "approved", "passed"]), act: z.string().regex(/^\d+\/\d{4}$/), wordingFrom: z.iso.date().nullable(), wordingUrl: eSbirkaUrlSchema, suppliedCount: z.number().int().nonnegative(), provisions: z.array(z.object({ citationCz: z.string().min(1), url: eSbirkaUrlSchema }).strict()).min(1) }).strict();
export const assessmentRevisionSchema = z.object({ id: z.string().min(1), promiseId: z.string().min(1), revision: z.number().int().positive(), status: assessmentStatusSchema, explanationShort: z.string().min(1), publishedAt: z.iso.date(), evidenceSourceIds: z.array(z.string().min(1)), evidenceTrail: z.array(evidenceTrailEntrySchema).min(1).optional(), contextOmissions: z.array(contextOmissionSchema).min(1).optional(), proposalId: z.string().min(1).optional(), baselinePromiseSourceId: z.string().min(1).optional(), isDemo: z.boolean() }).superRefine((revision, context) => {
  if (revision.contextOmissions && !revision.proposalId) context.addIssue({ code: "custom", path: ["contextOmissions"], message: "Context omissions are copied from a reviewed proposal" });
  if (revision.evidenceSourceIds.length === 0 && !revision.evidenceTrail) context.addIssue({ code: "custom", path: ["evidenceSourceIds"], message: "A revision must cite source records or an evidence trail" });
  if (revision.baselinePromiseSourceId && (revision.evidenceTrail || revision.proposalId)) context.addIssue({ code: "custom", path: ["evidenceTrail"], message: "Baseline revisions have no evidence trail or proposal" });
  if (revision.evidenceTrail && revision.evidenceSourceIds.length > 0) context.addIssue({ code: "custom", path: ["evidenceSourceIds"], message: "A revision with an evidence trail cites no other source record" });
  if (revision.evidenceTrail && !revision.proposalId) context.addIssue({ code: "custom", path: ["proposalId"], message: "An evidence trail is copied from a reviewed proposal" });
  if (revision.baselinePromiseSourceId && revision.status !== "no-progress") context.addIssue({ code: "custom", path: ["status"], message: "Baseline revisions must use no-progress" });
  if (revision.baselinePromiseSourceId && revision.revision !== 1) context.addIssue({ code: "custom", path: ["revision"], message: "Baseline revisions must be the initial revision" });
  if (revision.baselinePromiseSourceId && (revision.evidenceSourceIds.length !== 1 || revision.evidenceSourceIds[0] !== revision.baselinePromiseSourceId)) context.addIssue({ code: "custom", path: ["evidenceSourceIds"], message: "Baseline revisions must list only their baseline promise source" });
});
export const systemStatusSchema = z.object({ lastSuccessfulCollectionAt: z.iso.datetime() });
// Site features only, newest first; content and score changes are not listed
// (docs/decisions.md).
export const changelogSchema = z.object({
  released: z.array(z.object({ date: z.iso.date(), items: z.array(z.string().min(1)).min(1) })).min(1),
  planned: z.array(z.string().min(1)),
}).superRefine((changelog, context) => {
  changelog.released.forEach((entry, index) => {
    const previous = changelog.released[index - 1];
    if (previous && previous.date <= entry.date) context.addIssue({ code: "custom", path: ["released", index, "date"], message: "Released entries must be unique dates, newest first" });
  });
});

export type PartyPeriod = z.infer<typeof partyPeriodSchema>;
export type PromiseRecord = z.infer<typeof promiseSchema>;
export type PolicyCategory = z.infer<typeof policyCategorySchema>;
export type AssessmentRevision = z.infer<typeof assessmentRevisionSchema>;
export type EvidenceTrailPrint = z.infer<typeof evidenceTrailPrintSchema>;
export type EvidenceTrailRegulation = z.infer<typeof evidenceTrailRegulationSchema>;
export type EvidenceTrailResolution = z.infer<typeof evidenceTrailResolutionSchema>;
export type EvidenceTrailEntry = z.infer<typeof evidenceTrailEntrySchema>;
export type EvidenceTrailStep = EvidenceTrailPrint["steps"][number];
export type ContextOmission = z.infer<typeof contextOmissionSchema>;
