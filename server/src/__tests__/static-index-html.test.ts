import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { readBrandedStaticIndexHtml, resolveStaticUiDist } from "../static-index-html.js";

describe("static SPA fallback HTML", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves the current index.html instead of reusing stale asset hashes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-static-index-"));
    tempDirs.push(tempDir);
    const indexPath = path.join(tempDir, "index.html");
    const app = express();
    app.get(/.*/, (_req, res) => {
      res
        .status(200)
        .set("Content-Type", "text/html")
        .set("Cache-Control", "no-cache")
        .end(readBrandedStaticIndexHtml(tempDir));
    });

    fs.writeFileSync(
      indexPath,
      '<html><body><script type="module" src="/assets/index-old.js"></script></body></html>',
      "utf8",
    );
    await expect(request(app).get("/PAP/issues/PAP-9939")).resolves.toMatchObject({
      text: expect.stringContaining("/assets/index-old.js"),
    });

    fs.writeFileSync(
      indexPath,
      '<html><body><script type="module" src="/assets/index-new.js"></script></body></html>',
      "utf8",
    );
    const res = await request(app).get("/PAP/issues/PAP-9939");
    expect(res.text).toContain("/assets/index-new.js");
    expect(res.text).not.toContain("/assets/index-old.js");
  });

  it("prefers a current workspace build over a stale packaged UI", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-static-layout-"));
    tempDirs.push(root);
    const serverSourceDir = path.join(root, "server", "src");
    const workspaceUi = path.join(root, "ui", "dist");
    const packagedUi = path.join(root, "server", "ui-dist");
    fs.mkdirSync(serverSourceDir, { recursive: true });
    fs.mkdirSync(workspaceUi, { recursive: true });
    fs.mkdirSync(packagedUi, { recursive: true });
    fs.writeFileSync(path.join(workspaceUi, "index.html"), "current", "utf8");
    fs.writeFileSync(path.join(packagedUi, "index.html"), "stale", "utf8");

    expect(resolveStaticUiDist(serverSourceDir)).toBe(workspaceUi);
    fs.rmSync(path.join(workspaceUi, "index.html"));
    expect(resolveStaticUiDist(serverSourceDir)).toBe(packagedUi);
  });
});
