import { promulgatedWording } from "./e-sbirka.mjs";
import { citationOfPath, eSbirkaProvisionUrl } from "./law-context.mjs";

const versionLabelsCz = { proposed: "navržený text", approved: "text schválený Sněmovnou", passed: "text přijatý Parlamentem" };

function dateCz(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day}. ${month}. ${year}`;
}

/** One line of the human review naming a law change, its act and wording, and the counts. */
export function contextOmissionLabel({ printNumber, headingCz, titleCz, version, act, wordingFrom, suppliedCount, provisions }) {
  const wording = wordingFrom ? `ve znění od ${dateCz(wordingFrom)}` : "ve vyhlášeném znění";
  return `Tisk ${printNumber}: ${headingCz ? `${headingCz} – ` : ""}${titleCz} (${versionLabelsCz[version]}), zákon č. ${act} Sb. ${wording}: chybí znění ${provisions.length} ustanovení, k dispozici ${suppliedCount}`;
}

/**
 * The context left out of an evidence package so that the models could read
 * it (docs/evidence-pipeline.md, Package), as the human review and the
 * public site show it: per law-change version and per amended act and
 * wording, the provisions whose wording the assessors did not receive, each
 * linked to that wording in e-Sbírka. Empty for a package that was not
 * trimmed.
 */
export function contextOmissionsOf(evidencePackage) {
  const changes = new Map(evidencePackage.evidence.filter(({ role }) => role === "law-change").map((item) => [item.id, item]));
  return (evidencePackage.generation?.contextOmissions ?? []).flatMap(({ evidenceId, version, suppliedCount, omitted }) => {
    const change = changes.get(evidenceId);
    if (!change) throw new Error(`Context omission names ${evidenceId}, which is not in the package`);
    const byWording = omitted.map(({ act, wording, paths }) => ({ act, wording, provisions: paths.map((path) => ({ citationCz: citationOfPath(path), url: eSbirkaProvisionUrl({ act, wording, path }) })) }));
    return byWording.map(({ act, wording, provisions }) => ({
      lawChangeId: evidenceId,
      printNumber: change.structuredFacts.printNumber,
      headingCz: change.structuredFacts.heading ?? null,
      titleCz: change.structuredFacts.titleCz,
      version,
      act,
      wordingFrom: wording === promulgatedWording ? null : wording,
      wordingUrl: eSbirkaProvisionUrl({ act, wording, path: "" }),
      suppliedCount,
      provisions
    }));
  });
}
