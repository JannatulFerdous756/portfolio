/* =========================================================
   main.js
   1. Loads the CV from api/profile.php (AJAX with fetch)
   2. Builds the city skyline: one building per paper, project or qualification
   3. Renders every section from the JSON
   4. Research topic filter
   5. Contact form sent with AJAX (XMLHttpRequest) to api/contact.php
   6. Visitor counter (api/visits.php)
   ========================================================= */

(function () {
  "use strict";

  const API = {
    profile: "api/profile.php",
    contact: "api/contact.php",
    visits: "api/visits.php",
  };

  const $ = (sel) => document.querySelector(sel);
  const SVG_NS = "http://www.w3.org/2000/svg";

  /* ---------------------------------------------------------
     Small helper to create elements safely.
     All text goes in through textContent, so data from JSON can
     never inject HTML (no XSS).
     --------------------------------------------------------- */
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    return node;
  }

  /* Seeded random numbers: the city looks the same on every visit. */
  function seededRandom(seedText) {
    let seed = 0;
    for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    return function () {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     1. LOAD THE PROFILE (AJAX)
     ========================================================= */
  // Two ways to get the CV:
  //  1. api/profile.php  (XAMPP or any PHP host: everything works, including the contact form)
  //  2. data/profile.json (GitHub Pages or any static host: no PHP, so the form becomes an email button)
  let staticMode = false;

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(url + " answered " + res.status);
    return res.json();
  }

  async function loadProfile() {
    const status = $("#loadStatus");
    let data = null;
    try {
      const json = await getJSON(API.profile);
      if (!json.ok) throw new Error(json.message || "Bad response");
      data = json.data;
    } catch (phpErr) {
      try {
        data = await getJSON("data/profile.json");
        staticMode = true;
        // Same rule as profile.php: keep referee details private unless public is true
        const refs = data.references || {};
        if (!refs.public) data.references = { public: false, count: (refs.people || []).length };
      } catch (jsonErr) {
        status.classList.add("error");
        status.replaceChildren(
          h("strong", { text: "The CV data could not load. " }),
          "Open this site through a web server, for example ",
          h("code", { text: "http://localhost/portfolio" }),
          " in XAMPP, instead of double-clicking index.html."
        );
        buildSkyline([]); // still draw an empty city
        return;
      }
    }
    status.textContent = "";
    render(data);
  }

  function render(p) {
    renderHero(p.basics);
    buildSkyline(cityItems(p));
    renderAbout(p);
    renderResearch(p.research || []);
    renderProjects(p.projects || []);
    renderEducation(p);
    renderContact(p);
    if (staticMode) useEmailInsteadOfForm(p.basics);
    document.querySelectorAll(".block").forEach((s) => (s.hidden = false));
    watchSections();
  }

  /* =========================================================
     2. HERO + SKYLINE
     ========================================================= */
  function renderHero(b) {
    $("#heroName").textContent = b.name;
    $("#heroRole").textContent = b.role;
    $("#heroSummary").textContent = b.summary;
    document.title = b.name + " | " + b.role;
  }

  // Turn the CV into a list of buildings.
  function cityItems(p) {
    const items = [];
    (p.research || []).forEach((r) =>
      items.push({ kind: "research", id: r.id, href: "#paper-" + r.id, title: r.title, sub: r.venue + ", " + r.date })
    );
    (p.projects || []).forEach((pr) =>
      items.push({ kind: "project", id: pr.id, href: "#project-" + pr.id, title: pr.title, sub: pr.stack.join(", ") })
    );
    (p.education || []).forEach((e, i) =>
      items.push({ kind: "learning", id: "edu" + i, href: "#education", title: e.degree, sub: e.school + ", " + e.result })
    );
    (p.certifications || []).forEach((c) =>
      items.push({ kind: "learning", id: c.id, href: "#cert-" + c.id, title: c.title, sub: c.issuer })
    );

    // Mix the kinds so the city looks natural, but the same every time.
    const rand = seededRandom("jannatul-city");
    return items
      .map((it) => ({ it, key: rand() }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.it);
  }

  const WINDOW_COLORS = { research: "#F5C451", project: "#6FD0B8", learning: "#F2B3C0" };
  const HEIGHTS = { research: [180, 290], project: [130, 200], learning: [100, 170] };

  function buildSkyline(items) {
    const W = 1200;
    const H = 320;
    const host = $("#skyline");
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax meet", "aria-hidden": items.length ? "false" : "true" });

    // Back row: quiet silhouettes for depth (not interactive)
    const back = svg("g", { class: "filler", "aria-hidden": "true" });
    const rb = seededRandom("back-row");
    for (let x = -10; x < W; ) {
      const w = 40 + rb() * 60;
      const bh = 70 + rb() * 150;
      back.append(svg("rect", { x: x, y: H - bh, width: w, height: bh, fill: "#3A4478" }));
      addWindows(back, x, H - bh, w, bh, "#F5C451", rb, 0.12, 0.45, W);
      x += w + 2;
    }
    root.append(back);

    // Front row: one building per item
    const front = svg("g");
    const count = items.length;
    if (count) {
      const gap = 6;
      const r = seededRandom("front-row");
      const widths = items.map(() => 50 + r() * 26);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (count - 1);
      const scale = Math.min(1, (W - 40) / total);
      let x = (W - total * scale) / 2;

      items.forEach((item, i) => {
        const rr = seededRandom(item.id + item.title);
        const w = widths[i] * scale;
        const [minH, maxH] = HEIGHTS[item.kind];
        const bh = minH + rr() * (maxH - minH);
        const top = H - bh;

        const link = svg("a", {
          href: item.href,
          class: "bldg bldg-" + item.kind,
          "aria-label": `${labelFor(item.kind)}: ${item.title}`,
          tabindex: "0",
        });
        link.dataset.title = item.title;
        link.dataset.sub = item.sub;
        link.dataset.kind = item.kind;

        // Roof shape: flat, set-back, or antenna
        const roof = Math.floor(rr() * 3);
        if (roof === 1) {
          link.append(svg("rect", { class: "body", x: x + w * 0.2, y: top - 18, width: w * 0.6, height: 20, fill: "#232E58" }));
        } else if (roof === 2) {
          link.append(svg("line", { x1: x + w / 2, y1: top - 26, x2: x + w / 2, y2: top, stroke: "#232E58", "stroke-width": 3 }));
          link.append(svg("circle", { cx: x + w / 2, cy: top - 27, r: 2.5, fill: "#FF8A7A" }));
        }
        link.append(svg("rect", { class: "body", x: x, y: top, width: w, height: bh, fill: "#232E58" }));
        addWindows(link, x, top, w, bh, WINDOW_COLORS[item.kind], rr, 0.62, 1, W);

        front.append(link);
        x += (widths[i] + gap) * scale;
      });
    }
    root.append(front);
    root.append(svg("rect", { x: 0, y: H - 4, width: W, height: 4, fill: "#1F2A4D" }));
    host.replaceChildren(root);

    wireTooltips(root);
  }

  function addWindows(group, x, top, w, bh, color, rand, chance, opacity, W) {
    const winW = 6, winH = 9, stepX = 12, stepY = 17;
    const cols = Math.max(1, Math.floor((w - 10) / stepX));
    const offset = x + (w - (cols * stepX - (stepX - winW))) / 2;
    for (let y = top + 12; y < top + bh - 14; y += stepY) {
      for (let c = 0; c < cols; c++) {
        const lit = rand() < chance;
        const rect = svg("rect", {
          x: offset + c * stepX, y: y, width: winW, height: winH,
          fill: lit ? color : "#2D3968",
          class: "win" + (lit ? " on" : ""),
          "fill-opacity": lit ? opacity : 1,
        });
        // The whole city lights up from left to right, once, on page load.
        if (lit && !reduceMotion) rect.style.setProperty("--d", ((x / W) * 1.4 + rand() * 0.7).toFixed(2) + "s");
        if (!lit) rect.style.opacity = "1";
        group.append(rect);
      }
    }
  }

  function labelFor(kind) {
    return { research: "Research", project: "Project", learning: "Education" }[kind];
  }

  function wireTooltips(root) {
    const tip = $("#cityTip");
    const city = $(".city");
    let armed = null; // for touch: first tap shows the label, second tap opens it

    function show(b) {
      tip.replaceChildren(h("strong", { text: b.dataset.title }), h("span", { text: b.dataset.sub }));
      tip.hidden = false;
      const box = b.getBoundingClientRect();
      const host = city.getBoundingClientRect();
      const half = Math.min(160, host.width / 2 - 10);
      const left = Math.min(Math.max(box.left - host.left + box.width / 2, half), host.width - half);
      tip.style.left = left + "px";
      tip.style.top = box.top - host.top + "px";
    }
    function hide() { tip.hidden = true; }

    root.querySelectorAll(".bldg").forEach((b) => {
      b.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") show(b); });
      b.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hide(); });
      b.addEventListener("focus", () => show(b));
      b.addEventListener("blur", hide);
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(b.getAttribute("href")); } });
      b.addEventListener("click", (e) => {
        e.preventDefault();
        if (e.pointerType === "touch" || (window.matchMedia("(hover: none)").matches)) {
          if (armed !== b) { armed = b; show(b); return; }
        }
        armed = null;
        hide();
        goTo(b.getAttribute("href"));
      });
    });
  }

  // Scroll to a paper/project and highlight it briefly.
  function goTo(hash) {
    const target = document.querySelector(hash);
    if (!target) return;
    if (target.classList.contains("paper") && target.hidden) setFilter("All");
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    target.classList.remove("flash");
    void target.offsetWidth; // restart the animation
    target.classList.add("flash");
    history.replaceState(null, "", hash);
  }

  /* =========================================================
     3. ABOUT
     ========================================================= */
  function renderAbout(p) {
    const portrait = $("#portrait");
    portrait.src = p.basics.photo;
    portrait.alt = "Portrait of " + p.basics.name;
    $("#objective").textContent = p.basics.objective;

    $("#stats").replaceChildren(
      ...(p.stats || []).map((s) => h("div", null, h("dt", { text: s.label }), h("dd", { text: s.value })))
    );

    $("#skills").replaceChildren(
      ...(p.skills || []).map((g) =>
        h("div", { class: "skill-group" },
          h("h4", { text: g.group }),
          h("ul", { class: "tags" }, g.items.map((it) => h("li", { text: it })))
        )
      )
    );
  }

  /* =========================================================
     4. RESEARCH + FILTER
     ========================================================= */
  let currentFilter = "All";

  function renderResearch(list) {
    $("#researchCount").textContent = list.length + " papers and presentations, 2025–2026";

    // Filter buttons: "All" plus one per topic, with counts
    const topics = {};
    list.forEach((r) => (topics[r.topic] = (topics[r.topic] || 0) + 1));
    const names = ["All", ...Object.keys(topics).sort()];
    $("#filters").replaceChildren(
      ...names.map((t) =>
        h("button", { type: "button", "data-topic": t, "aria-pressed": t === "All" ? "true" : "false", onclick: () => setFilter(t) },
          t, h("span", { text: t === "All" ? list.length : topics[t] }))
      )
    );

    // Group by year, newest first
    const years = [...new Set(list.map((r) => r.year))].sort((a, b) => b - a);
    $("#researchList").replaceChildren(
      ...years.map((y) =>
        h("div", { class: "year-group", "data-year": y },
          h("div", { class: "year-label", text: y }),
          h("ul", { class: "papers" }, list.filter((r) => r.year === y).map(paperItem))
        )
      )
    );
  }

  function paperItem(r) {
    return h("li", { class: "paper", id: "paper-" + r.id, "data-topic": r.topic },
      h("h3", { text: r.title }),
      h("p", { text: [r.venue, r.date, r.note].filter(Boolean).join(", ") }),
      h("div", { class: "paper-meta" },
        h("span", { class: "pill pill-topic", text: r.topic }),
        h("span", { class: "pill pill-status", text: r.status }),
        r.doi ? h("a", { class: "doi", href: "https://doi.org/" + r.doi, target: "_blank", rel: "noopener", text: "DOI " + r.doi }) : null
      )
    );
  }

  function setFilter(topic) {
    currentFilter = topic;
    document.querySelectorAll("#filters button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.topic === topic))
    );
    document.querySelectorAll(".paper").forEach((p) => (p.hidden = topic !== "All" && p.dataset.topic !== topic));
    // Hide a year if none of its papers are visible
    document.querySelectorAll(".year-group").forEach((g) => (g.hidden = !g.querySelector(".paper:not([hidden])")));
  }

  /* =========================================================
     5. PROJECTS, EDUCATION, CERTIFICATES, LEADERSHIP
     ========================================================= */
  function renderProjects(list) {
    $("#projectList").replaceChildren(
      ...list.map((p) =>
        h("article", { class: "project", id: "project-" + p.id },
          h("p", { class: "when", text: p.when }),
          h("h3", { text: p.title }),
          h("p", { class: "role", text: p.role }),
          h("p", { class: "goal", text: p.goal }),
          h("ul", { class: "points" }, p.points.map((pt) => h("li", { text: pt }))),
          h("ul", { class: "tags" }, p.stack.map((s) => h("li", { text: s })))
        )
      )
    );
  }

  function renderEducation(p) {
    $("#eduList").replaceChildren(
      ...(p.education || []).map((e) =>
        h("li", null,
          h("h3", { text: e.degree }),
          h("p", { text: e.school + ", " + e.place }),
          h("p", null, h("span", { class: "result", text: e.result }), ", " + e.when)
        )
      )
    );
    $("#certList").replaceChildren(
      ...(p.certifications || []).map((c) =>
        h("li", { id: "cert-" + c.id },
          h("strong", { text: c.title }),
          h("p", { text: c.issuer + ", " + c.when }),
          c.note ? h("p", { text: c.note }) : null
        )
      )
    );
    $("#leadList").replaceChildren(
      ...(p.leadership || []).map((l) => h("li", null, h("strong", { text: l.title }), h("p", { text: l.text })))
    );
  }

  /* =========================================================
     6. CONTACT (AJAX with XMLHttpRequest)
     ========================================================= */
  function renderContact(p) {
    const b = p.basics;
    const lines = [
      h("li", null, h("span", { class: "label", text: "Email" }),
        h("a", { href: "mailto:" + b.email, text: b.email }),
        h("button", { type: "button", class: "copy-btn", onclick: (e) => copyText(b.email, e.currentTarget) }, "Copy")),
      h("li", null, h("span", { class: "label", text: "Phone" }),
        h("span", null, b.phones.map((ph, i) => [i ? ", " : "", h("a", { href: "tel:+88" + ph, text: ph })]))),
      h("li", null, h("span", { class: "label", text: "Based in" }), b.location),
    ];
    const links = (b.links || []).filter((l) => l.url);
    if (links.length) {
      lines.push(h("li", null, h("span", { class: "label", text: "Online" }),
        h("span", null, links.map((l, i) => [i ? ", " : "", h("a", { href: l.url, target: "_blank", rel: "noopener", text: l.label })]))));
    }
    lines.push(h("li", null, h("span", { class: "label", text: "CV" }),
      h("a", { href: b.cv, download: true, text: "Download the PDF" })));
    $("#contactLines").replaceChildren(...lines);

    const refs = p.references || {};
    $("#refsNote").textContent = refs.public
      ? "References: " + refs.people.map((r) => r.name + " (" + r.title + (r.email ? ", " + r.email : "") + ")").join("; ")
      : (refs.count ? refs.count + " academic references from AIUB faculty are available on request." : "");
  }

  // On a host without PHP (GitHub Pages) the form cannot send, so offer email instead.
  function useEmailInsteadOfForm(b) {
    const subject = encodeURIComponent("Hello from your portfolio");
    $("#contactForm").replaceWith(
      h("div", { class: "email-card" },
        h("h3", { text: "Write to Jannatul" }),
        h("p", { text: "Your email app will open with her address already filled in." }),
        h("a", { class: "btn btn-lamp", href: "mailto:" + b.email + "?subject=" + subject, text: "Email Jannatul" })
      )
    );
  }

  function copyText(text, btn) {
    const done = () => { btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy"), 1600); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      const t = h("textarea", { style: "position:fixed;opacity:0" }); t.value = text;
      document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); done();
    }
  }

  function setupContactForm() {
    const form = $("#contactForm");
    const statusEl = $("#formStatus");
    const sendBtn = $("#sendBtn");
    const msg = $("#cMessage");

    // Ask the server for a CSRF token
    fetch(API.contact, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => { if (j.ok) $("#csrfToken").value = j.token; })
      .catch(() => {});

    msg.addEventListener("input", () => ($("#msgCounter").textContent = msg.value.length + " / 2000"));

    // Browser-side checks (the PHP file checks everything again)
    function validate(data) {
      const errors = {};
      const name = data.get("name").trim();
      const email = data.get("email").trim();
      const message = data.get("message").trim();
      if (!name) errors.name = "Enter your name.";
      else if (name.length < 2) errors.name = "Name must be 2 to 60 characters.";
      if (!email) errors.email = "Enter your email.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email, like name@example.com.";
      if (!data.get("subject")) errors.subject = "Choose a subject.";
      if (message.length < 10) errors.message = "Write at least 10 characters.";
      return errors;
    }

    function showErrors(errors) {
      ["name", "email", "subject", "message"].forEach((f) => {
        const text = errors[f] || "";
        $("#err-" + f).textContent = text;
        $("#err-" + f).closest(".field").classList.toggle("invalid", !!text);
      });
      const first = Object.keys(errors)[0];
      if (first) form.elements[first].focus();
    }

    function setStatus(text, ok) {
      statusEl.textContent = text;
      statusEl.className = "form-status " + (ok ? "ok" : "bad");
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const errors = validate(data);
      showErrors(errors);
      if (Object.keys(errors).length) { setStatus("Check the highlighted fields.", false); return; }

      sendBtn.disabled = true;
      sendBtn.textContent = "Sending…";
      setStatus("", true);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", API.contact, true);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.onload = function () {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch (_) { res = { ok: false, message: "The server sent an unexpected answer." }; }
        if (xhr.status === 200 && res.ok) {
          form.reset();
          $("#msgCounter").textContent = "0 / 2000";
          showErrors({});
          setStatus(res.message, true);
        } else {
          if (res.errors) showErrors(res.errors);
          setStatus(res.message || "The message was not sent. Try again.", false);
        }
      };
      xhr.onerror = function () { setStatus("No connection to the server. Check that PHP is running and try again.", false); };
      xhr.onloadend = function () { sendBtn.disabled = false; sendBtn.textContent = "Send message"; };
      xhr.send(data);
    });
  }

  /* =========================================================
     7. VISITORS, NAV, SMALL THINGS
     ========================================================= */
  function countVisit() {
    fetch(API.visits, { method: "POST", credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) $("#visits").textContent = j.count.toLocaleString() + (j.count === 1 ? " person has" : " people have") + " visited this city.";
      })
      .catch(() => {});
  }

  function setupNav() {
    const btn = $("#menuBtn");
    const nav = $("#nav");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); btn.textContent = "Menu"; }
    });
    const bar = $("#topbar");
    const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Highlight the menu link of the section on screen
  function watchSections() {
    if (!("IntersectionObserver" in window)) return;
    const links = document.querySelectorAll("#nav a[href^='#']");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach((s) => io.observe(s));
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#year").textContent = new Date().getFullYear();
    setupNav();
    setupContactForm();
    loadProfile();
    countVisit();
  });
})();
