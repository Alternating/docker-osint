export interface DorkLink {
  label: string;
  url: string;
  group: string;
}

const g = (q: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const bing = (q: string): string =>
  `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
const ddg = (q: string): string =>
  `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

const slug = (s: string): string => encodeURIComponent(s.replace(/\s+/g, "-"));

export function nameDorks(name: string): DorkLink[] {
  const trimmed = name.trim();
  if (trimmed === "") return [];

  const q = `"${trimmed}"`;
  const enc = encodeURIComponent(trimmed);
  const path = slug(trimmed);

  return [
    { group: "Search engines", label: "Google exact", url: g(q) },
    { group: "Search engines", label: "Google + address", url: g(`${q} address`) },
    { group: "Search engines", label: "Google + phone/contact", url: g(`${q} phone OR contact`) },
    { group: "Search engines", label: "Bing exact", url: bing(q) },
    { group: "Search engines", label: "DuckDuckGo exact", url: ddg(q) },
    { group: "Social", label: "LinkedIn", url: g(`site:linkedin.com/in ${q}`) },
    { group: "Social", label: "Facebook", url: g(`site:facebook.com ${q}`) },
    { group: "Social", label: "Instagram", url: g(`site:instagram.com ${q}`) },
    { group: "Social", label: "X/Twitter", url: g(`site:x.com OR site:twitter.com ${q}`) },
    { group: "Social", label: "Reddit", url: g(`site:reddit.com ${q}`) },
    { group: "Records & leaks", label: "Pastebin", url: g(`site:pastebin.com ${q}`) },
    {
      group: "Records & leaks",
      label: "Documents (PDF/DOC/XLS)",
      url: g(`${q} filetype:pdf OR filetype:doc OR filetype:xls`),
    },
    {
      group: "Records & leaks",
      label: "Court/news mentions",
      url: g(`${q} arrest OR court OR obituary OR marriage`),
    },
    {
      group: "People search sites",
      label: "TruePeopleSearch",
      url: `https://www.truepeoplesearch.com/results?name=${enc}`,
    },
    {
      group: "People search sites",
      label: "FastPeopleSearch",
      url: `https://www.fastpeoplesearch.com/name/${path}`,
    },
    {
      group: "People search sites",
      label: "WhitePages",
      url: `https://www.whitepages.com/name/${path}`,
    },
    { group: "People search sites", label: "Spokeo", url: `https://www.spokeo.com/${path}` },
  ];
}

export function addressDorks(address: string): DorkLink[] {
  const trimmed = address.trim();
  if (trimmed === "") return [];

  const q = `"${trimmed}"`;
  const enc = encodeURIComponent(trimmed);

  return [
    {
      group: "Maps",
      label: "Google Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${enc}`,
    },
    {
      group: "Maps",
      label: "OpenStreetMap",
      url: `https://www.openstreetmap.org/search?query=${enc}`,
    },
    { group: "Maps", label: "Zillow", url: g(`site:zillow.com ${q}`) },
    { group: "Search engines", label: "Google exact", url: g(q) },
    { group: "Search engines", label: "Bing exact", url: bing(q) },
    { group: "Search engines", label: "DuckDuckGo exact", url: ddg(q) },
    {
      group: "Records",
      label: "County property records",
      url: g(`${q} property records OR assessor`),
    },
    { group: "Records", label: "Past residents", url: g(`${q} residents OR "lived at"`) },
    {
      group: "Records",
      label: "TruePeopleSearch address",
      url: `https://www.truepeoplesearch.com/resultaddress?streetaddress=${enc}`,
    },
  ];
}

export function phoneDorks(phone: string): DorkLink[] {
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.length === 0) return [];

  const q = `"${phone.trim()}"`;
  const qClean = `"${clean}"`;

  return [
    { group: "Search engines", label: "Google (as typed)", url: g(q) },
    { group: "Search engines", label: "Google (digits only)", url: g(qClean) },
    { group: "Search engines", label: "DuckDuckGo", url: ddg(qClean) },
    { group: "Search engines", label: "Bing", url: bing(qClean) },
    {
      group: "Reverse lookup",
      label: "TrueCaller",
      url: `https://www.truecaller.com/search/us/${encodeURIComponent(clean)}`,
    },
    {
      group: "Reverse lookup",
      label: "WhoCalledMe / 800notes",
      url: g(`site:whocalled.me OR site:800notes.com ${qClean}`),
    },
    {
      group: "Reverse lookup",
      label: "Spam/scam reports",
      url: g(`${qClean} spam OR scam OR robocall`),
    },
  ];
}

export function emailDorks(email: string): DorkLink[] {
  const trimmed = email.trim();
  if (trimmed === "") return [];

  const q = `"${trimmed}"`;
  const enc = encodeURIComponent(trimmed);

  return [
    { group: "Search engines", label: "Google exact", url: g(q) },
    { group: "Search engines", label: "DuckDuckGo exact", url: ddg(q) },
    { group: "Search engines", label: "Bing exact", url: bing(q) },
    { group: "Leaks & pastes", label: "Pastebin", url: g(`site:pastebin.com ${q}`) },
    {
      group: "Leaks & pastes",
      label: "Documents (PDF/XLS)",
      url: g(`${q} filetype:pdf OR filetype:xls`),
    },
    {
      group: "Leaks & pastes",
      label: "HaveIBeenPwned",
      url: `https://haveibeenpwned.com/account/${enc}`,
    },
    {
      group: "Social",
      label: "LinkedIn/Facebook mentions",
      url: g(`${q} site:linkedin.com OR site:facebook.com`),
    },
  ];
}
