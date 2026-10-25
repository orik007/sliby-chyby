import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { amendingPoints, annexSectionKey, sectionGroupHolds, sectionGroups, sectionKeysNamed } from "../scripts/lib/amending-points.mjs";
import { sectionsNamedInAmendment } from "../scripts/lib/psp-amendments.mjs";

// Part one of print 67 (the Building Act) as read with its Word list numbers
// from the proposed text (idd 266187) and the approved text (idd 280389):
// its opening paragraphs, its points on § 1 to § 12, and the first
// paragraphs of its article II.
const excerpt = JSON.parse(await readFile(new URL("./fixtures/print-67-part-one-excerpt.json", import.meta.url), "utf8"));
const versionTexts = Object.fromEntries(Object.entries(excerpt).map(([version, paragraphs]) => [version, { paragraphs: paragraphs.map(({ text }) => text), labels: paragraphs.map(({ label }) => label) }]));

test("an amending part's points are its continuing list numbers, each on the section it names first", () => {
  const { opening, points, rest } = amendingPoints(versionTexts.proposed.paragraphs, versionTexts.proposed.labels);
  assert.deepEqual(opening.slice(0, 3), ["ČÁST PRVNÍ", "Změna stavebního zákona", "Čl. I"]);
  assert.match(opening[3], /^Zákon č\. 283\/2021 Sb\., stavební zákon/);
  assert.equal(points.length, 25);
  assert.equal(points[0].paragraphs[0], "1. V nadpisu pod označením § 1 se slovo „úpravy“ nahrazuje slovy „a účel zákona“.");
  assert.deepEqual(points.map(({ section }) => section / 1000), [1, 1, 1, 1, 2, 2, 2, 3, 5, 5, 5, 6, 10, 10, ...Array(11).fill(12)]);
  assert.deepEqual(rest.slice(0, 2), ["Čl. II", "Přechodná ustanovení"]);
  const approved = amendingPoints(versionTexts.approved.paragraphs, versionTexts.approved.labels);
  assert.equal(approved.points.length, 29);
  assert.equal(amendingPoints(["ČÁST PRVNÍ", "V § 1 se …"], ["", "1."]), null, "one point is no list of points");
});

test("a large amending part is divided into the same groups of sections in every version", () => {
  const groups = sectionGroups(versionTexts, 4000);
  assert.deepEqual(groups.map(({ section }) => section.labelCz), ["body k § 1", "body k § 2 až § 11", "body k § 12", "Čl. II"]);
  assert.deepEqual(groups.map(({ section }) => [section.from, section.to]), [[null, 2000], [2000, 12000], [12000, null], [null, null]]);
  for (const group of groups) assert.deepEqual(Object.keys(group.versions), ["proposed", "approved"]);
  // Every group opens with the part's opening paragraphs and holds whole points.
  for (const group of groups.slice(0, 3)) assert.deepEqual(group.versions.approved.slice(0, 3), ["ČÁST PRVNÍ", "Změna stavebního zákona", "Čl. I"]);
  assert.match(groups[1].versions.proposed[4], /^5\. /);
  // Nothing is left out: the points and the article are all in the groups.
  for (const [version, { paragraphs }] of Object.entries(versionTexts)) {
    const opening = 4;
    // The further articles open with the part's heading and title only.
    const held = groups.reduce((sum, group) => sum + (group.versions[version]?.length ?? 0) - (group.section.rest ? 2 : opening), 0);
    assert.equal(held, paragraphs.length - opening, version);
  }
  const withoutArticle = Object.fromEntries(Object.entries(versionTexts).map(([version, { paragraphs, labels }]) => {
    const end = paragraphs.lastIndexOf("Čl. II");
    return [version, { paragraphs: paragraphs.slice(0, end), labels: labels.slice(0, end) }];
  }));
  // A later version never moves the groups' bounds.
  assert.deepEqual(sectionGroups({ proposed: versionTexts.proposed }, 4000).map(({ section }) => [section.from, section.to]), groups.map(({ section }) => [section.from, section.to]));
  assert.equal(sectionGroups(withoutArticle), null, "a part that forms one group is not divided");
  assert.equal(sectionGroups(versionTexts).length, 2, "its further article is a group of its own");
  assert.equal(sectionGroups({ ...versionTexts, approved: { paragraphs: versionTexts.approved.paragraphs, labels: null } }, 4000), null, "a version without list numbers keeps the part whole");
});

test("an amendment is matched to the groups whose sections or articles its instructions on the part name", () => {
  // Amendment SD 1054 to print 67 (Z1, Marian Jurečka), its instructions on
  // part one and part twenty-eight, shortened.
  const amendment = [
    "Pozměňovací návrh",
    "V části první čl. I se za dosavadní novelizační bod 331 vkládá nový bod X332, který zní:",
    "„X332. V § 144a se doplňují odstavce 4 až 6, které znějí:",
    "Následující novelizační body se přečíslují.",
    "V části první čl. I se za dosavadní novelizační bod 643 vkládá nový bod X644, který zní:",
    "„X644. V příloze č. 1 odst. 1 se na konci písmene a) doplňuje bod 46, který zní:",
    "V části dvacáté osmé čl. XLI se za dosavadní novelizační bod 4 vkládá nový bod X5, který zní:",
    "„X5. Za § 28 se vkládá nový § 28a, který včetně nadpisu zní:",
    "V části dvacáté osmé se za čl. XLI vkládá nový čl. XLIa, který včetně nadpisu zní:",
    "Odůvodnění",
    "Navrhuje se úprava § 1."
  ];
  const partOne = sectionsNamedInAmendment(amendment, "ČÁST PRVNÍ");
  assert.deepEqual(partOne, { sections: [144001, annexSectionKey], articles: ["Čl. I"] });
  assert.deepEqual(sectionsNamedInAmendment(amendment, "ČÁST DVACÁTÁ OSMÁ"), { sections: [28000, 28001], articles: ["Čl. XLI", "Čl. XLIa"] });
  const groups = [
    { from: null, to: 144000, rest: false, restArticles: ["Čl. II"] },
    { from: 144000, to: annexSectionKey, rest: false, restArticles: ["Čl. II"] },
    { from: annexSectionKey, to: null, rest: false, restArticles: ["Čl. II"] },
    { from: null, to: null, rest: true, restArticles: ["Čl. II"] }
  ];
  assert.deepEqual(groups.map((section) => sectionGroupHolds(section, partOne)), [false, true, true, false]);
  assert.deepEqual(groups.map((section) => sectionGroupHolds(section, { sections: [], articles: ["Čl. II"] })), [false, false, false, true]);
  assert.deepEqual(groups.map((section) => sectionGroupHolds(section, { sections: [], articles: ["Čl. I"] })), [true, true, true, true], "naming neither concerns every group");
  assert.equal(sectionGroupHolds(undefined, partOne), true, "an undivided part holds every amendment");
  assert.deepEqual(sectionKeysNamed("V § 1 se, v § 144a odst. 2 a § 28aa"), [1000, 144001, 28028]);
});
