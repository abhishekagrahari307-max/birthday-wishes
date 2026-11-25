/* Batch page: details → subjects → topics → lectures/notes, with per-batch progress. */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const batchId = (params.get("id") || "").trim();

  const heroEl = document.getElementById("batchHero");
  const progressEl = document.getElementById("progress");
  const subjectsEl = document.getElementById("subjects");

  let details = null;
  let progress = {};
  let progressKey = "lwb-progress-" + batchId;
  let totalVideos = 0;
  let doneVideos = 0;

  try { progress = JSON.parse(localStorage.getItem(progressKey) || "{}"); } catch (e) { progress = {}; }

  function saveProgress() {
    localStorage.setItem(progressKey, JSON.stringify(progress));
    updateProgressBar();
  }

  function updateProgressBar() {
    const pct = totalVideos ? Math.round((doneVideos / totalVideos) * 100) : 0;
    progressEl.innerHTML = `
      <div class="progress-label"><span>Lecture progress</span><span>${doneVideos}/${totalVideos || "?"} watched · ${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(d) {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (isNaN(dt)) return String(d).slice(0, 10);
      return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return String(d).slice(0, 10); }
  }

  function posterUrl(d) {
    const p = d.previewImage;
    if (!p) return "";
    if (typeof p === "string") return p;
    return (p.baseUrl || "") + (p.key || "");
  }

  function cleanDesc(s) {
    if (!s) return "";
    return String(s)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Build the AryaVidya player deep-link (same params as play.php). */
  function watchHref(subject, topic, item) {
    if (item.yt) return `https://www.youtube.com/watch?v=${encodeURIComponent(item.yt)}`;
    if (item.urlType === "youtube" && item.url) return item.url;
    if (item.url && item.urlType && item.urlType !== "penpencilvdo") return item.url;
    const title = item.topic || (item.videoDetails && item.videoDetails.name) || "Lecture";
    const poster = (item.videoDetails && item.videoDetails.image) || "";
    const p = new URLSearchParams({
      video_url: "",
      title: title,
      poster: poster,
      video_id: item._id || "",
      batch_id: batchId,
      subject_id: subject._id || "",
      subject_id_original: subject._id || "",
      topic_id: (topic && topic._id) || "",
      subject_slug: subject.slug || "",
      topic_slug: (topic && topic.slug) || "",
      video_type: "pw",
      urlType: "penpencilvdo"
    });
    return `https://stream.aryavidya.cc/play.php?${p.toString()}`;
  }

  function recalcProgress() {
    // Recompute done/total over every rendered lecture row.
    const rows = subjectsEl.querySelectorAll(".lecture[data-vid]");
    totalVideos = rows.length;
    doneVideos = 0;
    rows.forEach((r) => { if (progress[r.dataset.vid]) doneVideos++; });
    updateProgressBar();
  }

  /* ---------- hero ---------- */
  function renderHero(d) {
    const poster = posterUrl(d);
    const price = d.price != null ? d.price : (d.fee && (d.fee.price ?? d.fee.amount));
    const start = fmtDate(d.startDate);
    const end = fmtDate(d.endDate);
    const desc = cleanDesc(d.description || d.shortDescription);
    if (d.name) document.title = d.name + " — Lecture with Batch";
    heroEl.innerHTML = `
      <div class="batch-hero">
        <div class="poster" ${poster ? `style="background-image:url('${poster.replace(/'/g, "%27")}')"` : ""}>${poster ? "" : "🎓"}</div>
        <div class="info">
          <h1>${esc(d.name)}</h1>
          <div class="by">${esc(d.byName || "")}</div>
          <div class="meta">
            <span class="tag lang">${esc(d.language || "")}</span>
            ${d.class ? `<span class="tag">Class ${esc(d.class)}</span>` : ""}
            ${d.type ? `<span class="tag">${esc(String(d.type).split("/").pop())}</span>` : ""}
            ${start ? `<span class="tag">${start} → ${end}</span>` : ""}
            ${d.source === "seed" ? `<span class="tag">offline data</span>` : `<span class="tag">live</span>`}
          </div>
          ${price != null ? `<div class="price">${price === 0 ? "Free" : "₹" + Number(price).toLocaleString("en-IN")}</div>` : ""}
          ${desc ? `<details><summary>About this batch</summary><p>${esc(desc)}</p></details>` : ""}
        </div>
      </div>`;
  }

  /* ---------- subjects ---------- */
  function subjectHtml(s) {
    const img = s.image || (s.imageId ? (s.imageId.baseUrl || "") + (s.imageId.key || "") : "");
    const teachers = (s.teachers || [])
      .map((t) => (typeof t === "string" ? t : [t.firstName, t.lastName].filter(Boolean).join(" ")))
      .filter(Boolean)
      .join(", ");
    return `<div class="subject" data-slug="${esc(s.slug)}" data-id="${esc(s._id)}">
      <div class="subject-head">
        <div class="sicon" ${img ? `style="background-image:url('${img.replace(/'/g, "%27")}')"` : ""}>${img ? "" : "📖"}</div>
        <div>
          <div class="sname">${esc(s.subject)}</div>
          <div class="scounts">${s.lectureCount || 0} lectures · ${s.tagCount || 0} chapters${teachers ? " · " + esc(teachers) : ""}</div>
        </div>
        <span class="chev">▶</span>
      </div>
      <div class="subject-body"><div class="state"><span class="spin"></span>Loading chapters…</div></div>
    </div>`;
  }

  function renderSubjects(d) {
    const subs = d.subjects || [];
    if (!subs.length) {
      subjectsEl.innerHTML = `<div class="state"><div class="big">🏫</div>
        This is a hybrid/offline batch — no online subjects are published here yet.</div>`;
      return;
    }
    subjectsEl.innerHTML = subs.map(subjectHtml).join("");
    recalcProgress();
  }

  /* ---------- topics ---------- */
  function topicRowHtml(t, idx) {
    const v = t.videos || 0;
    const n = t.notes || 0;
    return `<div class="topic" data-slug="${esc(t.slug)}" data-id="${esc(t._id)}">
      <div class="topic-head">
        <span class="chev">▶</span>
        <span class="tname">${idx}. ${esc(t.name)}</span>
        <span class="tcounts">
          ${v ? `<span class="tag">${v} video${v > 1 ? "s" : ""}</span>` : ""}
          ${n ? `<span class="tag">${n} note${n > 1 ? "s" : ""}</span>` : ""}
          ${!v && !n ? `<span class="tag">empty</span>` : ""}
        </span>
      </div>
      <div class="topic-body"><div class="state"><span class="spin"></span>Loading lectures…</div></div>
    </div>`;
  }

  async function loadTopics(subjectEl) {
    const slug = subjectEl.dataset.slug;
    const body = subjectEl.querySelector(".subject-body");
    body.innerHTML = `<div class="state"><span class="spin"></span>Loading chapters…</div>`;
    try {
      const topics = await API.topics(batchId, slug);
      if (!topics.length) {
        body.innerHTML = `<div class="state">No chapters found in this subject.</div>`;
        return;
      }
      body.innerHTML = topics.map((t, i) => topicRowHtml(t, i + 1)).join("");
    } catch (e) {
      body.innerHTML = `<div class="state error">⚠️ ${esc(e.message)}
        <br><button class="btn ghost" data-retry="topics">Retry</button></div>`;
      body.querySelector("[data-retry]").addEventListener("click", () => loadTopics(subjectEl));
    }
  }

  /* ---------- contents (lectures / notes) ---------- */
  function lectureRowHtml(subject, topic, item, idx) {
    const vid = item._id || "";
    const done = !!progress[vid];
    const title = item.topic || (item.videoDetails && item.videoDetails.name) || "Lecture";
    const dur = (item.videoDetails && item.videoDetails.duration) || "";
    const date = fmtDate(item.date);
    const href = watchHref(subject, topic, item);
    const isYt = !!item.yt;
    const free = item.free || item.isFree;
    return `<div class="lecture${done ? " done" : ""}" data-vid="${esc(vid)}">
      <div class="lnum">${idx}</div>
      <div class="lmain">
        <div class="ltitle">${esc(title)} ${free ? '<span class="badge-free">FREE</span>' : ""}</div>
        <div class="lmeta">
          ${date ? `<span>📅 ${date}</span>` : ""}
          ${dur ? `<span>⏱ ${dur}</span>` : ""}
          ${isYt ? `<span>▶ YouTube</span>` : ""}
        </div>
      </div>
      <div class="lacts">
        <a class="mini" href="${esc(href)}" target="_blank" rel="noopener">Watch</a>
        <span class="tick${done ? " on" : ""}" title="Mark watched">✓</span>
      </div>
    </div>`;
  }

  function noteRowHtml(item, idx) {
    const href = item.url || "#";
    const title = item.topic || item.fileName || "Note";
    const date = fmtDate(item.date);
    return `<div class="lecture">
      <div class="lnum">N${idx}</div>
      <div class="lmain">
        <div class="ltitle">${esc(title)}</div>
        <div class="lmeta">${date ? `<span>📅 ${date}</span>` : ""}${item.fileName ? `<span>📄 ${esc(item.fileName)}</span>` : ""}</div>
      </div>
      <div class="lacts">
        ${href !== "#" ? `<a class="mini alt" href="${esc(href)}" target="_blank" rel="noopener">Open PDF</a>` : `<span class="mini alt" style="opacity:.5">Unavailable</span>`}
      </div>
    </div>`;
  }

  async function loadContents(topicEl, subjectEl) {
    const topicSlug = topicEl.dataset.slug;
    const subjectSlug = subjectEl.dataset.slug;
    const subject = { _id: subjectEl.dataset.id, slug: subjectSlug };
    const topic = { _id: topicEl.dataset.id, slug: topicSlug };
    const body = topicEl.querySelector(".topic-body");
    body.innerHTML = `<div class="state"><span class="spin"></span>Loading lectures…</div>`;
    try {
      const videos = await API.contents(batchId, subjectSlug, topicSlug, "videos", 1);
      let notes = [];
      try { notes = await API.contents(batchId, subjectSlug, topicSlug, "notes", 1); } catch (e) { notes = []; }

      let html = "";
      if (videos.length) {
        html += videos.map((it, i) => lectureRowHtml(subject, topic, it, i + 1)).join("");
      }
      if (notes.length) {
        html += `<div class="section-title" style="font-size:15px;margin:14px 0 8px;">📒 Notes (${notes.length})</div>`;
        html += notes.map((it, i) => noteRowHtml(it, i + 1)).join("");
      }
      if (!html) html = `<div class="state">No lectures or notes found.</div>`;
      body.innerHTML = html;
      recalcProgress();
    } catch (e) {
      body.innerHTML = `<div class="state error">⚠️ ${esc(e.message)}
        <br><button class="btn ghost" data-retry="contents">Retry</button></div>`;
      body.querySelector("[data-retry]").addEventListener("click", () => loadContents(topicEl, subjectEl));
    }
  }

  /* ---------- delegated clicks ---------- */
  subjectsEl.addEventListener("click", (e) => {
    const tick = e.target.closest(".tick");
    if (tick) {
      const row = tick.closest(".lecture");
      const vid = row.dataset.vid;
      if (progress[vid]) delete progress[vid]; else progress[vid] = true;
      row.classList.toggle("done", !!progress[vid]);
      tick.classList.toggle("on", !!progress[vid]);
      saveProgress();
      recalcProgress();
      return;
    }
    const topicHead = e.target.closest(".topic-head");
    if (topicHead) {
      const topicEl = topicHead.parentElement;
      const willOpen = !topicEl.classList.contains("open");
      topicEl.classList.toggle("open", willOpen);
      if (willOpen && !topicEl.dataset.loaded) {
        topicEl.dataset.loaded = "1";
        const subjectEl = topicEl.closest(".subject");
        loadContents(topicEl, subjectEl);
      }
      return;
    }
    const subjectHead = e.target.closest(".subject-head");
    if (subjectHead) {
      const subjectEl = subjectHead.parentElement;
      const willOpen = !subjectEl.classList.contains("open");
      subjectEl.classList.toggle("open", willOpen);
      if (willOpen && !subjectEl.dataset.loaded) {
        subjectEl.dataset.loaded = "1";
        loadTopics(subjectEl);
      }
    }
  });

  /* ---------- init ---------- */
  async function init() {
    if (!batchId) {
      heroEl.innerHTML = `<div class="state error"><div class="big">❓</div>No batch id provided.
        <br><br><a class="btn" href="index.html">← Back to batches</a></div>`;
      subjectsEl.innerHTML = "";
      progressEl.innerHTML = "";
      return;
    }
    heroEl.innerHTML = `<div class="state"><span class="spin"></span>Loading batch…</div>`;
    try {
      details = await API.details(batchId);
      renderHero(details);
      renderSubjects(details);
      updateProgressBar();
    } catch (e) {
      heroEl.innerHTML = `<div class="state error"><div class="big">⚠️</div>${esc(e.message)}
        <br><br><a class="btn ghost" href="index.html">← Back to batches</a></div>`;
      subjectsEl.innerHTML = "";
      progressEl.innerHTML = "";
    }
  }
  init();
})();
