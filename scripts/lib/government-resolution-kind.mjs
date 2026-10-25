/**
 * The names a government resolution goes by in the pipeline: its source and
 * the kind of its record and law change (scripts/lib/government-resolutions.mjs).
 */
export const resolutionSourceId = "zvlady-resolutions";
export const resolutionKind = "government-resolution";

// The part of a government resolution a law change is, after the
// resolution's own title: its heading and, when it has one, its own title
// ("– Příloha č. 1, Ministr dopravy, úkol č. 3: Návrh zákona, …"); nothing for
// a whole resolution.
export function resolutionPartName({ printTitleCz, heading, titleCz }) {
  if (!heading) return "";
  return ` – ${heading}${titleCz && !printTitleCz.endsWith(titleCz) ? `: ${titleCz}` : ""}`;
}
