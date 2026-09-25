import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hashText, loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";

// The assessors and the arbiter apply docs/scoring.md through their prompts.
// The patterns below match the prompts' wording of that document; they are
// not a source of rules. They were checked against the version of
// docs/scoring.md whose hash is recorded here, so any change to it fails
// until the prompts and these patterns are brought in line with it.
const reviewedScoringHash = "0341b6a6ef07e2791f462559ecd40707f79239d4777cfd7233c17030642b171b";

test("the prompt checks were reviewed against the current docs/scoring.md", async () => {
  const scoring = await readFile(new URL("../docs/scoring.md", import.meta.url), "utf8");
  assert.equal(hashText(scoring), reviewedScoringHash, "docs/scoring.md changed: bring the assessor and arbiter prompts and the patterns in this test in line with it, then record its new hash here");
});

const conductRules = [
  ["a whole-promise decision is fulfilled", /majority `yes` on a measure delivering the whole promise(?::| is) `fulfilled`/],
  ["a part-promise decision moves towards", /on a (?:measure delivering only a )?part(?::)? `moving-towards`/],
  ["voting down a contradicting measure moves towards", /majority `no` on a (?:measure contradicting the promise|contradicting measure)(?::| is) `moving-towards`/],
  ["adopting a contradiction or rejecting delivery acts against", /majority `yes` on a measure contradicting the whole promise, or majority `no` on a measure delivering the whole promise(?::|, is) `acting-against`/],
  ["a partial contradiction or partial rejection moves against", /majority `yes` on a measure contradicting only a part, or majority `no` on a measure delivering only a part(?::|, is) `moving-against`/],
  ["no strict majority on a delivering measure moves against", /no strict majority at a decisive vote on a measure delivering the promise(?::| is) `moving-against`/],
  ["a proposal is never fulfilled or acting against", /never `fulfilled` or `acting-against`/],
  ["a decision outweighs a proposal; the most recent decides", /A decision outweighs a proposal; among conduct of the same weight, the most recent decides/i],
  ["inactivity is never negative", /elapsed time and inactivity are never negative/i],
  ["a vote is scored on the vote date", /[Ss]core(?:d)? (?:a vote by|by) the party's own choice on the vote date/],
  ["the later fate of a measure does not change the vote", /[Ww]hether the measure later passed the Senate, survived a presidential return, or took effect does not change it/]
];

test("the assessor prompt states every scoring rule of docs/scoring.md", async () => {
  const { assessor } = await loadAssessmentPrompts();
  for (const [rule, pattern] of conductRules) assert.match(assessor.instructions, pattern, rule);
  const rules = [
    ["only the supplied evidence", /Use only the supplied evidence package/],
    ["each conduct is judged by its own version", /Judge every conduct by its own version: a submission by the proposed text, a vote by the text it decided on/],
    ["a later decision decides by its own text", /When a later decision concerns a text that no longer delivers what the proposal delivered, that decision decides by its own text/],
    ["a proposal moves towards when in line and against when contradicting", /A \*\*proposal\*\* is a member bill or a government proposal: in line with the promise `moving-towards`; contradicting it `moving-against`/],
    ["a maintenance baseline moves towards", /When `assessmentContext\.maintenanceBaseline` is present, it is the supplied audit determination that the promise qualifies\. In `live` mode, choose `moving-towards` for it/],
    ["one relevance verdict for every law change", /For \*\*each\*\* law change in the package, add exactly one entry to `changeRelevance`/],
    ["sharing a topic is not relevance", /sharing only the general topic is not enough/],
    ["no relevant change is insufficient evidence", /If no law change is relevant, set `evidenceSufficient` to false/],
    ["cite only package IDs", /Select the IDs only from the supplied package/],
    ["never cite an irrelevant change", /Never cite a law change you found not relevant when `evidenceSufficient` is true/]
  ];
  for (const [rule, pattern] of rules) assert.match(assessor.instructions, pattern, rule);
});

test("the arbiter prompt states the same scoring rules and may only choose between the reviews", async () => {
  const { arbiter } = await loadAssessmentPrompts();
  for (const [rule, pattern] of conductRules) assert.match(arbiter.instructions, pattern, rule);
  const rules = [
    ["only the supplied package and reviews", /Use only the supplied package and reviews/],
    ["a proposal moves towards when in line and against when contradicting", /a member bill or a government proposal is a proposal: `moving-towards` when in line with the promise, `moving-against` when contradicting it/],
    ["choose a review or cannot-decide", /Select `assessor-a`, select `assessor-b`, or return `cannot-decide`/],
    ["a maintenance baseline moves towards", /when `assessmentContext\.maintenanceBaseline` is present in a live package, the review should select `moving-towards`/],
    ["never select an unavailable review", /never select the unavailable assessor/],
    ["judge each conduct by its own version", /judges each conduct by its own version/],
    ["a later decision by its own text", /a later decision by its own text even when the earlier proposal was in line with the promise/],
    ["relevance follows the full texts", /Prefer the review whose verdicts follow the full law-change texts/],
    ["cite only supplied IDs", /cite only supplied evidence IDs/]
  ];
  for (const [rule, pattern] of rules) assert.match(arbiter.instructions, pattern, rule);
});
