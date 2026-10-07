import { unzipSync } from "fflate";
import { log } from "./run-log.mjs";
import {
  cleanText,
  createCollectedRecord,
  deduplicateRecords,
  invariant
} from "./collector-core.mjs";

const schemas = {
  vote: ["id", "organId", "session", "number", "agenda", "date", "time", "yes", "no", "abstained", "notVoting", "registered", "quorum", "voteType", "result", "longTitle", "shortTitle"],
  individualVote: ["mpId", "voteId", "choice"],
  person: ["personId", "prefix", "surname", "givenName", "suffix", "birthDate", "sex", "changedAt", "deathDate"],
  mp: ["mpId", "personId", "regionId", "candidatePartyId", "termOrganId", "web", "street", "city", "postalCode", "email", "phone", "fax", "officePhone", "facebook", "hasPhoto"],
  membership: ["personId", "entityId", "isFunction", "memberFrom", "memberTo", "mandateFrom", "mandateTo"],
  organ: ["organId", "parentOrganId", "organTypeId", "abbreviation", "nameCz", "nameEn", "from", "to", "priority", "baseMembers"],
  print: ["printId", "kindId", "stateId", "number", "partNumber", "proposalTypeId", "proposerOrganId", "termOrganId", "personId", "proposerText", "shortTitle", "submittedAt", "distributedAt", "nextAt", "electronicAt", "fullTitle", "deadlineChange", "deadline", "fastTrack", "textUrl", "isEu", "publishedAt", "confidenceLinked", "status"],
  history: ["historyId", "printId", "dateTime", "voteId", "transitionId", "agendaId", "session", "resolutionNumber", "committeeReporterMpId", "chairReporterMpId", "committeeResolution", "collectionPublishedAt", "collectionPart", "collectionNumber", "note"],
  state: ["stateId", "stateTypeId", "printKindId", "description", "deadline", "deadlineTransitionId"],
  stateType: ["stateTypeId", "description"],
  subPrint: ["printId", "partNumber", "historyId", "kindId", "shortTitle", "fullTitle"],
  transition: ["transitionId", "fromStateId", "toStateId", "actionId", "transitionType"],
  action: ["actionId", "description"],
  proposer: ["printId", "personId", "order", "type"],
  // schuze.zip; only the leading columns this collector reads are declared.
  session: ["sessionId", "organId", "number", "from", "to", "updatedAt", "isInvitation"],
  agendaItem: ["agendaItemId", "sessionId", "printId", "typeId", "number", "fullTitle", "fullSuffix", "note", "stateId", "isInvitation"]
};

function parseUnlLine(line) {
  const fields = [];
  let current = "";
  let escaped = false;
  for (const character of line) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      fields.push(current || null);
      current = "";
    } else {
      current += character;
    }
  }
  if (current) fields.push(current);
  return fields;
}

export function parseUnl(text, columns) {
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const fields = parseUnlLine(line);
    invariant(fields.length >= columns.length, `UNL row ${index + 1} has ${fields.length} fields; expected at least ${columns.length}`);
    return Object.fromEntries(columns.map((column, fieldIndex) => [column, fields[fieldIndex]]));
  });
}

function archiveEntries(bytes, sourceId) {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries);
  invariant(names.length > 0 && names.length < 100, `Archive ${sourceId} has an unsafe entry count`);
  const totalBytes = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0);
  invariant(totalBytes < 150_000_000, `Archive ${sourceId} exceeds the uncompressed size limit`);
  return entries;
}

function decodeEntry(entries, name) {
  const actualName = Object.keys(entries).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  invariant(actualName, `PSP archive is missing ${name}`);
  return new TextDecoder("windows-1250").decode(entries[actualName]);
}

function decodeMatchingEntries(entries, pattern) {
  return Object.entries(entries)
    .filter(([name]) => pattern.test(name))
    .map(([, bytes]) => new TextDecoder("windows-1250").decode(bytes))
    .join("\n");
}

function pspDate(value) {
  if (!value) return null;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function pspDateTime(value, separateTime = null) {
  if (!value) return null;
  if (separateTime !== null) {
    const date = pspDate(value);
    return date ? `${date}T${separateTime || "00:00"}:00` : null;
  }
  const normalized = value.replace(" ", "T");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function numeric(value) {
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function activeOn(membership, date) {
  const from = membership.memberFrom?.slice(0, 10) ?? "0000-00-00";
  const to = membership.memberTo?.slice(0, 10) ?? "9999-99-99";
  return from <= date && date <= to;
}

function officialPrintUrl(termNumber, printNumber) {
  return `https://public.psp.cz/sqw/historie.sqw?o=${termNumber}&t=${printNumber}`;
}

function officialVoteUrl(voteId) {
  return `https://public.psp.cz/sqw/hlasy.sqw?g=${voteId}`;
}

const voteChoiceGroups = {
  yes: new Set(["A"]),
  no: new Set(["B", "N"]),
  abstained: new Set(["C", "K"]),
  notVoting: new Set(["F"]),
  absent: new Set(["@", "M", "W"])
};

function normalizedVoteChoice(choiceCode) {
  for (const [choice, codes] of Object.entries(voteChoiceGroups)) {
    if (codes.has(choiceCode)) return choice;
  }
  return "unknown";
}

export function derivePartyVoteSummaries(individualVotes, { voteTypeCode = "N", voidedByOfficialRecord = false } = {}) {
  const membersByParty = new Map();
  for (const individualVote of individualVotes) {
    for (const membership of individualVote.clubMembershipsAtVote ?? []) {
      if (!membership.projectPartyId) continue;
      const members = membersByParty.get(membership.projectPartyId) ?? new Map();
      members.set(individualVote.externalMpId, individualVote.choiceCode);
      membersByParty.set(membership.projectPartyId, members);
    }
  }

  return [...membersByParty.entries()].sort(([partyA], [partyB]) => partyA.localeCompare(partyB)).map(([partyId, members]) => {
    const counts = { yes: 0, no: 0, abstained: 0, notVoting: 0, absent: 0, unknown: 0 };
    for (const choiceCode of members.values()) counts[normalizedVoteChoice(choiceCode)] += 1;
    const eligibleMemberCount = members.size;
    const directionalVoteCount = counts.yes + counts.no;
    const strictMajorityThreshold = Math.floor(eligibleMemberCount / 2) + 1;
    let majorityChoice = null;
    if (counts.yes >= strictMajorityThreshold) majorityChoice = "yes";
    else if (counts.no >= strictMajorityThreshold) majorityChoice = "no";

    let attributionStatus = majorityChoice ? "attributed" : "no-strict-majority";
    if (voidedByOfficialRecord) attributionStatus = "voided-vote";
    else if (voteTypeCode !== "N") attributionStatus = "unsupported-vote-type";

    return {
      partyId,
      eligibleMemberCount,
      directionalVoteCount,
      strictMajorityThreshold,
      counts,
      majorityChoice: attributionStatus === "attributed" ? majorityChoice : null,
      attributionStatus,
      ruleVersion: "party-vote-strict-majority-v3"
    };
  });
}

/**
 * Resolves the approved agenda items of this term's sessions from schuze.zip.
 * Per the official schema (psp.cz/sqw/hp.sqw?k=1308), a proposed and an
 * approved agenda share the same id_schuze and id_bod and differ only in
 * `pozvanka` (1 = proposed, null = approved); item numbers can differ between
 * the two. Only approved items are used. Items of type 6 (individual answers
 * to written interpellations) share an id_bod with their parent item and are
 * skipped. A vote row names its session number and agenda-item number, so the
 * returned map is keyed by `${sessionNumber}:${agendaNumber}`.
 */
function approvedAgendaItems(sessionsEntries, termOrganId) {
  const sessionNumberById = new Map(parseUnl(decodeEntry(sessionsEntries, "schuze.unl"), schemas.session)
    .filter((row) => row.organId === String(termOrganId) && row.isInvitation !== "1")
    .map((row) => [row.sessionId, row.number]));
  const itemsByKey = new Map();
  for (const row of parseUnl(decodeEntry(sessionsEntries, "bod_schuze.unl"), schemas.agendaItem)) {
    if (row.isInvitation === "1" || row.typeId === "6") continue;
    const sessionNumber = sessionNumberById.get(row.sessionId);
    if (!sessionNumber || !(Number(row.number) >= 1)) continue;
    itemsByKey.set(`${sessionNumber}:${Number(row.number)}`, row);
  }
  return itemsByKey;
}

/**
 * Validates the government periods that make a government bill conduct of
 * the governing parties (automation/attribution/government-periods.json).
 */
export function validateGovernmentPeriods(governmentPeriods) {
  invariant(governmentPeriods?.schemaVersion === "1.0.0", "Unsupported government periods schemaVersion");
  invariant(Array.isArray(governmentPeriods.periods), "Government periods must be an array");
  for (const period of governmentPeriods.periods) {
    invariant(typeof period.id === "string" && period.id.length > 0, "Government period is missing id");
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(period.from), `Government period ${period.id} needs a from date`);
    invariant(period.to === null || /^\d{4}-\d{2}-\d{2}$/.test(period.to), `Government period ${period.id} has an invalid to date`);
    invariant(Array.isArray(period.partyIds) && period.partyIds.length > 0, `Government period ${period.id} needs partyIds`);
    invariant(/^https:\/\//.test(period.verificationUrl), `Government period ${period.id} needs an HTTPS verificationUrl`);
  }
  return governmentPeriods;
}

export function governmentPartiesOn(governmentPeriods, date) {
  const period = governmentPeriods.periods.find(({ from, to }) => from <= date && (to === null || date <= to));
  return period ? [...period.partyIds].sort() : [];
}

// The stage of the debate a history step leaves (typ_stavu of its
// transition's starting state, e.g. "3. čtení" or "Sněmovna (Senát)"): it
// tells which text of the bill a vote concerned (docs/evidence-pipeline.md).
function historyContext(history, { transitionById, actionById, stageOfState }) {
  const transition = transitionById.get(history.transitionId);
  const action = actionById.get(transition?.actionId);
  return {
    externalHistoryId: history.historyId,
    transitionId: history.transitionId,
    actionCz: cleanText(action?.description, 500) || null,
    stageCz: stageOfState(transition?.fromStateId),
    resolutionNumber: numeric(history.resolutionNumber)
  };
}

// Official print kind (druh_tisku.unl) of a Senate resolution returning a
// bill to the Chamber, a sub-print listed in tisky_za.unl.
const senateResolutionKindId = "11";

export function normalizePspData({ source, since, votesEntries, membersEntries, printsEntries, sessionsEntries, governmentPeriods }) {
  validateGovernmentPeriods(governmentPeriods);
  const voteRows = parseUnl(decodeEntry(votesEntries, `hl${source.term.year}s.unl`), schemas.vote)
    .filter((row) => row.organId === String(source.term.organId));
  const individualRows = parseUnl(decodeMatchingEntries(votesEntries, new RegExp(`^hl${source.term.year}h\\d+\\.unl$`, "i")), schemas.individualVote);
  const voidVoteIds = new Set(parseUnl(decodeEntry(votesEntries, "zmatecne.unl"), ["voteId"]).map((row) => row.voteId));

  const people = new Map(parseUnl(decodeEntry(membersEntries, "osoby.unl"), schemas.person).map((row) => [row.personId, row]));
  const mpRows = parseUnl(decodeEntry(membersEntries, "poslanec.unl"), schemas.mp)
    .filter((row) => row.termOrganId === String(source.term.organId));
  const mpById = new Map(mpRows.map((row) => [row.mpId, row]));
  const organRows = parseUnl(decodeEntry(membersEntries, "organy.unl"), schemas.organ);
  const clubs = new Map(organRows
    .filter((row) => row.parentOrganId === String(source.term.organId) && row.organTypeId === "1")
    .map((row) => [row.organId, row]));
  const membershipsByPerson = new Map();
  for (const membership of parseUnl(decodeEntry(membersEntries, "zarazeni.unl"), schemas.membership)) {
    if (membership.isFunction !== "0" || !clubs.has(membership.entityId)) continue;
    const list = membershipsByPerson.get(membership.personId) ?? [];
    list.push(membership);
    membershipsByPerson.set(membership.personId, list);
  }

  const printRows = parseUnl(decodeEntry(printsEntries, "tisky.unl"), schemas.print)
    .filter((row) => row.termOrganId === String(source.term.organId));
  const printById = new Map(printRows.map((row) => [row.printId, row]));
  const clubPartyOn = (personId, date) => (membershipsByPerson.get(personId) ?? [])
    .filter((membership) => activeOn(membership, date))
    .map((membership) => source.partyAliases[clubs.get(membership.entityId)?.abbreviation] ?? null)
    .filter(Boolean);

  // Per the official schema (psp.cz/sqw/hp.sqw?k=1303, druh_tisku.unl): the
  // government submits kind 1 (government bill), 3 (state budget) and 4
  // (international treaty); kind 2 with proposer type 2 or 3 is a bill of one
  // MP or a group of MPs. A single proposer is tisky.id_osoba; several are
  // listed in predkladatel.unl.
  const proposersByPrint = new Map();
  for (const row of parseUnl(decodeEntry(printsEntries, "predkladatel.unl"), schemas.proposer)) {
    if (!printById.has(row.printId)) continue;
    const list = proposersByPrint.get(row.printId) ?? [];
    list.push(row.personId);
    proposersByPrint.set(row.printId, list);
  }
  const proposalByPrint = new Map();
  for (const print of printRows) {
    const submittedOn = pspDate(print.submittedAt);
    if (!submittedOn) continue;
    if (print.kindId === "1" || print.kindId === "3" || print.kindId === "4") {
      proposalByPrint.set(print.printId, {
        kind: "government-proposal",
        submittedOn,
        proposerPartyIds: governmentPartiesOn(governmentPeriods, submittedOn),
        proposerCz: cleanText(print.proposerText, 300) || null
      });
    } else if (print.kindId === "2" && (print.proposalTypeId === "2" || print.proposalTypeId === "3")) {
      const personIds = [...new Set(proposersByPrint.get(print.printId) ?? (print.personId ? [print.personId] : []))];
      proposalByPrint.set(print.printId, {
        kind: "member-bill",
        submittedOn,
        proposerPartyIds: [...new Set(personIds.flatMap((personId) => clubPartyOn(personId, submittedOn)))].sort(),
        proposerCz: cleanText(print.proposerText, 300) || null
      });
    }
  }
  const historyRows = parseUnl(decodeEntry(printsEntries, "hist.unl"), schemas.history)
    .filter((row) => printById.has(row.printId));
  const stateById = new Map(parseUnl(decodeEntry(printsEntries, "stavy.unl"), schemas.state).map((row) => [row.stateId, row]));
  const transitionById = new Map(parseUnl(decodeEntry(printsEntries, "prechody.unl"), schemas.transition).map((row) => [row.transitionId, row]));
  const actionById = new Map(parseUnl(decodeEntry(printsEntries, "typ_akce.unl"), schemas.action).map((row) => [row.actionId, row]));
  const stateTypeById = new Map(parseUnl(decodeEntry(printsEntries, "typ_stavu.unl"), schemas.stateType).map((row) => [row.stateTypeId, row]));
  const stageOfState = (stateId) => cleanText(stateTypeById.get(stateById.get(stateId)?.stateTypeId)?.description, 200) || null;
  const historyTables = { transitionById, actionById, stageOfState };
  const senateResolutionParts = new Map();
  for (const row of parseUnl(decodeEntry(printsEntries, "tisky_za.unl"), schemas.subPrint)) {
    if (row.kindId !== senateResolutionKindId || !printById.has(row.printId)) continue;
    senateResolutionParts.set(row.printId, [...(senateResolutionParts.get(row.printId) ?? []), numeric(row.partNumber)].sort((left, right) => left - right));
  }

  // Agenda items link a vote to the print it was cast on. The link is used
  // only when schuze.zip and hist.unl agree on agenda-item identifiers;
  // otherwise the collector warns and keeps the exact hist.unl vote links only.
  const warnings = [];
  let agendaItemByKey = approvedAgendaItems(sessionsEntries, source.term.organId);
  const printLinkedItems = [...agendaItemByKey.values()].filter((item) => printById.has(item.printId));
  const historyAgendaPairs = new Set(historyRows.map((row) => `${row.agendaId}:${row.printId}`));
  if (printLinkedItems.length > 0 && !printLinkedItems.some((item) => historyAgendaPairs.has(`${item.agendaItemId}:${item.printId}`))) {
    warnings.push("PSP agenda items do not match any print history agenda reference; agenda-item vote links were skipped.");
    agendaItemByKey = new Map();
  }

  const cutoff = since ?? "0000-00-00";
  const recentVotes = voteRows.filter((row) => (pspDate(row.date) ?? "0000-00-00") >= cutoff);
  const recentVoteIds = new Set(recentVotes.map((row) => row.id));
  const individualByVote = new Map();
  for (const row of individualRows) {
    if (!recentVoteIds.has(row.voteId)) continue;
    const list = individualByVote.get(row.voteId) ?? [];
    list.push(row);
    individualByVote.set(row.voteId, list);
  }

  const historyByVote = new Map();
  for (const row of historyRows) {
    if (!row.voteId) continue;
    const list = historyByVote.get(row.voteId) ?? [];
    list.push(row);
    historyByVote.set(row.voteId, list);
  }

  function linkedPrint(printId, linkBasis, histories) {
    const print = printById.get(printId);
    return {
      externalPrintId: printId,
      printKindId: print?.kindId ?? null,
      number: numeric(print?.number),
      partNumber: numeric(print?.partNumber),
      titleCz: cleanText(print?.fullTitle || print?.shortTitle, 1000),
      url: print ? officialPrintUrl(source.term.number, print.number) : null,
      documentPublishedAt: pspDateTime(print?.publishedAt),
      senateResolutionPartNumbers: senateResolutionParts.get(printId) ?? [],
      linkBasis,
      historyContexts: histories.map((history) => historyContext(history, historyTables))
    };
  }

  const records = [];
  for (const vote of recentVotes) {
    const occurredOn = pspDate(vote.date);
    const individualVotes = (individualByVote.get(vote.id) ?? []).map((individual) => {
      const mp = mpById.get(individual.mpId);
      const person = people.get(mp?.personId);
      const activeMemberships = (membershipsByPerson.get(mp?.personId) ?? [])
        .filter((membership) => activeOn(membership, occurredOn))
        .map((membership) => {
          const club = clubs.get(membership.entityId);
          return {
            externalClubId: club.organId,
            abbreviation: club.abbreviation,
            nameCz: cleanText(club.nameCz, 300),
            projectPartyId: source.partyAliases[club.abbreviation] ?? null,
            from: membership.memberFrom,
            to: membership.memberTo
          };
        });
      return {
        externalMpId: individual.mpId,
        externalPersonId: mp?.personId ?? null,
        displayName: person ? cleanText(`${person.givenName ?? ""} ${person.surname ?? ""}`, 200) : null,
        choiceCode: individual.choice,
        clubMembershipsAtVote: activeMemberships
      };
    });
    const historiesForVote = historyByVote.get(vote.id) ?? [];
    const agendaItem = agendaItemByKey.get(`${vote.session}:${Number(vote.agenda)}`) ?? null;
    const linkedPrintIds = [...new Set(historiesForVote.map(({ printId }) => printId))];
    const linkedPrints = linkedPrintIds.map((printId) => linkedPrint(printId, "history-vote-id",
      historiesForVote.filter((history) => history.printId === printId)));
    // The agenda item names the print a vote concerns. Only a print-history
    // step that names this exact vote gives it decisive context.
    if (agendaItem && printById.has(agendaItem.printId) && !linkedPrintIds.includes(agendaItem.printId)) {
      linkedPrints.push(linkedPrint(agendaItem.printId, "agenda-item", []));
    }
    const voidedByOfficialRecord = voidVoteIds.has(vote.id);
    const partyVoteSummaries = derivePartyVoteSummaries(individualVotes, {
      voteTypeCode: vote.voteType,
      voidedByOfficialRecord
    });
    records.push(createCollectedRecord({
      id: `${source.id}--vote-${vote.id}`,
      sourceId: source.id,
      kind: "parliamentary-vote",
      primary: true,
      evidenceRole: source.evidenceRole,
      occurredAt: pspDateTime(vote.date, vote.time),
      timeZone: "Europe/Prague",
      title: cleanText(vote.longTitle || vote.shortTitle || `Hlasování ${vote.id}`, 1000),
      publisher: source.publisher,
      url: officialVoteUrl(vote.id),
      payload: {
        externalVoteId: vote.id,
        termNumber: source.term.number,
        sessionNumber: numeric(vote.session),
        voteNumber: numeric(vote.number),
        agendaNumber: numeric(vote.agenda),
        counts: {
          yes: numeric(vote.yes),
          no: numeric(vote.no),
          abstained: numeric(vote.abstained),
          notVoting: numeric(vote.notVoting),
          registered: numeric(vote.registered),
          quorum: numeric(vote.quorum)
        },
        voteTypeCode: vote.voteType,
        resultCode: vote.result,
        voidedByOfficialRecord,
        agendaItem: agendaItem ? {
          externalAgendaItemId: agendaItem.agendaItemId,
          number: numeric(agendaItem.number),
          titleCz: cleanText(agendaItem.fullTitle, 1000) || null,
          suffixCz: cleanText(agendaItem.fullSuffix, 500) || null
        } : null,
        linkedPrints,
        individualVotes,
        partyVoteSummaries
      }
    }));
  }

  for (const history of historyRows) {
    const occurredAt = pspDateTime(history.dateTime);
    if (!occurredAt || occurredAt.slice(0, 10) < cutoff) continue;
    const print = printById.get(history.printId);
    const transition = transitionById.get(history.transitionId);
    const action = actionById.get(transition?.actionId);
    const fromState = stateById.get(transition?.fromStateId);
    const toState = stateById.get(transition?.toStateId);
    const actionTitle = cleanText(action?.description || toState?.description || "Legislative step", 500);
    const printTitle = cleanText(print.fullTitle || print.shortTitle, 1000);
    records.push(createCollectedRecord({
      id: `${source.id}--print-step-${history.historyId}`,
      sourceId: source.id,
      kind: "legislative-step",
      primary: true,
      evidenceRole: source.evidenceRole,
      occurredAt,
      timeZone: "Europe/Prague",
      title: `${print.number}/${print.partNumber}: ${actionTitle} — ${printTitle}`,
      publisher: source.publisher,
      url: officialPrintUrl(source.term.number, print.number),
      payload: {
        externalHistoryId: history.historyId,
        externalPrintId: print.printId,
        printKindId: print.kindId,
        proposal: proposalByPrint.get(print.printId) ?? null,
        printNumber: numeric(print.number),
        partNumber: numeric(print.partNumber),
        printTitleCz: printTitle,
        documentPublishedAt: pspDateTime(print.publishedAt),
        senateResolutionPartNumbers: senateResolutionParts.get(print.printId) ?? [],
        transitionId: history.transitionId,
        actionCz: actionTitle,
        fromStateCz: cleanText(fromState?.description, 500) || null,
        stageCz: stageOfState(transition?.fromStateId),
        toStateCz: cleanText(toState?.description, 500) || null,
        currentStateCz: cleanText(stateById.get(print.stateId)?.description, 500) || null,
        externalVoteId: history.voteId,
        sessionNumber: numeric(history.session),
        resolutionNumber: numeric(history.resolutionNumber),
        collectionNumber: numeric(history.collectionNumber),
        noteCz: cleanText(history.note, 1000) || null
      }
    }));
  }

  const referenceData = {
    clubs: [...clubs.values()].map((club) => ({
      externalClubId: club.organId,
      abbreviation: club.abbreviation,
      nameCz: cleanText(club.nameCz, 300),
      projectPartyId: source.partyAliases[club.abbreviation] ?? null,
      from: pspDate(club.from),
      to: pspDate(club.to)
    })),
    members: mpRows.map((mp) => {
      const person = people.get(mp.personId);
      return {
        externalMpId: mp.mpId,
        externalPersonId: mp.personId,
        displayName: person ? cleanText(`${person.givenName ?? ""} ${person.surname ?? ""}`, 200) : null,
        clubMemberships: (membershipsByPerson.get(mp.personId) ?? []).map((membership) => ({
          externalClubId: membership.entityId,
          from: membership.memberFrom,
          to: membership.memberTo
        }))
      };
    })
  };

  return { records: deduplicateRecords(records), referenceData, warnings };
}

// The official files are downloaded one after the other through `fetchPsp`
// (createPspFetcher in psp-print-documents.mjs), the same limit and proxy
// as every other psp.cz request.
export async function collectPspSource(source, options) {
  const endpointEntries = Object.entries(source.endpoints);
  log(`${source.id}: downloading ${endpointEntries.length} official files (${endpointEntries.map(([name]) => name).join(", ")})`);
  const responses = [];
  for (const [name, endpoint] of endpointEntries) {
    const startedAt = Date.now();
    const response = await options.fetchPsp(source, endpoint, {
      maxBytes: 20_000_000,
      expectedContentTypes: ["zip", "octet-stream"]
    });
    log(`${source.id}: downloaded ${name} (${(response.bytes.byteLength / 1_000_000).toFixed(1)} MB in ${((Date.now() - startedAt) / 1000).toFixed(1)} s)`);
    responses.push([name, response]);
  }
  log(`${source.id}: parsing votes, members, prints, and sessions`);
  const responseByName = Object.fromEntries(responses);
  const normalized = normalizePspData({
    source,
    since: options.since,
    votesEntries: archiveEntries(responseByName.votes.bytes, `${source.id}:votes`),
    membersEntries: archiveEntries(responseByName.members.bytes, `${source.id}:members`),
    printsEntries: archiveEntries(responseByName.prints.bytes, `${source.id}:prints`),
    sessionsEntries: archiveEntries(responseByName.sessions.bytes, `${source.id}:sessions`),
    governmentPeriods: options.governmentPeriods
  });
  return {
    sourceId: source.id,
    collector: source.collector,
    retrievedAt: options.collectedAt,
    snapshots: Object.fromEntries(responses.map(([name, response]) => [name, {
      url: response.finalUrl,
      contentType: response.contentType,
      lastModified: response.lastModified,
      etag: response.etag,
      contentHash: response.contentHash
    }])),
    records: normalized.records,
    warnings: normalized.warnings,
    referenceData: normalized.referenceData
  };
}
