#!/usr/bin/env node
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");
const DATA_DIR = path.join(ROOT_DIR, "assets", "data");
const PUBLICATIONS_PATH = path.join(DATA_DIR, "publications.json");
const BIB_PATH = path.join(DATA_DIR, "publications.bib");
const NEWS_PATH = path.join(DATA_DIR, "news.json");
const LINKS_PATH = path.join(DATA_DIR, "publication-links.json");
const PROJECT_CONFIG_PATH = path.join(DATA_DIR, "homepage-config.json");
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const PROFILE_PATH = path.join(DATA_DIR, "profile.json");
const SYNC_STATUS_PATH = path.join(DATA_DIR, "sync-status.json");
const FEED_PATH = path.join(ROOT_DIR, "feed.xml");
const SITEMAP_PATH = path.join(ROOT_DIR, "sitemap.xml");

const DBLP_URL = "https://dblp.org/pid/314/6823.xml";
const ORCID_URL = "https://pub.orcid.org/v3.0/0000-0002-4995-4732/works";
const ORCID_EMPLOYMENTS_URL = "https://pub.orcid.org/v3.0/0000-0002-4995-4732/employments";
const ORCID_EDUCATIONS_URL = "https://pub.orcid.org/v3.0/0000-0002-4995-4732/educations";
const OPENALEX_URL = "https://api.openalex.org/works?filter=author.id:A5015310258&sort=publication_date:desc&per-page=100";
const CROSSREF_WORKS_URL = "https://api.crossref.org/works";
const GITHUB_REPOSITORIES_URL = "https://api.github.com/users/USTCzzl/repos?per_page=100&sort=updated";
const SITE_URL = "https://ustczzl.github.io/";
const OWNER_NAME = "Zhangli Zhou";
const CONTACT_EMAIL = "zzl1215@mail.ustc.edu.cn";
const args = new Set(process.argv.slice(2));
const initMode = args.has("--init");
const localOnly = args.has("--local-only");

function normalizeSpace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTitle(value = "") {
  return normalizeSpace(value)
    .replace(/[.。]+$/u, "")
    .toLowerCase();
}

function slugify(value = "") {
  return normalizeTitle(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "publication";
}

function decodeXml(value = "") {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
    hellip: "...",
    auml: "a",
    Auml: "A",
    ouml: "o",
    Ouml: "O",
    uuml: "u",
    Uuml: "U",
    szlig: "ss",
    eacute: "e",
    Eacute: "E",
    eeacute: "e",
    agrave: "a",
    ccedil: "c"
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return named[entity] || match;
  });
}

function stripTags(value = "") {
  return value.replace(/<[^>]+>/g, "");
}

function cleanText(value = "") {
  return normalizeSpace(decodeXml(stripTags(value))).replace(/[.。]$/u, "");
}

function cleanAuthorName(value = "") {
  return cleanText(value).replace(/\s+\d{4}$/u, "");
}

function expandVenue(value = "") {
  const venues = {
    "IEEE Robotics Autom. Lett": "IEEE Robotics and Automation Letters",
    "IEEE Trans Autom. Sci. Eng": "IEEE Transactions on Automation Science and Engineering",
    "IEEE Trans. Artif. Intell": "IEEE Transactions on Artificial Intelligence",
    "IEEE Trans. Ind. Electron": "IEEE Transactions on Industrial Electronics",
    ICRA: "IEEE International Conference on Robotics and Automation",
    IROS: "IEEE/RSJ International Conference on Intelligent Robots and Systems",
    ICARM: "IEEE International Conference on Advanced Robotics and Mechatronics",
    ICDL: "IEEE International Conference on Development and Learning"
  };
  return venues[value] || value;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

function singaporeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Singapore",
    year: "numeric"
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatHumanDate(value) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function parseAttributes(value = "") {
  const attrs = {};
  const pattern = /([\w:-]+)="([^"]*)"/g;
  let match;
  while ((match = pattern.exec(value))) {
    attrs[match[1]] = decodeXml(match[2]);
  }
  return attrs;
}

function getFields(block, fieldName) {
  const fields = [];
  const pattern = new RegExp(`<${fieldName}\\b[^>]*>([\\s\\S]*?)<\\/${fieldName}>`, "gi");
  let match;
  while ((match = pattern.exec(block))) {
    fields.push(cleanText(match[1]));
  }
  return fields.filter(Boolean);
}

function firstField(block, fieldName) {
  return getFields(block, fieldName)[0] || "";
}

function typeLabel(type) {
  return {
    journal: "Journal",
    conference: "Conference",
    preprint: "Preprint"
  }[type] || "Publication";
}

function bibType(type) {
  if (type === "conference") {
    return "inproceedings";
  }
  if (type === "preprint") {
    return "misc";
  }
  return "article";
}

function extractDoi(value = "") {
  const match = value.match(/10\.\d{4,9}\/[^\s"'<>]+/i);
  return match ? match[0].replace(/[).,;]+$/g, "") : "";
}

function urlForDoi(doi = "") {
  return doi ? `https://doi.org/${doi}` : "";
}

function normalizeDoi(value = "") {
  return extractDoi(value).toLowerCase();
}

function datePartsToIso(dateParts = []) {
  if (!dateParts.length || !dateParts[0]) {
    return "";
  }
  const [year, month = 1, day = 1] = dateParts[0];
  if (!year) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDblpXml(xml) {
  const records = [];
  const pattern = /<(article|inproceedings)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = pattern.exec(xml))) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    const block = match[3];
    const authors = getFields(block, "author").map(cleanAuthorName);
    const title = cleanText(firstField(block, "title"));
    const year = Number.parseInt(firstField(block, "year"), 10) || null;
    const journal = firstField(block, "journal");
    const booktitle = firstField(block, "booktitle");
    const venue = expandVenue(tag === "inproceedings" ? booktitle : journal);
    const ee = getFields(block, "ee");
    const eeBlob = ee.join(" ");
    const doi = extractDoi(eeBlob);
    const arxiv = ee.find((url) => /arxiv\.org|10\.48550\/arxiv/i.test(url)) || "";
    const isPreprint =
      attrs.publtype === "informal" ||
      journal === "CoRR" ||
      (attrs.key || "").startsWith("journals/corr/");
    const type = isPreprint ? "preprint" : tag === "inproceedings" ? "conference" : "journal";

    if (!title || !year || !authors.length) {
      continue;
    }

    records.push({
      key: attrs.key || `dblp:${slugify(`${authors[0]} ${year} ${title}`)}`,
      type,
      year,
      title,
      authors,
      venue,
      journal: expandVenue(journal),
      booktitle: expandVenue(booktitle),
      volume: firstField(block, "volume"),
      number: firstField(block, "number"),
      pages: firstField(block, "pages"),
      doi,
      doiUrl: urlForDoi(doi),
      arxiv,
      dblpUrl: attrs.key ? `https://dblp.org/rec/${attrs.key}` : "",
      firstAuthor: authors[0] === OWNER_NAME
    });
  }

  return records;
}

function parseOrcidWorks(payload) {
  const works = [];
  const seen = new Set();

  for (const group of payload.group || []) {
    for (const summary of group["work-summary"] || []) {
      const externalIds = summary["external-ids"]?.["external-id"] || [];
      const doiEntry = externalIds.find((entry) => entry["external-id-type"]?.toLowerCase() === "doi");
      const doi = normalizeDoi(doiEntry?.["external-id-value"] || "");
      if (!doi || seen.has(doi)) {
        continue;
      }
      seen.add(doi);
      const publicationDate = summary["publication-date"] || {};
      const year = Number.parseInt(publicationDate.year?.value, 10) || null;
      const month = Number.parseInt(publicationDate.month?.value, 10) || 1;
      const day = Number.parseInt(publicationDate.day?.value, 10) || 1;
      works.push({
        doi,
        title: cleanText(summary.title?.title?.value || ""),
        venue: cleanText(summary["journal-title"]?.value || ""),
        year,
        publishedDate: year
          ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          : ""
      });
    }
  }

  return works;
}

function parseOrcidAffiliations(payload, summaryKey) {
  const records = [];
  for (const group of payload["affiliation-group"] || []) {
    for (const item of group.summaries || []) {
      const summary = item[summaryKey];
      if (!summary?.organization?.name) {
        continue;
      }
      const parseDate = (date) => {
        const year = date?.year?.value || "";
        const month = date?.month?.value || "";
        const day = date?.day?.value || "";
        return [year, month, day].filter(Boolean).join("-");
      };
      records.push({
        role: cleanText(summary["role-title"] || summary["department-name"] || ""),
        department: cleanText(summary["department-name"] || ""),
        organization: cleanText(summary.organization.name),
        city: cleanText(summary.organization.address?.city || ""),
        country: cleanText(summary.organization.address?.country || ""),
        startDate: parseDate(summary["start-date"]),
        endDate: parseDate(summary["end-date"])
      });
    }
  }
  return records.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
}

function parseOpenAlexWorks(payload) {
  const works = [];
  const seen = new Set();

  for (const item of payload.results || []) {
    const doi = normalizeDoi(item.doi || "");
    const ownerIsAuthor = (item.authorships || [])
      .some((authorship) => normalizeSpace(authorship.author?.display_name || "") === OWNER_NAME);
    if (!doi || !ownerIsAuthor || seen.has(doi)) {
      continue;
    }
    seen.add(doi);
    works.push({
      doi,
      title: cleanText(item.display_name || ""),
      venue: cleanText(item.primary_location?.source?.display_name || ""),
      year: Number.parseInt(item.publication_year, 10) || null,
      publishedDate: item.publication_date || ""
    });
  }

  return works;
}

function mergeWorkSummaries(...sources) {
  const works = [];
  const seen = new Set();
  for (const source of sources) {
    for (const work of source || []) {
      if (!work.doi || seen.has(work.doi)) {
        continue;
      }
      seen.add(work.doi);
      works.push(work);
    }
  }
  return works;
}

function parseCrossrefWork(item, orcidWork) {
  const doi = normalizeDoi(item.DOI || orcidWork.doi);
  const authors = (item.author || [])
    .map((author) => normalizeSpace([author.given, author.family].filter(Boolean).join(" ")))
    .filter(Boolean);
  const title = cleanText(item.title?.[0] || orcidWork.title);
  const publishedParts = item.published?.["date-parts"] || item.issued?.["date-parts"] || [];
  const year = Number.parseInt(publishedParts[0]?.[0], 10) || orcidWork.year;
  const venue = cleanText(item["container-title"]?.[0] || orcidWork.venue);
  const crossrefType = item.type || "";
  const type = crossrefType === "proceedings-article"
    ? "conference"
    : crossrefType === "posted-content"
      ? "preprint"
      : "journal";
  const publishedDate = item.created?.["date-time"]?.slice(0, 10)
    || datePartsToIso(publishedParts)
    || orcidWork.publishedDate;

  if (!doi || !title || !year || !authors.length) {
    throw new Error(`Crossref metadata is incomplete for ${doi || orcidWork.title}`);
  }

  return {
    key: `doi:${doi}`,
    type,
    year,
    publishedDate,
    title,
    authors,
    venue,
    journal: type === "journal" || type === "preprint" ? venue : "",
    booktitle: type === "conference" ? venue : "",
    volume: item.volume || "",
    number: item.issue || "",
    pages: item.page || "",
    doi,
    doiUrl: urlForDoi(doi),
    arxiv: "",
    dblpUrl: "",
    firstAuthor: authors[0] === OWNER_NAME
  };
}

function mergePublicationSources(...sources) {
  const publications = [];
  const indexesByDoi = new Map();
  const indexesByTitle = new Map();

  function fillMissing(primary, fallback) {
    if (primary.type !== fallback.type) {
      return primary;
    }
    const merged = { ...primary };
    for (const [key, value] of Object.entries(fallback)) {
      const current = merged[key];
      const isMissing =
        current === undefined ||
        current === null ||
        current === "" ||
        (Array.isArray(current) && current.length === 0);
      if (isMissing && value !== undefined && value !== null && value !== "") {
        merged[key] = value;
      }
    }
    return merged;
  }

  for (const source of sources) {
    for (const publication of source || []) {
      const doi = normalizeDoi(publication.doi || publication.doiUrl || "");
      const title = normalizeTitle(publication.title);
      const existingIndex = doi && indexesByDoi.has(doi)
        ? indexesByDoi.get(doi)
        : title && indexesByTitle.has(title)
          ? indexesByTitle.get(title)
          : undefined;
      if (existingIndex !== undefined) {
        publications[existingIndex] = fillMissing(publications[existingIndex], publication);
        continue;
      }
      const nextIndex = publications.length;
      if (doi) {
        indexesByDoi.set(doi, nextIndex);
      }
      if (title) {
        indexesByTitle.set(title, nextIndex);
      }
      publications.push(publication);
    }
  }

  return publications;
}

function enrichPublicationDates(publications, workSummaries) {
  const byDoi = new Map(workSummaries.filter((work) => work.doi).map((work) => [work.doi, work]));
  const byTitle = new Map(workSummaries.filter((work) => work.title).map((work) => [normalizeTitle(work.title), work]));

  return publications.map((publication) => {
    if (publication.publishedDate) {
      return publication;
    }
    const doi = normalizeDoi(publication.doi || publication.doiUrl || "");
    const match = byDoi.get(doi) || byTitle.get(normalizeTitle(publication.title));
    return match?.publishedDate
      ? { ...publication, publishedDate: match.publishedDate }
      : publication;
  });
}

function parseLinksFromHtml(block) {
  const links = {};
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(block))) {
    const label = cleanText(match[2]).toLowerCase();
    const url = decodeXml(match[1]);
    if (label === "doi") {
      links.doiUrl = url;
      links.doi = extractDoi(url);
    } else if (label === "arxiv") {
      links.arxiv = url;
    } else if (label === "code") {
      links.code = url;
    } else if (label === "video") {
      links.video = url;
    } else if (label === "pdf") {
      links.pdf = url;
    }
  }
  return links;
}

function parsePublicationsFromHtml(html) {
  const publications = [];
  const pattern = /<article\s+class="publication-card"([^>]*)>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const attrs = parseAttributes(match[1]);
    const block = match[2];
    const title = cleanText((block.match(/<h3>([\s\S]*?)<\/h3>/i) || [])[1] || "");
    const authorsText = cleanText((block.match(/<p class="authors">([\s\S]*?)<\/p>/i) || [])[1] || "");
    const authors = authorsText.split(/\s*,\s*/).map(cleanAuthorName).filter(Boolean);
    const venueText = cleanText((block.match(/<p class="venue">([\s\S]*?)<\/p>/i) || [])[1] || "");
    const image = ((block.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || "").trim();
    const year = Number.parseInt(attrs["data-year"], 10) || Number.parseInt(venueText.match(/\b(20\d{2}|19\d{2})\b/)?.[1], 10);
    const dataType = attrs["data-type"] || "";
    const type = dataType.includes("conference") ? "conference" : dataType.includes("preprint") ? "preprint" : "journal";
    const links = parseLinksFromHtml(block);
    const venue = venueText.replace(new RegExp(`,?\\s*${year}\\.?$`), "").replace(/\.$/, "");

    if (!title || !year) {
      continue;
    }

    publications.push({
      key: `legacy:${slugify(title)}`,
      id: attrs.id || "",
      type,
      year,
      title,
      authors,
      venue,
      journal: type === "journal" || type === "preprint" ? venue : "",
      booktitle: type === "conference" ? venue : "",
      volume: "",
      number: "",
      pages: "",
      doi: links.doi || "",
      doiUrl: links.doiUrl || "",
      arxiv: links.arxiv || "",
      dblpUrl: "",
      code: links.code || "",
      video: links.video || "",
      pdf: links.pdf || "",
      image,
      keywords: attrs["data-keywords"] || "",
      firstAuthor: dataType.includes("first") || authors[0] === OWNER_NAME
    });
  }

  return publications;
}

function dedupePreprints(publications) {
  const publishedTitles = new Set(
    publications
      .filter((publication) => publication.type !== "preprint")
      .map((publication) => normalizeTitle(publication.title))
  );

  return publications.filter((publication) => {
    return publication.type !== "preprint" || !publishedTitles.has(normalizeTitle(publication.title));
  });
}

function mergeExtras(publications, extrasByKey) {
  return publications.map((publication) => {
    const extras = {
      ...(extrasByKey[publication.key] || {}),
      ...(extrasByKey[publication.title] || {}),
      ...(extrasByKey[normalizeTitle(publication.title)] || {})
    };
    return {
      ...publication,
      ...extras,
      doi: extras.doi || publication.doi || "",
      doiUrl: extras.doiUrl || publication.doiUrl || (extras.doi ? urlForDoi(extras.doi) : ""),
      arxiv: extras.arxiv || publication.arxiv || "",
      code: extras.code || publication.code || "",
      video: extras.video || publication.video || "",
      pdf: extras.pdf || publication.pdf || "",
      image: extras.image || publication.image || "",
      id: extras.id || publication.id || `pub-${slugify(publication.title)}`
    };
  });
}

function sortPublications(publications) {
  const order = { journal: 0, conference: 1, preprint: 2 };
  return [...publications].sort((a, b) => {
    if (b.year !== a.year) {
      return b.year - a.year;
    }
    const dateA = a.publishedDate || `${a.year}-01-01`;
    const dateB = b.publishedDate || `${b.year}-01-01`;
    if (dateB !== dateA) {
      return dateB.localeCompare(dateA);
    }
    if ((order[a.type] ?? 9) !== (order[b.type] ?? 9)) {
      return (order[a.type] ?? 9) - (order[b.type] ?? 9);
    }
    return a.title.localeCompare(b.title);
  });
}

function ensureCitationKeys(publications) {
  const used = new Set();
  return publications.map((publication) => {
    let base = publication.citationKey;
    if (!base && publication.key && !publication.key.startsWith("legacy:")) {
      base = publication.key.split("/").pop();
    }
    if (!base) {
      const firstSurname = (publication.authors[0] || "Zhou").split(/\s+/).pop();
      base = `${firstSurname}${publication.year}${slugify(publication.title).split("-")[0]}`;
    }
    base = base.replace(/[^A-Za-z0-9:_-]/g, "");
    let citationKey = base;
    let suffix = 2;
    while (used.has(citationKey)) {
      citationKey = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(citationKey);
    return { ...publication, citationKey };
  });
}

function formatVenue(publication) {
  const bits = [];
  if (publication.venue) {
    bits.push(publication.venue);
  }

  let issue = "";
  if (publication.volume) {
    issue += publication.volume;
  }
  if (publication.number) {
    issue += `(${publication.number})`;
  }
  if (publication.pages) {
    issue += issue ? `:${publication.pages}` : publication.pages;
  }
  if (issue) {
    bits.push(issue);
  }
  if (publication.year) {
    bits.push(String(publication.year));
  }

  return `${bits.join(", ")}.`;
}

function keywordsFor(publication) {
  return normalizeSpace(
    [
      publication.keywords,
      publication.title,
      publication.venue,
      publication.authors.join(" "),
      publication.type,
      publication.firstAuthor ? "first author" : ""
    ].join(" ")
  );
}

function isUsefulLink(value = "") {
  return Boolean(value) && !value.startsWith("#");
}

function renderPublicationActions(publication, bibtex) {
  const links = [];
  if (publication.doiUrl) {
    links.push(`<a href="${escapeAttribute(publication.doiUrl)}" rel="noopener">DOI</a>`);
  }
  if (publication.arxiv) {
    links.push(`<a href="${escapeAttribute(publication.arxiv)}" rel="noopener">arXiv</a>`);
  }
  if (isUsefulLink(publication.pdf)) {
    links.push(`<a href="${escapeAttribute(publication.pdf)}" rel="noopener">PDF</a>`);
  }
  if (isUsefulLink(publication.code)) {
    links.push(`<a href="${escapeAttribute(publication.code)}" rel="noopener">Code</a>`);
  }
  if (isUsefulLink(publication.video)) {
    links.push(`<a href="${escapeAttribute(publication.video)}" rel="noopener">Video</a>`);
  }
  links.push(`<button class="copy-bibtex" type="button" data-bibtex="${escapeAttribute(bibtex)}">BibTeX</button>`);
  return links.join("\n                ");
}

function renderPublicationCard(publication) {
  const typeTokens = [publication.type, publication.firstAuthor ? "first" : ""].filter(Boolean).join(" ");
  const meta = [
    `<span>${escapeHtml(publication.year)}</span>`,
    `<span>${escapeHtml(typeLabel(publication.type))}</span>`,
    publication.firstAuthor ? "<span>First-author</span>" : ""
  ].filter(Boolean).join("\n                ");
  const authors = publication.authors
    .map((author) => author === OWNER_NAME ? `<strong>${escapeHtml(author)}</strong>` : escapeHtml(author))
    .join(", ");
  const bibtex = toBibTeX(publication);
  const imageTarget = publication.doiUrl || publication.arxiv || publication.video || publication.code || `#${publication.id}`;
  const thumbnail = publication.image
    ? `<a class="pub-thumb" href="${escapeAttribute(imageTarget)}" rel="noopener" aria-label="${escapeAttribute(`Open ${publication.title}`)}">
                <img src="${escapeAttribute(publication.image)}" alt="${escapeAttribute(publication.imageAlt || `${publication.title} figure from the paper`)}" loading="lazy">
              </a>`
    : `<a class="pub-thumb pub-thumb-placeholder" href="${escapeAttribute(imageTarget)}" rel="noopener" aria-label="${escapeAttribute(`Open ${publication.title}`)}">
                <span aria-hidden="true">${escapeHtml(typeLabel(publication.type))}</span>
                <small>Verified publication record</small>
              </a>`;

  return `            <article class="publication-card" data-type="${escapeAttribute(typeTokens)}" data-year="${escapeAttribute(publication.year)}" data-keywords="${escapeAttribute(keywordsFor(publication))}" id="${escapeAttribute(publication.id)}">
              ${thumbnail}
              <div class="pub-body">
                <div class="pub-meta">
                  ${meta}
                </div>
                <h3>${escapeHtml(publication.title)}</h3>
                <p class="authors">${authors}</p>
                <p class="venue">${escapeHtml(formatVenue(publication))}</p>
                <div class="pub-actions">
                  ${renderPublicationActions(publication, bibtex)}
                </div>
              </div>
            </article>`;
}

function renderPublicationGroups(publications) {
  const groups = [
    { type: "journal", title: "Journal Articles" },
    { type: "conference", title: "Conference Papers" },
    { type: "preprint", title: "Preprints" }
  ];

  return groups.map((group) => {
    const items = publications.filter((publication) => publication.type === group.type);
    if (!items.length) {
      return "";
    }
    return `            <section class="publication-group" data-publication-group="${group.type}" aria-labelledby="publication-group-${group.type}">
              <div class="publication-group-heading">
                <h3 id="publication-group-${group.type}">${group.title}</h3>
                <span>${items.length}</span>
              </div>
              <div class="publication-group-list">
${items.map(renderPublicationCard).join("\n\n")}
              </div>
            </section>`;
  }).filter(Boolean).join("\n\n");
}

function publicationMetrics(publications) {
  const years = publications.map((publication) => publication.year).filter(Boolean);
  return {
    total: publications.length,
    journals: publications.filter((publication) => publication.type === "journal").length,
    conferences: publications.filter((publication) => publication.type === "conference").length,
    preprints: publications.filter((publication) => publication.type === "preprint").length,
    firstAuthorWorks: publications.filter((publication) => publication.firstAuthor).length,
    firstAuthorJournals: publications.filter((publication) => {
      return publication.type === "journal" && publication.firstAuthor;
    }).length,
    earliestYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null
  };
}

function featuredProjectsFromGitHub(repositories, config, previousProjects) {
  const repositoriesByName = new Map(
    (repositories || []).map((repository) => [repository.name.toLowerCase(), repository])
  );
  const previousByName = new Map(
    (previousProjects || []).map((repository) => [repository.name.toLowerCase(), repository])
  );

  return (config.featuredRepositories || []).map((entry) => {
    const repository = repositoriesByName.get(entry.name.toLowerCase());
    const previous = previousByName.get(entry.name.toLowerCase()) || {};
    return {
      name: repository?.name || previous.name || entry.name,
      description: repository?.description || previous.description || entry.fallbackDescription || "",
      url: repository?.html_url || previous.url || `https://github.com/${config.githubUsername}/${entry.name}`,
      stars: repository?.stargazers_count ?? previous.stars ?? 0,
      forks: repository?.forks_count ?? previous.forks ?? 0,
      updatedAt: repository?.updated_at || previous.updatedAt || "",
      pushedAt: repository?.pushed_at || previous.pushedAt || ""
    };
  });
}

function renderProjectCard(project) {
  const updatedDate = project.updatedAt ? project.updatedAt.slice(0, 10) : "";
  const metadata = [
    pluralize(project.stars || 0, "star"),
    pluralize(project.forks || 0, "fork"),
    updatedDate ? `updated ${formatHumanDate(updatedDate)}` : ""
  ].filter(Boolean).join(" · ");

  return `            <article class="project-card">
              <h3>${escapeHtml(project.name)}</h3>
              <p>${escapeHtml(project.description || "Research code and supporting materials.")}</p>
              <p class="project-meta">${escapeHtml(metadata)}</p>
              <a href="${escapeAttribute(project.url)}" rel="noopener">Open repository</a>
            </article>`;
}

function renderProjects(projects) {
  return projects.map(renderProjectCard).join("\n");
}

function renderResearchRecord(publications, projects) {
  const metrics = publicationMetrics(publications);
  const typeSummary = [
    pluralize(metrics.journals, "journal article"),
    pluralize(metrics.conferences, "conference paper"),
    pluralize(metrics.preprints, "preprint")
  ].join(", ");
  const yearRange = metrics.earliestYear && metrics.latestYear
    ? `${metrics.earliestYear}-${metrics.latestYear}`
    : "the available record";
  const projectNames = projects.map((project) => project.name).join(", ");

  return `              <ul class="cv-list">
                <li>
                  <span>Publications</span>
                  <strong data-publication-total>${metrics.total} indexed works</strong>
                  <p>${escapeHtml(typeSummary)}; publication record spans ${escapeHtml(yearRange)}.</p>
                </li>
                <li>
                  <span>First-author work</span>
                  <strong>${pluralize(metrics.firstAuthorJournals, "first-author journal paper")}</strong>
                  <p>${pluralize(metrics.firstAuthorWorks, "first-author work")} across the verified publication record.</p>
                </li>
                <li>
                  <span>Open materials</span>
                  <strong>${pluralize(projects.length, "featured research repository", "featured research repositories")}</strong>
                  <p>${escapeHtml(projectNames)}; descriptions and activity are refreshed from GitHub.</p>
                </li>
              </ul>`;
}

function formatAffiliationDate(value) {
  if (!value) {
    return "";
  }
  const [year, month] = value.split("-");
  return month ? `${year}.${Number.parseInt(month, 10)}` : year;
}

function renderAffiliations(records, openEndedLabel) {
  return `              <ul class="cv-list">
${records.map((record) => {
    const range = [
      formatAffiliationDate(record.startDate),
      formatAffiliationDate(record.endDate) || openEndedLabel
    ].filter(Boolean).join("-");
    const title = [record.role, record.organization].filter(Boolean).join(", ");
    const details = [record.department, record.city, record.country]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(", ");
    return `                <li>
                  <span>${escapeHtml(range)}</span>
                  <strong>${escapeHtml(title)}</strong>
                  <p>${escapeHtml(details || record.organization)}.</p>
                </li>`;
  }).join("\n")}
              </ul>`;
}

function cleanBibValue(value = "") {
  return String(value).replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function bibField(name, value) {
  if (!value) {
    return "";
  }
  return `  ${name.padEnd(10)} = {${cleanBibValue(value)}}`;
}

function toBibTeX(publication) {
  const fields = [
    bibField("title", publication.title),
    bibField("author", publication.authors.join(" and ")),
    publication.type === "conference"
      ? bibField("booktitle", publication.venue)
      : bibField("journal", publication.venue),
    bibField("year", publication.year),
    bibField("volume", publication.volume),
    bibField("number", publication.number),
    bibField("pages", publication.pages),
    bibField("doi", publication.doi),
    bibField("url", publication.doiUrl || publication.arxiv || publication.dblpUrl)
  ].filter(Boolean);

  return `@${bibType(publication.type)}{${publication.citationKey},\n${fields.join(",\n")}\n}`;
}

function renderFeaturedNews(item) {
  return `            <li><time datetime="${escapeAttribute(item.date)}">${escapeHtml(item.date)}</time> ${escapeHtml(item.title)}</li>`;
}

function renderNewsLayout(item) {
  return `          <ul class="news-list" aria-label="Latest research news">
${renderFeaturedNews(item)}
          </ul>`;
}

function renderHeroSpotlight(publication) {
  const target = publication.doiUrl || publication.arxiv || `#${publication.id}`;
  const visual = publication.image
    ? `<a class="spotlight-image" href="${escapeAttribute(target)}" rel="noopener" aria-label="${escapeAttribute(`Open ${publication.title}`)}">
                <img src="${escapeAttribute(publication.image)}" alt="${escapeAttribute(publication.imageAlt || `${publication.title} figure from the paper`)}">
              </a>`
    : `<a class="spotlight-image spotlight-image-placeholder" href="${escapeAttribute(target)}" rel="noopener"><span>${escapeHtml(typeLabel(publication.type))}</span></a>`;

  return `            <article class="hero-spotlight">
              ${visual}
              <div>
                <p class="spotlight-label">Latest paper</p>
                <h3><a href="${escapeAttribute(target)}" rel="noopener">${escapeHtml(publication.title)}</a></h3>
                <p>${escapeHtml(publication.venue)}, ${escapeHtml(publication.year)}.</p>
              </div>
            </article>`;
}

function replaceHeroSpotlight(html, publication) {
  return html.replace(
    /            <article class="hero-spotlight">[\s\S]*?            <\/article>/,
    renderHeroSpotlight(publication)
  );
}

function replaceBetween(html, startMarker, endMarker, replacement) {
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Could not find markers ${startMarker} and ${endMarker}`);
  }
  return `${html.slice(0, startIndex + startMarker.length)}\n${replacement}\n              ${html.slice(endIndex)}`;
}

function replaceNewsLayout(html, item) {
  const legacyPattern = /          <div class="news-layout">[\s\S]*?          <button class="show-news"[\s\S]*?<\/button>/;
  if (legacyPattern.test(html)) {
    return html.replace(legacyPattern, renderNewsLayout(item));
  }

  const cardPattern = /          <div class="news-layout">[\s\S]*?          <\/div>/;
  if (cardPattern.test(html)) {
    return html.replace(cardPattern, renderNewsLayout(item));
  }

  return html.replace(/          <ul class="news-list"[\s\S]*?          <\/ul>/, renderNewsLayout(item));
}

function replaceProjectLayout(html, projects) {
  return replaceBetween(
    html,
    "<!-- PROJECTS_START -->",
    "<!-- PROJECTS_END -->",
    renderProjects(projects)
  );
}

function replaceResearchRecord(html, publications, projects) {
  return replaceBetween(
    html,
    "<!-- RESEARCH_RECORD_START -->",
    "<!-- RESEARCH_RECORD_END -->",
    renderResearchRecord(publications, projects)
  );
}

function replaceVerifiedProfile(html, profile) {
  let nextHtml = html;
  if (profile.employments?.length) {
    nextHtml = replaceBetween(
      nextHtml,
      "<!-- EXPERIENCE_START -->",
      "<!-- EXPERIENCE_END -->",
      renderAffiliations(profile.employments, "present")
    );
  }
  if (profile.educations?.length) {
    nextHtml = replaceBetween(
      nextHtml,
      "<!-- EDUCATION_START -->",
      "<!-- EDUCATION_END -->",
      renderAffiliations(profile.educations, "present")
    );
  }
  return nextHtml;
}

function replaceSyncLabels(html, syncDate) {
  const label = formatHumanDate(syncDate);
  return html
    .replace(
      /(<p class="last-updated" data-publications-updated>)[^<]*(<\/p>)/,
      `$1Daily data check · ${label}$2`
    )
    .replace(
      /(<span data-site-updated>)[^<]*(<\/span>)/,
      `$1Data refreshed ${label}.$2`
    );
}

function dateToRss(dateValue) {
  const date = /^\d{4}$/.test(dateValue)
    ? new Date(`${dateValue}-01-01T00:00:00Z`)
    : new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toUTCString();
  }
  return date.toUTCString();
}

function renderFeed(newsItems) {
  const items = newsItems.map((item) => {
    const url = `${SITE_URL}#news`;
    return `    <item>
      <title>${escapeHtml(item.title)}</title>
      <link>${url}</link>
      <guid>${SITE_URL}${escapeHtml(item.id)}</guid>
      <pubDate>${dateToRss(item.date)}</pubDate>
      <description>${escapeHtml(item.summary)}</description>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Zhangli Zhou research news</title>
    <link>${SITE_URL}</link>
    <description>Research updates, accepted papers, code, and demo news from Zhangli Zhou.</description>
${items}
  </channel>
</rss>
`;
}

function renderSitemap(syncDate) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${syncDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function publicationNews(publication) {
  const firstAuthor = publication.authors[0] || OWNER_NAME;
  const venue = publication.venue || "a new venue";
  const ownerIsFirst = firstAuthor === OWNER_NAME;
  const title = ownerIsFirst
    ? `Congratulations to ${OWNER_NAME} (first author) on publishing "${publication.title}" in ${venue}.`
    : `Congratulations to ${firstAuthor} and collaborators on publishing "${publication.title}" in ${venue}.`;
  const links = [
    publication.doiUrl ? { label: "DOI", url: publication.doiUrl } : null,
    publication.code ? { label: "Code", url: publication.code } : null,
    publication.video ? { label: "Video", url: publication.video } : null
  ].filter(Boolean);

  return {
    id: `news-${publication.publishedDate || new Date().toISOString().slice(0, 10)}-${slugify(publication.title)}`,
    date: publication.publishedDate || new Date().toISOString().slice(0, 10),
    title,
    summary: `${publication.title} has been published in ${venue}.`,
    links
  };
}

async function readJson(filePath, fallback) {
  if (!existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function fetchDblpXml() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(DBLP_URL, {
      signal: controller.signal,
      headers: {
        "user-agent": "ustczzl-homepage-sync/1.0 (+https://ustczzl.github.io/)"
      }
    });
    if (!response.ok) {
      throw new Error(`DBLP returned HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, headers = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": `ustczzl-homepage-sync/1.0 (mailto:${CONTACT_EMAIL})`,
          ...headers
        }
      });
      if (response.ok) {
        return await response.json();
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 2) {
        throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
      }
    } catch (error) {
      if (attempt === 2 || error.name === "AbortError") {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
  }
  throw new Error(`${new URL(url).hostname} did not return JSON`);
}

async function fetchCrossrefPublication(orcidWork) {
  const payload = await fetchJson(`${CROSSREF_WORKS_URL}/${encodeURIComponent(orcidWork.doi)}`);
  return parseCrossrefWork(payload.message || {}, orcidWork);
}

function replacePublicationStats(html, publications) {
  const metrics = publicationMetrics(publications);

  return html
    .replace(/(<dt data-publication-total>)[^<]*(<\/dt>)/, `$1${metrics.total}$2`)
    .replace(/(<strong data-publication-total>)[^<]*(<\/strong>)/, `$1${metrics.total} indexed works$2`)
    .replace(/(<dt data-first-author-journals>)[^<]*(<\/dt>)/, `$1${metrics.firstAuthorJournals}$2`)
    .replace(/(<dt data-latest-publication-year>)[^<]*(<\/dt>)/, `$1${metrics.latestYear || "-"}$2`);
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

async function main() {
  const [
    previousPublications,
    extrasByKey,
    existingNews,
    projectConfig,
    previousProjects,
    previousProfile,
    previousSyncStatus,
    indexHtml
  ] = await Promise.all([
    readJson(PUBLICATIONS_PATH, []),
    readJson(LINKS_PATH, {}),
    readJson(NEWS_PATH, []),
    readJson(PROJECT_CONFIG_PATH, { githubUsername: "USTCzzl", featuredRepositories: [] }),
    readJson(PROJECTS_PATH, []),
    readJson(PROFILE_PATH, { employments: [], educations: [] }),
    readJson(SYNC_STATUS_PATH, {}),
    fs.readFile(INDEX_PATH, "utf8")
  ]);

  let publications = previousPublications.length ? previousPublications : parsePublicationsFromHtml(indexHtml);
  let projects = previousProjects;
  let profile = previousProfile;
  const sourceParts = [];
  const sourceStatus = {
    DBLP: false,
    ORCID: false,
    ORCIDProfile: false,
    OpenAlex: false,
    Crossref: false,
    GitHub: false
  };
  const syncDate = localOnly
    ? previousSyncStatus.lastCheckedDate || singaporeDate()
    : singaporeDate();

  if (!localOnly) {
    try {
      const xml = await fetchDblpXml();
      publications = parseDblpXml(xml);
      sourceParts.push("DBLP");
      sourceStatus.DBLP = true;
    } catch (error) {
      console.warn(`DBLP sync failed: ${error.message}`);
    }

    const workSummarySources = [];
    const dateSummarySources = [];
    try {
      const orcidPayload = await fetchJson(ORCID_URL, { accept: "application/json" });
      const orcidWorks = parseOrcidWorks(orcidPayload);
      workSummarySources.push(orcidWorks);
      dateSummarySources.push(orcidWorks);
      sourceParts.push("ORCID");
      sourceStatus.ORCID = true;
    } catch (error) {
      console.warn(`ORCID sync failed: ${error.message}`);
    }

    try {
      const [employmentPayload, educationPayload] = await Promise.all([
        fetchJson(ORCID_EMPLOYMENTS_URL, { accept: "application/vnd.orcid+json" }),
        fetchJson(ORCID_EDUCATIONS_URL, { accept: "application/vnd.orcid+json" })
      ]);
      profile = {
        employments: parseOrcidAffiliations(employmentPayload, "employment-summary"),
        educations: parseOrcidAffiliations(educationPayload, "education-summary")
      };
      sourceStatus.ORCIDProfile = true;
    } catch (error) {
      console.warn(`ORCID profile sync failed: ${error.message}`);
    }

    try {
      const openAlexPayload = await fetchJson(`${OPENALEX_URL}&mailto=${encodeURIComponent(CONTACT_EMAIL)}`);
      const openAlexWorks = parseOpenAlexWorks(openAlexPayload);
      workSummarySources.push(openAlexWorks.filter((work) => work.year >= 2024));
      dateSummarySources.push(openAlexWorks);
      sourceParts.push("OpenAlex");
      sourceStatus.OpenAlex = true;
    } catch (error) {
      console.warn(`OpenAlex sync failed: ${error.message}`);
    }

    const knownDois = new Set(publications.map((publication) => normalizeDoi(publication.doi || publication.doiUrl || "")).filter(Boolean));
    const knownTitles = new Set(publications.map((publication) => normalizeTitle(publication.title)).filter(Boolean));
    const missingWorks = mergeWorkSummaries(...workSummarySources).filter((work) => {
      return !knownDois.has(work.doi) && !knownTitles.has(normalizeTitle(work.title));
    });
    const crossrefResults = await Promise.allSettled(missingWorks.map(fetchCrossrefPublication));
    const crossrefPublications = [];
    crossrefResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        crossrefPublications.push(result.value);
      } else {
        console.warn(`Crossref sync failed for ${missingWorks[index].doi}: ${result.reason.message}`);
      }
    });
    if (crossrefPublications.length) {
      sourceParts.push("Crossref");
    }
    sourceStatus.Crossref = crossrefResults.every((result) => result.status === "fulfilled");
    publications = mergePublicationSources(publications, crossrefPublications, previousPublications);
    publications = enrichPublicationDates(publications, mergeWorkSummaries(...dateSummarySources));

    try {
      const githubHeaders = {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28"
      };
      if (process.env.GITHUB_TOKEN) {
        githubHeaders.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const repositories = await fetchJson(GITHUB_REPOSITORIES_URL, githubHeaders);
      projects = featuredProjectsFromGitHub(repositories, projectConfig, previousProjects);
      sourceStatus.GitHub = true;
      sourceParts.push("GitHub");
    } catch (error) {
      console.warn(`GitHub sync failed: ${error.message}`);
    }
  }

  if (!projects.length) {
    projects = featuredProjectsFromGitHub([], projectConfig, []);
  }

  publications = ensureCitationKeys(
    sortPublications(
      mergeExtras(
        dedupePreprints(publications),
        extrasByKey
      )
    )
  );

  const previousTitles = new Set(previousPublications.map((publication) => normalizeTitle(publication.title)));
  const previousKeys = new Set(previousPublications.map((publication) => publication.key));
  const generatedNews = initMode
    ? []
    : publications
        .filter((publication) => !previousKeys.has(publication.key) && !previousTitles.has(normalizeTitle(publication.title)))
        .map(publicationNews);
  const newsIds = new Set();
  const news = [...generatedNews, ...existingNews].filter((item) => {
    if (newsIds.has(item.id)) {
      return false;
    }
    newsIds.add(item.id);
    return true;
  });

  let nextHtml = indexHtml;
  nextHtml = replaceBetween(
    nextHtml,
    "<!-- PUBLICATIONS_START -->",
    "<!-- PUBLICATIONS_END -->",
    renderPublicationGroups(publications)
  );
  nextHtml = replacePublicationStats(nextHtml, publications);
  nextHtml = replaceProjectLayout(nextHtml, projects);
  nextHtml = replaceResearchRecord(nextHtml, publications, projects);
  nextHtml = replaceVerifiedProfile(nextHtml, profile);
  nextHtml = replaceSyncLabels(nextHtml, syncDate);
  if (publications.length) {
    nextHtml = replaceHeroSpotlight(nextHtml, publications[0]);
  }

  if (news.length) {
    nextHtml = replaceNewsLayout(nextHtml, news[0]);
  }

  await Promise.all([
    writeText(INDEX_PATH, nextHtml),
    writeText(PUBLICATIONS_PATH, `${JSON.stringify(publications, null, 2)}\n`),
    writeText(BIB_PATH, `${publications.map(toBibTeX).join("\n\n")}\n`),
    writeText(NEWS_PATH, `${JSON.stringify(news, null, 2)}\n`),
    writeText(PROJECTS_PATH, `${JSON.stringify(projects, null, 2)}\n`),
    writeText(PROFILE_PATH, `${JSON.stringify({
      source: "ORCID",
      lastCheckedDate: syncDate,
      employments: profile.employments || [],
      educations: profile.educations || []
    }, null, 2)}\n`),
    writeText(SYNC_STATUS_PATH, `${JSON.stringify({
      lastCheckedDate: syncDate,
      timezone: "Asia/Singapore",
      sources: localOnly ? previousSyncStatus.sources || sourceStatus : sourceStatus,
      publicationMetrics: publicationMetrics(publications),
      featuredProjects: projects.length,
      orcidProfileRecords: {
        employments: profile.employments?.length || 0,
        educations: profile.educations?.length || 0
      }
    }, null, 2)}\n`),
    writeText(FEED_PATH, renderFeed(news)),
    writeText(SITEMAP_PATH, renderSitemap(syncDate))
  ]);

  console.log(`Synced ${publications.length} publications and ${projects.length} projects from ${sourceParts.join(" + ") || "local data"}.`);
  if (generatedNews.length) {
    console.log(`Added ${generatedNews.length} generated news item(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
