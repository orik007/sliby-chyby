import { unzipSync } from "fflate";
import {
  cleanText,
  createCollectedRecord,
  deduplicateRecords,
  fetchVerified,
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
  transition: ["transitionId", "fromStateId", "toStateId", "actionId", "transitionType"],
  action: ["actionId", "description"]
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
      strictMajorityThreshold,
      counts,
      majorityChoice: attributionStatus === "attributed" ? majorityChoice : null,
      attributionStatus,
      ruleVersion: "party-vote-strict-majority-v1"
    };
  });
}

export function normalizePspData({ source, since, votesEntries, membersEntries, printsEntries }) {
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
  const historyRows = parseUnl(decodeEntry(printsEntries, "hist.unl"), schemas.history)
    .filter((row) => printById.has(row.printId));
  const stateById = new Map(parseUnl(decodeEntry(printsEntries, "stavy.unl"), schemas.state).map((row) => [row.stateId, row]));
  const transitionById = new Map(parseUnl(decodeEntry(printsEntries, "prechody.unl"), schemas.transition).map((row) => [row.transitionId, row]));
  const actionById = new Map(parseUnl(decodeEntry(printsEntries, "typ_akce.unl"), schemas.action).map((row) => [row.actionId, row]));

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
    const linkedPrintIds = [...new Set(historiesForVote.map(({ printId }) => printId))];
    const linkedPrints = linkedPrintIds.map((printId) => {
      const print = printById.get(printId);
      const historyContexts = historiesForVote.filter((history) => history.printId === printId).map((history) => {
        const transition = transitionById.get(history.transitionId);
        const action = actionById.get(transition?.actionId);
        return {
          externalHistoryId: history.historyId,
          transitionId: history.transitionId,
          actionCz: cleanText(action?.description, 500) || null,
          resolutionNumber: numeric(history.resolutionNumber)
        };
      });
      return {
        externalPrintId: printId,
        number: numeric(print?.number),
        partNumber: numeric(print?.partNumber),
        titleCz: cleanText(print?.fullTitle || print?.shortTitle, 1000),
        url: print ? officialPrintUrl(source.term.number, print.number) : null,
        historyContexts
      };
    });
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
        printNumber: numeric(print.number),
        partNumber: numeric(print.partNumber),
        printTitleCz: printTitle,
        transitionId: history.transitionId,
        actionCz: actionTitle,
        fromStateCz: cleanText(fromState?.description, 500) || null,
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

  return { records: deduplicateRecords(records), referenceData, warnings: [] };
}

export async function collectPspSource(source, options) {
  const endpointEntries = Object.entries(source.endpoints);
  const responses = await Promise.all(endpointEntries.map(async ([name, endpoint]) => {
    const response = await fetchVerified(source, endpoint, {
      maxBytes: 20_000_000,
      expectedContentTypes: ["zip", "octet-stream"]
    });
    return [name, response];
  }));
  const responseByName = Object.fromEntries(responses);
  const normalized = normalizePspData({
    source,
    since: options.since,
    votesEntries: archiveEntries(responseByName.votes.bytes, `${source.id}:votes`),
    membersEntries: archiveEntries(responseByName.members.bytes, `${source.id}:members`),
    printsEntries: archiveEntries(responseByName.prints.bytes, `${source.id}:prints`)
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
