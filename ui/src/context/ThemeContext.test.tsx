// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { APP_THEME_STORAGE_KEY } from "../lib/app-branding";

const THEME_STORAGE_KEY = APP_THEME_STORAGE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("ThemeContext", () => {
  let container: HTMLDivElement;
  let observedTheme: "light" | "dark" | null = null;
  let setTheme: ((theme: "light" | "dark") => void) | null = null;
  let toggleTheme: (() => void) | null = null;

  function Probe() {
    const ctx = useTheme();
    observedTheme = ctx.theme;
    setTheme = ctx.setTheme;
    toggleTheme = ctx.toggleTheme;
    return null;
  }

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    observedTheme = null;
    setTheme = null;
    toggleTheme = null;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses the document theme without persisting until the user chooses", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    expect(observedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("persists after the user makes an explicit choice", () => {
    document.documentElement.classList.add("dark");

    const root = createRoot(container);
    act(() => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    act(() => {
      setTheme?.("light");
    });
    expect(observedTheme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => {
      toggleTheme?.();
    });
    expect(observedTheme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    act(() => {
      root.unmount();
    });
  });

  it("honors the pre-applied document theme when a stored choice already exists", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    const root = createRoot(container);
    act(() => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    expect(observedTheme).not.toBe("dark");

    act(() => {
      root.unmount();
    });
  });
});
