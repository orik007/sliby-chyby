// A deterministic stand-in for the OpenAI Responses API, loaded with
// `node --import` so a pipeline script runs end to end with no network and no
// cost. Each answer follows only from the request, so a rerun gives the same
// answers. It records every request in STUB_OPENAI_LOG when that is set.
import { appendFileSync } from "node:fs";

function tagOf(text) {
  if (/DPH|daň z přidané hodnoty|235\/2004/i.test(text)) return "vat-policy";
  if (/rozpočt|schodek|dluh/i.test(text)) return "deficit-and-debt";
  return "unknown";
}

function answer(name, input, model) {
  if (name === "topic_tag_assignment") {
    const tag = tagOf(input.text);
    return { tags: [tag], confidence: tag === "unknown" ? 0.1 : 0.9 };
  }
  if (name === "law_change_screening") {
    // A part that only sets the effective date is technical.
    const technical = /\n(?:účinnost|ÚČINNOST)\n/.test(input.text) && input.text.length < 1000;
    const tag = tagOf(input.text);
    return { substantive: !technical, reasonCz: technical ? "Stanoví jen den účinnosti." : "Mění pravidla.", tags: [tag], confidence: tag === "unknown" ? 0.1 : 0.9 };
  }
  if (name === "law_change_relevance") return { relevant: true, reasonCz: "Změna se týká slibu." };
  if (name === "slava_assessment") {
    const evidencePackage = input.evidencePackage;
    const changes = evidencePackage.evidence.filter(({ role }) => role === "law-change");
    return {
      promiseId: evidencePackage.promise.id,
      changeRelevance: changes.map(({ id }) => ({ evidenceId: id, relevant: true, reasonCz: "Změna se týká slibu." })),
      // The model named in STUB_OPENAI_DISSENTING_MODEL disagrees, so the
      // arbiter is called.
      status: model === process.env.STUB_OPENAI_DISSENTING_MODEL ? "moving-against" : "moving-towards",
      evidenceSufficient: true,
      citedEvidenceIds: evidencePackage.evidence.map(({ id }) => id),
      // STUB_OPENAI_EXPLANATION_CHARS lengthens the explanation, so a test
      // can make the reviews too large for the arbiter's input limit.
      explanationCz: "Vláda předložila návrh zákona, který směřuje ke splnění tohoto slibu.".padEnd(Number(process.env.STUB_OPENAI_EXPLANATION_CHARS ?? 0), " Podrobnosti."),
      confidence: "high",
      uncertainties: []
    };
  }
  if (name === "slava_arbitration") {
    return { choice: "assessor-a", citedEvidenceIds: input.evidencePackage.evidence.filter(({ role }) => role === "conduct-evidence").map(({ id }) => id), explanationCz: "První posudek vychází z textu, o kterém se hlasovalo." };
  }
  throw new Error(`The OpenAI stub has no answer for ${name}`);
}

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const name = body.text.format.name;
  const input = JSON.parse(body.input);
  if (process.env.STUB_OPENAI_LOG) appendFileSync(process.env.STUB_OPENAI_LOG, `${JSON.stringify({ name, model: body.model, input })}\n`);
  const output = answer(name, input, body.model);
  const usage = { input_tokens: Math.ceil((body.instructions.length + body.input.length) / 3), output_tokens: 30 };
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ id: "stub", model: body.model, usage, output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }] })
  };
};
