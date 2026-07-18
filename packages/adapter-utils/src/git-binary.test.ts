import { afterEach, describe, expect, it } from "vitest";
import { resolveGitBinary, resetGitBinaryCacheForTests } from "./git-binary.js";

describe("resolveGitBinary", () => {
  afterEach(() => resetGitBinaryCacheForTests());

  it("returns the bare name off Windows and memoizes", () => {
    resetGitBinaryCacheForTests();
    if (process.platform !== "win32") {
      expect(resolveGitBinary()).toBe("git");
      expect(resolveGitBinary()).toBe("git");
      return;
    }
    // On Windows the resolved binary must be an absolute .exe path when Git
    // for Windows is installed (bare "git" throws spawn ENOENT under Node's
    // hardened Windows resolution), else the bare-name fallback.
    const resolved = resolveGitBinary();
    expect(resolved === "git" || /git\.exe$/i.test(resolved)).toBe(true);
  });

  it("falls back to the bare name when no candidate path exists (win32 shape)", () => {
    resetGitBinaryCacheForTests();
    if (process.platform !== "win32") return;
    const resolved = resolveGitBinary({
      ProgramFiles: "C:\\definitely\\missing",
      "ProgramFiles(x86)": "C:\\also\\missing",
      LOCALAPPDATA: "C:\\still\\missing",
    });
    expect(resolved).toBe("git");
  });
});
