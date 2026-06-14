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
- `assets/data/publication-links.json` - manual DOI/arXiv/code/video/title overrides preserved during DBLP sync
- `scripts/sync-dblp.mjs` - pulls DBLP, regenerates publications, BibTeX, RSS, and news blocks
- `scripts/add-news.mjs` - adds an immediate acceptance/news item before DBLP has indexed the paper
- `.github/workflows/sync-publications.yml` - GitHub Actions workflow that syncs DBLP every 6 hours or on manual dispatch
- `assets/hero-local-observation.jpg` - robot experiment image used for the first screen
- `assets/video-*.jpg` - local YouTube cover images for the video cards
- `robots.txt` and `sitemap.xml` - search engine helpers

## Deploy

Place these files at the root of the `USTCzzl.github.io` repository and push to GitHub Pages. No build command is required.

The included GitHub Actions workflow runs `node scripts/sync-dblp.mjs` every 6 hours and commits changes when DBLP has new records. You can also run it manually from the Actions tab.

## Publication sync workflow

Initialize or refresh from DBLP:

```bash
node scripts/sync-dblp.mjs
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

Keep custom paper links in `assets/data/publication-links.json`. The DBLP sync preserves these manual code, video, arXiv, PDF, image, and title overrides.

## Suggested next edits

- Add PDF files under `assets/papers/` and link them from `assets/data/publication-links.json`.
- Add `assets/Zhangli_Zhou_CV.pdf` and change the CV text link into a download link.
- Replace or reorder demo video cover images once the final YouTube list is chosen.
- Confirm whether the exact current title should be "Postdoctoral Researcher", "Ph.D.", or another role.
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
