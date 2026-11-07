import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { handleErrorReport, type ReportEnvironment } from "../../lib/error-report";

// The only endpoint the site runs on request: the error-report form
// (docs/decisions.md, Error reports).
export const prerender = false;

export const POST: APIRoute = ({ request }) => handleErrorReport(request, env as ReportEnvironment);
