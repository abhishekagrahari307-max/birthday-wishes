/* Home page: batch grid + filters + live search + load-more. */
(function () {
  "use strict";

  const grid = document.getElementById("grid");
  const chipsEl = document.getElementById("chips");
  const searchInput = document.getElementById("search");
  const resultsEl = document.getElementById("results");
  const resultsTitle = document.getElementById("resultsTitle");
  const loadMoreBtn = document.getElementById("loadMore");
  const gridSection = document.getElementById("gridSection");

  const CHIPS = ["All", "JEE", "NEET", "UPSC", "GATE", "School", "Skills", "Others"];
  let activeChip = "All";
  let allBatches = [];
  let seen = new Set();
  let nextPage = 3; // pages 1-2 are in the seed
  let searchTimer = null;
  let searching = false;

  function examOf(b) {
    const n = (b.name + " " + (b.byName || "")).toUpperCase();
    if (/CYBER|SKILL|EARNER|HACK/.test(n)) return "Skills";
    if (/UPSC|IAS|PW ONLY/.test(n)) return "UPSC";
    if (/\bGATE\b/.test(n)) return "GATE";
    if (/NEET/.test(n)) return "NEET";
    if (/JEE|JEE\b/.test(n)) return "JEE";
    if (/CLASS \d|CLASS\d|\b9TH\b|\b10TH\b|\b11TH\b|\b12TH\b|UDAAN|NEEV|PARISHRAM|CHAMPS|BRIDGE|PUC|SCHOOL|MAHARASHTRA|GUJARAT|BOARD/.test(n)) return "School";
    if (/CET|EAPCET|KCET|OLYMPIAD|IOQM|NSEC|CAIIB|\bCA\b|BANK|SSC|BPSC|TEST SERIES/.test(n)) return "Others";
    return "Others";
  }

  function inChip(b) {
    if (activeChip === "All") return true;
    return examOf(b) === activeChip;
  }

  function feeLabel(fee) {
    if (fee === 0 || fee == null) return "Free";
    return "₹" + Number(fee).toLocaleString("en-IN");
  }

  function cardHtml(b) {
    const img = b.previewImage
      ? `style="background-image:url('${b.previewImage.replace(/'/g, "%27")}')"`
      : "";
    const badge = b.featured ? `<span class="tag hot">Your batch</span>` : "";
    const sub = b.byName ? `<div class="sub">${esc(b.byName)}</div>` : "";
    const dates = b.startDate ? `<span class="tag">${esc(b.startDate)} → ${esc(b.endDate || "")}</span>` : "";
    return `<a class="card" href="batch.html?id=${encodeURIComponent(b._id)}">
      <div class="thumb" ${img}>${b.previewImage ? "" : "📚"}</div>
      <div class="body">
        <div class="title">${esc(b.name)}</div>
        ${sub}
        <div class="meta">
          ${badge}
          <span class="tag fee">${feeLabel(b.feeTotal)}</span>
          <span class="tag lang">${esc(b.language || "")}</span>
          ${dates}
        </div>
      </div>
    </a>`;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGrid() {
    const list = allBatches.filter(inChip);
    if (!list.length) {
      grid.innerHTML = `<div class="state" style="grid-column:1/-1"><div class="big">🔍</div>No batches in this filter.</div>`;
      return;
    }
    // Featured first, then the rest in order
    const featured = list.filter((b) => b.featured);
    const rest = list.filter((b) => !b.featured);
    grid.innerHTML = featured.concat(rest).map(cardHtml).join("");
  }

  function mergeBatches(items) {
    let added = 0;
    for (const b of items) {
      if (!b || !b._id || seen.has(b._id)) continue;
      seen.add(b._id);
      allBatches.push({
        _id: b._id, name: b.name, byName: b.byName || "",
        startDate: b.startDate || "", endDate: b.endDate || "",
        language: b.language || "", previewImage: b.previewImage || "",
        feeTotal: b.feeTotal, type: b.type || "", slug: b.slug || "",
        featured: !!b.featured
      });
      added++;
    }
    return added;
  }

  /* ---- chips ---- */
  chipsEl.innerHTML = CHIPS.map(
    (c) => `<span class="chip${c === activeChip ? " active" : ""}" data-chip="${c}">${c}</span>`
  ).join("");
  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    activeChip = chip.dataset.chip;
    chipsEl.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    clearSearch();
    renderGrid();
  });

  /* ---- search ---- */
  function clearSearch() {
    resultsEl.hidden = true;
    resultsTitle.hidden = true;
    gridSection.hidden = false;
    loadMoreBtn.hidden = false;
  }

  async function runSearch(q) {
    if (!q || q.length < 2) { clearSearch(); return; }
    searching = true;
    resultsTitle.hidden = false;
    resultsTitle.textContent = `Searching “${q}”…`;
    resultsEl.hidden = false;
    gridSection.hidden = true;
    loadMoreBtn.hidden = true;
    try {
      const hits = await API.search(q);
      if (!hits.length) {
        resultsTitle.textContent = `No batches found for “${q}”`;
        resultsEl.innerHTML = "";
      } else {
        resultsTitle.textContent = `${hits.length} result${hits.length > 1 ? "s" : ""} for “${q}”`;
        resultsEl.innerHTML = hits
          .slice(0, 30)
          .map(
            (h) => `<a class="result" href="batch.html?id=${encodeURIComponent(h._id)}">
              <span>🎓 ${esc(h.name)}</span><span class="go">Open →</span></a>`
          )
          .join("");
      }
    } catch (e) {
      resultsTitle.textContent = "Search failed — check connection and retry.";
      resultsEl.innerHTML = "";
    } finally {
      searching = false;
    }
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    searchTimer = setTimeout(() => runSearch(q), 450);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(searchTimer);
      runSearch(searchInput.value.trim());
    }
    if (e.key === "Escape") { searchInput.value = ""; clearSearch(); }
  });

  /* ---- load more (live LearnX catalog pages) ---- */
  loadMoreBtn.addEventListener("click", async () => {
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = `<span class="spin"></span>Loading batches…`;
    try {
      const items = await API.catalogPage(nextPage);
      if (!items.length) {
        loadMoreBtn.textContent = "No more batches";
        return;
      }
      mergeBatches(items);
      nextPage++;
      renderGrid();
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Load more batches";
    } catch (e) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Couldn't load — retry";
    }
  });

  /* ---- init ---- */
  API.seed().then((s) => {
    mergeBatches(s.batches || []);
    renderGrid();
  }).catch(() => {
    grid.innerHTML = `<div class="state error"><div class="big">⚠️</div>Failed to load seed data.</div>`;
  });
})();
