let listings = [];
let markers = [];

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
      ${l.photos[0] ? `<img src="${l.photos[0]}" alt="" loading="lazy">` : `<div class="noimg">No photo</div>`}
      <div class="body">
        <div class="rent">${fmt(l.rent)}/mo</div>
        <div class="specs"><b>${l.beds}</b> bds | <b>${l.baths}</b> ba | <b>${l.sqft ? l.sqft.toLocaleString() : "—"}</b> sqft | ${l.type}</div>
        <div class="addr">${l.address}, ${l.city}, ${l.state} ${l.zip}</div>
      </div>
    </div>`
    )
    .join("");

  document.querySelectorAll(".card").forEach((c) =>
    c.addEventListener("click", () => openModal(items[Number(c.dataset.i)]))
  );

  markers.forEach((m) => map.removeLayer(m));
  markers = items
    .filter((l) => l.lat && l.lng)
    .map((l) => {
      const m = L.marker([l.lat, l.lng]).addTo(map);
      m.bindPopup(`<b>${fmt(l.rent)}/mo</b><br>${l.beds} bd / ${l.baths} ba<br>${l.address}`);
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
        ${l.applyUrl ? `<a class="apply" href="${l.applyUrl}" target="_blank" rel="noopener">Apply Now</a>` : ""}
      </div>
    </div>`;
  $("modal").classList.remove("hidden");
}

$("modal-close").addEventListener("click", () => $("modal").classList.add("hidden"));
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.add("hidden"); });
["search", "price", "beds", "baths", "sort"].forEach((id) => $(id).addEventListener("input", render));

load();
