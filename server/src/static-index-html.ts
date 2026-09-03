import fs from "node:fs";
import path from "node:path";
import { applyUiBranding } from "./ui-branding.js";

export function readBrandedStaticIndexHtml(uiDist: string): string {
  return applyUiBranding(fs.readFileSync(path.join(uiDist, "index.html"), "utf-8"));
}

export function resolveStaticUiDist(serverSourceDir: string): string | null {
  const candidates = [
    path.resolve(serverSourceDir, "../../ui/dist"),
    path.resolve(serverSourceDir, "../ui-dist"),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) ?? null;
}
