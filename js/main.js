/* Swami Samarth Tourism — behaviour.
   Language switching, destinations, enquiry form, call/WhatsApp CTAs, proof, reveal.
   Settings live in js/config.js; text lives in js/i18n.js. */
(function () {
  "use strict";

  var D = window.SS_I18N || {};
  var C = window.SS_SITE || {};
  var doc = document, html = doc.documentElement;
  var LANGS = ["en", "mr", "hi"];
  var STORE_KEY = "ss-lang";

  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var reduceMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ── config, normalised (anything invalid is treated as "not set") ───────── */
  var phones = (C.phones || []).map(function (p) { return String(p).replace(/\D/g, ""); })
    .filter(function (p) { return /^[6-9]\d{9}$/.test(p); });
  var waNumber = String(C.whatsappNumber || "").replace(/\D/g, "");
  if (waNumber.length < 11) waNumber = "";
  var endpoint = String(C.enquiryEndpoint || "").trim();
  var mapsUrl = /^https:\/\//i.test(String(C.mapsUrl || "").trim()) ? String(C.mapsUrl).trim() : "";
  var proofCfg = C.proof || {};

  function isReviewMode() {
    var m = C.reviewMode || "auto";
    if (m === "on") return true;
    if (m === "off") return false;
    var h = location.hostname;
    return location.protocol === "file:" || h === "localhost" || /^127\./.test(h) || h === "[::1]" || /\.local$/.test(h);
  }
  var review = isReviewMode();
  var showPlaceholders = proofCfg.showPlaceholders === "on" ? true :
    proofCfg.showPlaceholders === "off" ? false : review;

  /* ── i18n ────────────────────────────────────────────────────────────────── */
  var lang = "en";
  function t(key) {
    var d = D[lang] || {};
    if (key in d) return d[key];
    return (D.en && D.en[key]) || "";
  }

  function readInitialLang() {
    var fallback = LANGS.indexOf(C.defaultLanguage) > -1 ? C.defaultLanguage : "en";
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q && LANGS.indexOf(q) > -1) return q;
    } catch (e) {}
    if (C.persistLanguage !== false) {
      try {
        var s = localStorage.getItem(STORE_KEY);
        if (s && LANGS.indexOf(s) > -1) return s;
      } catch (e) {}
    }
    return fallback;
  }

  function applyText() {
    $$("[data-i18n]").forEach(function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
    $$("[data-i18n-attr]").forEach(function (n) {
      n.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":");
        n.setAttribute(p[0], t(p[1]));
      });
    });
  }

  function setLang(l, user) {
    if (LANGS.indexOf(l) < 0) l = "en";
    lang = l;
    html.lang = l;
    html.setAttribute("data-lang", l);
    applyText();
    $$(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === l ? "true" : "false");
    });
    renderMonths();
    renderDestinations();
    renderProof();
    refreshMessages();
    if (user) {
      if (C.persistLanguage !== false) { try { localStorage.setItem(STORE_KEY, l); } catch (e) {} }
      try {
        var u = new URL(location.href);
        u.searchParams.set("lang", l);
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) {}
    }
  }

  /* ── phones, WhatsApp, map ───────────────────────────────────────────────── */
  function fmt(d) { return d.slice(0, 5) + " " + d.slice(5); }

  function renderPhones() {
    $$("[data-phones]").forEach(function (box) {
      box.innerHTML = "";
      phones.forEach(function (d) {
        var a = el("a", "phone");
        a.href = "tel:+91" + d;
        a.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg>';
        a.appendChild(el("span", "", fmt(d)));
        box.appendChild(a);
      });
    });
    $$("[data-primary-call]").forEach(function (a) {
      if (phones[0]) a.href = "tel:+91" + phones[0]; else a.hidden = true;
    });
  }

  function waMessage(v) {
    v = v || {};
    return "Hello Swami Samarth Tourism,\nमला Tour Details जाणून घ्यायच्या आहेत.\n\n" +
      "Name: " + (v.name || "") + "\n" +
      "Destination: " + (v.destination || "") + "\n" +
      "Travellers: " + (v.travellers || "") + "\n" +
      "Preferred Month: " + (v.month || "");
  }
  function waUrl(v) { return "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(waMessage(v)); }

  function renderWhatsApp() {
    $$("[data-wa]").forEach(function (a) {
      if (waNumber) { a.href = waUrl(); a.hidden = false; } else { a.hidden = true; }
    });
    var f = $("#enqWa");
    if (f) f.hidden = !waNumber;
    if (!waNumber) { var fl = $(".float-wa"); if (fl) fl.hidden = true; }
    $("#stickyBar").classList.toggle("bar--2", !waNumber);
    var m = $("#mapLink");
    if (m && mapsUrl) m.href = mapsUrl;
  }

  /* ── months / destinations ───────────────────────────────────────────────── */
  function renderMonths() {
    var sel = $("#f-month");
    var keep = sel.selectedIndex;
    sel.innerHTML = "";
    var first = el("option", "", t("enq.pMonth")); first.value = ""; sel.appendChild(first);
    t("enq.months").split("|").forEach(function (m) { var o = el("option", "", m); o.value = m; sel.appendChild(o); });
    sel.selectedIndex = keep > 0 ? keep : 0;
  }

  var activeTab = 0;
  function renderDestinations() {
    var wrap = $("#destWrap");
    wrap.innerHTML = "";
    var tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", t("dest.tabs"));
    var panels = el("div", "panels");
    var all = [];
    var btns = [];

    for (var g = 1; g <= 6; g++) (function (g) {
      var i = g - 1;
      var b = el("button", "tab", t("dest.g" + g + ".n"));
      b.type = "button"; b.id = "dtab-" + i;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "dpanel-" + i);
      b.setAttribute("aria-selected", i === activeTab ? "true" : "false");
      b.tabIndex = i === activeTab ? 0 : -1;
      b.addEventListener("click", function () { select(i, false); });
      b.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = (i + 1) % 6;
        else if (e.key === "ArrowLeft") n = (i + 5) % 6;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = 5;
        if (n !== null) { e.preventDefault(); select(n, true); }
      });
      tabs.appendChild(b); btns.push(b);

      var p = el("div", "panel");
      p.id = "dpanel-" + i;
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", "dtab-" + i);
      p.hidden = i !== activeTab;
      var ul = el("ul", "pills");
      t("dest.g" + g + ".l").split("|").forEach(function (name) {
        all.push(name);
        var li = el("li");
        var pb = el("button", "pill", name);
        pb.type = "button";
        pb.addEventListener("click", function () { chooseDestination(name); });
        li.appendChild(pb); ul.appendChild(li);
      });
      p.appendChild(ul);
      panels.appendChild(p);
    })(g);

    function select(i, focus) {
      activeTab = i;
      btns.forEach(function (b, j) {
        b.setAttribute("aria-selected", j === i ? "true" : "false");
        b.tabIndex = j === i ? 0 : -1;
      });
      $$(".panel", wrap).forEach(function (p, j) { p.hidden = j !== i; });
      if (focus) btns[i].focus();
    }

    wrap.appendChild(tabs); wrap.appendChild(panels);

    var dl = $("#destList");
    dl.innerHTML = "";
    var seen = {};
    all.forEach(function (n) { if (!seen[n]) { seen[n] = 1; var o = doc.createElement("option"); o.value = n; dl.appendChild(o); } });
  }

  function scrollToForm() {
    var f = $("#enquiry");
    f.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  function focusFirstEmpty() {
    var order = ["#f-name", "#f-mobile", "#f-dest", "#f-trav", "#f-month"];
    for (var i = 0; i < order.length; i++) {
      var n = $(order[i]);
      if (n && !n.value) { setTimeout(function (x) { return function () { x.focus({ preventScroll: true }); }; }(n), reduceMotion ? 0 : 450); return; }
    }
  }
  function chooseDestination(name) {
    $("#f-dest").value = name;
    clearErr("dest");
    scrollToForm(); focusFirstEmpty();
  }
  function chooseType(type) {
    var r = $('input[name="tourType"][value="' + type + '"]');
    if (r) r.checked = true;
    scrollToForm(); focusFirstEmpty();
  }

  /* ── form ────────────────────────────────────────────────────────────────── */
  var form = $("#enqForm");
  var errKeys = {};      // field -> i18n key currently shown
  var statusState = null; // { kind, key }
  var busy = false;

  function normPhone(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    return d;
  }
  function showErr(field, key) {
    errKeys[field] = key;
    var p = $("#e-" + field), input = $("#f-" + (field === "wa" ? "wa" : field));
    p.textContent = t(key); p.hidden = false;
    if (input) input.setAttribute("aria-invalid", "true");
  }
  function clearErr(field) {
    delete errKeys[field];
    var p = $("#e-" + field), input = $("#f-" + field);
    if (p) { p.hidden = true; p.textContent = ""; }
    if (input) input.removeAttribute("aria-invalid");
  }
  function setStatus(kind, key) {
    var s = $("#enqStatus");
    if (!kind) { statusState = null; s.hidden = true; s.textContent = ""; s.className = "status ml"; return; }
    statusState = { kind: kind, key: key };
    s.className = "status ml status--" + kind;
    s.textContent = t(key);
    s.hidden = false;
  }
  function refreshMessages() {
    Object.keys(errKeys).forEach(function (f) { $("#e-" + f).textContent = t(errKeys[f]); });
    if (statusState) $("#enqStatus").textContent = t(statusState.key);
    updateWaLink();
  }

  function values() {
    var mSel = $("#f-month");
    var type = $('input[name="tourType"]:checked');
    var wa = normPhone($("#f-wa").value);
    return {
      name: $("#f-name").value.trim(),
      mobile: normPhone($("#f-mobile").value),
      whatsapp: wa,
      destination: $("#f-dest").value.trim(),
      travellers: $("#f-trav").value.trim(),
      month: mSel.value,
      monthIndex: mSel.selectedIndex,
      tourType: type ? type.value : "",
      message: $("#f-msg").value.trim()
    };
  }

  function validate(v) {
    var bad = [];
    function chk(field, ok, key) { if (ok) clearErr(field); else { showErr(field, key); bad.push(field); } }
    chk("name", v.name.length >= 2, "enq.err.name");
    chk("mobile", /^[6-9]\d{9}$/.test(v.mobile), "enq.err.mobile");
    chk("wa", !$("#f-wa").value.trim() || /^[6-9]\d{9}$/.test(v.whatsapp), "enq.err.wa");
    chk("dest", v.destination.length >= 2, "enq.err.dest");
    var n = Number(v.travellers);
    chk("trav", v.travellers !== "" && /^\d+$/.test(v.travellers) && n >= 1 && n <= 500, "enq.err.trav");
    chk("month", v.monthIndex > 0, "enq.err.month");
    return bad;
  }

  function setBusy(b) {
    busy = b;
    var btn = $("#enqSubmit");
    btn.disabled = b;
    btn.setAttribute("aria-busy", b ? "true" : "false");
  }

  function payload(v) {
    var idx = v.monthIndex >= 1 && v.monthIndex <= 12 ? v.monthIndex : null;
    return {
      name: v.name,
      mobile: "+91" + v.mobile,
      whatsapp: v.whatsapp ? "+91" + v.whatsapp : "",
      destination: v.destination,
      travellers: Number(v.travellers),
      preferredMonth: v.month,
      preferredMonthIndex: idx,
      tourType: v.tourType,
      message: v.message,
      language: lang,
      pageUrl: location.href,
      submittedAt: new Date().toISOString()
    };
  }

  function post(v) {
    var headers = { "Content-Type": "application/json" };
    var extra = C.enquiryHeaders || {};
    Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    var opts = { method: "POST", headers: headers, body: JSON.stringify(payload(v)) };
    var timer;
    if (window.AbortController) {
      var ac = new AbortController();
      opts.signal = ac.signal;
      timer = setTimeout(function () { ac.abort(); }, 20000);
    }
    return fetch(endpoint, opts).then(function (r) { clearTimeout(timer); return r; },
      function (e) { clearTimeout(timer); throw e; });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    if ($('input[name="website"]', form).value) return; // honeypot: bots only
    var v = values();
    var bad = validate(v);
    if (bad.length) {
      setStatus("error", "enq.fix");
      var first = $("#f-" + bad[0]);
      if (first) first.focus();
      return;
    }
    setStatus(null);

    if (endpoint) {
      setBusy(true); setStatus("pending", "enq.sending");
      post(v).then(function (r) {
        if (r.status >= 200 && r.status < 300) {
          form.reset(); renderMonths();
          setStatus("ok", "enq.ok");
          $("#enqStatus").focus();
        } else {
          setStatus("error", "enq.fail");
        }
      }, function () {
        setStatus("error", "enq.fail");
      }).then(function () { setBusy(false); });
      return;
    }

    if (waNumber) {
      var url = waUrl({ name: v.name, destination: v.destination, travellers: v.travellers, month: v.month });
      var w = window.open(url, "_blank", "noopener");
      if (!w) location.href = url;
      setStatus("info", "enq.waOpened");
      return;
    }

    setStatus("error", "enq.none"); // nothing configured: say so, keep their details
  });

  ["name", "mobile", "wa", "dest", "trav", "month"].forEach(function (f) {
    var n = $("#f-" + f);
    n.addEventListener("input", function () { if (errKeys[f]) clearErr(f); });
    n.addEventListener("change", function () { if (errKeys[f]) clearErr(f); });
  });

  function updateWaLink() {
    var a = $("#enqWa");
    if (!a || !waNumber) return;
    var v = values();
    a.href = waUrl({ name: v.name, destination: v.destination, travellers: v.travellers, month: v.month });
  }
  form.addEventListener("input", updateWaLink);
  form.addEventListener("change", updateWaLink);

  /* ── proof (real items only; placeholders in owner view) ─────────────────── */
  var PH = {
    reviews: "[GOOGLE REVIEWS LINK WILL BE ADDED HERE]",
    testimonials: "[REAL CUSTOMER TESTIMONIAL WILL BE ADDED HERE]",
    tour: "[REAL TOUR PHOTOS WILL BE ADDED HERE]",
    group: "[REAL GROUP PHOTOS WILL BE ADDED HERE]",
    hotel: "[REAL HOTEL PHOTOS WILL BE ADDED HERE]",
    vehicle: "[REAL BUS / TRAIN PHOTOS WILL BE ADDED HERE]",
    completion: "[TOUR COMPLETION PHOTOS WILL BE ADDED HERE]",
    video: "[CUSTOMER VIDEO TESTIMONIAL WILL BE ADDED HERE]"
  };
  var PH_ICON = { reviews: "star", testimonials: "quote", tour: "camera", group: "group", hotel: "hotel", vehicle: "bus", completion: "camera", video: "video" };

  function safeSrc(s) { s = String(s || "").trim(); return s && !/^\s*(javascript|data|vbscript):/i.test(s) ? s : ""; }
  function youTubeId(u) {
    var m = String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : "";
  }
  function proofBlock(type, hasReal) {
    var b = el("section", "proof-block" + (hasReal ? "" : " proof-ph"));
    var h = el("h3");
    h.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-' + PH_ICON[type] + '"/></svg>';
    h.appendChild(el("span", "", t("proof.t." + type)));
    b.appendChild(h);
    return b;
  }
  function renderProof() {
    var grid = $("#proofGrid");
    grid.innerHTML = "";
    var urlOk = /^https:\/\//i.test(String(proofCfg.googleReviewsUrl || ""));
    var tests = (proofCfg.testimonials || []).filter(function (x) { return x && x.quote; });
    var photos = (proofCfg.photos || []).filter(function (x) { return x && safeSrc(x.src); });
    var videos = (proofCfg.videos || []).filter(function (x) { return x && safeSrc(x.src); });
    var count = 0;

    function placeholder(type) {
      if (!showPlaceholders) return;
      var b = proofBlock(type, false);
      b.appendChild(el("p", "ph-text", PH[type]));
      b.appendChild(el("p", "ph-note", "Owner view only — visitors never see this box."));
      grid.appendChild(b); count++;
    }

    if (urlOk) {
      var b = proofBlock("reviews", true);
      var a = el("a", "btn btn-line", t("proof.readReviews"));
      a.href = proofCfg.googleReviewsUrl; a.target = "_blank"; a.rel = "noopener";
      b.appendChild(a); grid.appendChild(b); count++;
    } else placeholder("reviews");

    if (tests.length) {
      var tb = proofBlock("testimonials", true);
      tests.forEach(function (x) {
        var q = el("blockquote"); q.appendChild(el("p", "", x.quote));
        var who = [x.name, x.place].filter(Boolean).join(", ");
        if (who) q.appendChild(el("footer", "", who));
        tb.appendChild(q);
      });
      grid.appendChild(tb); count++;
    } else placeholder("testimonials");

    ["tour", "group", "hotel", "vehicle", "completion"].forEach(function (cat) {
      var items = photos.filter(function (p) { return p.category === cat; });
      if (!items.length) { placeholder(cat); return; }
      var pb = proofBlock(cat, true);
      var row = el("div", "shots");
      items.forEach(function (p) {
        var fig = el("figure"), img = doc.createElement("img");
        img.src = safeSrc(p.src); img.alt = p.alt || ""; img.loading = "lazy"; img.decoding = "async";
        fig.appendChild(img);
        if (p.caption) fig.appendChild(el("figcaption", "", p.caption));
        row.appendChild(fig);
      });
      pb.appendChild(row); grid.appendChild(pb); count++;
    });

    if (videos.length) {
      var vb = proofBlock("video", true);
      var vrow = el("div", "clips");
      videos.forEach(function (x) {
        var yt = youTubeId(x.src), node;
        if (yt) {
          node = doc.createElement("iframe");
          node.src = "https://www.youtube-nocookie.com/embed/" + yt;
          node.loading = "lazy"; node.allowFullscreen = true;
          node.title = x.title || t("proof.t.video");
        } else {
          node = doc.createElement("video");
          node.controls = true; node.preload = "none"; node.src = safeSrc(x.src);
          node.setAttribute("aria-label", x.title || t("proof.t.video"));
        }
        vrow.appendChild(node);
      });
      vb.appendChild(vrow); grid.appendChild(vb); count++;
    } else placeholder("video");

    grid.hidden = count === 0;
  }

  /* ── sticky / floating CTAs, reveal ──────────────────────────────────────── */
  function initCtas() {
    var bar = $("#stickyBar"), fl = $("#floatCta"), flWa = $(".float-wa");
    var heroSeen = true, formSeen = false;
    function paint() {
      bar.hidden = formSeen;
      fl.hidden = formSeen || heroSeen;
      if (flWa) flWa.hidden = !waNumber;
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { heroSeen = es[0].isIntersecting; paint(); }, { threshold: 0.05 }).observe($(".hero"));
      new IntersectionObserver(function (es) { formSeen = es[0].isIntersecting; paint(); }, { threshold: 0.15 }).observe($("#enquiry"));
    } else { heroSeen = false; }
    paint();
  }

  function initReveal() {
    if (!html.classList.contains("anim")) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(".rv").forEach(function (n) { io.observe(n); });
    clearTimeout(window.__ssGuard);
  }

  /* ── wire up ─────────────────────────────────────────────────────────────── */
  $$(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang"), true); });
  });
  $$(".tours button").forEach(function (b) {
    b.addEventListener("click", function () { chooseType(b.getAttribute("data-type")); });
  });

  renderPhones();
  renderWhatsApp();
  setLang(readInitialLang(), false);
  initCtas();
  initReveal();
})();
