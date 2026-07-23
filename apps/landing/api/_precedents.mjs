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

// Business-model library for the diagnosis engine. Sources: Alex Hormozi's
// $100M Offers and $100M Leads, Brad Jacobs' How to Make a Few Billion
// Dollars, and the founder corpus (knowledge/books/). Idea-stage picks weight
// time-to-first-dollar per Hormozi: sell the outcome before building the
// machine.
export const MODELS = {
  productized_service: {
    name: "Productized service",
    when: "You have a skill and no product yet: sell a fixed-scope outcome done for the client at a flat monthly price.",
    firstMove: "Define one Grand Slam package (outcome, timeline, guarantee), price it premium, and sell it to five people this month via warm outreach.",
    source: "$100M Offers: sell done-for-you at a premium first, productize later",
  },
  high_ticket_service: {
    name: "High-ticket service",
    when: "Few clients, a big painful problem, a provable outcome: charge thousands and back it with a guarantee.",
    firstMove: "Write the value equation for one avatar (dream outcome, proof, speed, effort removed) and take three sales calls.",
    source: "$100M Offers: the value equation and risk reversal",
  },
  saas: {
    name: "Software subscription (SaaS)",
    when: "A workflow you already deliver manually repeats identically across customers who have proven they will pay.",
    firstMove: "Charge for the manual version now; only automate the steps customers already pay for.",
    source: "Founder corpus: Jason Fried, your only competition is your costs",
  },
  content_audience: {
    name: "Audience first (media)",
    when: "Distribution is the product: build an audience on one platform and monetize with offers, affiliates, or ads later.",
    firstMove: "Rule of 100: one hundred minutes of content or one hundred warm touches daily, for one hundred days, on ONE platform.",
    source: "$100M Leads: the core four and the Rule of 100",
  },
  marketplace: {
    name: "Marketplace",
    when: "Two sides need each other and you can personally seed the supply side; the hardest cold start, chosen only when direct models fail.",
    firstMove: "Broker ten transactions yourself before writing any software.",
    source: "Founder corpus: Tony Xu, do the work yourself",
  },
  local_service: {
    name: "Local service business",
    when: "Geography-bound demand (trades, care, food): win on response speed and reputation, not technology.",
    firstMove: "Claim the Google Business Profile, then Rule-of-100 warm and cold outreach inside the service area.",
    source: "$100M Leads: warm and cold outreach before paid ads",
  },
  licensing: {
    name: "License the system",
    when: "Your playbook is proven and documented: sell the system to operators instead of running every unit yourself.",
    firstMove: "Document the playbook as a checklist an outsider can run, then sell it to one operator with a revenue share.",
    source: "$100M Offers arc: Hormozi's own endgame, service to licensing",
  },
  rollup: {
    name: "Rollup (buy and integrate)",
    when: "A fragmented industry, a big rising trend, and access to capital: acquire small operators and run one playbook.",
    firstMove: "Pick the trend, list fifty acquirable operators, and buy the first at a fair price instead of a haggled one.",
    source: "Brad Jacobs: high-quality M&A without imploding",
  },
};

export const MODEL_KEYS = Object.keys(MODELS);
