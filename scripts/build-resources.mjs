import fs from "fs";
import path from "path";

const inputPath = path.resolve(
  process.cwd(),
  process.env.AWESOME_OSINT_DIR ?? "tools/awesome-osint",
  "README.md"
);
const outputPath = path.resolve(process.cwd(), "lib", "generated", "resources.json");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

let content = "";
try {
  content = fs.readFileSync(inputPath, "utf8");
} catch {
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), total: 0, categories: [] }, null, 2)
  );
  console.warn(`README not found at ${inputPath}. Wrote empty resources index.`);
  process.exit(0);
}

const skipHeadings = ["Table of Contents", "Contributing", "Credits", "License"];
const categories = [];
let currentCategory = null;
let lastH2Name = null;

for (const rawLine of content.split("\n")) {
  const line = rawLine.replace(/\r$/, "");

  const h2Match = line.match(/^## (.+)$/);
  const h3Match = line.match(/^### (.+)$/);

  if (h2Match) {
    const name = h2Match[1].replace(/^\[↑\]\([^)]*\)\s*/, "").trim();
    lastH2Name = name;
    if (skipHeadings.some((sk) => name.includes(sk))) {
      currentCategory = null;
    } else {
      currentCategory = { name, resources: [] };
      categories.push(currentCategory);
    }
  } else if (h3Match) {
    const name = h3Match[1].replace(/^\[↑\]\([^)]*\)\s*/, "").trim();
    if (skipHeadings.some((sk) => name.includes(sk))) {
      currentCategory = null;
    } else {
      const prefixed =
        lastH2Name === "Social Media Tools" ? `Social Media Tools / ${name}` : name;
      currentCategory = { name: prefixed, resources: [] };
      categories.push(currentCategory);
    }
  } else if (currentCategory && (line.startsWith("* ") || line.startsWith("- "))) {
    const bullet = line.slice(2);
    const linkMatch = bullet.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
    if (!linkMatch) continue;
    const [, name, url] = linkMatch;
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue;

    const description = bullet
      .slice(linkMatch.index + linkMatch[0].length)
      .replace(/^\s*[-—–]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

    currentCategory.resources.push({ name, url, description });
  }
}

const validCategories = categories.filter((c) => c.resources.length > 0);
const total = validCategories.reduce((acc, c) => acc + c.resources.length, 0);

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), total, categories: validCategories },
    null,
    2
  )
);
console.log(`resources.json: ${validCategories.length} categories, ${total} resources.`);
