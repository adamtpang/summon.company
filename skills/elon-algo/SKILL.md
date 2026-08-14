---
name: elon-algo
description: >
  Runs Elon Musk's five-step Algorithm (Question Requirements, Delete,
  Simplify, Accelerate, Automate) on any task, feature, process, or offer, in
  strict order. A deletion engine: finds what work should not exist before
  optimizing or automating it. The classic failure is skipping to step 3-5.
---

# /elon-algo — run The Algorithm on anything

Elon's five-step process from the SpaceX and Tesla production lines (source:
knowledge/books/the-book-of-elon.md in summon.company). It is a deletion
engine: most work should not exist, and this skill finds out which work that
is BEFORE any effort goes into doing it well. Steps run IN ORDER, never out
of order. The classic failure is starting at step 3, 4, or 5: optimizing,
speeding up, or automating a thing that should have been deleted at step 2.
"The most common error of a smart engineer is to optimize a thing that
should not exist."

Trigger on: `/elon-algo <target>`, "run the algorithm on X", "elon this",
"should this even exist", or any ask to pressure-test a task, feature,
process, requirement list, offer, backlog, or whole company.

## Input

A target: one task, a feature, a process, a requirements doc, a backlog, an
offer, a company. If the target is a list (a backlog), run the five steps on
each item, cheapest verdict first: most items die at step 1 or 2 and never
earn steps 3 to 5.

## The five steps (in order, no skipping)

### 1. QUESTION — make the requirements less dumb

Every requirement on the target gets two challenges:
- **Who is the person (a name, not a department) that owns this
  requirement?** "Marketing wants it" is not an owner. If no named person
  will defend it, it is not a requirement, it is a rumor. In Summon terms:
  a requirement must trace to a named agent, a paying customer, or Adam.
- **Is it dumb?** All requirements are somewhat dumb; the ones from smart
  people are the most dangerous because nobody questions them. State what
  breaks if the requirement is dropped. If the answer is "nothing traceable
  to revenue, time, or a paying customer," mark it dumb.
  (The battery-mat story: noise team thought the mat was for fire, fire team
  thought it was for noise. Nobody owned it. It was deleted.)

Verdict per requirement: KEEP (named owner + traceable consequence) or
DUMB (goes to step 2 as a deletion candidate).

### 2. DELETE — try very hard to delete the part or process

For everything that survived step 1, attempt deletion anyway:
- What happens if this does not exist at all? Say it concretely.
- The 10% rule: **if you are not adding back at least 10% of what you
  deleted, you did not delete enough.** A pass that deletes nothing is a
  failed pass, run it again harder.
- Deleting is reversible (git, drafts, archives). Keeping the wrong thing
  compounds forever. Bias hard toward delete.

Verdict: DELETED (with what to watch for so it can be added back) or
SURVIVES (with the one-line reason it must exist).

### 3. OPTIMIZE — simplify what survived

Only now, and only on survivors: remove parts, steps, fields, options,
states. Simplify the interface before the implementation. A part that is
not there cannot fail and costs nothing. NO optimizing anything that did
not pass steps 1 and 2.

### 4. ACCELERATE — speed up the cycle

Only on the simplified survivor: shorten the loop. Faster deploys, faster
feedback, faster invoicing, faster reply. Never accelerate a process that
should not exist; speeding up waste just makes waste faster.

### 5. AUTOMATE — last, never first

Only automate a loop that has been questioned, deletion-tested, simplified,
and accelerated BY HAND enough times to prove the repetition is real.
Automation is the reward for a proven manual rep, not a substitute for one.
This is the anti-token-maxxing rule: agents doing a dumb thing at scale is
step-5-first disease. Doing something well does not make it important.

## Output format

One table, then the residue:

| # | Item | Verdict | Why (one line) | Owner |

- **Deleted:** the list of what died, with the add-back watch condition.
- **Survivors:** the minimal version of the target, each line with a named
  owner.
- **The 10% check:** state whether enough was deleted. If nothing was
  deleted, say the pass failed and run it again with a harder bias.
- **Next physical action:** one move, for Adam or a named agent.

## Standing rules

- Steps run 1 → 2 → 3 → 4 → 5. Refuse an ask to "automate X" or "optimize
  X" until X has passed 1 and 2; run them first, then honor the ask on what
  survives.
- Plain words, no em dashes, no doctrine words without their plain meaning.
- Anti-fabrication: consequences and owners must be real and named, or
  marked [TBD: awaiting real data]. Never invent a defender for a
  requirement.
- Relationship to the Summon algorithm: Summon surfaces problems,
  prioritizes them, and routes the top S-tier task to the right department.
  /elon-algo is the blade each department runs ON that task before doing
  it: question it, try to delete it, and only then do it well.
