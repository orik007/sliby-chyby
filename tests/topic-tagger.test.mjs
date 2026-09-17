import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPromiseTaggingBrief,
  buildSourceTaggingBrief,
  loadTaggingPrompt,
  requestTagAssignment,
  validateTagAssignmentOutput
} from "../scripts/lib/topic-tagger.mjs";
import { validatePromiseRegistry } from "../scripts/lib/evidence-matcher.mjs";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v1.json", import.meta.url), "utf8")));
const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/matching/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");

test("loadTaggingPrompt hashes the versioned prompt file", async () => {
  const prompt = await loadTaggingPrompt();
  assert.equal(prompt.version, "tagger-v1");
  assert.match(prompt.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(prompt.instructions.includes("Never invent a tag identifier"));
});

test("buildPromiseTaggingBrief includes only the promise's own supplied fields and the taxonomy definitions", () => {
  const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
  assert.equal(brief.subjectType, "promise");
  assert.equal(brief.subjectId, fiscalPromise.id);
  assert.ok(brief.text.includes("vyrovnaný rozpočet"));
  assert.ok(brief.taxonomyDefinitions.includes("deficit-and-debt"));
});

test("buildSourceTaggingBrief includes only supplied source metadata, excerpts, and the taxonomy definitions", () => {
  const record = createCollectedRecord({
    id: "psp--fixture",
    sourceId: "psp-core-2025",
    kind: "legislative-step",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-06-01T00:00:00",
    title: "Novela zákona o pravidlech rozpočtové odpovědnosti",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/historie.sqw?o=10&t=1",
    payload: { externalPrintId: "1" }
  });
  const brief = buildSourceTaggingBrief(record, ["official excerpt about the deficit rule"], taxonomy);
  assert.equal(brief.subjectType, "source");
  assert.ok(brief.text.includes("official excerpt about the deficit rule"));
  assert.ok(brief.taxonomyDefinitions.includes("fiscal-rules"));
});

test("validateTagAssignmentOutput rejects an invented tag id", () => {
  assert.throws(() => validateTagAssignmentOutput({ tags: ["not-a-real-tag"], confidence: 0.8, supportingExcerpts: [] }, taxonomy), /unknown tag id/);
});

test("validateTagAssignmentOutput rejects unknown combined with a real tag", () => {
  assert.throws(() => validateTagAssignmentOutput({ tags: ["deficit-and-debt", "unknown"], confidence: 0.8, supportingExcerpts: [] }, taxonomy), /cannot be combined/);
});

test("validateTagAssignmentOutput accepts a valid real-tag result", () => {
  const output = validateTagAssignmentOutput({ tags: ["deficit-and-debt"], confidence: 0.9, supportingExcerpts: ["exact quote"] }, taxonomy);
  assert.deepEqual(output.tags, ["deficit-and-debt"]);
});

test("requestTagAssignment calls the shared OpenAI structured-response endpoint and validates its output", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, init) => {
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        id: "resp_fixture",
        model: "gpt-5.6-terra",
        usage: { input_tokens: 42, output_tokens: 7 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ tags: ["deficit-and-debt"], confidence: 0.95, supportingExcerpts: ["fixture excerpt"] }) }] }]
      })
    };
  };
  try {
    const prompt = { version: "tagger-v1", contentHash: "fixture-hash", instructions: "fixture instructions" };
    const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
    const result = await requestTagAssignment({ provider: "openai", apiKey: "fixture-key", model: "gpt-5.6-terra", brief, taxonomy, prompt });
    assert.equal(capturedBody.model, "gpt-5.6-terra");
    assert.equal(capturedBody.text.format.name, "topic_tag_assignment");
    assert.equal(result.subjectId, fiscalPromise.id);
    assert.deepEqual(result.output.tags, ["deficit-and-debt"]);
    assert.equal(result.usage.input_tokens, 42);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
