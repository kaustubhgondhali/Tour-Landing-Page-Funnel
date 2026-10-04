# Swami Samarth Tourism — Landing Page Funnel

Plain **HTML, CSS and JavaScript**. No framework, no build step, no install.
Unzip and open `index.html`. Three languages — **English (default)**, **मराठी**, **हिन्दी** —
switchable from the top bar. A link like `index.html?lang=mr` opens straight in Marathi
(handy for WhatsApp/Instagram campaigns).

## Quick start

1. Open `js/config.js` — **the only file you need to edit.**
2. Set `whatsappNumber` and/or `enquiryEndpoint` (below).
3. Upload the whole folder to your host.

Opening the page on your computer (file:// or localhost) shows dashed proof placeholders.
They never appear on your live domain (`reviewMode` in the config controls this).

## Files

```
index.html            the page (English text is baked in, so it works without JS and for Google)
index.template.html   source of index.html (only needed if you change the structure)
css/styles.css        styling — colour tokens at the top
js/config.js          ← edit this
js/i18n.js            every word of the page in English, Marathi and Hindi
js/main.js            language switch, destinations, form, call/WhatsApp buttons
assets/               logo + resized copies, favicon, og-image
tools/build.js        developer-only: rebuilds index.html from the template (needs `npm i jsdom`)
tests/                117 automated checks (needs `npm i jsdom`, run `node tests/integration.test.js`)
```

## Before you publish — please confirm

| Item | Why |
|---|---|
| **WhatsApp number** | Left blank on purpose: you asked that it be set only after deciding which of your three numbers receives WhatsApp enquiries. While blank, every WhatsApp button is hidden. Set `whatsappNumber: "91XXXXXXXXXX"`. |
| **Where enquiries go** | Set `enquiryEndpoint` (your form backend; must return HTTP 2xx) and/or `whatsappNumber`. With neither, the form tells the visitor that **nothing was sent** and to call you — it never shows "Thank you" unless a real 2xx came back. Re-validate on the server; browser validation is a convenience. Never put a secret/API key in `config.js` (it is public). |
| **Service claims** | AC train, AC bus, 3-star hotel, family rooms and food arrangement are taken from your brief. Make sure they are true for *every* tour you advertise. |
| **Hindi + English copy** | Marathi follows your brief word-for-word, except the main headline, which was rewritten in all three languages. English and Hindi were written for this page, as were the Marathi/Hindi spellings of place names — please have a native reader proof them. |
| **Proof section** | No reviews, ratings, counts or photos were invented. Add real ones under `proof` in `config.js` (Google Reviews link, testimonials, photos by category, videos). Visitors see only what you add; until then the section shows your real office address and phone numbers. |
| **Google Maps link** | Paste your Maps share link into `mapsUrl`. Until then the footer links to a Maps search for your address. |
| **After hosting** | In `index.html`, change `og:image` and the JSON-LD `image`/`logo` to full `https://…` URLs so link previews work. |

## Enquiry form

Payload (JSON POST): `name, mobile (+91…), whatsapp, destination, travellers, preferredMonth,
preferredMonthIndex (1–12 or null), tourType, message, language, pageUrl, submittedAt`.
If only `whatsappNumber` is set, the form opens WhatsApp with the brief's message template
filled in and tells the visitor to press Send — it does not claim the enquiry was received.

## Changing text

All wording lives in `js/i18n.js` (`en`, `mr`, `hi`). Change a string there and it changes
everywhere. If you edit the **English** strings, also run `node tools/build.js` so the baked-in
`index.html` matches (or just leave it — the script fixes the page on load).

## Colours (sampled from the logo)

Navy `#0F2A63` / `#0B1F4D`, orange `#F59A23`, green `#1E7A34`, sky `#EAF3FB`.
Orange is used for buttons with navy text and, as text on white, only in the darker `#B24A06`
(white-on-orange fails accessibility contrast).

Fonts: Inter + Noto Sans Devanagari from Google Fonts (falls back to system fonts offline).
