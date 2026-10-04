/* ─────────────────────────────────────────────────────────────
   Swami Samarth Tourism — the ONE file you edit.
   Anything left blank is hidden or disabled. Nothing is invented.
   This file is public: never put a password or API key in it.
   ───────────────────────────────────────────────────────────── */
window.SS_SITE = {

  /* Language shown first. "en" = English. Visitors can switch to "mr" or "hi". */
  defaultLanguage: "en",
  persistLanguage: true,        // remember the visitor's choice on their device

  /* Phone numbers (10 digits). The first one is used by every "Call" button. */
  phones: ["8591124310", "9324389943", "9323997703"],

  /* WhatsApp number that should receive enquiries — digits with country code,
     e.g. "918591124310". LEFT BLANK ON PURPOSE: choose which of the three numbers
     should receive WhatsApp enquiries, then fill it in. While blank, every
     WhatsApp button is hidden. */
  whatsappNumber: "",

  /* Where the enquiry form posts JSON. Must answer with HTTP 2xx on success.
     While blank (and no WhatsApp number), the form tells the visitor that nothing
     was sent and asks them to call. */
  enquiryEndpoint: "",
  enquiryHeaders: {},           // e.g. { "X-Form-Token": "public-form-id" } — never a secret

  /* Google Maps link to your office ("Share" → "Copy link" in Google Maps).
     While blank, the footer links to a Maps search for your address. */
  mapsUrl: "",

  /* Owner view: shows dashed proof placeholders in the trust section.
     "auto" = only on file:// and localhost (never shown to visitors on your domain).
     "off"  = never.   "on" = always. */
  reviewMode: "auto",

  /* REAL proof only. Empty = nothing shown to visitors.
     Placeholders for the missing items appear only in the owner view. */
  proof: {
    showPlaceholders: "auto",   // "auto" | "on" | "off"
    googleReviewsUrl: "",       // link to your Google reviews
    testimonials: [],           // { quote: "…", name: "…", place: "…" }  (real, permitted)
    photos: [],                 // { src: "assets/tour1.jpg", alt: "…", category: "tour|group|hotel|vehicle|completion" }
    videos: []                  // { src: "assets/clip.mp4" or a YouTube link, title: "…" }
  }
};
