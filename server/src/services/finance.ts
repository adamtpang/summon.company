import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, costEvents, financeEvents, goals, heartbeatRuns, issues, projects } from "@paperclipai/db";
import type {
  FinanceStatementImportResult,
  ImportFinanceStatement,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export interface FinanceDateRange {
  from?: Date;
  to?: Date;
}

const MAX_STATEMENT_ROWS = 1_000;
const MAX_STATEMENT_CSV_BYTES = 2_000_000;
const MAX_STATEMENT_AMOUNT_CENTS = 2_147_483_647;
const statementImportTails = new Map<string, Promise<void>>();

interface ParsedStatementRow {
  occurredAt: Date;
  occurredOn: string;
  biller: string;
  description: string | null;
  direction: "debit" | "credit";
  amountCents: number;
  transactionId: string | null;
  lineNumber: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function statementError(message: string): never {
  throw unprocessable(`Statement import failed: ${message}`);
}

async function withStatementImportLock<T>(companyId: string, work: () => Promise<T>): Promise<T> {
  const previous = statementImportTails.get(companyId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  statementImportTails.set(companyId, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (statementImportTails.get(companyId) === tail) statementImportTails.delete(companyId);
  }
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"') {
        if (value[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) statementError("the CSV has an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseMoneyCents(value: string, lineNumber: number, column: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^\$/, "").replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    statementError(`line ${lineNumber} has an invalid ${column} amount`);
  }
  const [whole, fractional = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_STATEMENT_AMOUNT_CENTS) {
    statementError(`line ${lineNumber} has an out-of-range ${column} amount`);
  }
  return cents;
}

function parseStatementDate(value: string, lineNumber: number): { occurredAt: Date; occurredOn: string } {
  const occurredOn = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    statementError(`line ${lineNumber} must use an ISO date (YYYY-MM-DD)`);
  }
  const occurredAt = new Date(`${occurredOn}T12:00:00.000Z`);
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString().slice(0, 10) !== occurredOn) {
    statementError(`line ${lineNumber} has an invalid date`);
  }
  return { occurredAt, occurredOn };
}

function parseFinanceStatement(csv: string): ParsedStatementRow[] {
  const rawRows = parseCsv(csv);
  const headerIndex = rawRows.findIndex((row) => row.some((value) => value.trim().length > 0));
  if (headerIndex < 0) statementError("the CSV is empty");
  const headers = rawRows[headerIndex].map(normalizeHeader);
  const indexes = new Map<string, number>();
  headers.forEach((header, index) => {
    if (!header) return;
    if (indexes.has(header)) statementError(`the CSV repeats the ${header} column`);
    indexes.set(header, index);
  });

  const dateIndex = indexes.get("date");
  const vendorIndex = indexes.get("vendor");
  const descriptionIndex = indexes.get("description");
  const amountIndex = indexes.get("amount");
  const directionIndex = indexes.get("direction");
  const debitIndex = indexes.get("debit");
  const creditIndex = indexes.get("credit");
  const currencyIndex = indexes.get("currency");
  const transactionIdIndex = indexes.get("transaction_id");
  if (dateIndex === undefined) statementError("the CSV needs a date column");
  if (vendorIndex === undefined && descriptionIndex === undefined) {
    statementError("the CSV needs a vendor or description column");
  }
  const usesAmountDirection = amountIndex !== undefined || directionIndex !== undefined;
  if (usesAmountDirection && (amountIndex === undefined || directionIndex === undefined)) {
    statementError("amount and direction columns must be used together");
  }
  if (!usesAmountDirection && debitIndex === undefined && creditIndex === undefined) {
    statementError("the CSV needs amount + direction, or debit and credit columns");
  }

  const parsed: ParsedStatementRow[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rawRows.length; rowIndex += 1) {
    const row = rawRows[rowIndex];
    if (!row.some((value) => value.trim().length > 0)) continue;
    const lineNumber = rowIndex + 1;
    const valueAt = (index: number | undefined) => index === undefined ? "" : (row[index] ?? "");
    const currency = (valueAt(currencyIndex).trim() || "USD").toUpperCase();
    if (currency !== "USD") statementError(`line ${lineNumber} is ${currency}; only USD statements are accepted`);

    const { occurredAt, occurredOn } = parseStatementDate(valueAt(dateIndex), lineNumber);
    const vendor = valueAt(vendorIndex).trim();
    const descriptionValue = valueAt(descriptionIndex).trim();
    const biller = (vendor || descriptionValue).slice(0, 200);
    if (!biller) statementError(`line ${lineNumber} needs a vendor or description`);
    if ((vendor || descriptionValue).length > 200) statementError(`line ${lineNumber} vendor is too long`);
    if (descriptionValue.length > 500) statementError(`line ${lineNumber} description is too long`);

    let direction: "debit" | "credit";
    let amountCents: number;
    if (usesAmountDirection) {
      const directionValue = valueAt(directionIndex).trim().toLowerCase();
      if (directionValue !== "debit" && directionValue !== "credit") {
        statementError(`line ${lineNumber} direction must be debit or credit`);
      }
      direction = directionValue;
      amountCents = parseMoneyCents(valueAt(amountIndex), lineNumber, "amount") ?? statementError(`line ${lineNumber} needs an amount`);
    } else {
      const debitCents = parseMoneyCents(valueAt(debitIndex), lineNumber, "debit");
      const creditCents = parseMoneyCents(valueAt(creditIndex), lineNumber, "credit");
      if ((debitCents === null) === (creditCents === null)) {
        statementError(`line ${lineNumber} must have exactly one debit or credit amount`);
      }
      direction = debitCents !== null ? "debit" : "credit";
      amountCents = debitCents ?? creditCents!;
    }

    const transactionId = valueAt(transactionIdIndex).trim() || null;
    if (transactionId && transactionId.length > 240) statementError(`line ${lineNumber} transaction_id is too long`);
    parsed.push({
      occurredAt,
      occurredOn,
      biller,
      description: descriptionValue || null,
      direction,
      amountCents,
      transactionId,
      lineNumber,
    });
    if (parsed.length > MAX_STATEMENT_ROWS) statementError(`the CSV exceeds ${MAX_STATEMENT_ROWS} transaction rows`);
  }
  if (parsed.length === 0) statementError("the CSV has no transaction rows");
  return parsed;
}

async function assertBelongsToCompany(
  db: Db,
  table: any,
  id: string,
  companyId: string,
  label: string,
) {
  const row = await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .then((rows) => rows[0] ?? null);

  if (!row) throw notFound(`${label} not found`);
  if ((row as unknown as { companyId: string }).companyId !== companyId) {
    throw unprocessable(`${label} does not belong to company`);
  }
}

function rangeConditions(companyId: string, range?: FinanceDateRange) {
  const conditions: ReturnType<typeof eq>[] = [eq(financeEvents.companyId, companyId)];
  if (range?.from) conditions.push(gte(financeEvents.occurredAt, range.from));
  if (range?.to) conditions.push(lte(financeEvents.occurredAt, range.to));
  return conditions;
}

export function financeService(db: Db) {
  const debitExpr = sql<number>`coalesce(sum(case when ${financeEvents.direction} = 'debit' then ${financeEvents.amountCents} else 0 end), 0)::double precision`;
  const creditExpr = sql<number>`coalesce(sum(case when ${financeEvents.direction} = 'credit' then ${financeEvents.amountCents} else 0 end), 0)::double precision`;
  const estimatedDebitExpr = sql<number>`coalesce(sum(case when ${financeEvents.direction} = 'debit' and ${financeEvents.estimated} = true then ${financeEvents.amountCents} else 0 end), 0)::double precision`;

  return {
    createEvent: async (companyId: string, data: Omit<typeof financeEvents.$inferInsert, "companyId">) => {
      if (data.agentId) await assertBelongsToCompany(db, agents, data.agentId, companyId, "Agent");
      if (data.issueId) await assertBelongsToCompany(db, issues, data.issueId, companyId, "Issue");
      if (data.projectId) await assertBelongsToCompany(db, projects, data.projectId, companyId, "Project");
      if (data.goalId) await assertBelongsToCompany(db, goals, data.goalId, companyId, "Goal");
      if (data.heartbeatRunId) await assertBelongsToCompany(db, heartbeatRuns, data.heartbeatRunId, companyId, "Heartbeat run");
      if (data.costEventId) await assertBelongsToCompany(db, costEvents, data.costEventId, companyId, "Cost event");

      const event = await db
        .insert(financeEvents)
        .values({
          ...data,
          companyId,
          currency: data.currency ?? "USD",
          direction: data.direction ?? "debit",
          estimated: data.estimated ?? false,
        })
        .returning()
        .then((rows) => rows[0]);

      return event;
    },

    importStatement: async (
      companyId: string,
      input: ImportFinanceStatement,
    ): Promise<FinanceStatementImportResult> => {
      if (Buffer.byteLength(input.csv, "utf8") > MAX_STATEMENT_CSV_BYTES) {
        statementError("the CSV exceeds 2 MB");
      }
      const rows = parseFinanceStatement(input.csv);
      const statementHash = sha256(input.csv);
      const normalizedAccountLabel = input.accountLabel.trim().toLowerCase().replace(/\s+/g, " ");
      const accountFingerprint = sha256(`${companyId}|${input.sourceKind}|${normalizedAccountLabel}`);
      const duplicateTransactionIds = new Map<string, string>();
      const compositeOccurrences = new Map<string, number>();
      let duplicateRowsInsideStatement = 0;

      const candidates = rows.flatMap((row) => {
        const normalizedBiller = row.biller.toLowerCase().replace(/\s+/g, " ");
        const normalizedDescription = (row.description ?? "").toLowerCase().replace(/\s+/g, " ");
        const rowSignature = [
          row.occurredOn,
          row.direction,
          String(row.amountCents),
          normalizedBiller,
          normalizedDescription,
        ].join("|");
        let identity: string;
        let fingerprintMethod: "transaction_id" | "composite_row";
        if (row.transactionId) {
          identity = `id|${row.transactionId}`;
          fingerprintMethod = "transaction_id";
          const earlierSignature = duplicateTransactionIds.get(identity);
          if (earlierSignature && earlierSignature !== rowSignature) {
            statementError(`transaction_id ${row.transactionId} identifies conflicting rows`);
          }
          if (earlierSignature) {
            duplicateRowsInsideStatement += 1;
            return [];
          }
          duplicateTransactionIds.set(identity, rowSignature);
        } else {
          const compositeBase = `row|${rowSignature}`;
          const occurrence = (compositeOccurrences.get(compositeBase) ?? 0) + 1;
          compositeOccurrences.set(compositeBase, occurrence);
          identity = `${compositeBase}|occurrence:${occurrence}`;
          fingerprintMethod = "composite_row";
        }
        const transactionFingerprint = sha256(`${accountFingerprint}|${identity}`);
        const externalInvoiceId = `statement:${transactionFingerprint}`;
        return [{
          companyId,
          description: row.description,
          eventKind: "operating_expense",
          direction: row.direction,
          biller: row.biller,
          provider: input.sourceKind === "bank_csv" ? "bank_statement_csv" : "accounting_export_csv",
          amountCents: row.amountCents,
          currency: "USD",
          estimated: false,
          externalInvoiceId,
          metadataJson: {
            source: "statement_import",
            sourceKind: input.sourceKind,
            statementHash,
            accountFingerprint,
            transactionFingerprint,
            fingerprintMethod,
            sourceLine: row.lineNumber,
          },
          occurredAt: row.occurredAt,
          fingerprintMethod,
        }];
      });

      return withStatementImportLock(companyId, () => db.transaction(async (tx) => {
        const externalIds = candidates.map((candidate) => candidate.externalInvoiceId);
        const existing = externalIds.length === 0
          ? []
          : await tx
            .select({ externalInvoiceId: financeEvents.externalInvoiceId })
            .from(financeEvents)
            .where(and(
              eq(financeEvents.companyId, companyId),
              inArray(financeEvents.externalInvoiceId, externalIds),
            ));
        const existingIds = new Set(existing.flatMap((row) => row.externalInvoiceId ? [row.externalInvoiceId] : []));
        const pending = candidates.filter((candidate) => !existingIds.has(candidate.externalInvoiceId));
        if (pending.length > 0) {
          await tx.insert(financeEvents).values(pending.map(({ fingerprintMethod: _, ...event }) => event));
        }

        const importedDebitCents = pending
          .filter((row) => row.direction === "debit")
          .reduce((total, row) => total + row.amountCents, 0);
        const importedCreditCents = pending
          .filter((row) => row.direction === "credit")
          .reduce((total, row) => total + row.amountCents, 0);
        const occurredDates = rows.map((row) => row.occurredOn).sort();
        return {
          sourceKind: input.sourceKind,
          statementHash,
          importedCount: pending.length,
          skippedDuplicateCount: duplicateRowsInsideStatement + existingIds.size,
          debitCents: importedDebitCents,
          creditCents: importedCreditCents,
          periodStart: occurredDates[0],
          periodEnd: occurredDates[occurredDates.length - 1],
          transactionIdCount: candidates.filter((row) => row.fingerprintMethod === "transaction_id").length,
          compositeFingerprintCount: candidates.filter((row) => row.fingerprintMethod === "composite_row").length,
        };
      }));
    },

    summary: async (companyId: string, range?: FinanceDateRange) => {
      const conditions = rangeConditions(companyId, range);
      const [row] = await db
        .select({
          debitCents: debitExpr,
          creditCents: creditExpr,
          estimatedDebitCents: estimatedDebitExpr,
          eventCount: sql<number>`count(*)::int`,
        })
        .from(financeEvents)
        .where(and(...conditions));

      return {
        companyId,
        debitCents: Number(row?.debitCents ?? 0),
        creditCents: Number(row?.creditCents ?? 0),
        netCents: Number(row?.debitCents ?? 0) - Number(row?.creditCents ?? 0),
        estimatedDebitCents: Number(row?.estimatedDebitCents ?? 0),
        eventCount: Number(row?.eventCount ?? 0),
      };
    },

    byBiller: async (companyId: string, range?: FinanceDateRange) => {
      const conditions = rangeConditions(companyId, range);
      return db
        .select({
          biller: financeEvents.biller,
          debitCents: debitExpr,
          creditCents: creditExpr,
          estimatedDebitCents: estimatedDebitExpr,
          eventCount: sql<number>`count(*)::int`,
          kindCount: sql<number>`count(distinct ${financeEvents.eventKind})::int`,
          netCents: sql<number>`(${debitExpr} - ${creditExpr})::double precision`,
        })
        .from(financeEvents)
        .where(and(...conditions))
        .groupBy(financeEvents.biller)
        .orderBy(desc(sql`(${debitExpr} - ${creditExpr})::double precision`), financeEvents.biller);
    },

    byKind: async (companyId: string, range?: FinanceDateRange) => {
      const conditions = rangeConditions(companyId, range);
      return db
        .select({
          eventKind: financeEvents.eventKind,
          debitCents: debitExpr,
          creditCents: creditExpr,
          estimatedDebitCents: estimatedDebitExpr,
          eventCount: sql<number>`count(*)::int`,
          billerCount: sql<number>`count(distinct ${financeEvents.biller})::int`,
          netCents: sql<number>`(${debitExpr} - ${creditExpr})::double precision`,
        })
        .from(financeEvents)
        .where(and(...conditions))
        .groupBy(financeEvents.eventKind)
        .orderBy(desc(sql`(${debitExpr} - ${creditExpr})::double precision`), financeEvents.eventKind);
    },

    list: async (companyId: string, range?: FinanceDateRange, limit: number = 100) => {
      const conditions = rangeConditions(companyId, range);
      return db
        .select()
        .from(financeEvents)
        .where(and(...conditions))
        .orderBy(desc(financeEvents.occurredAt), desc(financeEvents.createdAt))
        .limit(limit);
    },
  };
}
