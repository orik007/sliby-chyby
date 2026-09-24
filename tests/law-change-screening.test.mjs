import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildRelevanceBrief,
  buildScreeningBrief,
  isKeptByRelevance,
  isSubstantive,
  lawChangeText,
  loadRelevancePrompt,
  loadScreeningPrompt,
  requestRelevance,
  requestScreening,
  validateRelevanceOutput,
  validateScreeningOutput
} from "../scripts/lib/law-change-screening.mjs";
import { ModelOutputError } from "../scripts/lib/topic-tagger.mjs";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import { validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v1.json", import.meta.url), "utf8")));
const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");

const change = {
  changeId: "43200-2",
  printNumber: 90,
  printKindId: "1",
  printTitleCz: "Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů",
  heading: "ČÁST DRUHÁ",
  titleCz: "Změna rozpočtových pravidel",
  acts: [{ act: "218/2000", name: "o rozpočtových pravidlech" }],
  textCz: "ČÁST DRUHÁ\nZměna rozpočtových pravidel\nV § 24 odst. 1 zákona č. 218/2000 Sb. se číslo „2“ nahrazuje číslem „3“."
};

function mockResponse(output, usage = { input_tokens: 100, output_tokens: 20 }) {
  let body = null;
  const fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ id: "resp", model: "gpt-6-luna", usage, output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }] }) };
  };
  return { fetch, body: () => body };
}

test("the screening and relevance prompts state the conservative rules", async () => {
  const screening = await loadScreeningPrompt();
  assert.equal(screening.version, "law-change-screener-v1");
  assert.match(screening.instructions, /When in doubt, the change is substantive/);
  assert.match(screening.instructions, /even one number/);
  const relevance = await loadRelevancePrompt();
  assert.equal(relevance.version, "relevance-check-v1");
  assert.match(relevance.instructions, /When in doubt, answer relevant/);
});

test("a model reads the full law-change text with its print, heading, and amended act", () => {
  const text = lawChangeText(change);
  assert.match(text, /^Chamber print 90 \(government bill\): Vládní návrh zákona/);
  assert.match(text, /Part: ČÁST DRUHÁ – Změna rozpočtových pravidel/);
  assert.match(text, /Amended act: zákon č\. 218\/2000 Sb\., o rozpočtových pravidlech/);
  assert.ok(text.endsWith(change.textCz));
  assert.match(lawChangeText({ ...change, heading: null, textCz: null }), /Official text: not available as a DOCX file; only the print title is known\./);
  const brief = buildScreeningBrief(change, taxonomy);
  assert.ok(brief.taxonomyDefinitions.includes("fiscal-rules"));
});

test("a screening output needs a verdict, a reason, valid tags, and verbatim excerpts", () => {
  const brief = buildScreeningBrief(change, taxonomy);
  const valid = { substantive: true, reasonCz: "Mění číslo v rozpočtových pravidlech.", tags: ["fiscal-rules"], confidence: 0.8, supportingExcerpts: ["Změna rozpočtových pravidel"] };
  assert.equal(validateScreeningOutput(valid, taxonomy, brief.text), valid);
  assert.throws(() => validateScreeningOutput({ ...valid, substantive: "yes" }, taxonomy, brief.text), ModelOutputError);
  assert.throws(() => validateScreeningOutput({ ...valid, reasonCz: "" }, taxonomy, brief.text), /reason/);
  assert.throws(() => validateScreeningOutput({ ...valid, supportingExcerpts: ["invented"] }, taxonomy, brief.text), /not present verbatim/);
});

test("a law change is dropped as technical only when both valid screeners say so", () => {
  const technical = { substantive: false };
  const substantive = { substantive: true };
  assert.equal(isSubstantive(technical, technical), false);
  assert.equal(isSubstantive(technical, substantive), true);
  assert.equal(isSubstantive(substantive, technical), true);
  assert.equal(isSubstantive(null, technical), true, "an invalid screener output never drops a change");
});

test("a pair is dropped as not relevant only when both valid checks say so", () => {
  assert.equal(isKeptByRelevance({ relevant: false }, { relevant: false }), false);
  assert.equal(isKeptByRelevance({ relevant: false }, { relevant: true }), true);
  assert.equal(isKeptByRelevance({ relevant: false }, null), true, "an invalid check output never drops a pair");
  assert.throws(() => validateRelevanceOutput({ relevant: true }), /reason/);
  assert.throws(() => validateRelevanceOutput({ reasonCz: "x" }), ModelOutputError);
});

test("screening sends the taxonomy first so it can be a cached prompt prefix", async () => {
  const mock = mockResponse({ substantive: false, reasonCz: "Jen přečíslování.", tags: ["unknown"], confidence: 0.2, supportingExcerpts: [] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const prompt = await loadScreeningPrompt();
    const result = await requestScreening({ provider: "openai", apiKey: "key", model: "gpt-6-luna", brief: buildScreeningBrief(change, taxonomy), taxonomy, prompt });
    assert.equal(result.output.substantive, false);
    assert.equal(result.usage.input_tokens, 100);
    const input = JSON.parse(mock.body().input);
    assert.deepEqual(Object.keys(input), ["taxonomyDefinitions", "changeId", "text"]);
    assert.equal(mock.body().text.format.name, "law_change_screening");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a relevance check reads the exact promise with its tests and the law-change text", async () => {
  const brief = buildRelevanceBrief(fiscalPromise, change);
  assert.equal(brief.pairId, `${fiscalPromise.id}--43200-2`);
  assert.ok(brief.promise.includes(fiscalPromise.originalTextCz));
  assert.ok(brief.promise.includes(`Fulfillment test: ${fiscalPromise.fulfillmentTest}`));
  assert.ok(brief.lawChange.includes(change.textCz));
  const mock = mockResponse({ relevant: true, reasonCz: "Pravidla se týkají schodku." });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const result = await requestRelevance({ provider: "openai", apiKey: "key", model: "gpt-6-luna", brief, prompt: await loadRelevancePrompt() });
    assert.equal(result.output.relevant, true);
    assert.equal(mock.body().text.format.name, "law_change_relevance");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
