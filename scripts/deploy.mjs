import { execFileSync } from "node:child_process";

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status) {
  throw new Error("Deployment requires a clean worktree so the public commit identity is exact.");
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const catalogShop = "agentic-app-review-test.myshopify.com";

run("npx", ["wrangler", "deploy", "--config", "wrangler.origin.jsonc"]);
run("npx", [
  "wrangler",
  "deploy",
  "--var",
  `CATALOG_SHOP:${catalogShop}`,
  "--var",
  `APP_COMMIT:${commit}`,
]);
run(process.execPath, ["scripts/verify-live.mjs"]);
