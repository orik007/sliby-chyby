import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPromiseTaggingBrief,
  loadTaggingPrompt,
  ModelOutputError,
  requestTagAssignment,
  validateTagAssignmentOutput
} from "../scripts/lib/topic-tagger.mjs";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import { validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v1.json", import.meta.url), "utf8")));
const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");

test("loadTaggingPrompt hashes the versioned prompt file", async () => {
  const prompt = await loadTaggingPrompt();
  assert.equal(prompt.version, "promise-tagger-v1");
  assert.match(prompt.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(prompt.instructions.includes("Never invent a tag identifier"));
  assert.ok(prompt.instructions.includes("Never return an empty tag list"), "the prompt's tag contract must match validateTagAssignmentOutput's non-empty requirement, or a compliant zero-tag response would crash the run");
  assert.ok(prompt.instructions.includes("empty excerpt-citation list"), "an unknown result must never be told to explain itself in a citation, since only verbatim brief material can pass validateTagAssignmentOutput's grounding check");
});

test("buildPromiseTaggingBrief includes only the promise's own supplied fields and the taxonomy definitions", () => {
  const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
  assert.equal(brief.subjectType, "promise");
  assert.equal(brief.subjectId, fiscalPromise.id);
  assert.ok(brief.text.includes("vyrovnaný rozpočet"));
  assert.ok(brief.taxonomyDefinitions.includes("deficit-and-debt"));
});

test("buildPromiseTaggingBrief includes the promise's own source context, per the design doc's step 3", () => {
  const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
  const source = fiscalPromise.promiseSource;
  assert.ok(brief.text.includes(source.title), "source title must inform classification, not just the derived promise text");
  assert.ok(brief.text.includes(source.publisher));
  assert.ok(brief.text.includes(source.url));
  if (source.locator) assert.ok(brief.text.includes(source.locator));
  if (source.exactQuoteCz) assert.ok(brief.text.includes(source.exactQuoteCz));
});

test("validateTagAssignmentOutput rejects an invented tag id", () => {
  assert.throws(() => validateTagAssignmentOutput({ tags: ["not-a-real-tag"], confidence: 0.8, supportingExcerpts: [] }, taxonomy), /unknown tag id/);
});

test("validateTagAssignmentOutput throws specifically ModelOutputError, distinguishable from a transport/provider failure", () => {
  // A caller (scripts/run-topic-routing.mjs) must be able to isolate
  // an invalid model *output* from a network, auth, or quota failure inside
  // requestTagAssignment -- catching by class, not just by "it threw",
  // keeps that distinction reliable rather than accidentally silencing an
  // outage as if it were an ordinary invalid answer.
  assert.throws(() => validateTagAssignmentOutput({ tags: ["not-a-real-tag"], confidence: 0.8, supportingExcerpts: [] }, taxonomy), ModelOutputError);
});

test("validateTagAssignmentOutput rejects unknown combined with a real tag", () => {
  assert.throws(() => validateTagAssignmentOutput({ tags: ["deficit-and-debt", "unknown"], confidence: 0.8, supportingExcerpts: [] }, taxonomy), /cannot be combined/);
});

test("validateTagAssignmentOutput accepts a valid real-tag result", () => {
  const output = validateTagAssignmentOutput({ tags: ["deficit-and-debt"], confidence: 0.9, supportingExcerpts: ["exact quote"] }, taxonomy);
  assert.deepEqual(output.tags, ["deficit-and-debt"]);
});

test("validateTagAssignmentOutput accepts a supportingExcerpt present verbatim in the supplied brief", () => {
  const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
  const verbatimExcerpt = fiscalPromise.originalTextCz;
  const output = validateTagAssignmentOutput({ tags: ["deficit-and-debt"], confidence: 0.9, supportingExcerpts: [verbatimExcerpt] }, taxonomy, brief.text);
  assert.deepEqual(output.supportingExcerpts, [verbatimExcerpt]);
});

test("validateTagAssignmentOutput rejects a fabricated supportingExcerpt not present in the supplied brief", () => {
  const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
  assert.throws(
    () => validateTagAssignmentOutput({ tags: ["deficit-and-debt"], confidence: 0.9, supportingExcerpts: ["text the model invented, never supplied to it"] }, taxonomy, brief.text),
    /not present verbatim/
  );
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
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ tags: ["deficit-and-debt"], confidence: 0.95, supportingExcerpts: [fiscalPromise.originalTextCz] }) }] }]
      })
    };
  };
  try {
    const prompt = { version: "promise-tagger-v1", contentHash: "fixture-hash", instructions: "fixture instructions" };
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

test("requestTagAssignment attaches the already-spent usage/model/provider to a ModelOutputError instead of losing them", async () => {
  // The paid call happens before validation ever runs, so a caller
  // isolating this one invalid attempt (scripts/run-topic-routing.mjs)
  // must still be able to fold its cost into a token-usage total -- losing
  // it here would make every reported spend estimate an undercount whenever
  // a tagger call is invalid.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: "resp_fixture",
      model: "gpt-5.6-terra",
      usage: { input_tokens: 11, output_tokens: 3 },
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ tags: ["not-a-real-tag"], confidence: 0.9, supportingExcerpts: [] }) }] }]
    })
  });
  try {
    const prompt = { version: "promise-tagger-v1", contentHash: "fixture-hash", instructions: "fixture instructions" };
    const brief = buildPromiseTaggingBrief(fiscalPromise, taxonomy);
    await assert.rejects(
      () => requestTagAssignment({ provider: "openai", apiKey: "fixture-key", model: "gpt-5.6-terra", brief, taxonomy, prompt }),
      (error) => {
        assert.ok(error instanceof ModelOutputError);
        assert.equal(error.model, "gpt-5.6-terra");
        assert.equal(error.provider, "openai");
        assert.equal(error.usage.input_tokens, 11);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
