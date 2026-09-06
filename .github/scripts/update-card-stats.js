const https = require("https");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GH_TOKEN;
const USERNAME = "Ranjith-13";
const CREATED_YEAR = 2020;
const CARD_PATH = path.join(__dirname, "..", "..", "card.svg");

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
          "User-Agent": "card-stats-updater",
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

async function main() {
  const currentYear = new Date().getFullYear();
  let totalContrib = 0;
  let totalCommits = 0;

  for (let year = CREATED_YEAR; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    const query = `{
      user(login: "${USERNAME}") {
        contributionsCollection(from: "${from}", to: "${to}") {
          contributionCalendar { totalContributions }
          totalCommitContributions
        }
      }
    }`;
    const result = await graphql(query);
    if (result.errors) {
      throw new Error(`GraphQL error for year ${year}: ${JSON.stringify(result.errors)}`);
    }
    const cc = result.data.user.contributionsCollection;
    totalContrib += cc.contributionCalendar.totalContributions;
    totalCommits += cc.totalCommitContributions;
  }

  const repoQuery = `{
    user(login: "${USERNAME}") {
      repositories(privacy: PUBLIC) { totalCount }
    }
  }`;
  const repoResult = await graphql(repoQuery);
  if (repoResult.errors) {
    throw new Error(`GraphQL error for repos: ${JSON.stringify(repoResult.errors)}`);
  }
  const totalRepos = repoResult.data.user.repositories.totalCount;

  console.log(`Contributions: ${totalContrib}, Commits: ${totalCommits}, Repos: ${totalRepos}`);

  let svg = fs.readFileSync(CARD_PATH, "utf8");
  svg = svg.replace(/(<text id="stat-contrib"[^>]*>)\d+(<\/text>)/, `$1${totalContrib}$2`);
  svg = svg.replace(/(<text id="stat-commits"[^>]*>)\d+(<\/text>)/, `$1${totalCommits}$2`);
  svg = svg.replace(/(<text id="stat-repos"[^>]*>)\d+(<\/text>)/, `$1${totalRepos}$2`);
  fs.writeFileSync(CARD_PATH, svg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
