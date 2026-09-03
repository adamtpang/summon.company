// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme, type ThemePreference } from "./ThemeContext";
import { APP_THEME_STORAGE_KEY } from "../lib/app-branding";

const THEME_STORAGE_KEY = APP_THEME_STORAGE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("ThemeContext", () => {
  let container: HTMLDivElement;
  let observedTheme: "light" | "dark" | null = null;
  let observedPreference: ThemePreference | null = null;
  let setTheme: ((theme: ThemePreference) => void) | null = null;
  let toggleTheme: (() => void) | null = null;

  function Probe() {
    const ctx = useTheme();
    observedTheme = ctx.theme;
    observedPreference = ctx.preference;
    setTheme = ctx.setTheme;
    toggleTheme = ctx.toggleTheme;
    return null;
  }

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    observedTheme = null;
    observedPreference = null;
    setTheme = null;
    toggleTheme = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
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
    expect(observedPreference).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("persists system preference and follows the device color scheme", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const root = createRoot(container);
    act(() => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    act(() => {
      setTheme?.("system");
    });

    expect(observedPreference).toBe("system");
    expect(observedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");

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
