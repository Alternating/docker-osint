// In-app help content. Authored prose/procedures; the Support component renders
// these blocks. Keep it accurate to the app — it's the self-contained manual.

export type SupportBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "example"; input: string; result: string }
  | { type: "note"; text: string };

export interface SupportChapter {
  id: string;
  title: string;
  blocks: SupportBlock[];
}

export const SUPPORT_CHAPTERS: SupportChapter[] = [
  {
    id: "getting-started",
    title: "1 · Getting started",
    blocks: [
      {
        type: "p",
        text: "Suron is a self-hosted OSINT workbench. It searches six kinds of identifier — username, email, phone, name, address, and domain — and cross-references emails against breach data. Everything runs on your own server; results are stored only in your instance.",
      },
      {
        type: "p",
        text: "Sign-in is passkey-only — there is no password to steal or reuse. The very first visit runs a one-time setup that creates the single admin account and registers your first passkey together.",
      },
      {
        type: "steps",
        items: [
          "On first launch, open the site and enter the setup password from your server configuration, pick a username, and follow your device's prompt to create a passkey.",
          "After that, sign in with the passkey on any later visit — no password is ever stored.",
          "Use the top nav to move between Dashboard (searching), Resources (the reference library), Settings (keys, imports, passkeys), and this Support guide.",
        ],
      },
      {
        type: "note",
        text: "Passkeys need a secure context (HTTPS, or localhost in development). If the login prompt never appears, check that you're reaching the site over https on its configured hostname.",
      },
    ],
  },
  {
    id: "searching",
    title: "2 · Running a search",
    blocks: [
      {
        type: "p",
        text: "The Dashboard is a single search box. Type an identifier and Suron auto-detects its type and routes it to the right tool. The mode chips above the box let you override the guess — pick \"Auto\" to let it decide, or force a specific type.",
      },
      {
        type: "steps",
        items: [
          "Type or paste what you're investigating into the box.",
          "Check the detected mode on the \"Auto\" chip (it shows the guess, e.g. \"Auto · email\"); tap another chip to override it.",
          "Press Enter or click the action button to start the scan.",
          "The scan appears in \"Scrying history\" below with a live status dot — blue pulsing while running, green when done, orange on error. Click any row to expand its full results.",
        ],
      },
      {
        type: "p",
        text: "Scans run in the background as jobs, so you can start several and come back to them. History persists, so you can revisit a past result later. A scan is force-stopped after five minutes, and very large result lists are truncated.",
      },
      {
        type: "p",
        text: "To tidy up, use \"Clear history\" above the list to remove all finished searches at once, or the ✕ on any row to delete just that one. Running scans are always kept.",
      },
      {
        type: "note",
        text: "Only investigate identifiers you are authorized to look into — your own accounts, your family's with their consent, or targets within an authorized engagement.",
      },
    ],
  },
  {
    id: "identity-types",
    title: "3 · What you can search",
    blocks: [
      {
        type: "p",
        text: "Each identifier type uses a different tool and returns a different kind of result. Examples:",
      },
      {
        type: "example",
        input: "Username — e.g. johndoe",
        result: "Sherlock hunts the username across ~480 sites and lists every profile it finds as clickable links.",
      },
      {
        type: "example",
        input: "Email — e.g. jane@example.com",
        result: "holehe probes ~120 sites for an account, then breach sources (Have I Been Pwned and any keys you've added) and your imported breach lists are cross-referenced, plus an EmailRep reputation read if configured.",
      },
      {
        type: "example",
        input: "Phone — e.g. +1 202 555 0123",
        result: "Validity, region, carrier, line type and timezones from the offline phonenumbers library, plus Twilio line-type/carrier/caller-name enrichment if a Twilio key is set.",
      },
      {
        type: "example",
        input: "Name — e.g. Jane Doe",
        result: "A dossier of curated search-engine dorks and people-search links. These point into data-broker sites — useful both for finding information and for filing opt-out/removal requests.",
      },
      {
        type: "example",
        input: "Address — e.g. 1600 Pennsylvania Ave NW, Washington DC",
        result: "Geocoding via OpenStreetMap's Nominatim (with a map link) plus address-specific dork links.",
      },
      {
        type: "example",
        input: "Domain — e.g. example.com",
        result: "Photon crawls the site and extracts URLs, endpoints, emails, and other intel, grouped by category.",
      },
      {
        type: "note",
        text: "Auto-detect is a best guess from the text's shape. If it guesses wrong (e.g. a name you meant as a username), just tap the right mode chip before searching.",
      },
    ],
  },
  {
    id: "results",
    title: "4 · Reading your results",
    blocks: [
      {
        type: "p",
        text: "Click a scan in the history to expand it. What you see depends on the scan type.",
      },
      {
        type: "list",
        items: [
          "Username / email account hits: a grid of sites where a profile or account was found; rate-limited sites are collapsed separately.",
          "Breach exposure: breaches from Have I Been Pwned show the date, scale, and the classes of data leaked, with sensitive classes (passwords, SSNs, cards) highlighted. LeakCheck and DeHashed list the breach sources they matched.",
          "Local breach lists: any matches from breach files you imported, shown by source.",
          "Email reputation: EmailRep's reputation score, risk flags, and where the address has been seen.",
          "Phone: validity, region, carrier, and line type, plus Twilio enrichment when configured.",
          "Domain: crawled URLs, endpoints, and intel grouped into expandable categories.",
        ],
      },
      {
        type: "note",
        text: "Suron never shows or stores plaintext passwords from any breach source — only the breach name, the categories of data exposed, and whether a password was present. That keeps your results database from becoming a second copy of the leak.",
      },
    ],
  },
  {
    id: "resources",
    title: "5 · The resources library",
    blocks: [
      {
        type: "p",
        text: "The Resources tab is a searchable index of roughly 1,400 curated OSINT tools and sites, organized into dozens of categories (drawn from the community awesome-osint project).",
      },
      {
        type: "steps",
        items: [
          "Open Resources from the top nav.",
          "Type in the filter to narrow by name or category.",
          "Click any entry to open it in a new tab.",
        ],
      },
      {
        type: "p",
        text: "Use it when a scan points you somewhere Suron doesn't automate — a specialized lookup, a country-specific registry, or a manual technique.",
      },
    ],
  },
  {
    id: "passkeys",
    title: "6 · Settings · Passkeys",
    blocks: [
      {
        type: "p",
        text: "Passkeys are the only way to sign in. The Passkeys tab lists every credential registered to your account with its created and last-used dates. You can register more than one — for example a laptop and a phone, or a hardware key as a backup.",
      },
      {
        type: "steps",
        items: [
          "Open Settings → Passkeys.",
          "Type a name for the new passkey (e.g. \"YubiKey\" or \"Phone\") and click Add passkey; follow your device's prompt.",
          "Rename a passkey anytime with Rename, or remove one you no longer use with Remove.",
        ],
      },
      {
        type: "note",
        text: "You can't remove your last remaining passkey — that's the guard against locking yourself out. Register a second passkey before removing the first, and keep at least one on a device you won't lose.",
      },
    ],
  },
  {
    id: "connections",
    title: "7 · Settings · API connections",
    blocks: [
      {
        type: "p",
        text: "API connections add optional intelligence sources. Each is off until you paste a key, so Suron works out of the box and you enable only what you want. A key saved here overrides the one baked into the server's environment; clear the field and save to fall back to that environment key.",
      },
      {
        type: "steps",
        items: [
          "Open Settings → API connections and find the provider.",
          "Paste its key into the field. Twilio takes a composite credential in the form AccountSID:AuthToken; the others take a single token.",
          "Click Save, then Test — the Test button makes one real authenticated request and reports whether the connection is live (and often the remaining credits).",
        ],
      },
      {
        type: "list",
        items: [
          "Have I Been Pwned — breach lookups per email. Free status check; the key is paid.",
          "LeakCheck — full breach records; testing and scanning each spend a query credit.",
          "EmailRep — email reputation and risk signals. Maintenance mode: existing keys work, but new ones aren't being issued.",
          "DeHashed — deep breach/credential search (v2); testing and scanning spend a small credit.",
          "Intelligence X — leak/darknet/archive search; currently test-only.",
          "Twilio Lookup — phone line-type, carrier, and caller-name enrichment; the enrichment fields are paid per lookup.",
        ],
      },
      {
        type: "note",
        text: "Metered providers (LeakCheck, DeHashed, Twilio enrichment) cost money per call and are only ever contacted when their key is set. Leave a key blank to keep that provider silent.",
      },
    ],
  },
  {
    id: "breach-imports",
    title: "8 · Settings · Breach imports",
    blocks: [
      {
        type: "p",
        text: "Breach imports let you cross-reference email scans against breach or combo lists you already hold, completely offline — no third-party API involved. Imported lists are matched automatically on every email scan.",
      },
      {
        type: "steps",
        items: [
          "Open Settings → Breach imports.",
          "Give the source a name (e.g. \"Collection #1\"), choose its format, optionally add a note, and select the file.",
          "Choose the format that matches the file: Combo list (email:password per line), Email list (one address per line), or CSV (email in the first column).",
          "Click Import. The file is parsed into an indexed table; afterwards, matching emails surface automatically in email-scan results.",
        ],
      },
      {
        type: "note",
        text: "Only a presence flag is stored — the email, which source it came from, and whether a password was present. The plaintext passwords themselves are never written to Suron's database.",
      },
    ],
  },
  {
    id: "pwned-passwords",
    title: "9 · Settings · Password exposure",
    blocks: [
      {
        type: "p",
        text: "This checks whether a password appears in HIBP's Pwned Passwords corpus using k-anonymity: the password is hashed in your browser and only the first five characters of the hash are ever sent. The plaintext never leaves your device.",
      },
      {
        type: "steps",
        items: [
          "Open Settings → API connections and scroll to the Password exposure panel.",
          "Type a password and click Check. A match shows how many breaches it appears in — change it everywhere if so.",
          "Choose the lookup mode: Online queries HIBP's free, keyless range API; Offline serves everything from a corpus you've imported, with no network calls at all.",
        ],
      },
      {
        type: "p",
        text: "Offline mode is for air-gapped use. Download the full corpus with the official PwnedPasswordsDownloader, place the file somewhere the server can read it (inside the data directory), enter the path in the Offline corpus section, and click Import. The corpus is tens of gigabytes; progress is shown while it builds.",
      },
      {
        type: "note",
        text: "In Offline mode Suron never reaches the network for password checks. An offline result is only authoritative once the import has finished — while the corpus is still building, a check whose prefix hasn't been imported yet reports \"corpus not fully imported\" instead of a misleading \"not found\".",
      },
    ],
  },
  {
    id: "privacy",
    title: "10 · Privacy & responsible use",
    blocks: [
      {
        type: "p",
        text: "Suron is built for auditing your own and your family's exposure, and for authorized security work. Use it only against identifiers you have a right to investigate.",
      },
      {
        type: "list",
        items: [
          "What stays local: holehe, phone parsing, name/address dorks, local breach lists, and offline password checks never leave your server.",
          "What reaches a third party: Sherlock and Photon contact the sites they scan; HIBP/LeakCheck/DeHashed/EmailRep/Twilio are contacted only when you've added their key; online password checks send just a 5-character hash prefix.",
          "What's never stored: plaintext passwords from any source, and your account password (there isn't one — auth is passkey-only).",
        ],
      },
      {
        type: "note",
        text: "Some data commercial people-search sites show comes from licensed broker feeds that free tools can't legally replicate, and breaches that never circulated publicly won't appear in any lookup. The dossier links help you search those brokers directly — and file opt-out/removal requests.",
      },
    ],
  },
];
