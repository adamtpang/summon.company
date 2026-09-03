import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers } from "@paperclipai/db";
import {
  accountExitConfirmationSchema,
  accountLifecycleSchema,
  authSessionSchema,
  currentUserProfileSchema,
  updateCurrentUserProfileSchema,
} from "@paperclipai/shared";
import { conflict, unauthorized } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { accountLifecycleService } from "../services/account-lifecycle.js";

async function loadCurrentUserProfile(db: Db, userId: string) {
  const user = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      name: authUsers.name,
      image: authUsers.image,
      accountState: authUsers.accountState,
      deactivatedAt: authUsers.deactivatedAt,
      deletedAt: authUsers.deletedAt,
    })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .then((rows) => rows[0] ?? null);

  if (!user) {
    throw unauthorized("Signed-in user not found");
  }

  return currentUserProfileSchema.parse({
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    accountState: user.accountState,
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    deletedAt: user.deletedAt?.toISOString() ?? null,
  });
}

function requireSessionActor(req: Express.Request) {
  if (
    req.actor.type !== "board" ||
    req.actor.source !== "session" ||
    !req.actor.userId ||
    !req.actor.sessionId
  ) {
    throw unauthorized("A signed-in browser session is required");
  }
  return { userId: req.actor.userId, sessionId: req.actor.sessionId };
}

export function authRoutes(db: Db) {
  const router = Router();
  const lifecycle = accountLifecycleService(db);

  router.get("/get-session", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized("Board authentication required");
    }

    const user = await loadCurrentUserProfile(db, req.actor.userId);
    res.json(authSessionSchema.parse({
      session: {
        id: req.actor.sessionId ?? `paperclip:${req.actor.source ?? "none"}:${req.actor.userId}`,
        userId: req.actor.userId,
      },
      user,
    }));
  });

  router.get("/profile", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized("Board authentication required");
    }

    res.json(await loadCurrentUserProfile(db, req.actor.userId));
  });

  router.patch("/profile", validate(updateCurrentUserProfileSchema), async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized("Board authentication required");
    }
    if (req.actor.accountState && req.actor.accountState !== "active") {
      throw conflict("Reactivate your account before changing your profile");
    }

    const patch = updateCurrentUserProfileSchema.parse(req.body);
    const now = new Date();

    const updated = await db
      .update(authUsers)
      .set({
        name: patch.name,
        ...(patch.image !== undefined ? { image: patch.image } : {}),
        updatedAt: now,
      })
      .where(eq(authUsers.id, req.actor.userId))
      .returning({
        id: authUsers.id,
        email: authUsers.email,
        name: authUsers.name,
        image: authUsers.image,
        accountState: authUsers.accountState,
        deactivatedAt: authUsers.deactivatedAt,
        deletedAt: authUsers.deletedAt,
      })
      .then((rows) => rows[0] ?? null);

    if (!updated) {
      throw unauthorized("Signed-in user not found");
    }

    res.json(currentUserProfileSchema.parse({
      id: updated.id,
      email: updated.email ?? null,
      name: updated.name ?? null,
      image: updated.image ?? null,
      accountState: updated.accountState,
      deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
    }));
  });

  router.get("/account/lifecycle", async (req, res) => {
    const actor = requireSessionActor(req);
    res.json(accountLifecycleSchema.parse(await lifecycle.getLifecycle(actor.userId)));
  });

  router.get("/account/export", async (req, res) => {
    const actor = requireSessionActor(req);
    const exported = await lifecycle.exportAccount(actor.userId);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="summon-account-${date}.json"`);
    res.send(`${JSON.stringify(exported, null, 2)}\n`);
  });

  router.post("/account/deactivate", validate(accountExitConfirmationSchema), async (req, res) => {
    const actor = requireSessionActor(req);
    const input = accountExitConfirmationSchema.parse(req.body);
    res.json(accountLifecycleSchema.parse(await lifecycle.deactivate(actor.userId, actor.sessionId, input)));
  });

  router.post("/account/reactivate", async (req, res) => {
    const actor = requireSessionActor(req);
    res.json(accountLifecycleSchema.parse(await lifecycle.reactivate(actor.userId)));
  });

  router.delete("/account", validate(accountExitConfirmationSchema), async (req, res) => {
    const actor = requireSessionActor(req);
    const input = accountExitConfirmationSchema.parse(req.body);
    res.json(await lifecycle.permanentlyDelete(actor.userId, actor.sessionId, input));
  });

  return router;
}
