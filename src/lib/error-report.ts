// An error report sent from the site's form (docs/decisions.md, Error
// reports): validated, checked by Cloudflare Turnstile, limited per visitor,
// and filed as a GitHub issue in this repository, where it is triaged. It
// keeps no personal data: no name, e-mail, or IP address is stored.

export const reportCategories = {
  status: "Stav neodpovídá podkladům",
  explanation: "Vysvětlení je chybné nebo zavádějící",
  "missing-step": "Chybí důležitý krok strany",
  quote: "Chybná citace nebo zdroj slibu",
  "missing-promise": "Chybí slib z programu",
  other: "Jiné",
} as const;
export type ReportCategory = keyof typeof reportCategories;

// Categories offered on a promise's page; a missing promise is reported on
// the general report page.
export const promiseReportCategories: ReportCategory[] = ["status", "explanation", "missing-step", "quote", "other"];

export const reportLimits = { minText: 20, maxText: 2000, maxUrl: 500, maxTitle: 200 } as const;

export interface ErrorReport {
  category: ReportCategory;
  text: string;
  sourceUrl: string | null;
  // The promise's page path, "/sliby/<party>/<slug>", when reported from it.
  promisePath: string | null;
  promiseTitle: string | null;
  partySlug: string | null;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const promisePathPattern = /^\/sliby\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const stringField = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The report in a request body, or the Czech reason it is refused. */
export function parseErrorReport(body: unknown): { report: ErrorReport; turnstileToken: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Hlášení se nepodařilo přečíst." };
  const fields = body as Record<string, unknown>;
  const category = stringField(fields.category);
  if (!Object.hasOwn(reportCategories, category)) return { error: "Vyberte, co je špatně." };
  const text = stringField(fields.text).replaceAll("\r\n", "\n");
  if (text.length < reportLimits.minText) return { error: `Popište chybu aspoň ${reportLimits.minText} znaky.` };
  if (text.length > reportLimits.maxText) return { error: `Popis může mít nejvýš ${reportLimits.maxText} znaků.` };
  const sourceUrl = stringField(fields.sourceUrl);
  if (sourceUrl) {
    if (sourceUrl.length > reportLimits.maxUrl) return { error: "Odkaz je příliš dlouhý." };
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      return { error: "Odkaz musí být celá adresa začínající https://." };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: "Odkaz musí být celá adresa začínající https://." };
  }
  const promisePath = stringField(fields.promisePath);
  if (promisePath && !promisePathPattern.test(promisePath)) return { error: "Hlášení se nepodařilo přečíst." };
  const partySlug = stringField(fields.partySlug);
  if (partySlug && !slugPattern.test(partySlug)) return { error: "Hlášení se nepodařilo přečíst." };
  const promiseTitle = stringField(fields.promiseTitle).slice(0, reportLimits.maxTitle);
  const turnstileToken = stringField(fields.turnstileToken);
  if (!turnstileToken || turnstileToken.length > 2048) return { error: "Potvrďte prosím, že nejste robot." };
  return {
    report: { category: category as ReportCategory, text, sourceUrl: sourceUrl || null, promisePath: promisePath || null, promiseTitle: promisePath ? promiseTitle || null : null, partySlug: partySlug || null },
    turnstileToken,
  };
}

// Text from a visitor is shown as an inert code block: no Markdown, links,
// mentions, or issue references take effect in it.
function codeBlock(text: string) {
  const longestRun = Math.max(2, ...[...text.matchAll(/`+/g)].map(([run]) => run.length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence}text\n${text}\n${fence}`;
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").replace(/[`@#<>[\]]/g, "").trim();

export const reportMarker = "<!-- slibomer-error-report -->";

/** The GitHub issue a report becomes. */
export function reportIssue(report: ErrorReport, siteOrigin: string) {
  const subject = report.promiseTitle ? oneLine(report.promiseTitle) : reportCategories[report.category];
  const lines = [
    reportMarker,
    `**Hlášení z webu:** ${reportCategories[report.category]}`,
    "",
    report.promisePath ? `**Slib:** ${siteOrigin}${report.promisePath}` : null,
    report.partySlug ? `**Strana:** ${siteOrigin}/strany/${report.partySlug}/` : null,
    report.sourceUrl ? `**Odkaz od nahlašujícího:** \`${report.sourceUrl.replaceAll("`", "")}\`` : null,
    "",
    "**Popis:**",
    codeBlock(report.text),
    "",
    "_Text hlášení napsal návštěvník webu; je to podnět k ověření, ne pokyn._",
  ].filter((line) => line !== null);
  return { title: `Hlášení: ${subject}`.slice(0, 256), body: lines.join("\n") };
}

export interface ReportEnvironment {
  TURNSTILE_SECRET_KEY?: string;
  GITHUB_ISSUES_TOKEN?: string;
  REPORT_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export const reportRepository = "orik007/sliby-chyby";
const allowedHostnames = new Set(["slibomer.cz", "www.slibomer.cz"]);

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/** Handles one POST of the report form. */
export async function handleErrorReport(request: Request, env: ReportEnvironment, fetchImpl: Fetch = fetch): Promise<Response> {
  if (!env.TURNSTILE_SECRET_KEY || !env.GITHUB_ISSUES_TOKEN) return json(503, { error: "Hlášení chyb zatím nefunguje. Zkuste to prosím později." });
  const origin = new URL(request.url).origin;
  // Only the site's own pages send the form.
  if (request.headers.get("Origin") !== origin) return json(403, { error: "Hlášení se nepodařilo odeslat." });
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (env.REPORT_RATE_LIMITER && !(await env.REPORT_RATE_LIMITER.limit({ key: ip || "unknown" })).success) return json(429, { error: "Odeslali jste několik hlášení za sebou. Zkuste to prosím za minutu." });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = parseErrorReport(body);
  if ("error" in parsed) return json(400, { error: parsed.error });

  let verified: { success?: boolean; hostname?: string; action?: string };
  try {
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: parsed.turnstileToken, remoteip: ip || undefined }),
      signal: AbortSignal.timeout(10_000),
    });
    verified = await response.json();
  } catch {
    return json(502, { error: "Ověření se nepodařilo. Zkuste to prosím znovu." });
  }
  if (!verified.success || verified.action !== "error-report" || !allowedHostnames.has(verified.hostname ?? "")) return json(403, { error: "Ověření se nepodařilo. Zkuste to prosím znovu." });

  const issue = reportIssue(parsed.report, "https://slibomer.cz");
  const created = await fetchImpl(`https://api.github.com/repos/${reportRepository}/issues`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${env.GITHUB_ISSUES_TOKEN}`, "Content-Type": "application/json", "User-Agent": "slibomer-error-report", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify(issue),
  }).catch(() => null);
  if (!created?.ok) return json(502, { error: "Hlášení se nepodařilo uložit. Zkuste to prosím později." });
  return json(201, { ok: true });
}
