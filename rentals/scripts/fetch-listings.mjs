// Fetches published listings from Propertyware REST API and writes data/listings.json
// Runs in GitHub Actions. Requires secrets: PW_API_KEY, PW_SYSTEM_ID
import { writeFileSync } from "node:fs";

const API_BASE = process.env.PW_API_BASE || "https://api.propertyware.com/pw/api/rest/v1";
const HEADERS = {
  "x-propertyware-api-key": process.env.PW_API_KEY,
  "x-propertyware-system-id": process.env.PW_SYSTEM_ID,
  Accept: "application/json",
};

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`PW API ${path} failed: ${res.status} ${res.statusText} ${await res.text()}`);
  }
  return res.json();
}

async function fetchAllListings() {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await getJson(`/publishedlistings?limit=${limit}&offset=${offset}`);
    const items = Array.isArray(page) ? page : page.results || [];
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }
  return all;
}

function normalize(l) {
  const addr = l.address || {};
  return {
    id: l.id,
    address: addr.address || l.streetAddress || "",
    city: addr.city || l.city || "",
    state: addr.state || l.state || "",
    zip: addr.postalCode || l.zip || "",
    rent: Number(l.targetRent ?? l.rent ?? 0),
    deposit: Number(l.targetDeposit ?? l.deposit ?? 0),
    beds: Number(l.noBedrooms ?? l.bedrooms ?? 0),
    baths: Number(l.noBathrooms ?? l.bathrooms ?? 0),
    sqft: Number(l.totalArea ?? l.sqft ?? 0),
    type: l.propertyType || l.type || "House",
    available: l.availableDate || l.dateAvailable || null,
    description: l.comments || l.description || "",
    photos: (l.images || l.photos || []).map((p) => p.url || p.original || p).filter(Boolean),
    lat: l.latitude ?? addr.latitude ?? null,
    lng: l.longitude ?? addr.longitude ?? null,
    applyUrl: l.onlineApplicationUrl || null,
  };
}

const raw = await fetchAllListings();
const listings = raw.map(normalize).filter((l) => l.rent > 0);
writeFileSync("data/listings.json", JSON.stringify({ updated: new Date().toISOString(), listings }, null, 2));
console.log(`Wrote ${listings.length} listings`);
