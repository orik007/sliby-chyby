import type { APIRoute } from "astro";
import { collectionWorkflowRunsUrl, getLatestSuccessfulCollectionTime } from "../../lib/collection-status";
import { systemStatus } from "../../lib/data";

export const prerender = false;

export const GET: APIRoute = async () => {
  let lastSuccessfulCollectionAt = systemStatus.lastSuccessfulCollectionAt;

  try {
    const response = await fetch(collectionWorkflowRunsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "sliby-chyby-public-status",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (response.ok) {
      const liveTime = getLatestSuccessfulCollectionTime(await response.json());
      if (liveTime) lastSuccessfulCollectionAt = liveTime;
    }
  } catch {
    // Keep the last build-verified successful timestamp when GitHub is unavailable.
  }

  return new Response(JSON.stringify({ lastSuccessfulCollectionAt }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
};
