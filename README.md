# Session Context Extractor V2

Your AI agent forgets everything when a session ends. This skill gives it persistent, structured memory.

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
- *"How do my miles this week compare to last month?"* → exact numbers from your logs
- *"How many commits did I make this week?"* → exact number from your logs

**Automatic organization** — every fact goes to the right place:

- `context-vault/people/` — one profile per contact, updated on every mention
- `context-vault/projects/` — one file per topic, decisions accumulate over time
- `context-vault/errors/` — error log with status tracking
- `USER.md` — your agent's profile of you, updated automatically as it learns

**Weekly archiving** — old daily files move to `memory/archive/` every week, the vault is backed up, and the distill log is consolidated. Your data stays organized without manual cleanup.

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

## Install (Heyron Container)

This skill includes `node_modules` in the repo. On Heyron, npm has cache permission restrictions that prevent standard `npm install` from running. The included `node_modules` bypasses this entirely — no npm required.

**Step 1 — Clone and run setup**

> 📋 Paste this to your agent

```
use the exec tool to run these commands one at a time:
cd ~/.openclaw/workspace/skills
git clone https://github.com/jasonklutts/session-context-extractor-v2.git session-context-extractor-v2
cd session-context-extractor-v2
./node_modules/.bin/ts-node src/setup.ts
```

The setup command handles everything automatically:
- Creates all required directories: `context-vault/people/`, `projects/`, `errors/`, `archive/`, `backups/`
- Adds heartbeat config to `openclaw.json` — see note below
- Creates or updates `HEARTBEAT.md` with nightly distillation and weekly archive schedules
- Creates `USER.md` template if one doesn't exist
- Creates a backup script at `scripts/backup-vault.sh`
- Runs first distillation if daily files are already present

### openclaw.json modification

The setup script adds a `heartbeat` block to your `openclaw.json`:

```json
"heartbeat": {
  "enabled": true,
  "prompt": "Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
  "intervalMinutes": 60,
  "activeHours": "00-24"
}
```

**What this does:** enables the OpenClaw heartbeat system, which fires every 60 minutes and tells your agent to check `HEARTBEAT.md` for scheduled tasks — including nightly distillation and weekly archiving.

**Tradeoff:** the heartbeat runs 24 hours a day and fires every hour. If you want to limit active hours (e.g. 8am–10pm only), change `activeHours` to `"08-22"` in your `openclaw.json` after setup. The setup script backs up your existing `openclaw.json` before modifying it.

**Step 2 — Give your agent its instructions**

Paste this block directly into your agent's chat. This is a one-time setup.

> 📋 Paste this to your agent

```
You now have a persistent memory system. Follow these instructions in every conversation:

PASSIVE CAPTURE — always on:
Listen to everything said in our conversations. Whenever you hear something worth remembering, write it to ~/.openclaw/workspace/memory/dailies/YYYY-MM-DD.md using today's date. Do this without being asked. Things worth logging include:

- Any person mentioned: name, role, relationship
  * Contact: Sarah is my project manager at Acme Corp

- Any preference expressed: tools, habits, styles, opinions
  * Preference: prefers bullet points in technical summaries

- Any decision made: what was chosen and why
  * Decision: Decided to prioritize OCI certification before AZ-104

- Any daily activity: exercise, sleep, food, work, study, finances
  * Information: Ran 2.3 miles in 19:45, felt good
  * Information: Slept 7 hours, drank 9 glasses water
  * Information: Worked 8 hours on the main project
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

## Example: Agent Remembering Something It Otherwise Wouldn't

**Session 1 — Monday**

> Jason: "My new project manager is Sarah. She prefers weekly status updates over daily standups."
>
> Jarvis: *(writes to 2026-04-27.md)*
> `* Contact: Sarah is my project manager, prefers weekly status updates over daily standups`

**Session 2 — Thursday (new session, no shared context)**

> Jason: "How should I loop in my project manager on the deployment delay?"
>
> Jarvis: *(queries vault)* "Based on what I know about Sarah, she prefers weekly status updates rather than daily standups — so a concise written update would likely land better than a quick call. Want me to draft one?"

Sarah was mentioned once on Monday. Three days and multiple sessions later, Jarvis remembered her name, her role, and her communication preference — without being told again.

---

## Example: Photo → Logged Calories → Weekly Total

> Jason: *(uploads photo of dinner plate)*
> "Estimate the calories in this meal and log it."
>
> Jarvis: "That looks like grilled salmon with roasted vegetables and brown rice — I'd estimate around 680 calories. Logged."
>
> *(writes to daily file)*
> `* Information: Ate grilled salmon with roasted vegetables and brown rice, approximately 680 calories`

Later that week:

> Jason: "How many calories did I eat this week?"
>
> Jarvis: *(queries vault)* "Based on your logs: Monday 2,150 — Tuesday 2,300 — Wednesday 2,100 — Thursday 1,950 — Friday 680 so far. Weekly total: 9,180 calories."

No typing. No manual tracking. Photo in, structured data out, real totals on demand.

---

## Daily Usage

**Just talk normally.** Your agent captures everything automatically.

> *"I ran 2.5 miles this morning, slept 7 hours, worked 8 hours, earned $200 from a client."*

> *"My new dentist is Dr. Rivera at Tulane Medical."*

> *"I've decided to focus on OCI before starting AZ-104."*

**Ask anything about your history:**

> *"Give me a weekly summary"*

> *"Who is Dr. Rivera?"*

> *"How do my miles this week compare to last month?"*

> *"What did I earn and spend this week?"*

---

## Manual Commands

You don't need these for normal use. They're here for testing and troubleshooting.

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
