import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashText } from "./assessment-config.mjs";
import { createStructuredModelResponse } from "./model-provider.mjs";
import { hasTag } from "./topic-taxonomy.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Thrown only by validateTagAssignmentOutput, so a caller can isolate a
// single invalid model *output* (an invented tag id, a fabricated excerpt)
// from a transport, authentication, or provider failure inside
// requestTagAssignment -- those must never be silently swallowed the same
// way, or a missing API key or a full outage would look like a run that
// legitimately found nothing.
export class TagValidationError extends Error {}

function invariantValidTag(condition, message) {
  if (!condition) throw new TagValidationError(message);
}

export const taggingPromptVersion = "tagger-v1";

export function taggingRuntimeConfig(env = process.env) {
  return {
    provider: env.SLIBY_TAGGING_PROVIDER ?? "openai",
    modelA: env.SLIBY_TAGGING_MODEL_A ?? "gpt-6-luna",
    modelB: env.SLIBY_TAGGING_MODEL_B ?? "gpt-6-luna",
    concurrency: Number(env.SLIBY_TAGGING_CONCURRENCY ?? "4")
  };
}

export async function loadTaggingPrompt(root = process.cwd()) {
  const instructions = await readFile(resolve(root, `automation/prompts/${taggingPromptVersion}.md`), "utf8");
  return { version: taggingPromptVersion, contentHash: hashText(instructions), instructions };
}

function taxonomyDefinitionsText(taxonomy) {
  return taxonomy.tags
    .map((tag) => [
      `- id: ${tag.id}`,
      `  parent: ${tag.parent ?? "(none)"}`,
      `  label: ${tag.labelEn}`,
      `  assessmentEligible: ${tag.assessmentEligible}`,
      `  czechAliases: ${tag.czechAliases.join(", ")}`,
      `  inclusionExamples: ${tag.inclusionExamples.join(" | ")}`,
      `  exclusionExamples: ${tag.exclusionExamples.join(" | ")}`
    ].join("\n"))
    .join("\n\n");
}

export function buildPromiseTaggingBrief(promise, taxonomy) {
  invariant(typeof promise.id === "string" && promise.id.length > 0, "Promise brief requires an id");
  invariant(typeof promise.originalTextCz === "string" && promise.originalTextCz.length > 0, "Promise brief requires originalTextCz");
  const source = promise.promiseSource;
  return {
    subjectType: "promise",
    subjectId: promise.id,
    // Promise tagging is specified to classify from its exact wording and
    // source context (docs/evidence-pipeline.md) -- the promise
    // source's own title/publisher/locator/quote, not just the derived
    // promise text, since that context can itself be topically decisive.
    text: [
      `Promise (Czech, exact wording): ${promise.originalTextCz}`,
      promise.atomicClaimCz ? `Atomic claim: ${promise.atomicClaimCz}` : null,
      promise.fulfillmentTest ? `Fulfillment test: ${promise.fulfillmentTest}` : null,
      promise.contradictionTest ? `Contradiction test: ${promise.contradictionTest}` : null,
      source ? `Promise source: ${source.title} (${source.publisher}, ${source.publishedAt}), ${source.url}` : null,
      source?.locator ? `Source locator: ${source.locator}` : null,
      source?.exactQuoteCz ? `Source exact quote (Czech): ${source.exactQuoteCz}` : null
    ].filter(Boolean).join("\n"),
    taxonomyDefinitions: taxonomyDefinitionsText(taxonomy)
  };
}

/**
 * Extracts whatever substantive text a collected record already carries in
 * its own structured payload (an official-publication excerpt, a
 * parliamentary print's title and recorded action, or a vote's roll-call
 * result). This is real, already-collected content, distinct from the
 * enriched official-document excerpts an enrichment stage may add later; a
 * source record with only a generic title should still give the tagger
 * something decisive to classify from.
 *
 * A `parliamentary-vote` record's own generic title ("Hlasování 123") never
 * says what was voted on -- that lives in `payload.linkedPrints`, the same
 * print titles and recorded actions a `legislative-step` record surfaces at
 * its own top level (scripts/lib/psp-collector.mjs), together with the
 * agenda item the vote was cast on. All must be read here for either kind
 * to give the tagger the text it actually needs.
 */
export function deriveRecordContentExcerpts(record) {
  const payload = record.payload ?? {};
  const excerpts = [];
  if (typeof payload.excerptCz === "string" && payload.excerptCz.length > 0) {
    excerpts.push(payload.excerptCz);
  }
  if (typeof payload.printTitleCz === "string" && payload.printTitleCz.length > 0) {
    excerpts.push(`Parliamentary print title: ${payload.printTitleCz}`);
  }
  if (typeof payload.actionCz === "string" && payload.actionCz.length > 0) {
    excerpts.push(`Recorded official action: ${payload.actionCz}`);
  }
  if (typeof payload.currentStateCz === "string" && payload.currentStateCz.length > 0) {
    excerpts.push(`Current recorded state: ${payload.currentStateCz}`);
  }
  if (typeof payload.agendaItem?.titleCz === "string" && payload.agendaItem.titleCz.length > 0) {
    excerpts.push(`Agenda item voted on: ${[payload.agendaItem.titleCz, payload.agendaItem.suffixCz].filter(Boolean).join(" ")}`);
  }
  for (const linkedPrint of payload.linkedPrints ?? []) {
    if (typeof linkedPrint.titleCz === "string" && linkedPrint.titleCz.length > 0) {
      excerpts.push(`Linked parliamentary print title: ${linkedPrint.titleCz}`);
    }
    for (const context of linkedPrint.historyContexts ?? []) {
      if (typeof context.actionCz === "string" && context.actionCz.length > 0) {
        excerpts.push(`Linked print recorded action: ${context.actionCz}`);
      }
    }
  }
  if (record.kind === "parliamentary-vote" && payload.counts) {
    excerpts.push(`Roll-call result: ${payload.counts.yes ?? 0} yes, ${payload.counts.no ?? 0} no.`);
  }
  return excerpts;
}

// An official-document excerpt (scripts/lib/psp-print-documents.mjs's
// selectRelevantDocumentExcerpts) is `{ paragraph, text }`, not a plain
// string; a fixture or a record's own derived excerpt is a plain string.
// Stringifying the object form directly would render "[object Object]" and
// silently drop the actual quoted text from the brief.
function formatExcerpt(excerpt) {
  if (typeof excerpt === "string") return excerpt;
  if (excerpt && typeof excerpt.text === "string") {
    return Number.isFinite(excerpt.paragraph) ? `(paragraph ${excerpt.paragraph}) ${excerpt.text}` : excerpt.text;
  }
  return String(excerpt);
}

export function buildSourceTaggingBrief(record, officialDocumentExcerpts, taxonomy) {
  invariant(typeof record.id === "string" && record.id.length > 0, "Source brief requires a record id");
  invariant(typeof record.title === "string" && record.title.length > 0, "Source brief requires a record title");
  const excerpts = [...deriveRecordContentExcerpts(record), ...(officialDocumentExcerpts ?? [])];
  return {
    subjectType: "source",
    subjectId: record.id,
    text: [
      `Source title: ${record.title}`,
      `Publisher: ${record.publisher}`,
      `Kind: ${record.kind}`,
      `Source URL: ${record.url}`,
      ...excerpts.map((excerpt, index) => `Excerpt ${index + 1}: ${formatExcerpt(excerpt)}`)
    ].join("\n"),
    taxonomyDefinitions: taxonomyDefinitionsText(taxonomy)
  };
}

function tagAssignmentSchema(taxonomy) {
  const tagIds = [...taxonomy.tags.map((tag) => tag.id), "unknown"];
  return {
    type: "object",
    properties: {
      tags: { type: "array", items: { type: "string", enum: tagIds } },
      confidence: { type: "number" },
      supportingExcerpts: { type: "array", items: { type: "string" } }
    },
    required: ["tags", "confidence", "supportingExcerpts"],
    additionalProperties: false
  };
}

/**
 * `briefText`, when supplied, grounds `supportingExcerpts`: `isGrounded`
 * (scripts/lib/topic-routing.mjs) treats any non-empty excerpt array as
 * sufficient support for an auto-candidate, so an unvalidated excerpt would
 * let fabricated model text clear that gate. Each excerpt must therefore
 * appear verbatim in the exact material the tagger was actually given,
 * mirroring how citedEvidenceIds are checked against the supplied package
 * in scripts/lib/assessment-pipeline.mjs. Optional so callers that only
 * exercise the structural checks (tests, malformed-output fixtures) are not
 * forced to construct a matching brief.
 */
export function validateTagAssignmentOutput(output, taxonomy, briefText) {
  invariantValidTag(Array.isArray(output?.tags) && output.tags.length > 0, "Tag assignment must return at least one tag or \"unknown\"");
  for (const tagId of output.tags) {
    invariantValidTag(tagId === "unknown" || hasTag(taxonomy, tagId), `Tag assignment referenced an unknown tag id: ${tagId}`);
  }
  if (output.tags.length > 1) {
    invariantValidTag(!output.tags.includes("unknown"), "\"unknown\" cannot be combined with other tags");
  }
  invariantValidTag(Number.isFinite(output.confidence) && output.confidence >= 0 && output.confidence <= 1, "Tag assignment confidence must be between 0 and 1");
  invariantValidTag(Array.isArray(output.supportingExcerpts), "Tag assignment must return supportingExcerpts");
  if (typeof briefText === "string") {
    for (const excerpt of output.supportingExcerpts) {
      invariantValidTag(typeof excerpt === "string" && excerpt.length > 0 && briefText.includes(excerpt), `Tag assignment cites a supporting excerpt not present verbatim in the supplied brief: ${JSON.stringify(excerpt)}`);
    }
  }
  return output;
}

export async function requestTagAssignment({ provider, apiKey, model, brief, taxonomy, prompt }) {
  const response = await createStructuredModelResponse({
    provider,
    apiKey,
    model,
    instructions: prompt.instructions,
    input: { subjectType: brief.subjectType, subjectId: brief.subjectId, text: brief.text, taxonomyDefinitions: brief.taxonomyDefinitions },
    name: "topic_tag_assignment",
    schema: tagAssignmentSchema(taxonomy),
    metadata: { subjectId: brief.subjectId, promptVersion: prompt.version }
  });
  try {
    return {
      subjectId: brief.subjectId,
      provider: response.provider,
      model: response.model,
      promptVersion: prompt.version,
      promptContentHash: prompt.contentHash,
      usage: response.usage,
      output: validateTagAssignmentOutput(response.output, taxonomy, brief.text)
    };
  } catch (error) {
    // The API call already happened and already cost real tokens even
    // though its output failed validation -- attach the response metadata
    // to the thrown error so a caller isolating this failure (per subject)
    // can still account for it in a token-usage/spend total instead of the
    // paid call silently vanishing from every usage report.
    if (error instanceof TagValidationError) {
      error.provider = response.provider;
      error.model = response.model;
      error.usage = response.usage;
    }
    throw error;
  }
}
