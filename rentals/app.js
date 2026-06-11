let listings = [];
let markers = [];

// Per-listing Findigs link from Propertyware "Findigs Link" custom field;
// falls back to address-prefilled generic link when not set
const APPLY_BASE = "https://apply.findigs.com/";
const applyLink = (l) =>
  l.applyUrl || `${APPLY_BASE}?address=${encodeURIComponent(`${l.address}, ${l.city}, ${l.state} ${l.zip}`)}`;

const map = L.map("map").setView([35.2, -89.85], 11); // Bartlett/Memphis default
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const $ = (id) => document.getElementById(id);
const fmt = (n) => "$" + Number(n).toLocaleString();

async function load() {
  const res = await fetch("data/listings.json");
  const data = await res.json();
  listings = data.listings || [];
  if (data.updated) $("count").title = "Updated " + new Date(data.updated).toLocaleString();
  render();
}

function filtered() {
  const q = $("search").value.trim().toLowerCase();
  const [pMin, pMax] = ($("price").value || "0-999999").split("-").map(Number);
  const beds = Number($("beds").value || 0);
  const baths = Number($("baths").value || 0);
  let out = listings.filter(
    (l) =>
      l.rent >= pMin && l.rent <= pMax &&
      l.beds >= beds && l.baths >= baths &&
      (!q || `${l.address} ${l.city} ${l.zip}`.toLowerCase().includes(q))
  );
  const sort = $("sort").value;
  if (sort === "rent-asc") out.sort((a, b) => a.rent - b.rent);
  else if (sort === "rent-desc") out.sort((a, b) => b.rent - a.rent);
  else if (sort === "beds-desc") out.sort((a, b) => b.beds - a.beds);
  else if (sort === "newest") out.sort((a, b) => new Date(b.available || 0) - new Date(a.available || 0));
  return out;
}

function render() {
  const items = filtered();
  $("count").textContent = `${items.length} rental${items.length === 1 ? "" : "s"} available`;

  $("cards").innerHTML = items
    .map(
      (l, i) => `
    <div class="card" data-i="${i}">
      <div class="photo-box">
        ${l.photos[0] ? `<img src="${l.photos[0]}" alt="" loading="lazy" data-idx="0">` : `<div class="noimg">No photo</div>`}
        ${l.photos.length > 1 ? `
          <button class="ph-arrow ph-prev" data-dir="-1">&#10094;</button>
          <button class="ph-arrow ph-next" data-dir="1">&#10095;</button>
          <span class="ph-count">1/${l.photos.length}</span>` : ""}
      </div>
      <div class="body">
        <div class="rent">${fmt(l.rent)}/mo</div>
        <div class="specs"><b>${l.beds}</b> bds | <b>${l.baths}</b> ba | <b>${l.sqft ? l.sqft.toLocaleString() : "—"}</b> sqft | ${l.type}</div>
        <div class="addr">${l.address}, ${l.city}, ${l.state} ${l.zip}</div>
        <a class="apply card-apply" href="${applyLink(l)}" target="_blank" rel="noopener">Apply Now</a>
      </div>
    </div>`
    )
    .join("");

  document.querySelectorAll(".card").forEach((c) => {
    const listing = items[Number(c.dataset.i)];
    c.addEventListener("click", (e) => {
      if (e.target.closest(".ph-arrow") || e.target.closest(".card-apply")) return;
      openModal(listing);
    });
    c.querySelectorAll(".ph-arrow").forEach((btn) =>
      btn.addEventListener("click", () => {
        const img = c.querySelector(".photo-box img");
        const n = listing.photos.length;
        const idx = (Number(img.dataset.idx) + Number(btn.dataset.dir) + n) % n;
        img.dataset.idx = idx;
        img.src = listing.photos[idx];
        c.querySelector(".ph-count").textContent = `${idx + 1}/${n}`;
      })
    );
  });

  markers.forEach((m) => map.removeLayer(m));
  markers = items
    .filter((l) => l.lat && l.lng)
    .map((l, idx) => {
      const m = L.marker([l.lat, l.lng]).addTo(map);
      m.bindPopup(
        `<div class="map-card" data-mi="${items.indexOf(l)}">
          ${l.photos[0] ? `<img src="${l.photos[0]}" alt="">` : `<div class="map-noimg">No photo</div>`}
          <div class="map-card-body">
            <div class="map-rent">${fmt(l.rent)}/mo</div>
            <div>${l.beds} bds | ${l.baths} ba | ${l.sqft ? l.sqft.toLocaleString() : "—"} sqft</div>
            <div class="map-addr">${l.address}, ${l.city}</div>
          </div>
        </div>`,
        { closeButton: false, offset: [0, -8] }
      );
      m.on("mouseover", () => m.openPopup());
      m.on("popupopen", () => {
        const el = document.querySelector(`.map-card[data-mi="${items.indexOf(l)}"]`);
        if (el) el.addEventListener("click", () => openModal(l));
      });
      m.on("click", () => openModal(l));
      return m;
    });
  if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
}

function openModal(l) {
  $("modal-body").innerHTML = `
    <div class="modal-body">
      ${l.photos[0] ? `<img id="hero" src="${l.photos[0]}">` : ""}
      ${l.photos.length > 1 ? `<div class="gallery">${l.photos.map((p) => `<img src="${p}" onclick="document.getElementById('hero').src='${p}'">`).join("")}</div>` : ""}
      <div class="modal-info">
        <h2>${fmt(l.rent)}/mo</h2>
        <div class="specs">${l.beds} bds | ${l.baths} ba | ${l.sqft ? l.sqft.toLocaleString() + " sqft" : ""} | ${l.type}</div>
        <div class="addr">${l.address}, ${l.city}, ${l.state} ${l.zip}</div>
        ${l.deposit ? `<p>Deposit: ${fmt(l.deposit)}</p>` : ""}
        ${l.available ? `<p>Available: ${new Date(l.available).toLocaleDateString()}</p>` : ""}
        <p>${l.description || ""}</p>
        <a class="apply" href="${applyLink(l)}" target="_blank" rel="noopener">Apply Now</a>
      </div>
    </div>`;
  $("modal").classList.remove("hidden");
}

$("modal-close").addEventListener("click", () => $("modal").classList.add("hidden"));
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.add("hidden"); });
["search", "price", "beds", "baths", "sort"].forEach((id) => $(id).addEventListener("input", render));

load();
