/* Integration tests. Run:  npm install jsdom   &&   node tests/integration.test.js */
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.join(__dirname, "..");
const I18N = require(path.join(root, "js/i18n.js"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; console.log("  FAIL  " + name + (extra !== undefined ? "  → " + extra : "")); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── boot the real page in jsdom, optionally patching js/config.js ── */
async function boot(patch, opts) {
  opts = opts || {};
  const calls = { fetch: [], open: [] };
  const store = {};
  const dom = await JSDOM.fromFile(path.join(root, opts.file || "index.html"), {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      let cfg;
      Object.defineProperty(w, "SS_SITE", {
        configurable: true,
        get() { return cfg; },
        set(v) { cfg = Object.assign({}, v, patch || {}); if (patch && patch.proof) cfg.proof = Object.assign({}, v.proof, patch.proof); }
      });
      w.Element.prototype.scrollIntoView = function () {};
      w.HTMLElement.prototype.focus = function () { this.__focused = true; w.document.__active = this; };
      Object.defineProperty(w, "localStorage", { value: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } });
      if (opts.search) Object.defineProperty(w.document, "__q", { value: opts.search });
      w.fetch = opts.fetch ? (u, o) => { calls.fetch.push({ u, o }); return opts.fetch(u, o); } : undefined;
      w.open = (u, t, f) => { calls.open.push(u); return {}; };
    }
  });
  const w = dom.window;
  await new Promise(res => { if (w.document.readyState === "complete") res(); else w.addEventListener("load", res); });
  await sleep(50);
  return { w, d: w.document, calls, store };
}
const $ = (d, s) => d.querySelector(s);
const $$ = (d, s) => Array.from(d.querySelectorAll(s));
function fill(d, w, v) {
  const set = (id, val) => { const n = $(d, id); n.value = val; n.dispatchEvent(new w.Event("input", { bubbles: true })); };
  if ("name" in v) set("#f-name", v.name);
  if ("mobile" in v) set("#f-mobile", v.mobile);
  if ("wa" in v) set("#f-wa", v.wa);
  if ("dest" in v) set("#f-dest", v.dest);
  if ("trav" in v) set("#f-trav", v.trav);
  if ("month" in v) { $(d, "#f-month").selectedIndex = v.month; $(d, "#f-month").dispatchEvent(new w.Event("change", { bubbles: true })); }
}
const GOOD = { name: "Asha Patil", mobile: "98765 43210", dest: "Kashmir", trav: "4", month: 3 };
const submit = (d, w) => $(d, "#enqForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

(async () => {
  /* ═══ 1. Static page + dictionary ═══ */
  console.log("static checks");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const tpl = fs.readFileSync(path.join(root, "index.template.html"), "utf8");
  const sdom = new JSDOM(html); const sd = sdom.window.document;

  check("html lang is en (default language)", sd.documentElement.lang === "en");
  check("English title baked in", /Swami Samarth Tourism \| Complete Tour Planning/.test(sd.title));
  check("English H1 baked in (works without JS)", /Decided on a tour\?/.test($(sd, "h1").textContent));
  check("no data-i18n element left empty", $$(sd, "[data-i18n]").every(n => n.textContent.trim().length > 0), $$(sd, "[data-i18n]").filter(n => !n.textContent.trim()).map(n => n.dataset.i18n).join(","));
  check("no template placeholders", !/\{\{|\}\}|undefined/.test(html));
  const ids = $$(sd, "[id]").map(n => n.id);
  check("ids unique", new Set(ids).size === ids.length);
  check("every #anchor has a target", $$(sd, 'a[href^="#"]').every(a => a.getAttribute("href") === "#" || sd.getElementById(a.getAttribute("href").slice(1))));
  const refs = $$(sd, "[src],link[href]").map(n => n.getAttribute("src") || n.getAttribute("href")).filter(u => u && !/^(https?:|#|data:)/.test(u));
  check("all local assets exist (" + refs.length + ")", refs.every(u => fs.existsSync(path.join(root, u.split("?")[0]))), refs.filter(u => !fs.existsSync(path.join(root, u))).join(","));
  const order = ["prob-h", "lose-h", "next-h", "sol-h", "ben-h", "tt-h", "dest-h", "proof-h", "why-h", "fin-h", "enq-h", "con-h"];
  const pos = order.map(i => html.indexOf('id="' + i + '"'));
  check("funnel order: problem → lose → next → solution → benefits → tours → destinations → proof → why → final → enquiry → contact", pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])));
  check("exactly one h1", $$(sd, "h1").length === 1);
  check("every img has alt attr", $$(sd, "img").every(i => i.hasAttribute("alt")));
  check("every form field has a label", ["f-name", "f-mobile", "f-wa", "f-dest", "f-trav", "f-month", "f-msg"].every(id => sd.querySelector('label[for="' + id + '"]')));
  let ld = null; try { ld = JSON.parse($(sd, 'script[type="application/ld+json"]').textContent); } catch (e) {}
  check("JSON-LD valid TravelAgency with 3 phones", ld && ld["@type"] === "TravelAgency" && ld.telephone.length === 3);
  check("JSON-LD has no invented rating/reviews", ld && !("aggregateRating" in ld) && !("review" in ld));
  check("meta description + OG tags present", $(sd, 'meta[name="description"]').content.length > 50 && $(sd, 'meta[property="og:title"]').content && $(sd, 'meta[property="og:image"]'));
  check("3 phone numbers as tel: links in hero", $$(sd, '[data-phones="hero"] a[href^="tel:+91"]').length === 3);
  check("footer address present", /Kothari Galli/.test($(sd, ".foot").textContent));

  const tplKeys = [...tpl.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]).concat([...tpl.matchAll(/data-i18n-attr="[^"]*?:([\w.]+)(?:;[^"]*)?"/g)].map(m => m[1]));
  check("every template key exists in en/mr/hi", ["en", "mr", "hi"].every(l => tplKeys.every(k => I18N[l][k] && I18N[l][k].length)));
  const enKeys = Object.keys(I18N.en);
  check("en/mr/hi have identical key sets (" + enKeys.length + " keys)", ["mr", "hi"].every(l => JSON.stringify(Object.keys(I18N[l]).sort()) === JSON.stringify(enKeys.slice().sort())));
  check("no empty strings in any language", ["en", "mr", "hi"].every(l => Object.values(I18N[l]).every(v => v && v.trim())));
  check("destination lists same length in all languages", [1, 2, 3, 4, 5, 6].every(g => ["mr", "hi"].every(l => I18N[l]["dest.g" + g + ".l"].split("|").length === I18N.en["dest.g" + g + ".l"].split("|").length)));
  check("13 month options in all languages", ["en", "mr", "hi"].every(l => I18N[l]["enq.months"].split("|").length === 13));
  check("Marathi hero headline", I18N.mr["hero.h1"] === "टूरचा बेत ठरला?\nप्रवास, जेवण, मुक्काम — सगळी जबाबदारी आमची.");
  check("Marathi problem heading verbatim", I18N.mr["prob.h"] === "सहलीचा विचार करताना सर्वात मोठी अडचण प्रवास नसतो...\nPlanning असते.");
  check("Marathi success text verbatim", I18N.mr["enq.ok"] === "धन्यवाद! तुमची enquiry प्राप्त झाली आहे.\nआमची team लवकरच तुमच्याशी संपर्क करेल.");
  check("Marathi tagline verbatim", I18N.mr["brand.tag"] === "तुमची यात्रा • आमची जबाबदारी 🙏");
  check("Hindi + Marathi text contain Devanagari", /[ऀ-ॿ]/.test(I18N.hi["hero.h1"]) && /[ऀ-ॿ]/.test(I18N.mr["hero.h1"]));
  const everything = ["en", "mr", "hi"].map(l => Object.values(I18N[l]).join("\n")).join("\n").toLowerCase();
  check("no fake scarcity/claims in copy", !/1000\+|seats left|guarantee|lowest price|happy customers|\d+\+ (customers|travellers)|award|rated|★|5 star/.test(everything));

  /* ═══ 2. Language switching ═══ */
  console.log("language");
  let s = await boot({});
  check("English is the default", s.d.documentElement.lang === "en" && /Decided on a tour\?/.test($(s.d, "h1").textContent));
  check("English button pressed by default", $(s.d, '.lang [data-lang="en"]').getAttribute("aria-pressed") === "true");
  $(s.d, '.lang [data-lang="mr"]').click();
  check("→ Marathi: H1", $(s.d, "h1").textContent === I18N.mr["hero.h1"]);
  check("→ Marathi: html lang + data-lang", s.d.documentElement.lang === "mr" && s.d.documentElement.dataset.lang === "mr");
  check("→ Marathi: title + meta description", s.d.title === I18N.mr["meta.title"] && $(s.d, 'meta[name="description"]').content === I18N.mr["meta.desc"]);
  check("→ Marathi: aria-pressed moved", $(s.d, '.lang [data-lang="mr"]').getAttribute("aria-pressed") === "true" && $(s.d, '.lang [data-lang="en"]').getAttribute("aria-pressed") === "false");
  check("→ Marathi: placeholder + month list", $(s.d, "#f-dest").placeholder === I18N.mr["enq.pDest"] && $(s.d, "#f-month").options[1].textContent === "जानेवारी");
  check("→ Marathi: no English-only residue in headings (hero CTA)", $(s.d, ".hero .btn-primary").textContent === "टूरची माहिती मिळवा");
  $(s.d, '.lang [data-lang="hi"]').click();
  check("→ Hindi: H1", $(s.d, "h1").textContent === I18N.hi["hero.h1"] && s.d.documentElement.lang === "hi");
  check("→ Hindi: submit button", $(s.d, "#enqSubmit span").textContent === I18N.hi["enq.submit"]);
  $(s.d, '.lang [data-lang="en"]').click();
  check("→ back to English", $(s.d, "h1").textContent === I18N.en["hero.h1"]);
  check("choice remembered on device", s.store["ss-lang"] === "en");
  s.w.close();

  {
    const q = new JSDOM(html, { runScripts: "dangerously", resources: "usable", url: "file://" + root + "/index.html?lang=hi", beforeParse(w) { w.Element.prototype.scrollIntoView = function () {}; } });
    await new Promise(r => q.window.addEventListener("load", r)); await sleep(80);
    check("?lang=hi in the link opens the page in Hindi (shareable)", q.window.document.documentElement.lang === "hi" && $(q.window.document, "h1").textContent === I18N.hi["hero.h1"]);
    q.window.close();
  }

  s = await boot({ defaultLanguage: "mr" });
  check("defaultLanguage can be changed in config", s.d.documentElement.lang === "mr");
  s.w.close();
  s = await boot({ defaultLanguage: "xx" });
  check("invalid defaultLanguage falls back to English", s.d.documentElement.lang === "en");
  s.w.close();

  /* ═══ 3. Destinations, tour types ═══ */
  console.log("destinations");
  s = await boot({});
  check("6 destination tabs", $$(s.d, ".tab").length === 6);
  check("first tab selected, only its panel visible", $$(s.d, ".tab")[0].getAttribute("aria-selected") === "true" && $$(s.d, ".panel").filter(p => !p.hidden).length === 1);
  check("North India has 11 pills", $$(s.d, "#dpanel-0 .pill").length === 11);
  $$(s.d, ".tab")[2].click();
  check("tab click switches panel", $$(s.d, ".panel")[2].hidden === false && $$(s.d, ".panel")[0].hidden === true);
  check("Religious tab has 12 pills incl. Jagannath Puri", $$(s.d, "#dpanel-2 .pill").length === 12 && $$(s.d, "#dpanel-2 .pill").some(p => p.textContent === "Jagannath Puri"));
  $$(s.d, ".tab")[2].dispatchEvent(new s.w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  check("ArrowRight moves to next tab", $$(s.d, ".tab")[3].getAttribute("aria-selected") === "true");
  $$(s.d, "#dpanel-3 .pill")[0].click();
  check("pill click fills destination", $(s.d, "#f-dest").value === "Bangalore");
  $(s.d, '.lang [data-lang="mr"]').click();
  check("tab choice survives language switch", $$(s.d, ".tab")[3].getAttribute("aria-selected") === "true" && $$(s.d, ".tab")[3].textContent === "दक्षिण भारत");
  check("pills turn into Devanagari", $$(s.d, "#dpanel-3 .pill")[0].textContent === "बेंगळुरू");
  check("datalist rebuilt in Marathi", $$(s.d, "#destList option").some(o => o.value === "काश्मीर"));
  s.w.close();

  s = await boot({});
  const tile = $$(s.d, ".tours button")[4]; tile.click();
  check("tour tile pre-selects tour type", $(s.d, 'input[name="tourType"]:checked').value === "Family");
  check("9 tour tiles", $$(s.d, ".tours button").length === 9);
  s.w.close();

  /* ═══ 4. Phones + WhatsApp ═══ */
  console.log("calls + whatsapp");
  s = await boot({});
  check("3 phone buttons in contact strip", $$(s.d, '[data-phones="contact"] a[href^="tel:"]').length === 3);
  check("call buttons point to first number", $$(s.d, "[data-primary-call]").every(a => a.href === "tel:+918591124310"));
  check("WhatsApp hidden while number unset", $$(s.d, "[data-wa]").every(a => a.hidden) && $(s.d, "#enqWa").hidden);
  check("sticky bar adapts to 2 buttons without WhatsApp", $(s.d, "#stickyBar").classList.contains("bar--2"));
  s.w.close();

  s = await boot({ whatsappNumber: "+91 93243 89943" });
  const wa = $(s.d, '.contact [data-wa]');
  check("WhatsApp shown once number is set", !wa.hidden && wa.href.startsWith("https://wa.me/919324389943?text="));
  const msg = decodeURIComponent(wa.href.split("text=")[1]);
  check("WhatsApp template matches brief", msg === "Hello Swami Samarth Tourism,\nमला Tour Details जाणून घ्यायच्या आहेत.\n\nName: \nDestination: \nTravellers: \nPreferred Month: ", JSON.stringify(msg));
  fill(s.d, s.w, { name: "Ravi", dest: "Goa", trav: "6", month: 5 });
  const m2 = decodeURIComponent($(s.d, "#enqWa").href.split("text=")[1]);
  check("form WhatsApp button carries what the visitor typed", /Name: Ravi\nDestination: Goa\nTravellers: 6\nPreferred Month: May/.test(m2), m2);
  check("sticky bar keeps 3 buttons", !$(s.d, "#stickyBar").classList.contains("bar--2"));
  s.w.close();
  s = await boot({ whatsappNumber: "123" });
  check("too-short WhatsApp number ignored", $$(s.d, "[data-wa]").every(a => a.hidden));
  s.w.close();

  /* ═══ 5. Form validation ═══ */
  console.log("form validation");
  s = await boot({});
  submit(s.d, s.w);
  const shown = $$(s.d, ".err").filter(e => !e.hidden).map(e => e.id);
  check("empty submit flags name, mobile, destination, travellers, month", ["e-name", "e-mobile", "e-dest", "e-trav", "e-month"].every(i => shown.includes(i)) && !shown.includes("e-wa"), shown.join());
  check("fields marked aria-invalid", $(s.d, "#f-name").getAttribute("aria-invalid") === "true");
  check("summary status shown + focus on first bad field", $(s.d, "#enqStatus").textContent === I18N.en["enq.fix"] && s.d.__active === $(s.d, "#f-name"));
  $(s.d, '.lang [data-lang="mr"]').click();
  check("error text re-translates on language switch", $(s.d, "#e-name").textContent === I18N.mr["enq.err.name"] && $(s.d, "#enqStatus").textContent === I18N.mr["enq.fix"]);
  $(s.d, '.lang [data-lang="en"]').click();
  fill(s.d, s.w, { name: "A" }); check("typing clears that field's error", $(s.d, "#e-name").hidden);
  for (const bad of ["12345", "5987654321", "98765 4321", "abcdefghij"]) {
    fill(s.d, s.w, Object.assign({}, GOOD, { mobile: bad })); submit(s.d, s.w);
    check("rejects mobile '" + bad + "'", !$(s.d, "#e-mobile").hidden);
  }
  for (const ok of ["9876543210", "+91 98765 43210", "09876543210", "919876543210"]) {
    fill(s.d, s.w, Object.assign({}, GOOD, { mobile: ok })); submit(s.d, s.w);
    check("accepts mobile '" + ok + "'", $(s.d, "#e-mobile").hidden);
  }
  fill(s.d, s.w, Object.assign({}, GOOD, { wa: "123" })); submit(s.d, s.w);
  check("rejects bad WhatsApp number", !$(s.d, "#e-wa").hidden);
  fill(s.d, s.w, Object.assign({}, GOOD, { wa: "" })); submit(s.d, s.w);
  check("blank WhatsApp is fine", $(s.d, "#e-wa").hidden);
  for (const bad of ["0", "-2", "1.5", "501", "abc"]) {
    fill(s.d, s.w, Object.assign({}, GOOD, { trav: bad })); submit(s.d, s.w);
    check("rejects travellers '" + bad + "'", !$(s.d, "#e-trav").hidden);
  }
  s.w.close();

  /* ═══ 6. Submission paths ═══ */
  console.log("submission");
  // A: nothing configured
  s = await boot({}, { fetch: async () => ({ status: 200 }) });
  fill(s.d, s.w, GOOD); submit(s.d, s.w);
  check("A: nothing configured → says nothing was sent", $(s.d, "#enqStatus").textContent === I18N.en["enq.none"] && $(s.d, "#enqStatus").className.includes("error"));
  check("A: no request made, no success claim", s.calls.fetch.length === 0 && s.calls.open.length === 0 && !/Thank you/.test($(s.d, "#enqStatus").textContent));
  check("A: visitor's details are kept", $(s.d, "#f-name").value === "Asha Patil" && $(s.d, "#f-dest").value === "Kashmir");
  s.w.close();

  // B: WhatsApp only
  s = await boot({ whatsappNumber: "919324389943" });
  fill(s.d, s.w, Object.assign({}, GOOD, { tourType: 1 })); submit(s.d, s.w);
  check("B: opens WhatsApp once", s.calls.open.length === 1 && s.calls.open[0].startsWith("https://wa.me/919324389943?text="));
  const bm = decodeURIComponent(s.calls.open[0].split("text=")[1]);
  check("B: message holds name/destination/travellers/month", /Name: Asha Patil\nDestination: Kashmir\nTravellers: 4\nPreferred Month: March/.test(bm), bm);
  check("B: says 'press Send' — never claims received", $(s.d, "#enqStatus").textContent === I18N.en["enq.waOpened"] && !/received/i.test($(s.d, "#enqStatus").textContent));
  s.w.close();

  // C: endpoint 200
  s = await boot({ enquiryEndpoint: "https://example.test/enquiry", enquiryHeaders: { "X-Form-Token": "abc" } }, { fetch: async () => ({ status: 200 }) });
  fill(s.d, s.w, Object.assign({}, GOOD, { wa: "9323997703" }));
  $(s.d, 'input[name="tourType"][value="Group"]').checked = true;
  $(s.d, "#f-msg").value = "Need AC rooms";
  submit(s.d, s.w); await sleep(30);
  const call = s.calls.fetch[0];
  check("C: POSTs to the endpoint with JSON + custom header", call && call.u === "https://example.test/enquiry" && call.o.method === "POST" && call.o.headers["Content-Type"] === "application/json" && call.o.headers["X-Form-Token"] === "abc");
  const body = call && JSON.parse(call.o.body);
  check("C: payload fields", body && body.name === "Asha Patil" && body.mobile === "+919876543210" && body.whatsapp === "+919323997703" && body.destination === "Kashmir" && body.travellers === 4 && body.preferredMonth === "March" && body.preferredMonthIndex === 3 && body.tourType === "Group" && body.message === "Need AC rooms" && body.language === "en" && !!body.submittedAt, JSON.stringify(body));
  check("C: success text only after a genuine 2xx", $(s.d, "#enqStatus").textContent === I18N.en["enq.ok"] && $(s.d, "#enqStatus").className.includes("ok"));
  check("C: form cleared after success", $(s.d, "#f-name").value === "");
  check("C: submit button free again", !$(s.d, "#enqSubmit").disabled);
  s.w.close();

  // C2: payload language follows the page
  s = await boot({ enquiryEndpoint: "https://example.test/e" }, { fetch: async () => ({ status: 201 }) });
  $(s.d, '.lang [data-lang="mr"]').click();
  fill(s.d, s.w, GOOD); submit(s.d, s.w); await sleep(30);
  const b2 = JSON.parse(s.calls.fetch[0].o.body);
  check("C2: Marathi page sends language 'mr', month label + numeric index", b2.language === "mr" && b2.preferredMonth === "मार्च" && b2.preferredMonthIndex === 3);
  check("C2: success message is Marathi", $(s.d, "#enqStatus").textContent === I18N.mr["enq.ok"]);
  $(s.d, '.lang [data-lang="hi"]').click();
  check("C2: status text switches language", $(s.d, "#enqStatus").textContent === I18N.hi["enq.ok"]);
  s.w.close();

  // D: endpoint 500
  s = await boot({ enquiryEndpoint: "https://example.test/e" }, { fetch: async () => ({ status: 500 }) });
  fill(s.d, s.w, GOOD); submit(s.d, s.w); await sleep(30);
  check("D: 500 → error, not success", $(s.d, "#enqStatus").textContent === I18N.en["enq.fail"] && $(s.d, "#enqStatus").className.includes("error"));
  check("D: details preserved, button re-enabled", $(s.d, "#f-name").value === "Asha Patil" && !$(s.d, "#enqSubmit").disabled);
  s.w.close();

  // E: network failure
  s = await boot({ enquiryEndpoint: "https://example.test/e" }, { fetch: () => Promise.reject(new Error("offline")) });
  fill(s.d, s.w, GOOD); submit(s.d, s.w); await sleep(30);
  check("E: network failure → error, details kept", $(s.d, "#enqStatus").textContent === I18N.en["enq.fail"] && $(s.d, "#f-dest").value === "Kashmir");
  s.w.close();

  // F: double submit + honeypot
  let release; const gate = new Promise(r => { release = r; });
  s = await boot({ enquiryEndpoint: "https://example.test/e" }, { fetch: () => gate.then(() => ({ status: 200 })) });
  fill(s.d, s.w, GOOD); submit(s.d, s.w); submit(s.d, s.w);
  check("F: pending state shown, button disabled", $(s.d, "#enqSubmit").disabled && $(s.d, "#enqStatus").textContent === I18N.en["enq.sending"]);
  release(); await sleep(30);
  check("F: double submit sent once", s.calls.fetch.length === 1);
  fill(s.d, s.w, GOOD); $(s.d, 'input[name="website"]').value = "http://spam"; submit(s.d, s.w); await sleep(20);
  check("F: honeypot blocks bots silently", s.calls.fetch.length === 1);
  s.w.close();

  /* ═══ 7. Proof + owner view ═══ */
  console.log("proof + review mode");
  s = await boot({});
  check("owner checklist banner removed", !$(s.d, "#reviewBanner") && !/Owner checklist/.test(s.d.body.textContent));
  check("owner view: 8 placeholders with the brief's wording", $$(s.d, ".proof-ph").length === 8 && /\[REAL CUSTOMER TESTIMONIAL WILL BE ADDED HERE\]/.test($(s.d, "#proofGrid").textContent));
  s.w.close();

  s = await boot({ reviewMode: "off" });
  check("public view: NO placeholders, no fake proof", $$(s.d, ".proof-ph").length === 0 && $(s.d, "#proofGrid").hidden && !/WILL BE ADDED/.test(s.d.body.textContent));
  check("public view: still shows real office address + phones in trust section", /Kothari Galli/.test($(s.d, ".office").textContent) && $$(s.d, '.office a[href^="tel:"]').length === 3);
  s.w.close();

  s = await boot({ reviewMode: "off", proof: { googleReviewsUrl: "https://g.page/r/example", testimonials: [{ quote: "<b>Great</b> trip", name: "Real Person", place: "Pune" }], photos: [{ src: "assets/logo-160.jpg", alt: "Group at Kashi", category: "group" }, { src: "javascript:alert(1)", alt: "x", category: "tour" }], videos: [{ src: "https://youtu.be/dQw4w9WgXcQ", title: "Clip" }] } });
  check("real Google Reviews link renders safely", $(s.d, '#proofGrid a[href="https://g.page/r/example"]') && $(s.d, '#proofGrid a').rel.includes("noopener"));
  check("testimonial text is escaped (not HTML)", $(s.d, "#proofGrid blockquote p").textContent === "<b>Great</b> trip" && !$(s.d, "#proofGrid blockquote b"));
  check("real photo rendered lazily with alt", $(s.d, '#proofGrid img[alt="Group at Kashi"]') && $(s.d, '#proofGrid img').loading === "lazy");
  check("javascript: photo src is refused", !/javascript:/i.test($(s.d, "#proofGrid").innerHTML));
  check("YouTube clip embeds via nocookie iframe", $(s.d, "#proofGrid iframe").src.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
  check("no placeholders for blocks that have real content, none on public", $$(s.d, ".proof-ph").length === 0);
  s.w.close();
  s = await boot({ reviewMode: "off", proof: { googleReviewsUrl: "http://insecure.example" } });
  check("non-https review link refused", $$(s.d, "#proofGrid a").length === 0);
  s.w.close();

  /* ═══ 8. Footer/map ═══ */
  s = await boot({ mapsUrl: "https://maps.app.goo.gl/abc" });
  check("custom Maps link used", $(s.d, "#mapLink").href === "https://maps.app.goo.gl/abc");
  s.w.close();
  s = await boot({});
  check("default Maps link searches the address", /google\.com\/maps\/search/.test($(s.d, "#mapLink").href));
  s.w.close();

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
