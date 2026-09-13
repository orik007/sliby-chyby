import { z } from "zod";

export const assessmentStatusSchema = z.enum(["fulfilled", "moving-towards", "no-progress", "moving-against", "acting-against"]);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const periodSchema = z.object({ id: z.string().min(1), name: z.string().min(1), label: z.string().min(1), current: z.boolean(), isDemo: z.boolean() });
export const partySchema = z.object({ id: z.string().min(1), slug: z.string().min(1), shortName: z.string().min(1), fullName: z.string().min(1), officialUrl: z.url().nullable() });
export const partyPeriodSchema = z.object({ id: z.string().min(1), periodId: z.string().min(1), partyId: z.string().min(1), leaderName: z.string().min(1), portraitImage: z.string().regex(/^\/portraits\/[a-z0-9-]+\.png$/, "Portrait image must use a local public asset"), portraitSourceUrl: z.url(), tone: z.enum(["coral", "blue", "gold"]), order: z.number().int().positive(), isDemo: z.boolean() });
export const sourceLocatorSchema = z.object({ page: z.number().int().positive().optional(), paragraph: z.string().min(1).optional(), timestamp: z.string().min(1).optional(), imageRegion: z.string().min(1).optional() }).refine((locator) => Object.values(locator).some(Boolean), "A promise source locator is required");
export const promiseSchema = z.object({ id: z.string().min(1), slug: z.string().min(1), partyPeriodId: z.string().min(1), title: z.string().min(1), originalText: z.string().min(1), category: z.string().min(1), promiseType: z.enum(["outcome", "process", "behavior"]), primarySourceId: z.string().min(1), sourceLocator: sourceLocatorSchema, isDemo: z.boolean() });
export const policyCategorySchema = z.object({ id: z.string().min(1), labelCz: z.string().min(1), order: z.number().int().positive() });
export const promisePolicyCategorySchema = z.object({ promiseId: z.string().min(1), policyCategoryId: z.string().min(1), sourceProgrammeChapter: z.string().min(1), sourceProgrammeChapterOrder: z.number().int().positive(), sourceSection: z.string().min(1).nullable(), sourceSectionOrder: z.number().int().positive().nullable(), sourceOrder: z.number().int().positive().nullable() }).superRefine((mapping, context) => {
  const sourceSectionValues = [mapping.sourceSection, mapping.sourceSectionOrder, mapping.sourceOrder];
  if (sourceSectionValues.some((value) => value === null) && sourceSectionValues.some((value) => value !== null)) context.addIssue({ code: "custom", message: "Source section metadata must be complete or null.", path: ["sourceSection"] });
});
export const policyCategoryDataSchema = z.object({ schemaVersion: z.literal(1), categories: z.array(policyCategorySchema).min(1), mappings: z.array(promisePolicyCategorySchema).min(1) }).superRefine((data, context) => {
  const categoryIds = new Set<string>();
  for (const [index, category] of data.categories.entries()) {
    if (categoryIds.has(category.id)) context.addIssue({ code: "custom", message: "Policy category IDs must be unique.", path: ["categories", index, "id"] });
    categoryIds.add(category.id);
  }
  const promiseIds = new Set<string>();
  for (const [index, mapping] of data.mappings.entries()) {
    if (promiseIds.has(mapping.promiseId)) context.addIssue({ code: "custom", message: "Promise category mappings must be unique.", path: ["mappings", index, "promiseId"] });
    if (!categoryIds.has(mapping.policyCategoryId)) context.addIssue({ code: "custom", message: "Promise category mapping references an unknown category.", path: ["mappings", index, "policyCategoryId"] });
    promiseIds.add(mapping.promiseId);
  }
});
export const sourceSchema = z.object({ id: z.string().min(1), type: z.enum(["programme", "official-record", "roll-call-vote", "article"]), title: z.string().min(1), publisher: z.string().min(1), publishedAt: z.iso.date(), url: z.url().nullable(), primary: z.boolean(), isDemo: z.boolean() });
export const assessmentRevisionSchema = z.object({ id: z.string().min(1), promiseId: z.string().min(1), revision: z.number().int().positive(), status: assessmentStatusSchema, explanationShort: z.string().min(1), publishedAt: z.iso.date(), evidenceSourceIds: z.array(z.string().min(1)).min(1), baselinePromiseSourceId: z.string().min(1).optional(), isDemo: z.boolean() }).superRefine((revision, context) => {
  if (revision.baselinePromiseSourceId && revision.status !== "no-progress") context.addIssue({ code: "custom", path: ["status"], message: "Baseline revisions must use no-progress" });
  if (revision.baselinePromiseSourceId && revision.revision !== 1) context.addIssue({ code: "custom", path: ["revision"], message: "Baseline revisions must be the initial revision" });
  if (revision.baselinePromiseSourceId && (revision.evidenceSourceIds.length !== 1 || revision.evidenceSourceIds[0] !== revision.baselinePromiseSourceId)) context.addIssue({ code: "custom", path: ["evidenceSourceIds"], message: "Baseline revisions must list only their baseline promise source" });
});
export const systemStatusSchema = z.object({ lastSuccessfulCollectionAt: z.iso.datetime() });

export type PartyPeriod = z.infer<typeof partyPeriodSchema>;
export type PromiseRecord = z.infer<typeof promiseSchema>;
export type PolicyCategory = z.infer<typeof policyCategorySchema>;
export type PromisePolicyCategory = z.infer<typeof promisePolicyCategorySchema>;
export type AssessmentRevision = z.infer<typeof assessmentRevisionSchema>;
