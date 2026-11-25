# Lecture with Batch 🎓

A static website that organizes **lectures by batch**: pick a batch → open its subjects →
chapters → lectures (with durations, dates, watch links) and PDF notes.

## Pages

| File | What it does |
| --- | --- |
| `index.html` | Home — batch grid with exam filters, live search, "load more" from the live catalog |
| `batch.html?id=<batchId>` | Batch view — details, subjects → chapters → lectures/notes, per-batch watch progress |
| `tracker.html` | The Cyber Security topic study tracker (from PR #1) |

## Data layer (`js/api.js`)

Live data is fetched at runtime from open PW-compatible mirrors, tried in order:

1. `https://s4-cdn.samfygros.com/radha/<path>` (direct)
2. `https://api.allorigins.win/raw?url=…` (CORS relay)

Endpoints used: `v3/batches/{id}/details`, `v2/batches/{id}/subject/{slug}/topics`,
`v2/batches/{id}/subject/{slug}/contents?tag=…&contentType=videos|notes`,
`v3/batches/search?name=…`, plus the LearnX catalog `AllBatches?page=N`.

If every live attempt fails, the site falls back to the offline seed:

- `data/seed.json` — 42-batch catalog snapshot + deep fallback for the two saved batches
  (Hacking & Cyber Security - Earners, Hybrid UPSC GS Foundation)
- `data/course-data.json` — fully extracted Cyber Security with AI topic (10 lectures + 8 notes)

Watch links build the same `play.php` deep-links used by the public lecture player.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

No build step, no dependencies — plain HTML/CSS/JS.

## Files

```
index.html      home (batch catalog)
batch.html      batch → subjects → chapters → lectures
tracker.html    topic study tracker (previous deliverable)
css/site.css    shared styles
js/api.js       live/seed data layer
js/home.js      home page logic
js/batch.js     batch page logic
data/seed.json  offline seed catalog + deep fallbacks
data/course-data.json  extracted cyber topic (lectures, notes, resources)
STUDY_PLAN.md   4-week study plan for the Cyber Security topic
```

## Status

- [x] Batch catalog with filters + live search
- [x] Batch → subject → chapter → lecture browsing with watch links
- [x] Notes (PDF) lists per chapter
- [x] Per-batch watched-progress (localStorage)
- [x] Offline seed fallback (works without any live mirror)
- [x] Topic tracker from PR #1 preserved at `tracker.html`
