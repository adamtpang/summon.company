#!/usr/bin/env node
// vitals init: vendor the dashboard into a target repo.
// Usage: node bin/init.mjs [target-repo-path]   (defaults to current directory)
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, "..");
const target = resolve(process.argv[2] || ".");
const dest = join(target, "vitals");

mkdirSync(dest, { recursive: true });
for (const f of ["vitals.css", "vitals.core.js", "SKILL.md", "schema.md"]) {
  copyFileSync(join(lib, f), join(dest, f));
}
// The dashboard shell ships as index.html inside the vendored folder
// (the repo's own index.html is the vitals.run landing page).
copyFileSync(join(lib, "dashboard.html"), join(dest, "index.html"));

const dataDest = join(dest, "vitals.data.js");
if (!existsSync(dataDest)) {
  copyFileSync(join(lib, "vitals.data.example.js"), dataDest);
  console.log("Created vitals/vitals.data.js (starter).");
}

console.log("Vitals installed into " + dest);
console.log('Next: open an AI coding session in this repo and say "interview me",');
console.log("or edit vitals/vitals.data.js, then open vitals/index.html.");
