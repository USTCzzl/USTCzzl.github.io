# Zhangli Zhou Academic Homepage

This is a static GitHub Pages homepage draft for `https://ustczzl.github.io/`.
It replaces the current AcademicPages template front page with a single-page research profile focused on papers, videos, code, CV, and contact links.

## Files

- `index.html` - homepage content and SEO metadata
- `styles.css` - responsive layout and visual system
- `script.js` - mobile menu, publication search/filter/year controls, BibTeX copy, and visitor map logic
- `feed.xml` - RSS feed for research news
- `assets/data/publications.json` - generated publication data
- `assets/data/publications.bib` - generated BibTeX export
- `assets/data/news.json` - editable news source
- `assets/data/publication-links.json` - manual DOI/arXiv/code/video/image/title overrides preserved during publication sync
- `assets/data/homepage-config.json` - editable GitHub repository selection and fallback project descriptions
- `assets/data/projects.json` - generated GitHub project metadata
- `assets/data/profile.json` - generated public ORCID employment and education records
- `assets/data/sync-status.json` - generated daily source status and research-record metrics
- `scripts/sync-homepage.mjs` - refreshes publications, projects, research metrics, BibTeX, RSS, homepage statistics, and news
- `scripts/add-news.mjs` - adds an immediate acceptance/news item before DBLP has indexed the paper
- `.github/workflows/sync-homepage.yml` - GitHub Actions workflow that refreshes verified homepage data every day or on manual dispatch
- `assets/hero-local-observation.jpg` - robot experiment image used for the first screen
- `assets/video-*.jpg` - local YouTube cover images for the video cards
- `robots.txt` and `sitemap.xml` - search engine helpers

## Deploy

Place these files at the root of the `USTCzzl.github.io` repository and push to GitHub Pages. No build command is required.

The included GitHub Actions workflow runs `node scripts/sync-homepage.mjs` every day at 00:17 UTC (08:17 Asia/Singapore) and commits the generated page only when data changed. You can also run it manually from the Actions tab.

## Homepage sync workflow

Initialize or refresh all source-backed homepage records:

```bash
node scripts/sync-homepage.mjs
```

Add immediate acceptance news before DBLP has indexed the paper:

```bash
node scripts/add-news.mjs \
  --person "Student Name" \
  --role "first author" \
  --title "Paper Title" \
  --venue "ICRA 2026" \
  --date "2026-06-13" \
  --link "https://doi.org/..."
```

DBLP remains the primary bibliography. ORCID and the ORCID-linked OpenAlex author record discover newer DOI records before DBLP indexes them, and Crossref supplies the canonical metadata. GitHub supplies current metadata for the configured featured repositories. The generated homepage groups journal articles, conference papers, and preprints separately, updates the latest-paper spotlight and news, rebuilds the Research record metrics, refreshes project activity, and records the daily source-check date.

Keep custom paper links and verified paper-figure paths in `assets/data/publication-links.json`. The sync preserves these overrides. Papers without a verified figure use a neutral publication placeholder; the script never borrows an image from another paper.

Experience and education are refreshed from public ORCID records when those lists contain entries. ORCID currently returns no public employment or education entries, so the existing verified CV text is preserved. Research themes, contact details, and selected demo videos remain manually maintained because no current public source can update them reliably without risking false profile information.

## Suggested next edits

- Add PDF files under `assets/papers/` and link them from `assets/data/publication-links.json`.
- Add `assets/Zhangli_Zhou_CV.pdf` and change the CV text link into a download link.
- Replace or reorder demo video cover images once the final YouTube list is chosen.
- Keep the appointment title and education entries current if they change; automated sources do not currently provide these verified fields.
- Register a production analytics widget such as ClustrMaps, MapMyVisitors, GoatCounter, Umami, or Cloudflare Web Analytics if you want server-side aggregate page views and a real multi-visitor world map. The current static implementation shows the current visitor's IP-derived location, a local browser visit count, a lightweight counter badge, and a zoomable Leaflet/OpenStreetMap visitor map.

## Visitor analytics notes

GitHub Pages is static hosting, so the site cannot keep its own server-side IP logs or global visit database without an external service. The visitor panel currently uses browser-side IP geolocation with graceful fallback:

- Primary IP lookup: `https://ipwho.is/`
- Fallback IP lookup: `https://ipapi.co/json/`
- Lightweight page counter badge: `https://profile-counter.glitch.me/`
- Interactive map library: Leaflet 1.9.4 with OpenStreetMap tiles

For a production visitor map, paste your chosen provider's embed code into the `Visitors` section in `index.html`.

## Data sources used for this draft

- Existing homepage: `https://ustczzl.github.io/`
- ICR group people page: `https://ustc-icr.github.io/people.html`
- DBLP author page: `https://dblp.org/pid/314/6823`
- Google Scholar profile link from the old homepage: `https://scholar.google.com/citations?user=cluMJl4AAAAJ&hl=en`
- GitHub public profile and repository names: `https://github.com/USTCzzl`
- Academic website inspiration and visitor-map options: The Academic Designer, Rice Graduate and Postdoctoral Studies, AcademicPages visitor-map discussion, ClustrMaps tutorials, MapMyVisitors.
