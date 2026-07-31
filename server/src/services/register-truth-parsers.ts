/**
 * Register parsers: turn a customer's findings document into structured rows.
 *
 * Markdown tables first, because that is what real registers look like
 * (regain-inc/miss uses one). Checkbox lists second.
 *
 * Design: doc/REGISTER-TRUTH-AGENT.md
 */

export interface ParsedFinding {
  /** The customer's own id, e.g. "P0-2". Never renumbered. */
  id: string;
  /** Verbatim claim text. */
  claim: string;
  /** Whatever the register says about status today (a column, a checkbox). */
  claimedStatus: string;
  /** Repo-relative file paths named in the row. */
  files: string[];
  /** Backticked identifiers named in the row, best-effort probe candidates. */
  symbols: string[];
  /** 1-indexed line in the register, so a diff can be anchored. */
  line: number;
}

const ID_PATTERN = /^\|\s*(P\d+-\d+|[A-Z]{1,4}-\d+)\s*\|/;
/** `path/to/file.ts:123` or a bare path with a code extension. */
const FILE_PATTERN = /([\w./-]+\.(?:ts|tsx|js|mjs|py|rb|go|rs|sql|po|json|md))(?::(\d+(?:-\d+)?))?/g;
const BACKTICK_PATTERN = /`([^`]+)`/g;

/** Split a markdown table row, tolerating escaped pipes inside code spans. */
function splitRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  for (const char of row) {
    if (char === "`") inCode = !inCode;
    if (char === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells.filter((cell, index) => !(index === 0 && cell === ""));
}

function extractFiles(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(FILE_PATTERN)) out.add(match[1]);
  return [...out];
}

function extractSymbols(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(BACKTICK_PATTERN)) {
    const raw = match[1].trim();
    // A path is already captured as a file; a symbol is the interesting part.
    if (/\.(ts|tsx|js|mjs|py|rb|go|rs|sql|po|json|md)(:\d+)?$/.test(raw)) continue;
    if (raw.length < 3 || raw.length > 80) continue;
    out.add(raw.replace(/\(\)$/, ""));
  }
  return [...out];
}

/**
 * Parse a markdown findings table. Returns every row whose first cell looks
 * like a finding id, which skips the header and separator without needing to
 * know the column layout, since registers differ between customers.
 */
export function parseMarkdownRegister(text: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, index) => {
    const idMatch = raw.match(ID_PATTERN);
    if (!idMatch) return;

    const cells = splitRow(raw);
    if (cells.length < 2) return;

    const id = cells[0];
    // The widest cell is the finding text in every register shape seen so far.
    const claim = cells.slice(1).reduce((a, b) => (b.length > a.length ? b : a), "");
    // A short trailing cell that carries a tick or a word like open/done is the status.
    const claimedStatus =
      [...cells].reverse().find((cell) => cell.length > 0 && cell.length <= 20) ?? "";

    findings.push({
      id,
      claim,
      claimedStatus,
      files: extractFiles(raw),
      symbols: extractSymbols(raw),
      line: index + 1,
    });
  });

  return findings;
}

/** Parse `- [ ] thing` / `- [x] thing` lists, the other common register shape. */
export function parseChecklistRegister(text: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, index) => {
    const match = raw.match(/^\s*[-*]\s*\[( |x|X)\]\s*(.+)$/);
    if (!match) return;
    const claim = match[2].trim();
    const idMatch = claim.match(/^([A-Z]{1,4}\d*-\d+)\b/);
    findings.push({
      id: idMatch ? idMatch[1] : `L${index + 1}`,
      claim,
      claimedStatus: match[1].trim() === "" ? "open" : "done",
      files: extractFiles(raw),
      symbols: extractSymbols(raw),
      line: index + 1,
    });
  });

  return findings;
}

/** Sniff the format, then parse. Table wins when both are present. */
export function parseRegister(text: string): ParsedFinding[] {
  const table = parseMarkdownRegister(text);
  if (table.length > 0) return table;
  return parseChecklistRegister(text);
}
