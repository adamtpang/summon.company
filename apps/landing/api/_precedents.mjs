// The founder-precedent library behind /diagnose.
// Every entry cites a REAL episode in summon.company/knowledge (48 episodes,
// ~810k words of David Senra's two shows). The diagnosis model picks a
// constraint key; the citation is looked up here deterministically, so the
// public page can never invent a source.

export const PRECEDENTS = {
  focus: {
    founder: "Todd Graves",
    company: "Raising Cane's",
    lesson:
      "Todd Graves built a multibillion dollar chain on one product, chicken fingers, and refused to add menu items for decades. The distracted never beat the focused.",
    source: "How Todd Graves Built Raising Cane's, David Senra interview",
  },
  simplicity: {
    founder: "Steve Jobs",
    company: "Apple",
    lesson:
      "Jobs wielded simplicity as a weapon: small teams, one message per idea, and attacking markets full of complex second-rate products.",
    source: "Insanely Simple by Ken Segall, Founders Podcast",
  },
  distribution: {
    founder: "Jimmy Iovine",
    company: "Interscope Records, Beats",
    lesson:
      "Iovine treated marketing as empathy at scale: attach yourself to the best people, tell the brutal truth, and carry the product to where the audience already is.",
    source: "Jimmy Iovine on building Interscope and Beats, David Senra interview",
  },
  costs: {
    founder: "Jason Fried",
    company: "37signals",
    lesson:
      "Fried's rule: your only competition is your costs. Keep them low enough that a few customers are enough, and you never need permission to survive.",
    source: "Jason Fried, your only competition is your costs, David Senra interview",
  },
  cash: {
    founder: "John D. Rockefeller",
    company: "Standard Oil",
    lesson:
      "Rockefeller was brutally honest with his numbers and kept the deepest war chest in the industry, which let him buy when everyone else had to sell.",
    source: "Rockefeller's autobiography, Founders Podcast",
  },
  speed: {
    founder: "Elon Musk",
    company: "SpaceX, Tesla",
    lesson:
      "Elon's algorithm: question every requirement, delete relentlessly, simplify, accelerate, and only then automate. Speed comes from removing steps, not working harder.",
    source: "How Elon Works, Founders Podcast",
  },
  differentiation: {
    founder: "Peter Thiel",
    company: "PayPal, Palantir",
    lesson:
      "Thiel's rule: go from zero to one by building a creative monopoly no one can copy. Competing in an existing market on the same axis is a losing game.",
    source: "Zero to One, Founders Podcast",
  },
  customer: {
    founder: "Tony Xu",
    company: "DoorDash",
    lesson:
      "Xu survived a thousand days of startup hell by doing the deliveries himself: the data you cannot see is what kills you, so do the work yourself and run relentless experiments.",
    source: "Tony Xu of DoorDash, David Senra interview",
  },
  automation: {
    founder: "Thomas Peterffy",
    company: "Interactive Brokers",
    lesson:
      "Peterffy automated everything so the business ran on math, not intuition. Every manual step you keep is a cost and an error rate you chose.",
    source: "The billionaire who automates everything, Founders Podcast",
  },
  commitment: {
    founder: "Dana White",
    company: "UFC",
    lesson:
      "Dana White kept no Plan B. Owning your content and its story, and refusing the exit hatch, is what let loyalty compound into an empire.",
    source: "Dana White, the man behind the UFC, David Senra interview",
  },
  talent: {
    founder: "Brad Jacobs",
    company: "XPO, United Rentals",
    lesson:
      "Jacobs built eight billion dollar companies with one playbook: get the major trend right, hire people smarter than you, and repeat the discipline everywhere.",
    source: "How Brad Jacobs built 8 billion dollar companies, David Senra interview",
  },
  pricing: {
    founder: "Eric Glyman",
    company: "Ramp",
    lesson:
      "Glyman inverted his industry: help customers spend less money and time, not more. Price against the value you return, then run every process through question, simplify, automate.",
    source: "Eric Glyman of Ramp, David Senra interview",
  },
};

export const CONSTRAINT_KEYS = Object.keys(PRECEDENTS);

export const STAGES = [
  "Initial idea",
  "Found it",
  "Identity",
  "Build",
  "Distribute",
  "Launch",
  "Operate and close",
  "Scale",
];

export const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Finance",
  "Operations",
  "Support",
  "Legal",
];
