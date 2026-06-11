// Fetches published-for-rent buildings from Propertyware REST API, writes data/listings.json
// Runs in GitHub Actions. Requires secrets: PW_CLIENT_ID, PW_CLIENT_SECRET, PW_SYSTEM_ID
import { writeFileSync } from "node:fs";

const API_BASE = "https://app.propertyware.com/pw/api/rest/v1";
const HEADERS = {
  "x-propertyware-client-id": process.env.PW_CLIENT_ID,
  "x-propertyware-client-secret": process.env.PW_CLIENT_SECRET,
  "X-Propertyware-System-ID": process.env.PW_SYSTEM_ID,
  Accept: "application/json",
};

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`PW API ${path} failed: ${res.status} ${res.statusText} ${await res.text()}`);
  }
  return res.json();
}

async function fetchPublished() {
  const all = [];
  let offset = 0;
  for (;;) {
    const page = await getJson(`/buildings?publishedForRent=true&offset=${offset}`);
    all.push(...page);
    if (page.length < 100) break;
    offset += page.length;
  }
  return all;
}

function normalize(b) {
  const addr = b.address || {};
  const mkt = b.marketing || {};
  return {
    id: b.id,
    address: addr.address || "",
    city: addr.city || "",
    state: addr.stateRegion || "",
    zip: (addr.postalCode || "").split("-")[0],
    rent: Number(b.targetRent || 0),
    deposit: Number(b.targetDepositAmount || 0),
    beds: Number(b.numberOfBedrooms || 0),
    baths: Number(b.numberOfBathrooms || 0),
    sqft: Number(b.totalArea || 0),
    type: b.type || "House",
    available: mkt.availableDate || null,
    description: mkt.comments || mkt.shortDescription || "",
    photos: [], // PW REST v1 exposes no photos; populated later if a source is added
    lat: mkt.latitude ?? null,
    lng: mkt.longitude ?? null,
    petsAllowed: !!mkt.petsAllowed,
  };
}

const raw = await fetchPublished();
const listings = raw.map(normalize).filter((l) => l.rent > 0);
writeFileSync("data/listings.json", JSON.stringify({ updated: new Date().toISOString(), listings }, null, 2));
console.log(`Wrote ${listings.length} listings`);
