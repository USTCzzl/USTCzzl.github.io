const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const yearTarget = document.querySelector("[data-current-year]");
if (yearTarget) {
  yearTarget.textContent = String(new Date().getFullYear());
}

const searchInput = document.querySelector("#publication-search");
const yearSelect = document.querySelector("[data-year-filter]");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const publicationCards = Array.from(document.querySelectorAll(".publication-card"));
const countTarget = document.querySelector("[data-publication-count]");
let activeFilter = "all";

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function cardMatchesFilter(card) {
  if (activeFilter === "all") {
    return true;
  }
  return card.dataset.type.split(" ").includes(activeFilter);
}

function cardMatchesSearch(card, query) {
  if (!query) {
    return true;
  }
  const searchable = normalize(
    [
      card.textContent,
      card.dataset.year,
      card.dataset.type,
      card.dataset.keywords
    ].join(" ")
  );
  return searchable.includes(query);
}

function cardMatchesYear(card) {
  if (!yearSelect || yearSelect.value === "all") {
    return true;
  }
  return card.dataset.year === yearSelect.value;
}

function populateYearFilter() {
  if (!yearSelect) {
    return;
  }

  const years = Array.from(new Set(publicationCards.map((card) => card.dataset.year).filter(Boolean)))
    .sort((a, b) => Number(b) - Number(a));

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });
}

function updatePublications() {
  const query = normalize(searchInput ? searchInput.value : "");
  let shown = 0;

  publicationCards.forEach((card) => {
    const visible = cardMatchesFilter(card) && cardMatchesYear(card) && cardMatchesSearch(card, query);
    card.classList.toggle("is-hidden", !visible);
    if (visible) {
      shown += 1;
    }
  });

  if (countTarget) {
    countTarget.textContent = String(shown);
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    updatePublications();
  });
});

if (searchInput) {
  searchInput.addEventListener("input", updatePublications);
}

if (yearSelect) {
  yearSelect.addEventListener("change", updatePublications);
}

populateYearFilter();
updatePublications();

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  fallbackCopy(text);
  return Promise.resolve();
}

document.querySelectorAll("[data-bibtex]").forEach((button) => {
  button.addEventListener("click", async () => {
    const originalLabel = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = originalLabel;

    try {
      await copyToClipboard(button.dataset.bibtex || "");
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }

    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1600);
  });
});

const newsToggle = document.querySelector("[data-news-toggle]");
const extraNewsItems = Array.from(document.querySelectorAll("[data-news-extra]"));

if (newsToggle && extraNewsItems.length) {
  newsToggle.addEventListener("click", () => {
    const expanded = newsToggle.getAttribute("aria-expanded") === "true";
    extraNewsItems.forEach((item) => {
      item.classList.toggle("is-collapsed", expanded);
    });
    newsToggle.setAttribute("aria-expanded", String(!expanded));
    newsToggle.textContent = expanded ? "Show older updates" : "Hide older updates";
  });
}

function setText(selector, value) {
  const target = document.querySelector(selector);
  if (target) {
    target.textContent = value;
  }
}

function incrementLocalVisits() {
  const key = "zzl-homepage-local-visits";
  let visits = 1;

  try {
    visits = Number(window.localStorage.getItem(key) || "0") + 1;
    window.localStorage.setItem(key, String(visits));
  } catch {
    visits = 1;
  }

  setText("[data-local-visits]", String(visits));
}

function prepareCounterBadge() {
  const badge = document.querySelector(".counter-badge");
  const fallback = document.querySelector("[data-counter-fallback]");

  if (!badge || !fallback) {
    return;
  }

  badge.addEventListener("error", () => {
    badge.hidden = true;
    fallback.hidden = false;
  });
}

let visitorMap;
let visitorMarker;

function addCircleMarker(map, point) {
  const marker = L.circleMarker([point.latitude, point.longitude], {
    radius: point.radius,
    color: point.color,
    fillColor: point.color,
    fillOpacity: point.fillOpacity,
    weight: 2,
    opacity: 0.92
  }).addTo(map);

  marker.bindPopup(`<strong>${point.title}</strong><br>${point.description}`);
  return marker;
}

function initializeVisitorMap() {
  const container = document.querySelector("[data-visitor-map]");
  if (!container || !window.L) {
    return null;
  }

  if (visitorMap) {
    return visitorMap;
  }

  visitorMap = L.map(container, {
    center: [26, 35],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18,
    worldCopyJump: true,
    scrollWheelZoom: true
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(visitorMap);

  [
    {
      title: "USTC ICR",
      description: "Intelligent Control and Robotics group, Hefei, China",
      latitude: 31.8206,
      longitude: 117.2272,
      color: "#f4c766",
      fillOpacity: 0.86,
      radius: 8
    },
    {
      title: "Research audience",
      description: "North America readership marker",
      latitude: 40.7128,
      longitude: -74.006,
      color: "#7fd0c4",
      fillOpacity: 0.62,
      radius: 6
    },
    {
      title: "Research audience",
      description: "Europe readership marker",
      latitude: 51.5072,
      longitude: -0.1276,
      color: "#7fd0c4",
      fillOpacity: 0.62,
      radius: 6
    },
    {
      title: "Research audience",
      description: "Asia readership marker",
      latitude: 35.6762,
      longitude: 139.6503,
      color: "#7fd0c4",
      fillOpacity: 0.62,
      radius: 6
    }
  ].forEach((point) => addCircleMarker(visitorMap, point));

  return visitorMap;
}

function lightCurrentVisitor(visitor) {
  const map = initializeVisitorMap();
  if (!map || !Number.isFinite(Number(visitor.latitude)) || !Number.isFinite(Number(visitor.longitude))) {
    return;
  }

  if (visitorMarker) {
    visitorMarker.remove();
  }

  const label = [visitor.city, visitor.country].filter(Boolean).join(", ") || "Current visitor";
  visitorMarker = L.circleMarker([visitor.latitude, visitor.longitude], {
    radius: 9,
    color: "#ff5b4f",
    fillColor: "#ff5b4f",
    fillOpacity: 0.92,
    weight: 3,
    opacity: 0.95,
    className: "leaflet-marker-glow"
  }).addTo(map);

  visitorMarker.bindPopup(`<strong>Current visitor</strong><br>${label}<br><span>${visitor.provider}</span>`);

  map.setView([26, 35], 2, { animate: true });
}

function guessVisitorFromTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const knownZones = {
    "Asia/Shanghai": { city: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737 },
    "Asia/Tokyo": { city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
    "Asia/Hong_Kong": { city: "Hong Kong", country: "China", latitude: 22.3193, longitude: 114.1694 },
    "Asia/Singapore": { city: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
    "Europe/London": { city: "London", country: "United Kingdom", latitude: 51.5072, longitude: -0.1276 },
    "Europe/Berlin": { city: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
    "America/New_York": { city: "New York", country: "United States", latitude: 40.7128, longitude: -74.006 },
    "America/Los_Angeles": { city: "Los Angeles", country: "United States", latitude: 34.0522, longitude: -118.2437 }
  };

  const fallback = knownZones[timezone] || { city: "Hefei", country: "China", latitude: 31.8206, longitude: 117.2272 };
  return {
    ...fallback,
    ip: "",
    provider: timezone ? `browser timezone (${timezone})` : "fallback estimate"
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6500);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadVisitorInfo() {
  const statusTarget = document.querySelector("[data-visitor-status]");

  try {
    const primary = await fetchJson("https://ipwho.is/");
    if (!primary || primary.success === false) {
      throw new Error("Primary IP lookup failed");
    }

    return {
      ip: primary.ip,
      city: primary.city,
      region: primary.region,
      country: primary.country,
      latitude: primary.latitude,
      longitude: primary.longitude,
      provider: "ipwho.is"
    };
  } catch {
    try {
      const fallback = await fetchJson("https://ipapi.co/json/");
      return {
        ip: fallback.ip,
        city: fallback.city,
        region: fallback.region,
        country: fallback.country_name,
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        provider: "ipapi.co"
      };
    } catch {
      if (statusTarget) {
        statusTarget.textContent = "IP lookup is currently unavailable. The visitor dot is estimated from browser timezone, while the local visit counter and static research-reach markers still work.";
      }
      return guessVisitorFromTimezone();
    }
  }
}

async function updateVisitorPanel() {
  prepareCounterBadge();
  incrementLocalVisits();
  initializeVisitorMap();

  const visitor = await loadVisitorInfo();
  if (!visitor) {
    setText("[data-visitor-ip]", "Unavailable");
    setText("[data-visitor-location]", "Unavailable");
    return;
  }

  const location = [visitor.city, visitor.country].filter(Boolean).join(", ");
  setText("[data-visitor-ip]", visitor.ip || "Unavailable");
  setText("[data-visitor-location]", location || "Unknown");
  lightCurrentVisitor(visitor);

  const statusTarget = document.querySelector("[data-visitor-status]");
  if (statusTarget) {
    statusTarget.textContent = `Current visitor location is estimated by ${visitor.provider}. Static GitHub Pages cannot keep server-side IP logs by itself; use ClustrMaps, MapMyVisitors, GoatCounter, Umami, or Cloudflare Web Analytics for production aggregate analytics.`;
  }
}

updateVisitorPanel();
