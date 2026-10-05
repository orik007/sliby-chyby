import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { arbiterPromptVersion, assessorPromptVersion, loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";
import { readerStatus } from "../scripts/lib/assessment-review.mjs";

// The assessors and the arbiter get their own prompt followed by
// docs/scoring.md unchanged, so the scoring rules live in one place.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const scoringRule = await read("docs/scoring.md");
const prompts = {
  assessor: await read(`automation/prompts/${assessorPromptVersion}.md`),
  arbiter: await read(`automation/prompts/${arbiterPromptVersion}.md`)
};

// Wording that belongs only to docs/scoring.md. A prompt carrying it would
// restate a scoring rule that can then drift from the canonical one.
const scoringRuleWording = [
  /strict majority/i,
  /outweighs a proposal/i,
  /vote date/i,
  /later passed the Senate|later fate/i,
  /elapsed time/i,
  /inactivity/i,
  /delivering the whole promise|contradicting the whole promise/i
];

for (const role of ["assessor", "arbiter"]) {
  test(`the ${role} receives its own prompt followed by docs/scoring.md unchanged`, async () => {
    const loaded = (await loadAssessmentPrompts())[role];
    assert.equal(loaded.instructions, `${prompts[role]}\n${scoringRule}`);
    assert.match(prompts[role], /The scoring rule follows\.\n$/);
  });

  test(`the ${role} prompt restates no scoring rule`, () => {
    for (const pattern of scoringRuleWording) assert.doesNotMatch(prompts[role], pattern, `${role} prompt restates ${pattern}`);
  });

  test(`the ${role} prompt maps every status to the score of docs/scoring.md`, () => {
    for (const [status, { score }] of Object.entries(readerStatus)) {
      const plain = score.replace("−", "-");
      assert.match(prompts[role], new RegExp(`\`${plain.replace("+", "\\+")}\`[^\\n]*\`${status}\`|\`${status}\`[^\\n,]*\`${plain.replace("+", "\\+")}\``), `${status} is ${plain}`);
      assert.match(scoringRule, new RegExp(`\\| \`${plain.replace("+", "\\+")}\` \\|`), `docs/scoring.md defines ${plain}`);
    }
  });
}

test("docs/scoring.md holds only the rule for scoring one promise", () => {
  assert.doesNotMatch(scoringRule, /SLAVA Index =|## SLAVA Index|## Audit/);
});

test("the assessor prompt states its own task: relevance, reading the package, and citations", () => {
  const rules = [
    ["only the supplied evidence", /Use only the supplied evidence package/],
    ["one relevance verdict for every law change", /For \*\*each\*\* law change in the package, add exactly one entry to `changeRelevance`/],
    ["sharing a topic is not relevance", /sharing only the general topic is not enough/],
    ["no relevant change is insufficient evidence", /If no law change is relevant, set `evidenceSufficient` to false/],
    ["the conduct's own version", /read the version that conduct concerns \(`structuredFacts\.concernsLawChanges`\)/],
    ["the effect of each relevant change, before and after", /For each relevant law change, also write `effectCz`/],
    ["the effect from the two wordings, not the label", /Judge the effect from the two wordings, never from the change's title, its stated purpose/],
    ["left-out law changes are not evidence", /`excludedLawChanges`, when present\): law changes that both assessors of an earlier assessment of this promise found not relevant[^\n]*never cite them and give them no relevance verdict/],
    ["a change amending no act states what it establishes", /A law change that amends no act \(a new act, a state budget, a treaty\) has no previous wording: state what it establishes/],
    ["conduct is judged by that effect", /compare the effect you stated in step 1, not the change's label, with what the promise commits to/],
    ["the maintenance classification is supplied", /Never infer a maintenance commitment yourself/],
    ["cite only package IDs", /Select the IDs only from the supplied package/],
    ["never cite an irrelevant change", /Never cite a law change you found not relevant when `evidenceSufficient` is true/]
  ];
  for (const [rule, pattern] of rules) assert.match(prompts.assessor, pattern, rule);
});

test("the arbiter prompt states its own task: choosing between the reviews", () => {
  const rules = [
    ["only the supplied package and reviews", /Use only the supplied package and reviews/],
    ["choose a review or cannot-decide", /Select `assessor-a`, select `assessor-b`, or return `cannot-decide`/],
    ["never select an unavailable review", /never select the unavailable assessor/],
    ["prefer the correct application of the scoring rule", /Prefer the review that applies the scoring rule at the end of these instructions correctly/],
    ["judge each conduct by the version it names", /Prefer the review that judges each conduct by the version it names/],
    ["relevance follows the full texts", /Prefer the review whose verdicts follow the full law-change texts/],
    ["the effect follows the wordings", /Prefer the review whose effect follows the previous wording in the context and the new text/],
    ["cite only supplied IDs", /cite only supplied evidence IDs/]
  ];
  for (const [rule, pattern] of rules) assert.match(prompts.arbiter, pattern, rule);
});
