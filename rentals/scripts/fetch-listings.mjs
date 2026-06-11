// Fetches published-for-rent buildings from Propertyware REST API, writes data/listings.json
// and downloads listing photos into photos/<buildingId>/.
// Secrets: PW_CLIENT_ID, PW_CLIENT_SECRET, PW_SYSTEM_ID
// Optional (for SharePoint photo folders in the "Pictures" custom field):
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET
import { writeFileSync, mkdirSync } from "node:fs";

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
    const page = await getJson(`/buildings?publishedForRent=true&includeCustomFields=true&offset=${offset}`);
    all.push(...page);
    if (page.length < 100) break;
    offset += page.length;
  }
  return all;
}

function customField(b, name) {
  const cf = (b.customFields || []).find((c) => c.fieldName === name);
  return cf && cf.value ? String(cf.value).trim() : "";
}

// --- SharePoint photo support (Graph client-credentials) ---
let graphToken = null;
async function getGraphToken() {
  if (graphToken) return graphToken;
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) return null;
  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status} ${await res.text()}`);
  graphToken = (await res.json()).access_token;
  return graphToken;
}

function shareLinkToGraphUrl(link) {
  const b64 = Buffer.from(link).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `https://graph.microsoft.com/v1.0/shares/u!${b64}/driveItem/children`;
}

async function downloadPhotos(buildingId, picturesValue) {
  if (!picturesValue) return [];
  // Direct image URLs (comma-separated) pass straight through
  if (!/sharepoint\.com/i.test(picturesValue)) {
    return picturesValue.split(",").map((u) => u.trim()).filter(Boolean);
  }
  // SharePoint folder share link: enumerate via Graph, download into repo
  const token = await getGraphToken();
  if (!token) {
    console.warn(`Building ${buildingId}: Pictures is a SharePoint link but MS_* secrets are not set — skipping photos`);
    return [];
  }
  const res = await fetch(shareLinkToGraphUrl(picturesValue), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`Building ${buildingId}: Graph folder fetch failed ${res.status}`);
    return [];
  }
  const items = (await res.json()).value || [];
  const images = items.filter((i) => i.file && /\.(jpe?g|png|webp)$/i.test(i.name || ""));
  const dir = `photos/${buildingId}`;
  mkdirSync(dir, { recursive: true });
  const paths = [];
  for (const img of images) {
    const url = img["@microsoft.graph.downloadUrl"];
    if (!url) continue;
    const data = Buffer.from(await (await fetch(url)).arrayBuffer());
    const safe = img.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    writeFileSync(`${dir}/${safe}`, data);
    paths.push(`${dir}/${safe}`);
  }
  return paths;
}

async function normalize(b) {
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
    photos: await downloadPhotos(b.id, customField(b, "Pictures")),
    lat: mkt.latitude ?? null,
    lng: mkt.longitude ?? null,
    petsAllowed: !!mkt.petsAllowed,
    applyUrl: customField(b, "Findigs Link") || null,
  };
}

const raw = await fetchPublished();
const listings = (await Promise.all(raw.map(normalize))).filter((l) => l.rent > 0);
writeFileSync("data/listings.json", JSON.stringify({ updated: new Date().toISOString(), listings }, null, 2));
console.log(`Wrote ${listings.length} listings`);
