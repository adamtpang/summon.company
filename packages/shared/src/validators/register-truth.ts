import { z } from "zod";

/**
 * Validation for register-truth routes. Probes reach `new RegExp` and
 * `git show <ref>:<path>`, so every field is shape- and size-bounded here
 * rather than trusted from the body.
 */
export const registerTruthProbeSchema = z
  .object({
    file: z.string().min(1).max(500),
    needle: z.string().min(1).max(500).optional(),
    pattern: z.string().min(1).max(500).optional(),
    anchor: z
      .object({ start: z.string().min(1).max(500), end: z.string().min(1).max(500).optional() })
      .optional(),
    blockContext: z.string().min(1).max(500).optional(),
    goal: z.enum(["increase", "decrease"]).optional(),
  })
  .strict();

export const registerTruthRunSchema = z
  .object({
    repoDir: z.string().min(1).max(1000),
    repo: z.string().min(1).max(300),
    registerPath: z.string().min(1).max(1000),
    probes: z.record(z.string().max(60), z.array(registerTruthProbeSchema).max(20)).optional(),
  })
  .strict();

export type RegisterTruthRunPayload = z.infer<typeof registerTruthRunSchema>;
