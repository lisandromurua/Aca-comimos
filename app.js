(function () {
  "use strict";

  const PLACES = window.PLACES || [];

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const GRADIENTS = [
    ["oklch(72% 0.11 35)", "oklch(63% 0.12 18)"],
    ["oklch(75% 0.09 95)", "oklch(65% 0.10 78)"],
    ["oklch(74% 0.07 150)", "oklch(64% 0.08 158)"],
    ["oklch(72% 0.06 250)", "oklch(62% 0.07 258)"],
    ["oklch(76% 0.08 10)", "oklch(66% 0.09 350)"],
    ["oklch(70% 0.10 60)", "oklch(60% 0.11 45)"],
    ["oklch(74% 0.05 30)", "oklch(64% 0.06 20)"],
    ["oklch(70% 0.08 300)", "oklch(60% 0.09 290)"],
  ];
  function gradientFor(id) {
    const g = GRADIENTS[id % GRADIENTS.length];
    return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
  }

  function placeholderIconSvg(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-4 4-3-3-4 4"/></svg>`;
  }

  const rosetteSvg = (size, fill) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="none"><circle cx="18" cy="12" r="5"/><circle cx="15" cy="17.2" r="5"/><circle cx="9" cy="17.2" r="5"/><circle cx="6" cy="12" r="5"/><circle cx="9" cy="6.8" r="5"/><circle cx="15" cy="6.8" r="5"/><circle cx="12" cy="12" r="3.5" fill="var(--ink)"/></svg>`;

  function locationLabel(p) {
    return [p.barrio, p.localidad].filter(Boolean).join(" · ") || p.localidad;
  }

  function scoreColor(nota) {
    // reserved for future use (e.g. tinting pins); not used yet.
    return "var(--ink)";
  }

  // ---------- filter state ----------
  const state = {
    search: "",
    provincia: "",
    localidad: "",
    barrio: "",
    momento: "",
    precio: "",
    minScore: 0,
    onlyDistincion: false,
    view: "grid",
  };

  // ---------- populate selects ----------
  function uniqueSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
  }

  function fillSelect(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` +
      values.map((v) => `<option value="${v}">${v}</option>`).join("");
    if (values.includes(current)) select.value = current;
  }

  function refreshDependentSelects() {
    const inProvincia = state.provincia
      ? PLACES.filter((p) => p.provincia === state.provincia)
      : PLACES;
    fillSelect($("#f-localidad"), uniqueSorted(inProvincia.map((p) => p.localidad)), "Localidad");

    const inLocalidad = state.localidad
      ? inProvincia.filter((p) => p.localidad === state.localidad)
      : inProvincia;
    fillSelect($("#f-barrio"), uniqueSorted(inLocalidad.map((p) => p.barrio)), "Barrio");
  }

  function initFilters() {
    fillSelect($("#f-provincia"), uniqueSorted(PLACES.map((p) => p.provincia)), "Provincia");
    fillSelect($("#f-momento"), uniqueSorted(PLACES.map((p) => p.momento)), "Momento del día");
    fillSelect($("#f-precio"), uniqueSorted(PLACES.map((p) => p.precio)).sort((a, b) => a.length - b.length), "Precio");
    refreshDependentSelects();
  }

  // ---------- filtering ----------
  function matches(p) {
    if (state.search && !p.nombre.toLowerCase().includes(state.search.toLowerCase())) return false;
    if (state.provincia && p.provincia !== state.provincia) return false;
    if (state.localidad && p.localidad !== state.localidad) return false;
    if (state.barrio && p.barrio !== state.barrio) return false;
    if (state.momento && p.momento !== state.momento) return false;
    if (state.precio && p.precio !== state.precio) return false;
    if (p.nota === null || p.nota < state.minScore) return false;
    if (state.onlyDistincion && !p.distincion) return false;
    return true;
  }

  function filteredPlaces() {
    return PLACES.filter(matches).sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
  }

  // ---------- grid rendering ----------
  function cardHtml(p) {
    const distincionBadge = p.distincion
      ? `<div class="photo-badge" title="${p.distincion}">${rosetteSvg(15, "white")}</div>`
      : "";
    return `
      <article class="card" data-id="${p.id}">
        <div class="card-photo" style="background:${gradientFor(p.id)};">
          ${placeholderIconSvg(28)}
          ${distincionBadge}
        </div>
        <div class="card-body">
          <div class="card-top">
            <div class="card-name">${p.nombre}</div>
            <div class="score-badge">${p.nota != null ? p.nota.toFixed(1) : "-"}</div>
          </div>
          <div class="card-loc">${locationLabel(p)}</div>
          <div class="card-tags">
            <div class="tag tag-momento">${p.momento}</div>
            <div class="tag tag-precio">${p.precio}</div>
          </div>
        </div>
      </article>`;
  }

  function renderGrid(list) {
    const container = $("#grid-container");
    const empty = $("#grid-empty");
    if (list.length === 0) {
      container.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    container.innerHTML = list.map(cardHtml).join("");
    container.querySelectorAll(".card").forEach((el) => {
      el.addEventListener("click", () => openDetail(Number(el.dataset.id)));
    });
  }

  // ---------- map rendering ----------
  let map, markersLayer;
  function initMap() {
    if (typeof L === "undefined") {
      console.warn("Leaflet no cargó (¿sin conexión?) — la vista de mapa queda deshabilitada.");
      $("#map").innerHTML = '<div class="empty-state">No se pudo cargar el mapa (revisá tu conexión a internet).</div>';
      return;
    }
    map = L.map("map", { scrollWheelZoom: true }).setView([-31.4201, -64.1888], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  }

  function pinDivIcon(p) {
    const size = 30;
    const html = `<div class="map-pin" style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:var(--accent);transform:rotate(-45deg);box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(45deg);" class="pin-score">${p.nota != null ? p.nota.toFixed(1) : "-"}</div>
    </div>`;
    return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size] });
  }

  const markersById = {};

  function renderMap(list) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();
    for (const key in markersById) delete markersById[key];
    if (list.length === 0) return;
    const bounds = [];
    list.forEach((p) => {
      const marker = L.marker([p.lat, p.lon], { icon: pinDivIcon(p) });
      const popupHtml = `
        <div class="popup-name">${p.nombre}</div>
        <div class="popup-meta">${locationLabel(p)} · ${p.momento} · ${p.precio}</div>
        <div class="popup-link" data-id="${p.id}">Ver ficha completa →</div>`;
      marker.bindPopup(popupHtml);
      marker.on("popupopen", () => {
        const link = document.querySelector(`.popup-link[data-id="${p.id}"]`);
        if (link) link.addEventListener("click", () => openDetail(p.id));
      });
      marker.addTo(markersLayer);
      markersById[p.id] = marker;
      bounds.push([p.lat, p.lon]);
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }

  function focusOnMap(id) {
    setView("map");
    if (!map) return;
    const marker = markersById[id];
    if (marker) {
      map.setView(marker.getLatLng(), 15);
      marker.openPopup();
    }
  }

  // ---------- detail panel ----------
  function detailHtml(p) {
    const distincionTag = p.distincion
      ? `<div class="badge-distincion">${rosetteSvg(12, "white")}${p.distincion}</div>`
      : "";
    const bar = (label, val) => `
      <div class="bar-row"><span>${label}</span><span style="font-weight:600;">${val != null ? val.toFixed(2) : "-"}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${val != null ? (val * 10) + "%" : "0%"};"></div></div>`;
    return `
      <button class="detail-close" id="detail-close-btn" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="detail-photo">${placeholderIconSvg(42)}</div>
      <div class="detail-body">
        <div>
          <div class="detail-breadcrumb">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/></svg>
            ${[p.barrio, p.localidad, p.provincia].filter(Boolean).join(" · ")}
          </div>
          <div class="detail-name">${p.nombre}</div>
          <div class="detail-tags">
            <div class="tag tag-momento">${p.momento}</div>
            <div class="tag tag-precio">${p.precio}</div>
            ${distincionTag}
          </div>
        </div>

        <div class="detail-score-row">
          <div class="detail-score-circle">
            <div class="n">${p.nota != null ? p.nota.toFixed(1) : "-"}</div>
          </div>
          <div class="detail-bars" style="flex-grow:1;">
            ${bar("Comida", p.comida)}
            ${bar("Lugar", p.lugar)}
            ${bar("Atención", p.atencion)}
          </div>
        </div>

        <div>
          <div class="detail-section-label">Notas</div>
          <div class="detail-resena">${p.resena || "Sin reseña todavía."}</div>
        </div>

        <div>
          <div class="detail-section-label">Visitas</div>
          <div class="pill-date">${p.visitas} ${p.visitas === "1" ? "visita" : "visitas"}</div>
        </div>

        <button class="detail-map-link" id="detail-map-btn" data-id="${p.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/></svg>
          Ver en el mapa
        </button>
      </div>`;
  }

  function openDetail(id) {
    const p = PLACES.find((x) => x.id === id);
    if (!p) return;
    $("#detail-panel").innerHTML = detailHtml(p);
    $("#detail-overlay").classList.add("open");
    $("#detail-close-btn").addEventListener("click", closeDetail);
    $("#detail-map-btn").addEventListener("click", () => {
      closeDetail();
      focusOnMap(id);
    });
  }
  function closeDetail() {
    $("#detail-overlay").classList.remove("open");
  }

  // ---------- view switching ----------
  function setView(view) {
    state.view = view;
    $$(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#view-grid").classList.toggle("active", view === "grid");
    $("#view-map").classList.toggle("active", view === "map");
    if (view === "map" && map) {
      // Leaflet needs a resize nudge the first time its container becomes visible.
      setTimeout(() => map.invalidateSize(), 0);
    }
  }

  // ---------- render everything ----------
  function renderAll() {
    const list = filteredPlaces();
    renderGrid(list);
    renderMap(list);
    $("#result-count").textContent = `${list.length} de ${PLACES.length} lugares`;
  }

  // ---------- wire up controls ----------
  function initControls() {
    $("#f-search").addEventListener("input", (e) => {
      state.search = e.target.value;
      renderAll();
    });
    $("#f-provincia").addEventListener("change", (e) => {
      state.provincia = e.target.value;
      state.localidad = "";
      state.barrio = "";
      refreshDependentSelects();
      renderAll();
    });
    $("#f-localidad").addEventListener("change", (e) => {
      state.localidad = e.target.value;
      state.barrio = "";
      refreshDependentSelects();
      renderAll();
    });
    $("#f-barrio").addEventListener("change", (e) => {
      state.barrio = e.target.value;
      renderAll();
    });
    $("#f-momento").addEventListener("change", (e) => {
      state.momento = e.target.value;
      renderAll();
    });
    $("#f-precio").addEventListener("change", (e) => {
      state.precio = e.target.value;
      renderAll();
    });
    $("#f-score").addEventListener("input", (e) => {
      state.minScore = Number(e.target.value);
      $("#f-score-val").textContent = state.minScore.toFixed(1).replace(/\.0$/, "");
      renderAll();
    });
    $("#f-distincion").addEventListener("change", (e) => {
      state.onlyDistincion = e.target.checked;
      renderAll();
    });
    $("#f-clear").addEventListener("click", () => {
      state.search = ""; state.provincia = ""; state.localidad = ""; state.barrio = "";
      state.momento = ""; state.precio = ""; state.minScore = 0; state.onlyDistincion = false;
      $("#f-search").value = "";
      $("#f-score").value = 0;
      $("#f-score-val").textContent = "0";
      $("#f-distincion").checked = false;
      refreshDependentSelects();
      $("#f-provincia").value = ""; $("#f-localidad").value = ""; $("#f-barrio").value = "";
      $("#f-momento").value = ""; $("#f-precio").value = "";
      renderAll();
    });

    $$(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    $("#filter-toggle").addEventListener("click", () => {
      const extra = $("#filter-extra");
      const isOpen = extra.classList.toggle("expanded");
      $("#filter-toggle").setAttribute("aria-expanded", String(isOpen));
    });

    $("#detail-overlay").addEventListener("click", (e) => {
      if (e.target.id === "detail-overlay") closeDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDetail();
    });
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    $("#brand-count").textContent = `${PLACES.length} lugares registrados`;
    initFilters();
    initControls();
    initMap();
    renderAll();
  });
})();
