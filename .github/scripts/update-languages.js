const https = require("https");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GH_TOKEN;
const USERNAME = "Ranjith-13";
const OUT_PATH = path.join(__dirname, "..", "..", "languages.svg");
const TOP_N = 6;

function graphql(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const req = https.request(
      {
        hostname: "api.github.com",
        path: "/graphql",
        method: "POST",
        headers: {
          Authorization: `bearer ${TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "languages-updater",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(languages, totalBytes) {
  const width = 320;
  const rowHeight = 22;
  const headerHeight = 34;
  const barHeight = 10;
  const barGap = 14;
  const height = headerHeight + barHeight + barGap + languages.length * rowHeight + 10;

  let x = 0;
  const barSegments = languages
    .map((l) => {
      const w = (l.pct / 100) * (width - 32);
      const seg = `<rect x="${(16 + x).toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="${l.color}"/>`;
      x += w;
      return seg;
    })
    .join("\n      ");

  const rowsSvg = languages
    .map((l, i) => {
      const y = i * rowHeight;
      return `<g transform="translate(16,${y})">
        <circle cx="6" cy="6" r="5" fill="${l.color}"/>
        <text x="18" y="10" font-size="12" fill="#e6edf3">${escapeXml(l.name)}</text>
        <text x="${width - 32}" y="10" font-size="12" fill="#8b949e" text-anchor="end">${l.pct.toFixed(1)}%</text>
      </g>`;
    })
    .join("\n      ");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="6" fill="#161b22" stroke="#30363d" stroke-width="1"/>
  <text x="16" y="22" font-family="Consolas,'Courier New',monospace" font-size="14" font-weight="bold" fill="#e6edf3">Most Used Languages</text>
  <g transform="translate(0,${headerHeight})">
    <rect x="16" y="0" width="${width - 32}" height="${barHeight}" rx="5" fill="#0d1117"/>
    <clipPath id="barClip"><rect x="16" y="0" width="${width - 32}" height="${barHeight}" rx="5"/></clipPath>
    <g clip-path="url(#barClip)">
      ${barSegments}
    </g>
  </g>
  <g transform="translate(0,${headerHeight + barHeight + barGap})" font-family="Consolas,'Courier New',monospace">
    ${rowsSvg}
  </g>
</svg>
`;
}

async function main() {
  const query = `{
    user(login: "${USERNAME}") {
      repositories(privacy: PUBLIC, isFork: false, first: 100, ownerAffiliation: OWNER) {
        nodes {
          name
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node { name color }
            }
          }
        }
      }
    }
  }`;

  const result = await graphql(query);
  if (result.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  const totals = new Map();
  for (const repo of result.data.user.repositories.nodes) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      const color = edge.node.color || "#8b949e";
      const existing = totals.get(name) || { size: 0, color };
      existing.size += edge.size;
      totals.set(name, existing);
    }
  }

  const totalBytes = [...totals.values()].reduce((sum, v) => sum + v.size, 0);

  const sorted = [...totals.entries()]
    .map(([name, v]) => ({ name, color: v.color, bytes: v.size, pct: (v.size / totalBytes) * 100 }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, TOP_N);

  console.log(sorted.map((l) => `${l.name}: ${l.pct.toFixed(1)}%`).join(", "));

  const svg = buildSvg(sorted, totalBytes);
  fs.writeFileSync(OUT_PATH, svg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
