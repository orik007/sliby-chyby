import assert from "node:assert/strict";
import test from "node:test";
import { instructionHead, instructionLines, parseAmendingInstructions, romanToNumber } from "../scripts/lib/amending-instructions.mjs";

// Every instruction below is quoted from a law change of a 10th-term print
// in the evidence packages of 27 September 2026 (the print is named).
const targetsOf = (text, act) => parseAmendingInstructions(text, act).flatMap(({ targets }) => targets);

test("names the paragraph a one-point change amends, without the act's amendment history", () => {
  // Print 77, law change 43184-22.
  const text = "ČÁST DVACÁTÁ DRUHÁ\nZměna zákona o zpracování osobních údajů\nČl. XXV\nV § 52 odst. 1 zákona č. 110/2019 Sb., o zpracování osobních údajů, ve znění zákona č. 448/2024 Sb., se věta poslední zrušuje.";
  assert.deepEqual(parseAmendingInstructions(text, "110/2019"), [{
    textCz: "V § 52 odst. 1 zákona č. 110/2019 Sb., o zpracování osobních údajů, ve znění zákona č. 448/2024 Sb., se věta poslední zrušuje.",
    targets: [{ kind: "section", act: "110/2019", section: "52", paragraph: "1" }]
  }]);
});

test("skips the act's introduction, renumbering, and quoted new text", () => {
  // Print 77, approved text of law change 43184-22, with invented quoted text.
  const text = [
    "Zákon č. 110/2019 Sb., o zpracování osobních údajů, ve znění zákona č. 448/2024 Sb., se mění takto:",
    "1. V § 51 se odstavec 3 zrušuje.",
    "Dosavadní odstavec 4 se označuje jako odstavec 3.",
    "2. V § 52 odst. 1 se věta poslední nahrazuje větou „V § 9 odst. 2 se slova „a“ zrušují.",
    "V § 10 se odstavec 1 zrušuje.“."
  ].join("\n");
  assert.deepEqual(targetsOf(text, "110/2019"), [
    { kind: "section", act: "110/2019", section: "51", paragraph: "3" },
    { kind: "section", act: "110/2019", section: "52", paragraph: "1" }
  ]);
});

test("reads a paragraph changed in place, and the whole section when one is inserted", () => {
  assert.deepEqual(targetsOf("V § 13 odstavec 2 včetně poznámky pod čarou č. 1 zní:", "175/2025"), [{ kind: "section", act: "175/2025", section: "13", paragraph: "2" }]);
  assert.deepEqual(targetsOf("V § 5 se odstavce 2 a 3 zrušují.", "1/2000"), [
    { kind: "section", act: "1/2000", section: "5", paragraph: "2" },
    { kind: "section", act: "1/2000", section: "5", paragraph: "3" }
  ]);
  // Prints 83 and 250: a paragraph or letter inserted into a section.
  assert.deepEqual(targetsOf("2. V § 20 se doplňují odstavce 3 a 4, které včetně poznámky pod čarou č. 45 znějí:", "111/1994"), [{ kind: "section", act: "111/1994", section: "20", paragraph: null }]);
  assert.deepEqual(targetsOf("V § 22d se za odstavec 4 vkládá nový odstavec 5, který zní:", "165/2012"), [{ kind: "section", act: "165/2012", section: "22d", paragraph: null }]);
  assert.deepEqual(targetsOf("§ 194 včetně nadpisu zní:", "283/2021"), [{ kind: "section", act: "283/2021", section: "194", paragraph: null }]);
});

test("names the neighbour and the new sections of an inserted section", () => {
  assert.deepEqual(targetsOf("Za § 8 se vkládají nové § 8a a 8b, které znějí:", "375/2022"), [
    { kind: "neighbour", act: "375/2022", section: "8", paragraph: null },
    { kind: "inserted", act: "375/2022", section: "8a", paragraph: null },
    { kind: "inserted", act: "375/2022", section: "8b", paragraph: null }
  ]);
});

test("expands section ranges and lists", () => {
  assert.deepEqual(targetsOf("V § 5 až 7 se slovo „ministerstvo“ nahrazuje slovem „úřad“.", "1/2000").map(({ section }) => section), ["5", "6", "7"]);
  assert.deepEqual(targetsOf("V § 32d odst. 2 se slova „podání žaloby“ nahrazují slovy „zahájení řízení o žalobě“.", "325/1999"), [{ kind: "section", act: "325/1999", section: "32d", paragraph: "2" }]);
});

test("reads an article or point of an amending act", () => {
  // Print 284, law change 43406-2.
  assert.deepEqual(targetsOf("V čl. II bodu 5 zákona č. 182/2024 Sb., kterým se mění zákon č. 254/2001 Sb., o vodách, se slova „1. ledna 2026“ nahrazují slovy „1. ledna 2027“.", "182/2024"), [
    { kind: "article", act: "182/2024", article: "2", point: "5", paragraph: null }
  ]);
  assert.equal(romanToNumber("XCII"), 92);
});

test("reads annexes, footnotes, and a missing § sign", () => {
  assert.deepEqual(targetsOf("V příloze č. 3 se bod 2 zrušuje.", "634/1992"), [{ kind: "annex", act: "634/1992", annex: "3", item: null }]);
  // Print 67: the only annex of act 634/2004 has no number.
  assert.deepEqual(targetsOf("Příloha k zákonu č. 634/2004 Sb., o správních poplatcích, ve znění zákona č. 217/2005 Sb., se mění takto:\n1. V položce 18 se slova „a“ zrušují.\n2. Za položku 57 se vkládá nová položka 57a, která zní:", "634/2004"), [
    { kind: "annex", act: "634/2004", annex: null, item: "18" },
    { kind: "annex", act: "634/2004", annex: null, item: "57" }
  ]);
  assert.deepEqual(targetsOf("Poznámky pod čarou č. 10 a 11 se zrušují.", "283/2021"), [
    { kind: "footnote", act: "283/2021", footnote: "10" },
    { kind: "footnote", act: "283/2021", footnote: "11" }
  ]);
  // Print 67 omits the § sign.
  assert.deepEqual(targetsOf("V 42 odst. 5 se věta první zrušuje.", "283/2021"), [{ kind: "section", act: "283/2021", section: "42", paragraph: "5" }]);
});

test("keeps instructions it cannot place, with no targets", () => {
  for (const text of [
    "V části třetí hlavě II se díl 2 včetně nadpisu zrušuje.",
    "V nadpisu části třetí se slova „PRO ROZPOČTOVÉ PROGNÓZY“ zrušují.",
    "V celém textu zákona se slova „ministerstvo“ nahrazují slovem „úřad“."
  ]) assert.deepEqual(parseAmendingInstructions(text, "283/2021"), [{ textCz: text, targets: [] }], text);
});

test("the instruction head stops at the new text", () => {
  assert.equal(instructionHead("V § 1 se na konci odstavce 5 tečka nahrazuje čárkou a doplňují se písmena e) a f), která znějí:"), "V § 1 se na konci odstavce 5 tečka nahrazuje čárkou a doplňují se písmena e) a f)");
  assert.deepEqual(instructionLines("Čl. I\nZměna zákona\nPodle § 5 lze uložit pokutu."), []);
});
