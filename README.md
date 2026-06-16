# Company OS

A portable company operating dashboard you import into any business project. One
JSON-style config file per company, one zero-dependency renderer shared across all of
them, and Claude as the agent that keeps the config in sync with the codebase.

It is an internal tool, not a product (yet). Dogfood it on your companies. If other
founders ask "can I use that," that is the signal to spin it out (the Basecamp moment).

## What is in here
- `company-os.core.js` — the framework-agnostic renderer (UMD: a plain `<script>` and an import both work).
- `company-os.css` — styles, scoped under `.cos` so they never touch a host app.
- `index.html` — the standalone shell (open it, no build step).
- `company-os.data.example.js` — the starter template. Full field reference in `schema.md`.
- `react/CompanyOS.jsx` — a React/Next wrapper around the same core.
- `bin/init.mjs` — vendors the dashboard into a target repo.
- `SKILL.md` — how Claude operates it (the interview and the commands).

## Three ways to use it

**1. Any project (static, PHP, anything), zero install:**
```
npx company-os ./path-to-your-repo
# or copy the company-os/ folder in by hand
```
Then open `company-os/index.html`, or serve the folder. Edit `company-os/company-os.data.js`.

**2. React or Next project (import as a component):**
```jsx
import CompanyOS from "company-os/react";
import "company-os/style.css";
import { companyOsData } from "./company-os.data";   // your data object
export default function Ops() { return <CompanyOS data={companyOsData} />; }
```

**3. Vanilla JS (import the core):**
```js
import CompanyOS from "company-os";   // or: const CompanyOS = require("company-os")
document.getElementById("app").classList.add("cos");
document.getElementById("app").innerHTML = CompanyOS.render(data);
```

## The Claude workflow (the point)
Open an AI coding session in the repo and talk to it:
- "interview me" to populate the OS from the repo's context files.
- "log this week", "check off <milestone>", "set <metric> to N", "add a decision".
Claude edits `company-os.data.js`; refresh the dashboard. The codebase is the knowledge
base, the data file is the state, and Claude is the runtime.

## Privacy
Finance numbers live in `company-os.data.js`. If they are real and sensitive, add
`company-os/company-os.data.js` to that repo's `.gitignore` so they stay local.
