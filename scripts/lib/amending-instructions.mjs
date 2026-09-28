/**
 * Reads the amending instructions of one law-change version and names the
 * provisions they change (docs/evidence-pipeline.md, Law-change context).
 * Only instructions are read: quoted new text („…“) and the provisions it
 * inserts are never taken for instructions. JavaScript's \b knows only ASCII
 * letters, so word ends after Czech letters are matched with `(?!\p{L})`.
 */

const end = "(?![\\p{L}\\d])";
const start = "(?<![\\p{L}\\d])";
const instructionStartPattern = new RegExp(`^(?:\\d+\\.\\s+)?(?:(?:V|Ve|Za|Před|Na|Nad|Pod)${end}|§|Přílo|Pozn|Nadpis|Slov|Text|Odstav|Písmen|Část|Hlav|Díl|Oddíl|Vět|Polož|Čl\\.|Článek)`, "u");
const instructionVerbPattern = new RegExp(`${start}(?:zní|znějí|zrušuj[eí]|vklád[aá]j?[ií]?|doplňuj[eí]|nahrazuj[eí]|mění|vypouští)${end}`, "u");
const renumberingPattern = new RegExp(`^(?:\\d+\\.\\s+)?Dosavadní${end}`, "u");
const actIntroductionPattern = new RegExp(`^(?:\\d+\\.\\s+)?Zákon\\s+č\\.\\s*\\d+/\\d{4}\\s*Sb\\..*${start}se\\s+mění\\s+takto`, "u");
const globalPattern = new RegExp(`${start}v\\s+celém\\s+(?:textu\\s+)?(?:zákona|zákoně|předpisu)${end}`, "iu");
const footnotePattern = new RegExp(`${start}poznám\\p{L}*\\s+pod\\s+čarou\\s+č\\.\\s*(\\d+[a-z]?)((?:\\s*(?:,|a|až)\\s*\\d+[a-z]?)*)`, "iu");
const annexPattern = new RegExp(`^(?:\\d+\\.\\s+)?(?:(?:V|Ve)\\s+)?(?:nadpisu\\s+)?přílo\\p{L}*`, "iu");
// "Příloha k zákonu č. 634/2004 Sb. … se mění takto:" introduces instructions
// that change the items of that annex.
const annexIntroductionPattern = new RegExp(`^(?:\\d+\\.\\s+)?Přílo\\p{L}*(?:\\s+č\\.\\s*(\\d+))?.*${start}se\\s+mění\\s+takto`, "u");
const itemPattern = new RegExp(`${start}(polož|bod)\\p{L}*\\s+(\\d+[a-z]?)`, "iu");
const letterPattern = /^\s+písm\.\s*([a-z]{1,2})\)/u;
// "se vkládá nový odstavec 3", "se doplňují odstavce 3 a 4": the paragraphs
// an instruction itself inserts.
const insertedParagraphsPattern = new RegExp(`${start}(?:vkládá|vkládají|doplňuje|doplňují)\\s+(?:se\\s+)?(?:nov\\p{L}+\\s+)?odstav\\p{L}*\\s+(\\d+)((?:\\s*(?:,|a|až)\\s*\\d+)*)`, "u");
const divisionPattern = new RegExp(`^(?:\\d+\\.\\s+)?(?:(?:V|Ve|Za|Před|Na\\s+konci)\\s+)?(?:nadpisu\\s+)?(?:část|části|hlav|díl|oddíl|pododdíl|názvu|nadpis)`, "iu");
const insertsParagraphPattern = new RegExp(`${start}(?:vkládá|vkládají|doplňuje|doplňují)\\s+(?:se\\s+)?(?:nov\\p{L}+\\s+)?(?:odstav|písmen|bod)`, "u");
const insertedSectionPattern = new RegExp(`${start}(?:vkládá|vkládají|doplňuje|doplňují)\\s+(?:se\\s+)?(?:nov\\p{L}+\\s+)?§§?\\s*\\d`, "u");
const articlePattern = new RegExp(`${start}(?:čl\\.|článk\\p{L}*)\\s*([IVXLCDM]+|\\d+[a-z]?)${end}(?:\\s+(?:bod\\p{L}*)\\s+(\\d+))?(?:\\s+odst\\.\\s*(\\d+))?`, "gu");

const romanValues = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function romanToNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (!/^[IVXLCDM]+$/.test(value)) return null;
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    const current = romanValues[value[index]];
    const next = romanValues[value[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

/**
 * The place an instruction changes: its text before the first quotation,
 * colon, or "který … zní", without the amendment history of an act named in
 * it ("ve znění zákona č. …"), which names other acts.
 */
export function instructionHead(line) {
  const head = line.split(/„|:|,?\s+kter[ýéáí]\s+(?:zní|znějí|včetně)/u)[0];
  return head.replace(/,?\s+ve\s+znění\s+[^§]*?(?=,\s*se\s|\s+se\s|$)/gu, "");
}

function numbersIn(text) {
  return [...text.matchAll(/(?<![\p{L}\d])(\d+[a-z]?)(?![\p{L}\d])/gu)].map((match) => match[1]);
}

function expandRange(first, last) {
  if (!/^\d+$/.test(first) || !/^\d+$/.test(last) || Number(last) <= Number(first) || Number(last) - Number(first) > 50) return [first, last];
  return Array.from({ length: Number(last) - Number(first) + 1 }, (_, index) => String(Number(first) + index));
}

function listed(first, rest) {
  if (!rest) return [first];
  const numbers = numbersIn(rest);
  return /až/u.test(rest) && numbers.length === 1 ? expandRange(first, numbers[0]) : [first, ...numbers];
}

// The act an instruction names ("V § 5 zákona č. 110/2019 Sb."), or the
// amended act of its law change when it names none.
function actOf(head, amendedAct) {
  return /(?:zákona|zákonu|zákon)\s+č\.\s*(\d+\/\d{4})\s*Sb\./u.exec(head)?.[1] ?? amendedAct;
}

/**
 * The § targets of one instruction head. A paragraph is a target only when
 * the instruction changes it in place ("V § 52 odst. 1", "V § 5 se odstavec
 * 2 zrušuje", "V § 13 odstavec 2 zní"); when the instruction inserts or
 * appends a paragraph, letter, point, sentence, or words, the whole § is the
 * target, so its current text is supplied.
 */
function sectionTargets(head, act) {
  const targets = [];
  const insertsInto = insertsParagraphPattern.test(head);
  const pattern = /§§?\s*(\d+[a-z]{0,2})((?:\s*(?:,|a|až)\s*\d+[a-z]{0,2}(?!\s*(?:odst|písm)))*)(\s+odst\.\s*\d+(?:\s*(?:,|a|až)\s*\d+)*)?/gu;
  for (const match of head.matchAll(pattern)) {
    const sections = listed(match[1], match[2]);
    let paragraphs = match[3] ? listed(numbersIn(match[3])[0], match[3].replace(/^\s+odst\.\s*\d+/u, "")) : [];
    if (paragraphs.length === 0 && sections.length === 1) {
      const named = /^\s+(?:se\s+)?(?:odstavec|odstavce)\s+(\d+)((?:\s*(?:,|a|až)\s*\d+)*)/u.exec(head.slice(match.index + match[0].length));
      if (named) paragraphs = listed(named[1], named[2]);
    }
    if (insertsInto || sections.length > 1) paragraphs = [];
    // A letter changed in place: "V § 24 odst. 24 písm. a) se slova …".
    const letter = !insertsInto && sections.length === 1 && paragraphs.length <= 1 ? letterPattern.exec(head.slice(match.index + match[0].length))?.[1] ?? null : null;
    for (const section of sections) {
      if (paragraphs.length === 0) targets.push({ kind: "section", act, section, paragraph: null, ...(letter ? { letter } : {}) });
      for (const paragraph of paragraphs) targets.push({ kind: "section", act, section, paragraph, ...(letter ? { letter } : {}) });
    }
    // The paragraphs the instruction inserts have no earlier text; a later
    // instruction that changes them names a new provision.
    const insertedParagraphs = sections.length === 1 ? insertedParagraphsPattern.exec(head.slice(match.index + match[0].length)) : null;
    if (insertedParagraphs) {
      for (const paragraph of listed(insertedParagraphs[1], insertedParagraphs[2])) targets.push({ kind: "inserted", act, section: sections[0], paragraph });
    }
  }
  return targets;
}

// "V čl. II bodu 5 zákona č. 182/2024 Sb." or "V čl. 5 odst. 2": an article
// of an amending act or of an act divided into articles.
function articleTargets(head, act) {
  const targets = [];
  for (const match of head.matchAll(articlePattern)) {
    const article = romanToNumber(match[1].replace(/[a-z]$/u, ""));
    if (article === null) continue;
    targets.push({ kind: "article", act, article: String(article), point: match[2] ?? null, paragraph: match[3] ?? null });
  }
  return targets;
}

// An item of an annex: a fee-schedule item ("položka 18", `pol_18`) or a
// point ("bod 2", `bod_2`).
function itemOf(match) {
  return { kind: match[1].toLowerCase().startsWith("polož") ? "pol" : "bod", number: match[2] };
}

/**
 * The lines of a version text outside quoted new text that are
 * instructions. A quotation opened and not closed on a line continues on
 * the next lines.
 */
export function instructionLines(text) {
  const lines = [];
  let insideQuote = false;
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const opened = (line.match(/„/gu) ?? []).length;
    const closed = (line.match(/“/gu) ?? []).length;
    if (insideQuote) {
      if (closed > opened) insideQuote = false;
      continue;
    }
    if (line.startsWith("„")) {
      insideQuote = opened > closed;
      continue;
    }
    if (opened > closed) insideQuote = true;
    if (instructionStartPattern.test(line) && instructionVerbPattern.test(line)) lines.push(line);
  }
  return lines;
}

/**
 * The instructions of one version and their targets. Each instruction is
 * `{ textCz, targets }`. A target is `{ kind, act, … }`:
 * - `section`: a § (`section`) and, when changed in place, its `paragraph`
 *   and `letter`;
 * - `neighbour`: the § after which new §§ are inserted;
 * - `inserted`: a § (`paragraph` null) or a paragraph of a § that the
 *   instruction itself inserts (no earlier text);
 * - `article`: an article (`article`, arabic) and its `point` or `paragraph`;
 * - `annex`: an annex (`annex`, null for the only, unnumbered one), or one
 *   `item` of it (`{ kind: "pol", number }` for a fee-schedule item,
 *   `{ kind: "bod", number }` for a point);
 * - `footnote`: a footnote (`footnote`).
 * An instruction without targets is one the rules do not recognise (a whole
 * part, head, or division, a title, a global replacement of words).
 * Renumbering (`Dosavadní …`) and the introduction of the amended act
 * (`Zákon č. … se mění takto:`) are not instructions.
 */
export function parseAmendingInstructions(text, amendedAct) {
  const instructions = [];
  let annexInView = null;
  for (const line of instructionLines(text)) {
    if (renumberingPattern.test(line) || actIntroductionPattern.test(line)) continue;
    const annexIntroduction = annexIntroductionPattern.exec(line);
    if (annexIntroduction) {
      annexInView = { annex: annexIntroduction[1] ?? null };
      continue;
    }
    // "V 42 odst. 5 se …": a § sign missing in the official text.
    const head = instructionHead(line).replace(/^((?:\d+\.\s+)?V\s+)(\d+[a-z]{0,2}\s+(?:odst\.|se\s))/u, "$1§ $2");
    const textCz = line.length > 300 ? `${line.slice(0, 299)}…` : line;
    const act = actOf(head, amendedAct);
    const namesSection = head.includes("§");
    const namesArticle = new RegExp(`${start}(?:čl\\.|článk)`, "u").test(head);
    const footnote = footnotePattern.exec(head);
    // An annex may itself be divided into articles ("V příloze č. 1 čl. A").
    if (!namesSection && annexPattern.test(head)) {
      const numbered = /přílo\p{L}*\s+č\.\s*(\d+)/iu.exec(head);
      const item = itemPattern.exec(head);
      instructions.push({ textCz, targets: [{ kind: "annex", act, annex: numbered ? numbered[1] : null, item: item ? itemOf(item) : null }] });
      continue;
    }
    // An item of the annex introduced before ("V položce 18 …").
    const item = itemPattern.exec(head);
    if (annexInView && !namesSection && item) {
      instructions.push({ textCz, targets: [{ kind: "annex", act, annex: annexInView.annex, item: itemOf(item) }] });
      continue;
    }
    if (!namesSection && !namesArticle && footnote) {
      instructions.push({ textCz, targets: listed(footnote[1], footnote[2]).map((number) => ({ kind: "footnote", act, footnote: number })) });
      continue;
    }
    if (!namesSection && !namesArticle && (globalPattern.test(head) || divisionPattern.test(head))) {
      instructions.push({ textCz, targets: [] });
      continue;
    }
    const inserted = insertedSectionPattern.exec(head);
    if (inserted && namesSection && head.indexOf("§") < inserted.index) {
      // "Za § 8 se vkládá nový § 8a": § 8 is the neighbour; § 8a is new.
      const neighbour = /§\s*(\d+[a-z]{0,2})/u.exec(head)[1];
      const newPart = head.slice(inserted.index);
      const first = /§§?\s*(\d+[a-z]{0,2})((?:\s*(?:,|a|až)\s*\d+[a-z]{0,2})*)/u.exec(newPart);
      const newSections = first ? listed(first[1], first[2]) : [];
      instructions.push({ textCz, targets: [{ kind: "neighbour", act, section: neighbour, paragraph: null }, ...newSections.map((section) => ({ kind: "inserted", act, section, paragraph: null }))] });
      continue;
    }
    instructions.push({ textCz, targets: namesArticle ? articleTargets(head, act) : sectionTargets(head, act) });
  }
  return instructions;
}
