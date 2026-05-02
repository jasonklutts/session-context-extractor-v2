# Session Context Extractor V2

Your AI agent forgets everything when a session ends. This skill gives it a memory that actually works.

Tell your agent about your day, mention someone's name, make a decision — it captures all of it automatically. Ask about it later and get real answers from your actual history. No hallucination. No re-explaining yourself every session.

---

## Performance

Most memory systems slow down as they grow. This one doesn't.

Facts are extracted and stored as structured data at distill time — not as raw conversation text. Queries run against SQLite with indexed columns. The result is sub-20ms query time regardless of how many facts are stored. 10 facts or 100,000 facts — same speed.

That also means recall is deterministic. When you ask how many miles you ran this week, the system computes the exact number from your logs. Not a semantic guess from a language model. Not a summary of a summary. The actual number.

---

## What It Does

**Passive capture** — your agent listens to every conversation and logs anything worth remembering without being asked:

- People you mention → stored as contacts, profile created automatically
- Decisions you make → stored with context, grouped by topic
- Preferences you express → stored and applied going forward
- Daily activity → tracked and aggregated across the week
- Errors and problems → logged with resolution status

**Intelligent recall** — ask natural questions and get real answers:

- *"Who is my project manager?"* → name, role, when you first mentioned them
- *"What did we decide about OCI?"* → full decision with date and reasoning
- *"Give me a weekly summary"* → real totals: miles, sleep, hours worked, money in/out, net
- *"How many commits did I make this week?"* → exact number from your logs

**Automatic organization** — every fact goes to the right place:

- `context-vault/people/` — one profile per contact, updated on every mention
- `context-vault/projects/` — one file per topic, decisions accumulate over time
- `context-vault/errors/` — error log with status tracking
- `USER.md` — your agent's profile of you, updated automatically as it learns

**Weekly archiving** — old daily files are moved to `memory/archive/` every week, the vault is backed up, and the distill log is compressed. Your data stays organized without manual cleanup.

---

## How It Works

```
You talk to your agent
        ↓
Agent writes facts to memory/dailies/YYYY-MM-DD.md
        ↓
Nightly distillation extracts and stores facts in SQLite vault
        ↓
Facts are indexed → people/, projects/, errors/, USER.md
        ↓
You ask a question → vault is queried → real answer returned
```

Numbers and units are extracted automatically from any fact — miles, hours, dollars, calories, steps, anything. Totals are computed at query time, grouped by date. Net financials calculated automatically.

---

## Install

**Step 1 — Clone and install**

> 📋 Paste this to your agent

```
use the exec tool to run these commands one at a time:
cd ~/.openclaw/workspace/skills
git clone https://github.com/jasonklutts/session-context-extractor-v2.git session-context-extractor-v2
cd session-context-extractor-v2
npm install
npm run v2:setup
```

The setup command handles everything automatically:
- Creates all required directories including `context-vault/people/`, `projects/`, `errors/`, `archive/`
- Adds heartbeat config to `openclaw.json` for nightly distillation
- Creates or updates `HEARTBEAT.md` with distillation and weekly archive schedules
- Creates `USER.md` template if one doesn't exist
- Creates a backup script at `scripts/backup-vault.sh`
- Runs first distillation if daily files are already present

**Step 2 — Give your agent its instructions**

Paste this block directly into your agent's chat. This is a one-time setup.

> 📋 Paste this to your agent

```
You now have a persistent memory system. Follow these instructions in every conversation:

PASSIVE CAPTURE — always on:
Listen to everything said in our conversations. Whenever you hear something worth remembering, write it to ~/.openclaw/workspace/memory/dailies/YYYY-MM-DD.md using today's date. Do this without being asked. Things worth logging include:

- Any person mentioned: name, role, relationship
  * Contact: Sarah is my project manager at Delta Utilities

- Any preference expressed: tools, habits, styles, opinions
  * Preference: prefers bullet points in technical summaries

- Any decision made: what was chosen and why
  * Decision: Decided to prioritize OCI certification before AZ-104 because Delta uses OCI

- Any daily activity: exercise, sleep, food, work, study, finances
  * Information: Ran 2.3 miles in 19:45, felt good
  * Information: Slept 7 hours, drank 9 glasses water
  * Information: Worked 8 hours on Delta project
  * Information: Studied OCI for 2 hours, made 6 commits
  * Information: Ate 2200 calories, spent $18 on lunch
  * Information: earned $100 from consulting work
  * Information: Completed 5 tasks, read 30 pages

- Any error or problem encountered
  * Error: Proxmox dropped to emergency mode after ungraceful shutdown

FORMAT RULES:
- Use * Information:, * Decision:, * Contact:, * Preference:, or * Error: at the start of each line
- Keep earned and spent on separate lines
- Write money as: earned $X or spent $X (lowercase)
- One fact per line where possible

RECALLING — when asked:
When asked about past context, summaries, totals, or anything from memory, use the exec tool to run:
cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:query "[the question]"
Then summarize the results in plain language.

Never append distilled session facts to MEMORY.md. All distill output goes to the session-context-extractor skill only.
```

That's it. Your agent is set up.

---

## Daily Usage

**Just talk normally.** Your agent captures everything automatically.

> *"I ran 2.5 miles this morning, slept 7 hours, worked 8 hours on the Delta project, earned $200 from a client."*

> *"My new dentist is Dr. Rivera at Tulane Medical."*

> *"I've decided to focus on OCI before starting AZ-104."*

**Ask anything about your history:**

> *"Give me a weekly summary"*

> *"Who is Dr. Rivera?"*

> *"How many miles did I run this week?"*

> *"What decisions have I made about certifications?"*

> *"What did I earn and spend this week?"*

---

## Manual Commands

You don't need these for normal use — your agent handles everything. But they're here if you want to test or troubleshoot.

**Run distillation manually:**
```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill
```

**Query the vault:**
```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:query "comprehensive weekly summary"
```

**List stored facts:**
```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:list
```

**Run weekly archive:**
```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:archive
```

**Full reset:**
```
use the exec tool to run: rm /home/openclaw/.openclaw/workspace/context-vault/vault.db && rm /home/openclaw/.openclaw/workspace/.last_distill_date && cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill
```

---

## Troubleshooting

**"Extracted 0 facts" after distill**
```
use the exec tool to run: rm /home/openclaw/.openclaw/workspace/.last_distill_date
```
Then distill again.

**"No results found" when querying**

Check facts are stored first:
```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:list
```

**Old or wrong data showing up**

Run a full reset using the command above.

---

## What Makes This Different

Most agent memory systems store raw conversation text and rely on the LLM to recall it semantically. This system extracts structured facts at distillation time and stores them in SQLite — so recall is deterministic, not probabilistic.

Numbers and units are detected generically — miles, steps, hours, dollars, calories, cups, reps, anything. You don't configure metrics. You just write naturally and the system figures it out.

The index layer means your data is also human-readable without querying. Open `context-vault/people/` and browse contact profiles. Open `context-vault/projects/` and read your decision history. It's a filing system, not just a database.

---

## File Structure

```
~/.openclaw/workspace/
  memory/
    dailies/          ← daily log files (YYYY-MM-DD.md)
    archive/          ← weekly archived files (YYYY-WXX/)
  context-vault/
    vault.db          ← SQLite fact database
    people/           ← contact profiles (one .md per person)
    projects/         ← decision files (one .md per topic)
    errors/           ← error logs (one .md per incident)
    backups/          ← weekly vault backups
  USER.md             ← auto-updated agent profile of you
  HEARTBEAT.md        ← heartbeat schedule with distillation tasks

skills/session-context-extractor-v2/
  src/
    distillation.ts   ← extracts facts from daily files
    query-engine.ts   ← aggregation and retrieval
    indexer.ts        ← writes people/projects/errors profiles
    user-updater.ts   ← updates USER.md automatically
    archiver.ts       ← weekly archive and backup
    setup.ts          ← one-time setup
    v2.ts             ← CLI entry point
```

---

## License

MIT

---

*Built for Heyron Agent Jam #1 — May 2026*