import { z } from "zod";

export const assessmentStatusSchema = z.enum(["fulfilled", "moving-towards", "no-progress", "moving-against", "acting-against"]);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const periodSchema = z.object({ id: z.string().min(1), name: z.string().min(1), label: z.string().min(1), current: z.boolean(), isDemo: z.boolean() });
export const partySchema = z.object({ id: z.string().min(1), slug: z.string().min(1), shortName: z.string().min(1), fullName: z.string().min(1), officialUrl: z.url().nullable() });
export const partyPeriodSchema = z.object({ id: z.string().min(1), periodId: z.string().min(1), partyId: z.string().min(1), leaderName: z.string().min(1), portraitInitials: z.string().min(1).max(3), tone: z.enum(["coral", "blue", "gold"]), order: z.number().int().positive(), isDemo: z.boolean() });
export const promiseSchema = z.object({ id: z.string().min(1), slug: z.string().min(1), partyPeriodId: z.string().min(1), title: z.string().min(1), originalText: z.string().min(1), category: z.string().min(1), promiseType: z.enum(["outcome", "process", "behavior"]), primarySourceId: z.string().min(1), isDemo: z.boolean() });
export const sourceSchema = z.object({ id: z.string().min(1), type: z.enum(["programme", "official-record", "roll-call-vote", "article"]), title: z.string().min(1), publisher: z.string().min(1), publishedAt: z.iso.date(), url: z.url().nullable(), primary: z.boolean(), isDemo: z.boolean() });
export const assessmentRevisionSchema = z.object({ id: z.string().min(1), promiseId: z.string().min(1), revision: z.number().int().positive(), status: assessmentStatusSchema, explanationShort: z.string().min(1), publishedAt: z.iso.date(), evidenceSourceIds: z.array(z.string().min(1)).min(1), reviewProposalId: z.string().min(1).optional(), baselinePromiseSourceId: z.string().min(1).optional(), isDemo: z.boolean() }).superRefine((revision, context) => {
  if (!revision.isDemo && !revision.reviewProposalId && !revision.baselinePromiseSourceId) context.addIssue({ code: "custom", path: ["reviewProposalId"], message: "Published real assessments require a review proposal ID or baseline promise source" });
  if (revision.reviewProposalId && revision.baselinePromiseSourceId) context.addIssue({ code: "custom", path: ["baselinePromiseSourceId"], message: "A revision cannot be both review-proposal and baseline sourced" });
  if (revision.baselinePromiseSourceId && revision.status !== "no-progress") context.addIssue({ code: "custom", path: ["status"], message: "Baseline revisions must use no-progress" });
  if (revision.baselinePromiseSourceId && revision.revision !== 1) context.addIssue({ code: "custom", path: ["revision"], message: "Baseline revisions must be the initial revision" });
});
export const systemStatusSchema = z.object({ lastSuccessfulCollectionAt: z.iso.datetime() });

export type PartyPeriod = z.infer<typeof partyPeriodSchema>;
export type PromiseRecord = z.infer<typeof promiseSchema>;
export type AssessmentRevision = z.infer<typeof assessmentRevisionSchema>;
