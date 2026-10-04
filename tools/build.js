/* Developer-only: bakes the default (English) text into index.html so the page
   reads correctly with no JavaScript and for search engines.
   You do NOT need to run this to use the site — only after editing index.template.html
   or the English strings in js/i18n.js.
   Usage:  npm install jsdom   &&   node tools/build.js                         */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { JSDOM } = require("jsdom");
const root = path.join(__dirname, "..");

const I18N = require(path.join(root, "js/i18n.js"));
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), ctx);
const CFG = ctx.window.SS_SITE;
const en = I18N.en;

const dom = new JSDOM(fs.readFileSync(path.join(root, "index.template.html"), "utf8"));
const doc = dom.window.document;

doc.querySelectorAll("[data-i18n]").forEach(el => {
  const k = el.getAttribute("data-i18n");
  if (!(k in en)) throw new Error("Missing English key: " + k);
  el.textContent = en[k];
});
doc.querySelectorAll("[data-i18n-attr]").forEach(el => {
  el.getAttribute("data-i18n-attr").split(";").forEach(pair => {
    const [attr, k] = pair.split(":");
    if (!(k in en)) throw new Error("Missing English key: " + k);
    el.setAttribute(attr, en[k]);
  });
});

// phones (same markup main.js renders at runtime)
const fmt = d => d.slice(0, 5) + " " + d.slice(5);
const phoneHtml = d => `<a class="phone" href="tel:+91${d}"><svg class="ic" aria-hidden="true"><use href="#i-phone"/></svg><span>${fmt(d)}</span></a>`;
doc.querySelectorAll("[data-phones]").forEach(el => { el.innerHTML = CFG.phones.map(phoneHtml).join(""); });
doc.querySelectorAll("[data-primary-call]").forEach(el => el.setAttribute("href", "tel:+91" + CFG.phones[0]));

// months
const sel = doc.getElementById("f-month");
en["enq.months"].split("|").forEach(m => { const o = doc.createElement("option"); o.value = m; o.textContent = m; sel.appendChild(o); });

// destinations: simple grouped lists (main.js upgrades this to tabs)
const wrap = doc.getElementById("destWrap");
let html = "", all = [];
for (let g = 1; g <= 6; g++) {
  const names = en["dest.g" + g + ".l"].split("|");
  all = all.concat(names);
  html += `<div class="dest-group"><h3>${en["dest.g" + g + ".n"]}</h3><ul class="pills">` +
    names.map(n => `<li><button type="button" class="pill" data-dest="${n}">${n}</button></li>`).join("") + `</ul></div>`;
}
wrap.innerHTML = html;
const dl = doc.getElementById("destList");
[...new Set(all)].forEach(n => { const o = doc.createElement("option"); o.value = n; dl.appendChild(o); });

fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>\n" + doc.documentElement.outerHTML);
console.log("index.html written");
