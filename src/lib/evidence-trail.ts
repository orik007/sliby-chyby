import type { ContextOmission, EvidenceTrailEntry, EvidenceTrailPrint, EvidenceTrailRegulation, EvidenceTrailResolution, EvidenceTrailStep } from "./schema";

type ConductStep = Exclude<EvidenceTrailStep, { kind: "senate-resolution" }>;

const proposalLabels: Record<Extract<EvidenceTrailStep, { kind: "submission" }>["proposal"], string> = {
  "member-bill": "Předložení poslaneckého návrhu zákona",
  "government-bill": "Předložení vládního návrhu zákona",
  "state-budget": "Předložení vládního návrhu státního rozpočtu",
  treaty: "Předložení mezinárodní smlouvy vládou",
};

const clubLabels: Record<Extract<EvidenceTrailStep, { kind: "vote" }>["club"], string> = {
  yes: "Klub strany hlasoval pro",
  no: "Klub strany hlasoval proti",
  "no-majority": "Klub strany nedal většinu hlasů pro ani proti",
};

const textLabels: Record<ConductStep["version"], string> = {
  proposed: "Navržený text",
  approved: "Text schválený Sněmovnou",
  passed: "Text přijatý Parlamentem",
};

const noteLabels: Record<ConductStep["notes"][number]["note"], string> = {
  "published-version-missing": "Znění, kterého se krok týkal, psp.cz samostatně nezveřejňuje; odkaz vede na předchozí znění.",
  removed: "V tomto znění už tato část zákona nebyla.",
  "text-not-published": "Text tohoto znění psp.cz nezveřejňuje, známý je jen název tisku.",
  "third-reading-rejection": "Hlasovalo se o navrženém textu upraveném pozměňovacími návrhy, který psp.cz nezveřejňuje jako celek; odkaz vede na navržený text.",
  "promulgated-text": "Toto znění psp.cz nezveřejňuje; odkaz vede na zákon, jak byl vyhlášen ve Sbírce zákonů (e-Sbírka).",
};

// Data dates are calendar dates (YYYY-MM-DD); formatting them from their
// parts keeps the day independent of the build machine's time zone.
export function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day}. ${month}. ${year}`;
}

export function moreLawChangesLabel(count: number) {
  if (count === 1) return "a 1 další část";
  if (count <= 4) return `a ${count} další části`;
  return `a ${count} dalších částí`;
}

export function lawChangeLabel({ headingCz, titleCz }: EvidenceTrailPrint["lawChanges"][number]) {
  return headingCz ? `${headingCz} – ${titleCz}` : titleCz;
}

export function amendedActsLabel(acts: string[]) {
  if (acts.length === 0) return null;
  return `mění ${acts.length === 1 ? "zákon" : "zákony"} č. ${acts.map((act) => `${act} Sb.`).join(", ")}`;
}

const opinionLabels: Record<Extract<EvidenceTrailStep, { kind: "government-opinion" }>["opinion"], string> = {
  agrees: "Vláda s návrhem souhlasila",
  disagrees: "Vláda s návrhem nesouhlasila",
};

export function stepTitle(step: EvidenceTrailStep) {
  if (step.kind === "submission") return proposalLabels[step.proposal];
  if (step.kind === "vote") return clubLabels[step.club];
  if (step.kind === "government-opinion") return opinionLabels[step.opinion];
  return "Senát vrátil návrh Sněmovně";
}

export function stepDetails(step: EvidenceTrailStep) {
  if (step.kind === "submission") return [step.proposal === "member-bill" ? `Navrhovatelé: ${step.proposerCz ?? "poslanci"}; mezi nimi je alespoň jeden poslanec klubu strany.` : "Strana byla v den předložení součástí vlády."];
  if (step.kind === "government-opinion") return ["Stanovisko vlády k návrhu zákona, který vláda nepředložila; strana byla v den jeho rozeslání ve Sněmovně součástí vlády."];
  if (step.kind === "vote") {
    const { yes, no, abstained, notVoting, absent, unknown } = step.counts;
    const counts = [`pro: ${yes}`, `proti: ${no}`, ...(abstained ? [`zdrželi se: ${abstained}`] : []), ...(notVoting ? [`nehlasovali: ${notVoting}`] : []), ...(absent ? [`nepřítomni: ${absent}`] : []), ...(unknown ? [`neznámý záznam: ${unknown}`] : [])];
    return [`Rozhodnutí Sněmovny: ${step.stageCz}, ${step.actionCz}`, `Poslanci klubu strany: ${counts.join(" · ")}`];
  }
  return [];
}

export function stepLinks(step: EvidenceTrailStep, printUrl: string) {
  if (step.kind === "senate-resolution") return [{ label: `Usnesení Senátu (tisk ${step.printPartCz})`, url: step.url }];
  const text = step.textUrl ? [{ label: textLabels[step.version], url: step.textUrl }] : [];
  if (step.kind === "vote") return [{ label: "Výsledek hlasování", url: step.url }, ...text];
  if (step.kind === "government-opinion") return [{ label: `Stanovisko vlády (tisk ${step.printPartCz})`, url: step.url }, ...text];
  return [{ label: "Průběh projednávání", url: printUrl }, ...text];
}

export function stepNotes(step: EvidenceTrailStep, print: EvidenceTrailPrint) {
  if (step.kind === "senate-resolution") return [];
  return step.notes.map(({ note, lawChangeIds }) => {
    if (lawChangeIds.length === print.lawChanges.length) return noteLabels[note];
    const parts = print.lawChanges.filter(({ lawChangeId }) => lawChangeIds.includes(lawChangeId)).map(lawChangeLabel);
    return `${noteLabels[note]} Týká se: ${parts.join("; ")}.`;
  });
}

export function isRegulationEntry(entry: EvidenceTrailEntry): entry is EvidenceTrailRegulation {
  return "kind" in entry && entry.kind === "regulation";
}

export function isResolutionEntry(entry: EvidenceTrailEntry): entry is EvidenceTrailResolution {
  return "kind" in entry && entry.kind === "resolution";
}

export function trailStepCount(trail: EvidenceTrailEntry[]) {
  return trail.reduce((count, entry) => count + (isRegulationEntry(entry) || isResolutionEntry(entry) ? 1 : entry.steps.length), 0);
}

// A government regulation or ministerial decree: who adopted it, and that
// the party governed on that day.
export function regulationAdoptionTitle({ adoption }: EvidenceTrailRegulation) {
  return adoption.by === "government" ? "Vláda přijala nařízení" : "Ministerstvo vydalo vyhlášku";
}

export function regulationAdoptionDetails({ adoption }: EvidenceTrailRegulation) {
  return [`${adoption.by === "government" ? "Přijala vláda" : `Vydavatel: ${adoption.issuerCz}`}; strana byla v den přijetí součástí vlády.`];
}

export function contextOmissionTitle({ printNumber, headingCz, titleCz, version }: ContextOmission) {
  return `Sněmovní tisk ${printNumber}: ${headingCz ? `${headingCz} – ` : ""}${titleCz} (${textLabels[version].toLowerCase()})`;
}

export function contextOmissionSummary({ act, wordingFrom, suppliedCount, provisions }: ContextOmission) {
  const wording = wordingFrom ? `ve znění od ${formatDate(wordingFrom)}` : "ve vyhlášeném znění";
  return `zákon č. ${act} Sb. ${wording}: bez znění ${provisions.length} ustanovení, se zněním ${suppliedCount}`;
}
