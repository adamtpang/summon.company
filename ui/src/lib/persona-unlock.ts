import type { Persona, PersonaUnlockStage } from "./personas";

/** Sequence numbers for roadmap stages — kept here so lib never imports the Roadmap page. */
export const PERSONA_UNLOCK_STAGE_SEQUENCE: Record<PersonaUnlockStage, number> = {
  initial_idea: 1,
  found_it: 2,
  identity: 3,
  build: 4,
  distribute: 5,
  launch: 6,
  operate_close: 7,
  scale: 8,
};

export const PERSONA_UNLOCK_STAGE_LABEL: Record<PersonaUnlockStage, string> = {
  initial_idea: "Initial idea",
  found_it: "Found it",
  identity: "Identity",
  build: "Build",
  distribute: "Distribute",
  launch: "Launch",
  operate_close: "Operate and close",
  scale: "Scale",
};

/**
 * Highest completed roadmap stage sequence for unlock checks.
 * `progress` is 0–100 from buildRoadmapStages; 100 = stage complete.
 */
export function reachedRoadmapSequence(
  stages: ReadonlyArray<{ stage: { id: string; sequence: number }; progress: number }>,
): number {
  let reached = 0;
  for (const entry of stages) {
    if (entry.progress >= 100 && entry.stage.sequence > reached) {
      reached = entry.stage.sequence;
    }
  }
  return reached;
}

export function isPersonaUnlocked(persona: Persona, reachedSequence: number): boolean {
  if (!persona.unlocksAtStage) return true;
  return PERSONA_UNLOCK_STAGE_SEQUENCE[persona.unlocksAtStage] <= reachedSequence;
}

export function personaUnlockLabel(persona: Persona): string | null {
  if (!persona.unlocksAtStage) return null;
  return PERSONA_UNLOCK_STAGE_LABEL[persona.unlocksAtStage];
}
