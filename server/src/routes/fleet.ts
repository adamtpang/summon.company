import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { heartbeatService } from "../services/index.js";
import { assertBoard } from "./authz.js";

/**
 * The board kill switch (SUM-125 lineage). Two endpoints, board-only:
 *
 *   GET  /fleet/running       — everything live or queued, across every company
 *                               (or one, with ?companyId=). Feeds the RUNNING
 *                               NOW panel.
 *   POST /fleet/stop          — one sweep: pause agents first (blocks re-fires),
 *                               cancel the queued wake backlog, cancel active
 *                               runs. Body: { companyId?, reason? }.
 *
 * The old way took three manual sweeps because cancelling a run popped the
 * next queued wake. Pausing first makes one sweep final.
 */
export function fleetRoutes(db: Db) {
  const router = Router();
  const heartbeat = heartbeatService(db);

  router.get("/fleet/running", async (req, res) => {
    assertBoard(req);
    const companyId = typeof req.query.companyId === "string" && req.query.companyId.trim().length > 0
      ? req.query.companyId.trim()
      : null;
    const result = await heartbeat.fleetRunning({ companyId });
    res.json(result);
  });

  router.post("/fleet/stop", async (req, res) => {
    assertBoard(req);
    const body = (req.body ?? {}) as { companyId?: unknown; reason?: unknown };
    const companyId = typeof body.companyId === "string" && body.companyId.trim().length > 0
      ? body.companyId.trim()
      : null;
    const reason = typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : undefined;
    const result = await heartbeat.fleetStop({ companyId, reason });
    res.json(result);
  });

  return router;
}
