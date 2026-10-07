import { createCollectedRecord, invariant } from "./collector-core.mjs";
import { promulgatedParagraphs, promulgatedTextUrl } from "./print-parts.mjs";
import { governmentPartiesOn } from "./psp-collector.mjs";

/**
 * Government regulations and ministerial decrees from the Collection of Laws
 * (docs/evidence-pipeline.md, Collection of Laws data rules): which acts they
 * are, who adopted them and when, and their text, read with a law-context
 * reader (scripts/lib/e-sbirka.mjs). Each one is a record of its adoption,
 * attributed to every governing party on the adoption date (docs/scoring.md),
 * and carries its text, from which it is one law change.
 */

export const regulationSourceId = "esbirka-regulations";

// The kinds of act, by the start of their short citation in e-Sbírka.
const kindsByCitation = [
  ["Nařízení vlády č.", "government-regulation"],
  ["Vyhláška č.", "ministerial-decree"]
];

/** Whether a law-change kind (`printKindId`) is a regulation or decree. */
export function isRegulationKind(kind) {
  return kindsByCitation.some(([, regulationKind]) => regulationKind === kind);
}

export function regulationKindOfCitation(citation) {
  return kindsByCitation.find(([start]) => String(citation).startsWith(start))?.[1] ?? null;
}

const months = { ledna: 1, února: 2, března: 3, dubna: 4, května: 5, června: 6, července: 7, srpna: 8, září: 9, října: 10, listopadu: 11, prosince: 12 };

/** The ISO date of a Czech date in words ("ze dne 23. září 2026,"), or null. */
export function czechDate(text) {
  const [, day, month, year] = /^ze\s+dne\s+(\d{1,2})\.\s*([\p{L}]+)\s+(\d{4})/u.exec(String(text ?? "").trim()) ?? [];
  if (!day || !months[month]) return null;
  return `${year}-${String(months[month]).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * The acts a regulation or decree is issued under, from the sentence that
 * says who issues it ("… stanoví podle § 29 odst. 2 zákona č. 266/2025 Sb., …
 * k provedení § 20 odst. 9 zákona …"): the act after each "podle" or "k
 * provedení", not the acts its amendment history names ("ve znění zákona
 * č. …"). The act may be cited as “zákona č.”, “k zákonu č.”, or “zákona
 * České národní rady č.”.
 */
export function enablingActsOf(sentence) {
  const acts = [];
  for (const [, act] of String(sentence).matchAll(/(?:podle|provedení)\s+(?:(?!zákon[au]|ve\s+znění)[\s\S]){0,240}?zákon[au]\s+(?:(?:České\s+národní\s+rady|Federálního\s+shromáždění)\s+)?č\.\s*(\d+\/\d{4})\s*Sb\./gu)) {
    if (!acts.includes(act)) acts.push(act);
  }
  return acts;
}

/**
 * Who adopted a regulation or decree and when, from its promulgated wording:
 * the date its heading (`dokument/prefix`) states ("ze dne …"), and the
 * sentence naming who issues it ("Vláda nařizuje …", "Ministerstvo vnitra
 * stanoví …"), in the heading or, in a decree of several parts, at the start
 * of each part, ending with a colon, whose sentences together name the acts
 * it is issued under.
 * `issuer` is `government`, `ministry` (also one acting with another
 * body), or `other`, from the first such sentence; null fields mean the
 * wording does not state them.
 */
export function regulationHeading(nodes) {
  const prefix = nodes.filter(([path, text]) => path.startsWith("dokument/prefix/") && text !== null).map(([, text]) => text.trim());
  const adoptedOn = prefix.map(czechDate).find(Boolean) ?? null;
  // "stanoví" ends in a letter outside ASCII, so no \b: the verb is followed
  // by white space, and the sentence states the act it is issued under.
  const verb = /\s(?:nařizuje|stanoví)\s/u;
  // An issuing sentence names its issuer before the verb, never a passive
  // "… se stanoví" of the text itself, and ends with a colon: in the acts of
  // 15 December 2025 to 6 October 2026, all 152 issuing sentences did, and
  // none of the 5 sentences of their provisions and annexes that also name
  // someone who "stanoví podle" something.
  const issuerOf = (text) => text.split(verb)[0].trim();
  // The wording can hold zero-width characters (a zero-width space before
  // "podle" in 582/2025 Sb.), which are not white space.
  const sentences = nodes.map(([, text]) => text?.replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "").trim() ?? "").filter((text) => verb.test(text) && /^\p{Lu}/u.test(text) && !/\sse$/u.test(issuerOf(text)) && /\spodle\s|provedení/u.test(text) && text.endsWith(":"));
  const issuerCz = sentences.length > 0 ? issuerOf(sentences[0]) : null;
  const issuer = issuerCz === null ? null : /^Vláda$/u.test(issuerCz) ? "government" : /^Ministerstv/u.test(issuerCz) ? "ministry" : "other";
  return { adoptedOn, issuerCz, issuer, enablingActs: [...new Set(sentences.flatMap(enablingActsOf))] };
}


// How many numbers in a row e-Sbírka must not hold before a year's acts are
// taken to end: the Collection numbers its acts of a year without gaps
// (checked on 6 October 2026: 1 to 586 of 2025, 1 to 179 of 2026).
const missingInARow = 3;

/**
 * Every government regulation and ministerial decree promulgated on or after
 * `since` (the source's `bootstrapFrom`), read act by act: each year's acts
 * are numbered from 1 without gaps. Returns the records of those adopted by
 * the government or a ministry while a tracked government governed, and
 * quality figures for every act read, including those left out and why.
 */
export async function collectRegulations({ reader, governmentPeriods, since, today, source, onAct = () => {} }) {
  invariant(/^\d{4}-\d{2}-\d{2}$/u.test(since) && /^\d{4}-\d{2}-\d{2}$/u.test(today), "collectRegulations needs since and today as YYYY-MM-DD");
  const quality = { actsRead: 0, regulations: 0, governmentRegulations: 0, ministerialDecrees: 0, attributed: 0, notYetDigitised: [], adoptedBeforeGovernment: 0, otherIssuers: {}, unreadableHeadings: [] };
  const records = [];
  for (let year = Number(since.slice(0, 4)); year <= Number(today.slice(0, 4)); year += 1) {
    let missing = 0;
    for (let number = 1; missing < missingInARow; number += 1) {
      const act = `${number}/${year}`;
      const info = await reader.citation(act);
      if (info === null) {
        missing += 1;
        continue;
      }
      missing = 0;
      quality.actsRead += 1;
      const kind = regulationKindOfCitation(info.citation);
      if (!kind || info.promulgatedOn < since) continue;
      quality.regulations += 1;
      quality[kind === "government-regulation" ? "governmentRegulations" : "ministerialDecrees"] += 1;
      const result = await readRegulation({ reader, act, kind, info, governmentPeriods, source });
      if (result.record) {
        quality.attributed += 1;
        records.push(result.record);
      } else if (result.reason === "not-yet-digitised") quality.notYetDigitised.push({ act, promulgatedOn: info.promulgatedOn });
      else if (result.reason === "unreadable-heading") quality.unreadableHeadings.push(act);
      else if (result.reason === "other-issuer") quality.otherIssuers[result.issuerCz] = (quality.otherIssuers[result.issuerCz] ?? 0) + 1;
      else if (result.reason === "before-government") quality.adoptedBeforeGovernment += 1;
      onAct({ act, outcome: result.outcome });
    }
  }
  return { records, quality };
}

/**
 * One government regulation or ministerial decree (`kind`, `info` from
 * reader.citation): its adoption record, or why it has none (`reason`): its
 * text is not yet digitised, its heading states no adoption date or issuer,
 * another authority than the government or a ministry issued it, or no
 * tracked government governed on its adoption date.
 */
export async function readRegulation({ reader, act, kind, info, governmentPeriods, source }) {
  const nodes = await reader.nodes(act, "0000-00-00");
  const paragraphs = promulgatedParagraphs(nodes, act);
  // e-Sbírka publishes the text of a new act within 30 days (222/2016 Sb.,
  // § 12(9)); until then it holds only a notice, and a later run reads it.
  if (paragraphs === null) return { reason: "not-yet-digitised", outcome: "not yet digitised" };
  const heading = regulationHeading(nodes);
  if (!heading.adoptedOn || !heading.issuer) return { reason: "unreadable-heading", outcome: "heading not readable" };
  if (heading.issuer === "other") return { reason: "other-issuer", issuerCz: heading.issuerCz, outcome: `issued by ${heading.issuerCz}` };
  const partyIds = governmentPartiesOn(governmentPeriods, heading.adoptedOn);
  if (partyIds.length === 0) return { reason: "before-government", outcome: `adopted on ${heading.adoptedOn}, before a tracked government` };
  return { record: regulationRecord({ act, kind, info, heading, partyIds, paragraphs, source }), outcome: `${kind}, adopted on ${heading.adoptedOn}` };
}

// The Ministry of the Interior has 30 days to publish the text of a newly
// promulgated act (222/2016 Sb., § 12(9)).
const digitisationDays = 30;

/**
 * The run warning for an act whose text e-Sbírka does not hold yet: a later
 * run reads it, and one still missing after the 30 days the law allows is
 * flagged for a check in e-Sbírka.
 */
export function notYetDigitisedWarning({ act, promulgatedOn }, today) {
  const days = Math.round((Date.parse(today) - Date.parse(promulgatedOn)) / 86_400_000);
  return days > digitisationDays
    ? `${act} Sb. (promulgated ${promulgatedOn}) is still not digitised in e-Sbírka ${days} days after its promulgation, past the ${digitisationDays} days of 222/2016 Sb., § 12(9); check it in e-Sbírka`
    : `${act} Sb. (promulgated ${promulgatedOn}) is not yet digitised in e-Sbírka; a later run reads it`;
}

/** The identifier of a regulation's print-like unit (`sb-2026-178`). */
export function regulationPrintId(act) {
  const [number, year] = act.split("/");
  return `sb-${year}-${number}`;
}

function regulationRecord({ act, kind, info, heading, partyIds, paragraphs, source }) {
  const [number, year] = act.split("/");
  return createCollectedRecord({
    id: `${regulationSourceId}--${year}-${number}`,
    sourceId: source.id,
    kind: "regulation-adoption",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: `${heading.adoptedOn}T00:00:00`,
    timeZone: "Europe/Prague",
    title: `${info.citation}: ${info.title}`,
    publisher: "Ministry of the Interior of the Czech Republic (Collection of Laws)",
    url: promulgatedTextUrl(act),
    payload: {
      externalPrintId: regulationPrintId(act),
      act,
      regulationKind: kind,
      citationCz: info.citation,
      titleCz: info.title,
      issuerCz: heading.issuerCz,
      adoptedOn: heading.adoptedOn,
      promulgatedOn: info.promulgatedOn,
      enablingActs: heading.enablingActs,
      proposal: { kind, proposerPartyIds: partyIds },
      paragraphs
    }
  });
}
