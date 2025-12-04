#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function run(command, ...args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function resolveCommitRef() {
  // 1) Direct arg (works for: node scripts/back.mjs <commit> and npm run back -- <commit>)
  if (process.argv[2]) return process.argv[2];

  // 2) NPM without --: parse npm_config_argv.original (npm provides original CLI args)
  try {
    const raw = process.env.npm_config_argv;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const original = Array.isArray(parsed?.original) ? parsed.original : [];
    // Find token after the script name (e.g., ["run","back","<commit>"])
    const scriptIndex = original.indexOf(
      process.env.npm_lifecycle_event || "back"
    );
    if (scriptIndex !== -1 && original[scriptIndex + 1]) {
      return original[scriptIndex + 1];
    }
    // Fallback: last token that is not 'run'/'run-script'/'back'
    const fallback = original
      .filter(
        (t) =>
          ![
            "run",
            "run-script",
            process.env.npm_lifecycle_event || "back",
          ].includes(t)
      )
      .pop();
    return fallback;
  } catch {
    return undefined;
  }
}

const commitRef = resolveCommitRef();

if (!commitRef) {
  console.error(
    "Usage: npm run back <commit-ish>  (also works: npm run back -- <commit-ish>)"
  );
  process.exit(1);
}

try {
  console.log(`[rollback] Checking out commit: ${commitRef}`);
  run("git", "checkout", commitRef);

  console.log("[rollback] Switching back to main");
  run("git", "checkout", "main");

  console.log(`[rollback] Resetting main hard to: ${commitRef}`);
  run("git", "reset", "--hard", commitRef);

  console.log("[rollback] Force-pushing main to origin");
  run("git", "push", "origin", "main", "--force");

  console.log("[rollback] Done.");
} catch (error) {
  console.error("[rollback] Failed.", error?.message ?? error);
  process.exit(typeof error?.status === "number" ? error.status : 1);
}
