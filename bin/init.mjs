#!/usr/bin/env node
// company-os init: vendor the dashboard into a target repo.
// Usage: node bin/init.mjs [target-repo-path]   (defaults to current directory)
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, "..");
const target = resolve(process.argv[2] || ".");
const dest = join(target, "company-os");

mkdirSync(dest, { recursive: true });
for (const f of ["company-os.css", "company-os.core.js", "index.html", "SKILL.md", "schema.md"]) {
  copyFileSync(join(lib, f), join(dest, f));
}

const dataDest = join(dest, "company-os.data.js");
if (!existsSync(dataDest)) {
  copyFileSync(join(lib, "company-os.data.example.js"), dataDest);
  console.log("Created company-os/company-os.data.js (starter).");
}

console.log("Company OS installed into " + dest);
console.log('Next: open an AI coding session in this repo and say "interview me",');
console.log("or edit company-os/company-os.data.js, then open company-os/index.html.");
