import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildRelevanceBrief,
  buildScreeningBrief,
  isKeptByRelevance,
  isSubstantive,
  amendmentRelevanceInputBlocks,
  buildAmendmentRelevanceBrief,
  keptPromptContentHash,
  loadAmendmentRelevancePrompt,
  lawChangeKind,
  lawChangeText,
  loadRelevancePrompt,
  loadScreeningPrompt,
  requestRelevance,
  requestScreening,
  validateRelevanceOutput,
  validateScreeningOutput
} from "../scripts/lib/law-change-screening.mjs";
import { ModelOutputError } from "../scripts/lib/model-output.mjs";
import { loadTrackedPromises } from "../scripts/lib/published-promises.mjs";
import { validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

// Stub calls never belong in a real run's spend log.
delete process.env.SLIBY_MODEL_CALL_LOG;

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v2.json", import.meta.url), "utf8")));
const registry = await loadTrackedPromises(fileURLToPath(new URL("..", import.meta.url)));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");

const proposedText = "ČÁST DRUHÁ\nZměna rozpočtových pravidel\nV § 24 odst. 1 zákona č. 218/2000 Sb. se číslo „2“ nahrazuje číslem „3“.";
const change = {
  changeId: "43200-2",
  printNumber: 90,
  printKindId: "1",
  printTitleCz: "Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů",
  heading: "ČÁST DRUHÁ",
  titleCz: "Změna rozpočtových pravidel",
  addedIn: "proposed",
  acts: [{ act: "218/2000", name: "o rozpočtových pravidlech" }],
  versions: {
    proposed: { heading: "ČÁST DRUHÁ", titleCz: "Změna rozpočtových pravidel", textCz: proposedText, document: null },
    approved: { heading: "ČÁST DRUHÁ", titleCz: "Změna rozpočtových pravidel", textCz: proposedText.replace("„3“", "„4“"), document: null }
  },
  senateResolutions: [{ partNumber: 2, document: null, textCz: "V čl. II bodu 1 číslo „4“ nahradit číslem „5“." }]
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
  assert.equal(screening.version, "law-change-screener-v6");
  assert.doesNotMatch(screening.instructions, /excerpt|supportingExcerpts/i, "screeners quote nothing");
  assert.match(screening.instructions, /When in doubt, the change is substantive/);
  assert.match(screening.instructions, /even one number/);
  const relevance = await loadRelevancePrompt();
  assert.equal(relevance.version, "relevance-check-v7");
  assert.match(relevance.instructions, /When in doubt, answer relevant/);
  assert.match(relevance.instructions, /its title names the one commitment assessed/);
});

test("a prompt keeps the earlier prompt's results except on the kinds of law change it names", async () => {
  const current = await loadScreeningPrompt();
  assert.equal(current.keeps, null, "the active prompts keep no earlier results");
  assert.equal(keptPromptContentHash(current, change), null);
  const earlier = "a".repeat(64);
  const prompt = await loadScreeningPrompt(undefined, { contentHash: earlier, rerun: ["government-resolution", "treaty"] });
  assert.equal(keptPromptContentHash(prompt, change), earlier, "a bill's result is kept");
  assert.equal(keptPromptContentHash(prompt, { ...change, printKindId: "4" }), null, "a treaty is screened again");
  assert.equal(keptPromptContentHash(prompt, { ...change, printKindId: "government-resolution" }), null);
  assert.equal(keptPromptContentHash(prompt, { ...change, printKindId: "ministerial-decree" }), earlier);
  assert.deepEqual(["1", "2", "3", "5", 4, "government-regulation"].map((printKindId) => lawChangeKind({ printKindId })), ["chamber-print", "chamber-print", "chamber-print", "chamber-print", "treaty", "government-regulation"]);
  await assert.rejects(() => loadScreeningPrompt(undefined, { contentHash: current.contentHash, rerun: [] }), /another prompt/);
  await assert.rejects(() => loadScreeningPrompt(undefined, { contentHash: "x", rerun: [] }), /another prompt/);
  await assert.rejects(() => loadScreeningPrompt(undefined, { contentHash: earlier, rerun: ["resolution"] }), /kinds of law change/);
  await assert.rejects(() => loadRelevancePrompt(undefined, { contentHash: earlier }), /kinds of law change/);
});

test("a model reads every version of the law change with its print, heading, amended act, and never the print-wide Senate resolution", () => {
  const text = lawChangeText(change);
  assert.match(text, /^Chamber print 90 \(government bill\): Vládní návrh zákona/);
  assert.match(text, /Part: ČÁST DRUHÁ – Změna rozpočtových pravidel/);
  assert.match(text, /Amended act: zákon č\. 218\/2000 Sb\., o rozpočtových pravidlech/);
  assert.ok(text.includes(`Version: proposed text\n${proposedText}`));
  assert.ok(text.includes("Version: text approved by the Chamber\nČÁST DRUHÁ"));
  assert.doesNotMatch(text, /Senate/, "a print-wide Senate resolution is not part of one law change");
  const same = lawChangeText({ ...change, versions: { proposed: change.versions.proposed, approved: { sameAs: "proposed", document: null } } });
  assert.match(same, /Version: text approved by the Chamber\nThe same text as the proposed text\./);
  const titleOnly = lawChangeText({ ...change, heading: null, versions: { proposed: { heading: null, titleCz: change.printTitleCz, textCz: null, document: null } }, senateResolutions: [] });
  assert.match(titleOnly, /Version: proposed text\nNot available as a DOCX or DOC file; only the print title is known\./);
  const removed = lawChangeText({ ...change, versions: { proposed: change.versions.proposed, approved: { removed: true } } });
  assert.match(removed, /Version: text approved by the Chamber\nThis part is not in this text: it was removed during the debate\./);
  assert.match(lawChangeText({ ...change, addedIn: "approved" }), /This part was added during the debate; it is not in the proposed text\./);
  const brief = buildScreeningBrief(change, taxonomy);
  assert.ok(brief.taxonomyDefinitions.includes("fiscal-rules"));
});

test("a screening output needs a verdict, a reason, valid tags, and a confidence", () => {
  const valid = { substantive: true, reasonCz: "Mění číslo v rozpočtových pravidlech.", tags: ["fiscal-rules"], confidence: 0.8 };
  assert.equal(validateScreeningOutput(valid, taxonomy), valid);
  assert.throws(() => validateScreeningOutput({ ...valid, substantive: "yes" }, taxonomy), ModelOutputError);
  assert.throws(() => validateScreeningOutput({ ...valid, reasonCz: "" }, taxonomy), /reason/);
  assert.throws(() => validateScreeningOutput({ ...valid, confidence: 2 }, taxonomy), /confidence/);
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

test("screening sends the taxonomy as its own cached block before the law change", async () => {
  const mock = mockResponse({ substantive: false, reasonCz: "Jen přečíslování.", tags: ["unknown"], confidence: 0.2 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const prompt = await loadScreeningPrompt();
    const result = await requestScreening({ provider: "openai", apiKey: "key", model: "gpt-6-luna", brief: buildScreeningBrief(change, taxonomy), taxonomy, prompt });
    assert.equal(result.output.substantive, false);
    assert.equal(result.usage.input_tokens, 100);
    const [message] = mock.body().input;
    assert.equal(message.role, "user");
    assert.deepEqual(message.content.map(({ type, prompt_cache_breakpoint }) => [type, prompt_cache_breakpoint]), [["input_text", { mode: "explicit" }], ["input_text", { mode: "explicit" }]]);
    assert.ok(message.content[0].text.startsWith("Topic taxonomy:\n\n- id: "));
    assert.ok(message.content[1].text.startsWith(`Law change ${change.changeId}:\n\n`));
    assert.ok(message.content[1].text.includes(proposedText));
    assert.equal(mock.body().text.format.name, "law_change_screening");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a screening answer cut off at the output cap is an invalid output, with its paid usage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: "resp_cut", model: "gpt-6-luna", status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 100, output_tokens: 48_000 }, output: [{ type: "reasoning", summary: [] }] }) });
  try {
    const prompt = await loadScreeningPrompt();
    await assert.rejects(requestScreening({ provider: "openai", apiKey: "key", model: "gpt-6-luna", brief: buildScreeningBrief(change, taxonomy), taxonomy, prompt }), (error) => error instanceof ModelOutputError && /cut off \(max_output_tokens\)/.test(error.message) && error.usage.output_tokens === 48_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a relevance check reads the exact promise with its tests and the law-change text", async () => {
  const brief = buildRelevanceBrief(fiscalPromise, change);
  assert.equal(brief.pairId, `${fiscalPromise.id}--43200-2`);
  assert.ok(brief.promise.includes(`Promise (the commitment assessed): ${fiscalPromise.titleCz}`));
  assert.ok(brief.promise.includes(`Exact source wording (Czech): ${fiscalPromise.originalTextCz}`));
  assert.ok(brief.lawChange.includes(proposedText));
  const mock = mockResponse({ relevant: true, reasonCz: "Pravidla se týkají schodku." });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetch;
  try {
    const result = await requestRelevance({ provider: "openai", apiKey: "key", model: "gpt-6-luna", brief, prompt: await loadRelevancePrompt() });
    assert.equal(result.output.relevant, true);
    assert.equal(mock.body().text.format.name, "law_change_relevance");
    // The law change is a cached block before the promise, so the checks of
    // one change against many promises read it from the prompt cache.
    const [message] = mock.body().input;
    assert.deepEqual(message.content.map(({ text, prompt_cache_breakpoint }) => [text, prompt_cache_breakpoint]), [
      [`Law change:\n\n${brief.lawChange}`, { mode: "explicit" }],
      [brief.promise, { mode: "explicit" }]
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an amendment is checked against a promise with its text first, the same for every promise", async () => {
  const prompt = await loadAmendmentRelevancePrompt();
  assert.equal(prompt.version, "amendment-relevance-v1");
  assert.match(prompt.instructions, /When in doubt, answer relevant/);
  const item = { documentNumber: "1054", printNumber: 67, printTitleCz: "Návrh zákona, kterým se mění stavební zákon", amendment: { label: "Z1", presentedOn: "2026-04-15", presenterCz: "Poslanec Marian Jurečka", textCz: "V části první čl. I se za bod 331 vkládá nový bod X332." } };
  const brief = buildAmendmentRelevanceBrief(fiscalPromise, item);
  assert.equal(brief.pairId, `${fiscalPromise.id}--amendment-1054`);
  const [amendmentBlock, promiseBlock] = amendmentRelevanceInputBlocks(brief);
  assert.equal(amendmentBlock, "Amendment Z1 (parliamentary document 1054) to Chamber print 67: Návrh zákona, kterým se mění stavební zákon, presented in the second reading on 2026-04-15 by Poslanec Marian Jurečka; it amends the proposed text of the bill:\nV části první čl. I se za bod 331 vkládá nový bod X332.");
  assert.match(promiseBlock, /^Promise \(the commitment assessed\): /);
  const other = registry.promises.find(({ id }) => id !== fiscalPromise.id);
  assert.equal(amendmentRelevanceInputBlocks(buildAmendmentRelevanceBrief(other, item))[0], amendmentBlock);
});
