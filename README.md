# Session Context Extractor V2

**Give your AI agent a persistent memory — so it remembers what you tell it, what you decide, who you mention, and what you do, across every session.**

By default your agent forgets everything when a session ends. This skill fixes that. Your agent passively listens to your conversations and logs anything worth remembering — contacts, decisions, preferences, daily activity, and more. Ask about it later and get real answers from your actual history, not guesses.

Examples of what it remembers:
- "My boss's name is Scott" → stored as a contact, recalled anytime
- "I prefer dark mode" → stored as a preference
- "We decided to go with OCI over Azure" → stored as a decision with reasoning
- "I ran 2.5 miles this morning" → stored and aggregated across the week
- "I spent $45 on lunch and earned $200 from a client" → tracked, totaled, net calculated

Ask your agent later:
- "Who is my boss?" → Scott
- "What did we decide about cloud providers?" → full decision with reasoning
- "Give me a weekly summary" → totals for miles, sleep, money, hours, tasks, and anything else logged
- "What are my preferences?" → everything you've mentioned

---

## What Gets Captured

Your agent listens for anything worth remembering and logs it automatically:

| What you say | What gets stored |
|---|---|
| "My boss is Scott" | Contact fact |
| "I prefer to work in the mornings" | Preference fact |
| "We decided to use OCI" | Decision fact with reasoning |
| "I ran 2.3 miles today" | Information fact, aggregated |
| "I spent $18 on lunch, earned $200 from a client" | Information fact, net calculated |
| "I slept 7 hours, drank 9 glasses of water" | Information fact, aggregated |
| "Completed 5 tasks, studied for 2 hours" | Information fact, aggregated |

You do not need to ask the agent to log things. It listens and writes automatically.

---

## Step 1 — Install

Paste this into your agent's chat:

> 📋 Paste this to your agent

```
use the exec tool to run these commands one at a time:

cd ~/.openclaw/workspace/skills
git clone https://github.com/jasonklutts/session-context-extractor-v2-copy-.git session-context-extractor-v2
cd session-context-extractor-v2
npm install
```

Then verify it worked:

> 📋 Paste this to your agent

```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:list
```

You should see: `No recent facts found` — correct, the vault is empty and ready.

---

## Step 2 — Give Your Agent Its Standing Instructions

Paste the block below directly into your agent's chat. This is a one-time setup. Your agent will follow these instructions automatically in every conversation from now on.

> 📋 Paste this to your agent

```
You now have a persistent memory system. Follow these instructions in every conversation:

PASSIVE CAPTURE — always on:
Listen to everything said in our conversations. Whenever you hear something worth remembering, write it to ~/.openclaw/workspace/memory/dailies/YYYY-MM-DD.md using today's date. Do this without being asked. Things worth logging include:

- Any person mentioned: their name, role, relationship
  Example: * Contact: Scott is my boss at Delta Utilities

- Any preference expressed: tools, habits, styles, opinions
  Example: * Preference: prefers to work in the mornings

- Any decision made: what was chosen and why
  Example: * Decision: chose OCI over Azure because Delta uses OCI

- Any daily activity: exercise, sleep, food, work, study, finances
  Example: * Information: Ran 2.3 miles in 19:45, felt strong
  Example: * Information: Slept 7 hours, drank 9 glasses water
  Example: * Information: Worked 8 hours on Delta project
  Example: * Information: Studied OCI for 2 hours, made 6 commits
  Example: * Information: Ate 2200 calories, spent $18 on lunch
  Example: * Information: earned $100 from consulting work
  Example: * Information: Completed 5 tasks, read 30 pages

- Any error or problem encountered: what went wrong and how it was resolved
  Example: * Error: Proxmox dropped to emergency mode after ungraceful shutdown

FORMAT RULES:
- Use * Information:, * Decision:, * Contact:, * Preference:, or * Error: at the start of each line
- Keep earned and spent on separate lines
- Write money as: earned $X or spent $X (lowercase)
- One fact per line where possible
- Always use today's actual date in the filename

RECALLING — when asked:
When asked about past context, summaries, totals, or anything from memory, use the exec tool to run:
cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:query "[the question]"
Then summarize the results in plain language.

Never append distilled session facts to MEMORY.md. All distill output goes to the session-context-extractor skill only.
```

---

## Step 3 — Start the Overnight Distillation

The skill automatically processes your daily logs every night at 21:00 and stores them in the memory vault. Start it now:

> 📋 Paste this to your agent

```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:start &
```

This runs in the background. You do not need to run it again unless the process is restarted.

---

## Step 4 — Just Talk

You are set up. Have normal conversations with your agent. It handles the rest.

**Examples of things it will capture automatically:**

> "My dentist's name is Dr. Rivera, she's at Tulane Medical."

> "I've decided to focus on OCI certification before starting AZ-104."

> "I prefer bullet points over long paragraphs in summaries."

> "I ran 2.5 miles this morning, slept 7 hours 45 minutes, earned $250 from a freelance project."

**Examples of things you can ask later:**

> "Who is my dentist?"

> "What certifications am I working on?"

> "What are my formatting preferences?"

> "Give me a comprehensive weekly summary."

> "How many miles did I run this week?"

> "What did I earn and spend this week?"

---

## Manual Commands (For Testing or Troubleshooting)

You do not need these during normal use.

**Run distillation manually:**

> 📋 Paste this to your agent

```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill
```

**Query manually:**

> 📋 Paste this to your agent

```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:query "comprehensive weekly summary"
```

**List stored facts:**

> 📋 Paste this to your agent

```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:list
```

**Full reset (wipe everything and start over):**

> 📋 Paste this to your agent

```
use the exec tool to run: rm /home/openclaw/.openclaw/workspace/context-vault/vault.db && rm /home/openclaw/.openclaw/workspace/.last_distill_date && cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill
```

---

## Troubleshooting

**"Extracted 0 facts" when distilling manually**

The system thinks it already processed your files. Run this then distill again:

> 📋 Paste this to your agent

```
use the exec tool to run: rm /home/openclaw/.openclaw/workspace/.last_distill_date
```

**"No results found" when querying**

Check that facts are stored:

> 📋 Paste this to your agent

```
use the exec tool to run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:list
```

If the list is empty, run distill manually. If the list has facts but queries return nothing, try simpler terms — "miles", "sleep", "summary", or the name of a person.

**Old or wrong data showing up**

Do a full reset using the command above.

---

## How It Works

1. Your agent passively listens to your conversations and writes facts to a daily markdown file automatically
2. Every night at 21:00 the distiller reads your daily files, extracts every fact, and stores everything in a local SQLite database
3. Numbers and units are parsed automatically — miles, hours, dollars, steps, anything
4. When you ask a question, the engine searches the vault and returns real answers from your actual history
5. For numeric queries, facts are grouped by date and totals are computed — no guessing

All data stays local. No cloud. No external services required.

---

## License

MIT License.

---

## Built For

Heyron Agent Jam #1 — May 2026