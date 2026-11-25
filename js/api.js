/* Lecture with Batch — data layer.
   Live data comes from open mirrors of the PenPencil API, tried in order:
     1) direct  https://s4-cdn.samfygros.com/radha/<path>
     2) CORS relay  https://api.allorigins.win/raw?url=<encoded>
   If every live attempt fails, the offline seed (data/seed.json + data/course-data.json) is used. */
(function () {
  "use strict";

  const MIRROR = "https://s4-cdn.samfygros.com/radha";
  const RELAY_RAW = "https://api.allorigins.win/raw?url=";
  const RELAY_GET = "https://api.allorigins.win/get?url=";
  const LEARNX = "https://www.learnxpw.site/api";

  function checkJson(j) {
    if (!j || typeof j !== "object") throw new Error("bad response");
    if (j.success === false) throw new Error(j.message || "upstream error");
    return j;
  }

  async function direct(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return checkJson(await r.json());
  }

  async function relay(url) {
    // /get wraps the body in {contents} and is the most reliable; /raw returns it as-is.
    try {
      const r = await fetch(RELAY_GET + encodeURIComponent(url));
      if (r.ok) {
        const j = checkJson(await r.json());
        if (typeof j.contents === "string") return checkJson(JSON.parse(j.contents));
        return j;
      }
    } catch (e) { /* fall through to /raw */ }
    const r2 = await fetch(RELAY_RAW + encodeURIComponent(url));
    if (!r2.ok) throw new Error("relay HTTP " + r2.status);
    return checkJson(JSON.parse(await r2.text()));
  }

  async function live(url) {
    try { return await direct(url); }
    catch (e) { return relay(url); }
  }

  let seedPromise = null;
  function seed() {
    if (!seedPromise) seedPromise = fetch("data/seed.json").then((r) => r.json());
    return seedPromise;
  }

  let coursePromise = null;
  function courseData() {
    if (!coursePromise) coursePromise = fetch("data/course-data.json").then((r) => r.json());
    return coursePromise;
  }

  const API = {
    /* Batch details (v3). Returns the raw `data` object plus `source`. */
    async details(batchId) {
      try {
        const j = await live(`${MIRROR}/v3/batches/${batchId}/details`);
        if (j.data && (j.data.subjects || j.data.name)) {
          j.data.source = "live";
          return j.data;
        }
      } catch (e) { /* fall back to seed */ }
      const s = await seed();
      if (s.deep && s.deep[batchId]) {
        const d = JSON.parse(JSON.stringify(s.deep[batchId]));
        d.source = "seed";
        return d;
      }
      // last resort: catalog entry
      const cat = (s.batches || []).find((b) => b._id === batchId);
      if (cat) {
        return {
          source: "seed", _id: cat._id, name: cat.name, byName: cat.byName,
          language: cat.language, startDate: cat.startDate, endDate: cat.endDate,
          previewImage: cat.previewImage, price: cat.feeTotal, type: cat.type,
          slug: cat.slug, subjects: []
        };
      }
      throw new Error("Batch not found");
    },

    /* Topics (chapters) of one subject. */
    async topics(batchId, subjectSlug) {
      try {
        const j = await live(`${MIRROR}/v2/batches/${batchId}/subject/${subjectSlug}/topics`);
        if (Array.isArray(j.data)) return j.data;
      } catch (e) { /* fall back */ }
      const s = await seed();
      const key = `${batchId}:${subjectSlug}`;
      if (s.topicsFallback && s.topicsFallback[key]) return s.topicsFallback[key];
      throw new Error("Topics unavailable right now");
    },

    /* Lecture / note items of one topic. type = "videos" | "notes". */
    async contents(batchId, subjectSlug, topicSlug, type, page) {
      type = type || "videos";
      page = page || 1;
      try {
        const q = `?tag=${encodeURIComponent(topicSlug)}&contentType=${type}&page=${page}`;
        const j = await live(`${MIRROR}/v2/batches/${batchId}/subject/${subjectSlug}/contents${q}`);
        if (Array.isArray(j.data)) return j.data;
      } catch (e) { /* fall back */ }

      // Offline fallback: the fully-extracted Cyber Security topic.
      if (topicSlug === "cyber-security-with-ai-979004") {
        const cd = await courseData();
        if (type === "videos") {
          return cd.lectures.map((l) => ({
            _id: l.videoId,
            topic: l.title,
            date: l.date,
            isVideoLecture: true,
            yt: l.youtube || null,
            free: !!l.free,
            videoDetails: { duration: l.duration, image: l.poster },
            offlineNote: l.note || null,
            offlineNoteUrl: l.noteUrl || null
          }));
        }
        if (type === "notes") {
          return cd.notes.map((n) => ({
            _id: "note-" + n.lecture,
            topic: n.title,
            date: n.date,
            url: n.url,
            fileName: n.file
          }));
        }
      }
      throw new Error("Content unavailable right now");
    },

    /* Name search across live batch catalog. */
    async search(q) {
      try {
        const j = await live(`${MIRROR}/v3/batches/search?name=${encodeURIComponent(q)}`);
        if (Array.isArray(j.data)) return j.data;
      } catch (e) { /* fall back to seed filter */ }
      const s = await seed();
      const lq = q.toLowerCase();
      return (s.batches || [])
        .filter((b) => (b.name + " " + (b.byName || "")).toLowerCase().includes(lq))
        .map((b) => ({ _id: b._id, name: b.name }));
    },

    /* Browse pages from the LearnX catalog (images + fees), pages start at 1. */
    async catalogPage(page) {
      const url = `${LEARNX}/AllBatches?page=${page}`;
      const j = await live(url);
      return (j && j.batches) || [];
    },

    seed
  };

  window.API = API;
})();
