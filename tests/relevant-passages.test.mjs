import assert from "node:assert/strict";
import test from "node:test";
import { ModelOutputError } from "../scripts/lib/model-output.mjs";
import { singleModelCall } from "../scripts/lib/paired-model-calls.mjs";
import { contextOfParagraphs, excerptAmendmentText, excerptLawChange, excerptText, lawChangeParagraphs, needsThirdCheck, relevanceDecision, wholeTextMaxLength } from "../scripts/lib/relevant-passages.mjs";

const relevant = (...paragraphs) => ({ relevant: true, paragraphs, reasonCz: "x" });
const notRelevant = { relevant: false, paragraphs: [], reasonCz: "x" };

test("two checks that agree decide; otherwise a third check's vote decides, and a tie keeps the pair", () => {
  assert.equal(needsThirdCheck(notRelevant, notRelevant), false);
  assert.equal(needsThirdCheck(relevant(1), relevant(2)), false);
  assert.equal(needsThirdCheck(relevant(1), notRelevant), true);
  assert.equal(needsThirdCheck(relevant(1), null), true, "an invalid output calls the third check");
  assert.deepEqual(relevanceDecision(notRelevant, notRelevant), { kept: false, paragraphs: null });
  assert.deepEqual(relevanceDecision(relevant(4, 2), relevant(2, 7)), { kept: true, paragraphs: [2, 4, 7] }, "the paragraphs both name, together");
  assert.deepEqual(relevanceDecision(relevant(3), notRelevant, relevant(5)), { kept: true, paragraphs: [3, 5] });
  assert.deepEqual(relevanceDecision(relevant(3), notRelevant, notRelevant), { kept: false, paragraphs: null }, "two of three find it not relevant");
  assert.deepEqual(relevanceDecision(relevant(3), notRelevant, null), { kept: true, paragraphs: [3] }, "an invalid third check leaves a tie, which keeps the pair");
  assert.deepEqual(relevanceDecision(null, notRelevant, notRelevant), { kept: false, paragraphs: null });
  assert.deepEqual(relevanceDecision(null, null, null), { kept: true, paragraphs: null }, "no valid output keeps the whole text");
  assert.deepEqual(relevanceDecision(relevant(), relevant()), { kept: true, paragraphs: null }, "relevant through an amendment alone keeps the whole text");
});

test("an excerpt holds the selected paragraphs in order and counts each left-out run", () => {
  const paragraphs = ["a", "b", "c", "d", "e"];
  assert.equal(excerptText(paragraphs, new Set([1, 2])), "[… 1 paragraph not concerning this promise left out …]\nb\nc\n[… 2 paragraphs not concerning this promise left out …]");
  assert.equal(excerptText(paragraphs, new Set()), "[… 5 paragraphs not concerning this promise left out …]");
  const long = `První\n\nDruhý\n${"Třetí ".repeat(400)}`;
  assert.deepEqual(excerptAmendmentText(long, [2]), { textCz: "[… 1 paragraph not concerning this promise left out …]\nDruhý\n[… 1 paragraph not concerning this promise left out …]", excerpt: { paragraphCount: 3, selectedCount: 1 } });
  assert.deepEqual(excerptAmendmentText("První\nDruhý", [2]).excerpt, { paragraphCount: 2, selectedCount: 2 }, `a text of at most ${wholeTextMaxLength} characters is kept whole`);
});

const filler = `Odůvodnění: ${"dlouhý text ".repeat(200)}`;
const proposed = ["ČÁST PRVNÍ", "Změna zákona o dani", "1. V § 5 odst. 1 se číslo „10“ nahrazuje číslem „12“.", "2. V § 6 se doplňuje odstavec 3, který zní:", "„(3) Nové pravidlo.“", "3. § 8 se zrušuje.", filler].join("\n");
const passed = proposed.replace("„12“", "„15“");
const change = {
  changeId: "1-1",
  versions: {
    proposed: { textCz: proposed, contextCz: "full context" },
    approved: { sameAs: "proposed", contextCz: "full context" },
    passed: { textCz: passed, contextCz: "full context" }
  }
};
const provision = (path) => ({ act: "1/2000", wording: "2026-01-01", path, citation: path, textCz: `text of ${path}` });
const versionContext = (text) => ({
  conductDate: "2026-02-01",
  amendedAct: "1/2000",
  instructions: [
    { instructionCz: text.split("\n")[2], targets: [{ target: "§ 5 odst. 1", status: "found", provisionIds: ["p5"] }] },
    { instructionCz: "2. V § 6 se doplňuje odstavec 3, který zní:", targets: [{ target: "§ 6", status: "found", provisionIds: ["p6"] }] },
    { instructionCz: "3. § 8 se zrušuje.", targets: [{ target: "§ 8", status: "found", provisionIds: ["p8"] }] }
  ],
  provisions: { p5: provision("par_5"), p6: provision("par_6"), p8: provision("par_8") }
});
const context = { versions: { proposed: versionContext(proposed), approved: versionContext(proposed), passed: versionContext(passed) } };
const left = (count) => `[… ${count} ${count === 1 ? "paragraph" : "paragraphs"} not concerning this promise left out …]`;

test("paragraphs are numbered across the versions with a text of their own", () => {
  assert.deepEqual(lawChangeParagraphs(change).map(({ number, version }) => [number, version]), [1, 2, 3, 4, 5, 6, 7].map((number) => [number, "proposed"]).concat([8, 9, 10, 11, 12, 13, 14].map((number) => [number, "passed"])));
});

test("a law change keeps the named paragraphs of each version and the context of only the provisions they amend", () => {
  const { change: excerpt, context: reduced } = excerptLawChange(change, [3, 10], context);
  assert.equal(excerpt.versions.proposed.textCz, `${left(2)}\n1. V § 5 odst. 1 se číslo „10“ nahrazuje číslem „12“.\n${left(4)}`);
  assert.deepEqual(excerpt.versions.proposed.excerpt, { paragraphCount: 7, selectedCount: 1 });
  assert.equal(excerpt.versions.proposed.contextCz, undefined, "the context text is written again from the reduced context");
  assert.deepEqual(excerpt.versions.approved, { sameAs: "proposed" }, "a version with the same text refers to the reduced one");
  assert.equal(excerpt.versions.passed.textCz, `${left(2)}\n1. V § 5 odst. 1 se číslo „10“ nahrazuje číslem „15“.\n${left(4)}`);
  for (const version of ["proposed", "approved", "passed"]) {
    assert.deepEqual(Object.keys(reduced.versions[version].provisions), ["p5"], version);
    assert.equal(reduced.versions[version].instructions.length, 1, version);
  }
  // Later versions the package does not hold still count in the numbering.
  const throughProposed = { ...change, versions: { proposed: change.versions.proposed } };
  assert.equal(excerptLawChange(throughProposed, [3, 10], context, change).change.versions.proposed.excerpt.selectedCount, 1);
  // When the checks named only a paragraph of such a later version, with no
  // paragraph of the same text in the version held, that version is whole.
  assert.deepEqual(excerptLawChange(throughProposed, [10], context, change).change.versions.proposed.excerpt, { paragraphCount: 7, selectedCount: 7 });
});

test("a paragraph named in one version is kept in every version with its text, and with the instruction it belongs to", () => {
  // The quoted new wording (5) keeps its instruction (4), and so does the
  // same wording in the passed text (12).
  const { change: excerpt, context: reduced } = excerptLawChange(change, [5], context);
  for (const version of ["proposed", "passed"]) {
    assert.equal(excerpt.versions[version].textCz, `${left(3)}\n2. V § 6 se doplňuje odstavec 3, který zní:\n„(3) Nové pravidlo.“\n${left(2)}`, version);
    assert.deepEqual(Object.keys(reduced.versions[version].provisions), ["p6"], version);
  }
});

test("a version with no paragraph kept and a short version are kept whole", () => {
  // Paragraph 3 differs between the versions: the passed text, of which no
  // paragraph was named, is kept whole.
  const { change: excerpt, context: reduced } = excerptLawChange(change, [3], context);
  assert.deepEqual(excerpt.versions.passed.excerpt, { paragraphCount: 7, selectedCount: 7 });
  assert.equal(excerpt.versions.passed.textCz, passed);
  assert.deepEqual(Object.keys(reduced.versions.passed.provisions), ["p5", "p6", "p8"]);
  const short = { changeId: "2-1", versions: { adopted: { textCz: "USNESENÍ\nVLÁDY\nI. schvaluje úkol" } } };
  assert.equal(excerptLawChange(short, [3]).change.versions.adopted.textCz, "USNESENÍ\nVLÁDY\nI. schvaluje úkol");
});

test("an instruction shortened to 300 characters is matched by its beginning", () => {
  const long = `1. V § 5 se ${"slovo ".repeat(60)}nahrazuje.`;
  const versionWithLong = { instructions: [{ instructionCz: `${long.slice(0, 299)}…`, targets: [{ provisionIds: ["p5"] }] }], provisions: { p5: provision("par_5"), p8: provision("par_8") } };
  assert.deepEqual(Object.keys(contextOfParagraphs(versionWithLong, [long]).provisions), ["p5"]);
  assert.deepEqual(Object.keys(contextOfParagraphs(versionWithLong, ["2. § 8 se zrušuje."]).provisions), []);
});

test("a third check is cached once valid and asked for again when invalid", async () => {
  const cache = { entries: {} };
  const saved = [];
  const persist = async (subjectId) => saved.push(subjectId);
  const fingerprint = { inputHash: "i", promptContentHash: "p", provider: "openai", model: "m" };
  let calls = 0;
  const invalid = () => { calls += 1; throw new ModelOutputError("bad"); };
  const valid = async () => { calls += 1; return { output: relevant(2), model: "m", usage: { input_tokens: 10, output_tokens: 2 } }; };
  const failed = await singleModelCall({ subjectId: "s", fingerprint, cache, persist, call: invalid });
  assert.deepEqual([failed.c, failed.invalidCount, saved.length], [null, 1, 0]);
  const made = await singleModelCall({ subjectId: "s", fingerprint, cache, persist, call: valid });
  assert.deepEqual([made.c, made.reused, saved], [relevant(2), false, ["s"]]);
  assert.deepEqual(made.usageByModel, [{ model: "m", usage: { input_tokens: 10, output_tokens: 2 } }]);
  const reused = await singleModelCall({ subjectId: "s", fingerprint, cache, persist, call: valid });
  assert.deepEqual([reused.c, reused.reused, calls], [relevant(2), true, 2]);
  await singleModelCall({ subjectId: "s", fingerprint: { ...fingerprint, inputHash: "j" }, cache, persist, call: valid });
  assert.equal(calls, 3, "another input is asked for");
});
