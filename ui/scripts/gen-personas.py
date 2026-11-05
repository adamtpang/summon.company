"""Generate ui/src/lib/personas.ts — the persona-picker roster (SUM-196).

Core-8 department heads are extracted VERBATIM from company/<dept>/persona.json,
including their primary-sourced verified quote. Alternates are role-doctrine
characterizations only: no verbatim quote is shown until it is primary-sourced
(DESIGN.md honesty law — the persona system logs misattributions, so we never fake one).

v2 (board reshape): alternates unlock at roadmap stages; each card carries a
monochrome illustrated portrait motif (never a real photo).
"""
import json, io, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ORDER = ["operations", "support", "sales", "marketing", "engineering", "design", "legal", "finance"]
LABELS = {k: k.capitalize() for k in ORDER}

# Alternate unlock gates (roadmap stage ids from ui/src/pages/Roadmap.tsx).
# Defaults are always unlocked (unlocksAtStage=null). First alt -> identity; second -> build.
ALT_UNLOCK_STAGES = ("identity", "build")

# Illustrated portrait motifs — abstract monochrome marks, never photos.
MOTIFS = {
  "jeff-bezos": "day-one",
  "taiichi-ohno": "floor",
  "sheryl-sandberg": "scale-ops",
  "tony-hsieh": "wow",
  "horst-schulze": "service",
  "shep-hyken": "delight",
  "ryan-serhant": "follow-up",
  "brian-tracy": "close",
  "david-ogilvy": "craft",
  "seth-godin": "purple-cow",
  "gary-vaynerchuk": "jab",
  "elon-musk": "first-principles",
  "linus-torvalds": "kernel",
  "grace-hopper": "compiler",
  "dieter-rams": "less",
  "jony-ive": "resolve",
  "massimo-vignelli": "grid",
  "louis-brandeis": "sunlight",
  "ruth-bader-ginsburg": "dissent",
  "thurgood-marshall": "precedent",
  "john-d-rockefeller": "ledger",
  "warren-buffett": "compound",
  "charlie-munger": "lattice",
}


def load_base():
    out = []
    for dept in ORDER:
        d = json.load(io.open(os.path.join(ROOT, "company", dept, "persona.json"), encoding="utf-8"))
        h = d["heroArchetype"]
        ag = d["agent"]
        q = (h.get("verifiedQuotes") or [{}])[0]
        out.append({
            "department": dept,
            "agent": {"name": ag.get("name"), "role": ag.get("role")},
            "archetype": h["name"], "slug": h["slug"],
            "title": h.get("title"), "lifespan": h.get("lifespan"),
            "oneLiner": h["oneLiner"],
            "principles": [p if isinstance(p, str) else p.get("text") for p in h["principles"][:3]],
            "quote": {"text": q.get("quote"), "source": q.get("source")} if q.get("quote") else None,
        })
    return out


ALTS = {
 "operations": [
  ("Taiichi Ohno", "Architect of the Toyota Production System", "1912–1990",
   "The engineer who invented lean manufacturing and just-in-time production, hunting waste on the factory floor through relentless first-hand observation.",
   ["Eliminate every activity that does not add value (muda).", "Go and see for yourself (genchi genbutsu) — never manage from the desk.", "Ask why five times to reach the true root cause."]),
  ("Sheryl Sandberg", "Former COO of Meta", "b. 1969",
   "The operator who scaled Google's and Facebook's advertising engines and turned hyper-growth into durable operating discipline.",
   ["Done is better than perfect.", "Build the operating cadence that lets a rocket scale without breaking.", "Make room for hard truths in every review."]),
 ],
 "support": [
  ("Horst Schulze", "Co-founder of The Ritz-Carlton", "b. 1939",
   "The hotelier who codified world-class service into repeatable standards and empowered every employee to make it right.",
   ["We are ladies and gentlemen serving ladies and gentlemen.", "Empower the front line to solve the problem on the spot.", "Excellence is a standard you engineer, not a mood."]),
  ("Shep Hyken", "Customer service & experience expert", "b. 1959",
   "The CX author who turned amazement into a system, arguing that convenience and consistency are what actually earn loyalty.",
   ["Be amazing, then be amazing again — consistency is the whole game.", "Reduce friction; convenience beats charm.", "The best complaint is the one you designed out."]),
 ],
 "sales": [
  ("Ryan Serhant", "Broker & founder of SERHANT.", "b. 1984",
   "The record-breaking broker who built a personal-brand sales machine and proved follow-up and visibility beat raw talent.",
   ["Follow up until they buy or die.", "Your brand is the top of the funnel — build it in public.", "Volume negates luck; take more at-bats than anyone."]),
  ("Brian Tracy", "Sales trainer & author", "b. 1944",
   "The sales educator who systematized the psychology of selling into repeatable habits for prospecting, closing, and self-discipline.",
   ["Sell the result, not the product.", "The sale is made in the qualifying, not the closing.", "Discipline is prospecting when you do not feel like it."]),
 ],
 "marketing": [
  ("Seth Godin", "Author; marketing thinker", "b. 1960",
   "The marketer who reframed marketing as permission and remarkability — make something worth talking about for a specific tribe.",
   ["Make something remarkable — a Purple Cow, not more beige.", "Earn permission; interruption is a tax.", "Market to the smallest viable audience first."]),
  ("Gary Vaynerchuk", "Entrepreneur; founder of VaynerMedia", "b. 1975",
   "The operator who rode every attention platform early and preached giving relentless value before ever asking for the sale.",
   ["Jab, jab, jab, right hook — give value before you ask.", "Bet on where attention is going, not where it has been.", "Document, do not create — volume compounds."]),
 ],
 "engineering": [
  ("Linus Torvalds", "Creator of Linux and Git", "b. 1969",
   "The engineer who built the kernel that runs the internet and the version control that runs software, prizing working code and brutal honesty.",
   ["Working code wins every argument.", "Given enough eyeballs, all bugs are shallow.", "Good taste is knowing which special cases are not special."]),
  ("Grace Hopper", "Computer scientist; U.S. Navy Rear Admiral", "1906–1992",
   "The pioneer who invented the compiler and made programming human-readable, insisting the machine bend to the person, not the reverse.",
   ["Make the machine speak the human's language.", "The most dangerous phrase is 'we have always done it this way.'", "Ask forgiveness, not permission — ship, then prove it."]),
 ],
 "design": [
  ("Jony Ive", "Designer; former Chief Design Officer, Apple", "b. 1967",
   "The designer behind the iMac, iPod, and iPhone who pursued unreasonable care and made simplicity a feat of resolution, not reduction.",
   ["Simplicity is a consequence of understanding, not the absence of clutter.", "Care is respect for the person who will use the thing.", "Resolve every detail, especially the ones no one will notice."]),
  ("Massimo Vignelli", "Modernist graphic & industrial designer", "1931–2014",
   "The modernist behind the New York subway map who preached a disciplined life of typography, grids, and timeless form over fashion.",
   ["If you can design one thing, you can design everything.", "Discipline, appropriateness, and timelessness over novelty.", "The grid is the underwear of the design — unseen, essential."]),
 ],
 "legal": [
  ("Ruth Bader Ginsburg", "Associate Justice, U.S. Supreme Court", "1933–2020",
   "The jurist who argued equal-protection cases into landmark wins and modeled dissent as principled, precise, and durable.",
   ["Argue the narrow ground that moves the law one durable step.", "Precision persuades; overreach invites reversal.", "Disagree without being disagreeable."]),
  ("Thurgood Marshall", "Associate Justice, U.S. Supreme Court", "1908–1993",
   "The lawyer who won Brown v. Board and built civil-rights victories case by case before taking the bench.",
   ["Build the winning precedent one case at a time.", "Marshal the facts until the injustice is undeniable.", "The law is a tool for the powerless, or it is nothing."]),
 ],
 "finance": [
  ("Warren Buffett", "Chairman & CEO of Berkshire Hathaway", "b. 1930",
   "The value investor who compounded a failing textile mill into a trillion-dollar holding company by buying wonderful businesses and holding forever.",
   ["Buy wonderful businesses at fair prices, not fair businesses at wonderful prices.", "Be fearful when others are greedy, and greedy when others are fearful.", "Never invest in a business you cannot understand."]),
  ("Charlie Munger", "Vice Chairman of Berkshire Hathaway", "1924-2023",
   "The polymath partner who armed value investing with mental models, inversion, and the discipline to do nothing until the odds are overwhelming.",
   ["Invert, always invert - solve problems backward from failure.", "Assemble a latticework of mental models from every discipline.", "The big money is in the waiting, not the buying and selling."]),
 ],
}


def slugify(n):
    return (n.lower().replace(".", "").replace(",", "").strip().replace(" ", "-"))


def motif_for(slug):
    return MOTIFS.get(slug, "mark")


def build():
    base = load_base()
    personas = []
    for p in base:
        slug = p["slug"]
        personas.append({
            "slug": slug, "archetype": p["archetype"], "department": p["department"],
            "title": p["title"], "lifespan": p["lifespan"], "oneLiner": p["oneLiner"],
            "principles": p["principles"], "quote": p["quote"], "isDefault": True,
            "unlocksAtStage": None,
            "portraitMotif": motif_for(slug),
        })
        for i, (name, title, life, one, prin) in enumerate(ALTS.get(p["department"], [])):
            s = slugify(name)
            personas.append({
                "slug": s, "archetype": name, "department": p["department"],
                "title": title, "lifespan": life, "oneLiner": one,
                "principles": prin, "quote": None, "isDefault": False,
                "unlocksAtStage": ALT_UNLOCK_STAGES[min(i, len(ALT_UNLOCK_STAGES) - 1)],
                "portraitMotif": motif_for(s),
            })
    depts = [{"key": d, "label": LABELS[d],
              "agent": next(x["agent"] for x in base if x["department"] == d)} for d in ORDER]
    return personas, depts


def emit(personas, depts):
    L = []
    L.append("// AUTO-SEEDED persona roster for the persona picker (SUM-196).")
    L.append("// Core-8 = the shipped department heads, carrying their PRIMARY-SOURCED verified quote,")
    L.append("// extracted verbatim from company/<dept>/persona.json by ui/scripts/gen-personas.py.")
    L.append("// Alternates carry role-doctrine characterizations only — no verbatim quote is shown")
    L.append("// until it is primary-sourced (DESIGN.md honesty law; we never fake a quote).")
    L.append("// v2: unlocksAtStage gates alternates to roadmap stages; portraitMotif keys the")
    L.append("// illustrated monochrome portrait (never a real photo).")
    L.append("// Regenerate the core-8 block from persona.json; extend alternates in the script.")
    L.append("")
    L.append("export type DepartmentKey =")
    L.append("  | " + "\n  | ".join(json.dumps(d) for d in ORDER) + ";")
    L.append("")
    L.append("/** Roadmap stage ids that can gate a persona unlock (mirrors RoadmapStageId). */")
    L.append("export type PersonaUnlockStage =")
    L.append('  | "initial_idea"')
    L.append('  | "found_it"')
    L.append('  | "identity"')
    L.append('  | "build"')
    L.append('  | "distribute"')
    L.append('  | "launch"')
    L.append('  | "operate_close"')
    L.append('  | "scale";')
    L.append("")
    L.append("export interface PersonaQuote {\n  text: string;\n  source: string;\n}")
    L.append("")
    L.append("export interface Persona {")
    L.append("  /** Stable id, e.g. \"dieter-rams\". Stamped onto agent.metadata.persona. */")
    L.append("  slug: string;")
    L.append("  /** The person, e.g. \"Dieter Rams\". */")
    L.append("  archetype: string;")
    L.append("  department: DepartmentKey;")
    L.append("  /** Profession / tenure line for the card. */")
    L.append("  title: string;")
    L.append("  /** e.g. \"b. 1932\" or \"1924–2023\". */")
    L.append("  lifespan: string;")
    L.append("  oneLiner: string;")
    L.append("  /** 2–3 doctrinal principles shown on the card. */")
    L.append("  principles: string[];")
    L.append("  /** Only present when primary-sourced (core-8 heads). */")
    L.append("  quote: PersonaQuote | null;")
    L.append("  /** True for the shipped department head. */")
    L.append("  isDefault: boolean;")
    L.append("  /** null = always unlocked; otherwise unlocks when that roadmap stage is complete. */")
    L.append("  unlocksAtStage: PersonaUnlockStage | null;")
    L.append("  /** Key for the illustrated monochrome portrait mark (never a photo). */")
    L.append("  portraitMotif: string;")
    L.append("}")
    L.append("")
    L.append("export interface DepartmentSeat {")
    L.append("  key: DepartmentKey;")
    L.append("  label: string;")
    L.append("  /** The AI employee that holds this seat. */")
    L.append("  agent: { name: string; role: string };")
    L.append("}")
    L.append("")
    L.append("export const DEPARTMENTS: DepartmentSeat[] = " + json.dumps(depts, ensure_ascii=False, indent=2) + ";")
    L.append("")
    L.append("export const PERSONAS: Persona[] = " + json.dumps(personas, ensure_ascii=False, indent=2) + ";")
    L.append("")
    L.append("export function personasForDepartment(key: DepartmentKey): Persona[] {")
    L.append("  return PERSONAS.filter((p) => p.department === key);")
    L.append("}")
    L.append("")
    L.append("export function personaBySlug(slug: string): Persona | undefined {")
    L.append("  return PERSONAS.find((p) => p.slug === slug);")
    L.append("}")
    L.append("")
    L.append("export function defaultPersonaFor(key: DepartmentKey): Persona | undefined {")
    L.append("  return PERSONAS.find((p) => p.department === key && p.isDefault);")
    L.append("}")
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    personas, depts = build()
    out = os.path.join(ROOT, "ui", "src", "lib", "personas.ts")
    io.open(out, "w", encoding="utf-8", newline="\n").write(emit(personas, depts))
    sidecar = os.path.join(ROOT, "ui", "scripts", "personas.preview.json")
    io.open(sidecar, "w", encoding="utf-8", newline="\n").write(
        json.dumps({"departments": depts, "personas": personas}, ensure_ascii=False, indent=2))
    print("wrote", out, "personas=", len(personas), "depts=", len(depts))
