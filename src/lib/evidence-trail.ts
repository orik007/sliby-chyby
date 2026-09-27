import type { EvidenceTrailPrint, EvidenceTrailStep } from "./schema";

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
  "third-reading-rejection": "Hlasovalo se o navrženém textu upraveném pozměňovacími návrhy, který psp.cz nezveřejňuje jako celek; odkaz vede na navržený text.",
};

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("cs-CZ");
}

export function lawChangeLabel({ headingCz, titleCz }: EvidenceTrailPrint["lawChanges"][number]) {
  return headingCz ? `${headingCz} – ${titleCz}` : titleCz;
}

export function amendedActsLabel(acts: string[]) {
  if (acts.length === 0) return null;
  return `mění ${acts.length === 1 ? "zákon" : "zákony"} č. ${acts.map((act) => `${act} Sb.`).join(", ")}`;
}

export function stepTitle(step: EvidenceTrailStep) {
  if (step.kind === "submission") return proposalLabels[step.proposal];
  if (step.kind === "vote") return clubLabels[step.club];
  return "Senát vrátil návrh Sněmovně";
}

export function stepDetails(step: EvidenceTrailStep) {
  if (step.kind === "submission") return [step.proposal === "member-bill" ? `Navrhovatelé: ${step.proposerCz ?? "poslanci"}; mezi nimi je alespoň jeden poslanec klubu strany.` : "Strana byla v den předložení součástí vlády."];
  if (step.kind === "vote") {
    const { yes, no, abstained, notVoting, absent } = step.counts;
    const counts = [`pro: ${yes}`, `proti: ${no}`, ...(abstained ? [`zdrželi se: ${abstained}`] : []), ...(notVoting ? [`nehlasovali: ${notVoting}`] : []), ...(absent ? [`nepřítomni: ${absent}`] : [])];
    return [`Rozhodnutí Sněmovny: ${step.stageCz}, ${step.actionCz}`, `Poslanci klubu strany: ${counts.join(" · ")}`];
  }
  return [];
}

export function stepLinks(step: EvidenceTrailStep, printUrl: string) {
  if (step.kind === "senate-resolution") return [{ label: `Usnesení Senátu (tisk ${step.printPartCz})`, url: step.url }];
  const text = step.textUrl ? [{ label: textLabels[step.version], url: step.textUrl }] : [];
  if (step.kind === "vote") return [{ label: "Výsledek hlasování", url: step.url }, ...text];
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

// A short line for the revision history panel.
export function stepSummary(step: EvidenceTrailStep) {
  if (step.kind === "submission") return `${formatDate(step.date)} · předložení návrhu`;
  if (step.kind === "vote") return `${formatDate(step.date)} · ${step.club === "yes" ? "klub pro" : step.club === "no" ? "klub proti" : "klub bez většiny"}, ${step.counts.yes}:${step.counts.no}`;
  return "Senát vrátil návrh";
}

export function stepSummaryLink(step: EvidenceTrailStep, printUrl: string) {
  if (step.kind === "vote") return { label: "hlasování", url: step.url };
  if (step.kind === "senate-resolution") return { label: "usnesení", url: step.url };
  return { label: "průběh", url: printUrl };
}

export function trailStepCount(trail: EvidenceTrailPrint[]) {
  return trail.reduce((count, print) => count + print.steps.length, 0);
}
