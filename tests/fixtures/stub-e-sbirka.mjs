// A stand-in for the e-Sbírka REST API, loaded with `node --import` so the
// law-change context runs end to end with no network: it answers the check
// of what e-Sbírka changed with nothing changed, and refuses anything else,
// which a complete cache never needs.
const realFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  const { hostname, pathname } = new URL(String(url));
  if (hostname !== "api.e-sbirka.gov.cz") return realFetch(url, options);
  if (/^\/dokumenty-sbirky\/(zmeny-zneni|depublikovana-zneni)$/.test(pathname)) {
    return new Response(JSON.stringify({ pocetCelkem: 0, seznamZneniPravnichPredpisu: [] }), { status: 200 });
  }
  throw new Error(`No e-Sbírka request is expected in tests: ${pathname}`);
};
