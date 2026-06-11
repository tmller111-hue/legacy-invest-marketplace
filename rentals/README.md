# Successful Properties — Rental Listings

Zillow-style rental site. Static frontend on GitHub Pages; a GitHub Action pulls published listings from the Propertyware API every 6 hours and commits `data/listings.json`.

## Setup

1. Push this repo to GitHub.
2. Repo **Settings → Secrets and variables → Actions** — add:
   - `PW_API_KEY` — Propertyware API key
   - `PW_SYSTEM_ID` — Propertyware system/organization ID
3. **Settings → Pages** — Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. **Actions** tab → "Update listings" → *Run workflow* to do the first sync.

## How it works

- `scripts/fetch-listings.mjs` — calls `GET /publishedlistings`, normalizes fields, writes `data/listings.json`.
- `.github/workflows/update-listings.yml` — cron `0 */6 * * *`, commits when data changes (which also redeploys Pages).
- `index.html` / `app.js` / `styles.css` — map (Leaflet + OpenStreetMap), filter bar (price/beds/baths/search/sort), detail modal with photo gallery and Apply link.

API keys live only in GitHub Secrets — never shipped to the browser.
