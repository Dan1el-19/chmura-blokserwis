#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function run(command, ...args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function resolveCommitArg() {
  // 1) Direct arg (node scripts/hist.mjs <commit> and npm run hist -- <commit>)
  if (process.argv[2]) return process.argv[2];

  // 2) NPM without --: parse npm_config_argv
  try {
    const raw = process.env.npm_config_argv;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const original = Array.isArray(parsed?.original) ? parsed.original : [];
    const script = process.env.npm_lifecycle_event || "hist";
    const scriptIndex = original.indexOf(script);
    if (scriptIndex !== -1 && original[scriptIndex + 1]) {
      return original[scriptIndex + 1];
    }
    // fallback: last token not equal to common tokens
    const fallback = original
      .filter((t) => !["run", "run-script", script].includes(t))
      .pop();
    return fallback;
  } catch {
    return undefined;
  }
}

const commitRef = resolveCommitArg();

if (!commitRef) {
  console.error(
    "Usage: npm run hist <commit-ish>  (also works: npm run hist -- <commit-ish>)"
  );
  process.exit(1);
}

try {
  console.log("[hist] Ensuring we are on main branch");
  run("git", "checkout", "main");

  console.log(`[hist] Resetting main soft to: ${commitRef}`);
  run("git", "reset", "--soft", commitRef);

  console.log("[hist] Pushing main with --force-with-lease");
  run("git", "push", "origin", "main", "--force-with-lease");

  console.log("[hist] Done.");
} catch (error) {
  console.error("[hist] Failed.", error?.message ?? error);
  process.exit(typeof error?.status === "number" ? error.status : 1);
}
