const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "..", "trophy.svg");
const KEEP_TITLES = ["Joined2020", "Experience", "Commits", "Repositories"];
const PANEL_WIDTH = 115;
const GAP = 10;
const STEP = PANEL_WIDTH + GAP;

function splitPanels(svgText) {
  const tagRegex = /<svg\b[^>]*>|<\/svg>/g;
  let depth = 0;
  let panelStart = null;
  const panels = [];
  let match;
  while ((match = tagRegex.exec(svgText)) !== null) {
    const tag = match[0];
    if (tag.startsWith("</svg>")) {
      depth--;
      if (depth === 1 && panelStart !== null) {
        const end = match.index + tag.length;
        panels.push(svgText.slice(panelStart, end));
        panelStart = null;
      }
    } else {
      depth++;
      if (depth === 2) {
        panelStart = match.index;
      }
    }
  }
  return panels;
}

function getTitle(panel) {
  const m = panel.match(/font-size="13"[^>]*>([^<]*)</);
  return m ? m[1].trim() : null;
}

const raw = fs.readFileSync(FILE, "utf8");
const panels = splitPanels(raw);
const kept = panels.filter((p) => KEEP_TITLES.includes(getTitle(p)));

if (kept.length === 0) {
  console.error("No matching trophy panels found - aborting to avoid corrupting the file.");
  process.exit(1);
}

const reindexed = kept.map((p, i) => p.replace(/x="\d+"(\s+y="0")/, `x="${i * STEP}"$1`));

const newWidth = kept.length * STEP - GAP;
const body = reindexed.join("\n");

const newSvg = `<svg width="${newWidth}" height="115" viewBox="0 0 ${newWidth} 115" fill="none" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>\n`;

fs.writeFileSync(FILE, newSvg);
console.log(`Kept ${kept.length} trophies: ${kept.map(getTitle).join(", ")}`);
console.log(`New width: ${newWidth}`);
