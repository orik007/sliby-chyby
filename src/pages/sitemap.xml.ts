import type { APIRoute } from "astro";
import { getCurrentPartySummaries } from "../lib/data";

export const prerender = true;

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

export const GET: APIRoute = ({ site, url }) => {
  const siteUrl = site ?? url;
  const summaries = getCurrentPartySummaries();
  const paths = [
    "/",
    "/metodika",
    ...summaries.map(({ party }) => `/strany/${party.slug}`),
    ...summaries.flatMap(({ party, promises }) => promises.map(({ promise }) => `/sliby/${party.slug}/${promise.slug}`)),
  ];
  const urls = paths.map((path) => `<url><loc>${escapeXml(new URL(path, siteUrl).href)}</loc></url>`).join("");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
