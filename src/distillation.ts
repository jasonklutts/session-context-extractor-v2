import fs from 'fs';
import path from 'path';
import { VaultDatabase } from './db';
import { VaultWriter } from './vault-writer';
import { Indexer } from './indexer';
import { UserUpdater } from './user-updater';
import { Fact } from './types';

export class DistillationEngine {
  private db: VaultDatabase;
  private writer: VaultWriter;
  private indexer: Indexer;
  private userUpdater: UserUpdater;
  private workspacePath: string;
  private skillPath: string;

  constructor(workspacePath: string, db: VaultDatabase, writer: VaultWriter) {
    this.workspacePath = workspacePath;
    this.db = db;
    this.writer = writer;
    this.indexer = new Indexer(workspacePath);
    this.userUpdater = new UserUpdater(workspacePath);
    this.skillPath = path.join(workspacePath, 'skills', 'session-context-extractor-v2', 'memory');
  }

  async distillAll(): Promise<void> {
    const dailiesDir = path.join(this.workspacePath, 'memory', 'dailies');
    const stateFile = path.join(this.workspacePath, '.last_distill_date');

    if (!fs.existsSync(dailiesDir)) {
      console.log('[DISTILL] No dailies directory');
      return;
    }

    let lastDate = '';
    if (fs.existsSync(stateFile)) {
      lastDate = fs.readFileSync(stateFile, 'utf-8').trim();
    }
    console.log(`[DISTILL] Processing since: ${lastDate || 'beginning'}`);

    const files = fs.readdirSync(dailiesDir).filter(f => f.endsWith('.md')).sort();
    const allFacts: Fact[] = [];

    for (const file of files) {
      const dateStr = file.replace('.md', '');
      if (lastDate && dateStr <= lastDate) continue;
      const filePath = path.join(dailiesDir, file);
      console.log(`[DISTILL] Extracting: ${file}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const facts = this.extractLines(content, dateStr);
      allFacts.push(...facts);
    }

    console.log(`[DISTILL] Extracted ${allFacts.length} facts`);

    const deduped = this.deduplicate(allFacts);
    console.log(`[DISTILL] After dedup: ${deduped.length} facts`);

    const stable = this.evaluateStability(deduped);
    console.log(`[DISTILL] Stable facts: ${stable.length}`);

    const reformulated = this.reformulate(stable);

    for (const fact of reformulated) {
      this.db.saveFact(fact);
      this.writer.writeFact(fact);
      this.indexer.index(fact);
    }

    this.appendDistillLog(reformulated);
    this.userUpdater.update(reformulated);

    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(stateFile, today);

    console.log(`[DISTILL] Complete. Stored ${reformulated.length} facts.`);
  }

  extractMetrics(content: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    const lower = content.toLowerCase();

    const sleepFull = lower.match(/slept\s+(\d+)\s+hours?\s+(\d+)\s+minutes?/);
    if (sleepFull) {
      metrics['hours_sleep'] = parseInt(sleepFull[1]) + parseInt(sleepFull[2]) / 60;
    } else {
      const sleepSimple = lower.match(/slept\s+(\d+\.?\d*)\s+hours?/);
      if (sleepSimple) metrics['hours_sleep'] = parseFloat(sleepSimple[1]);
    }

    const worked = lower.match(/worked\s+(\d+\.?\d*)\s+hours?/);
    if (worked) metrics['hours_worked'] = parseFloat(worked[1]);

    const studied = lower.match(/studied\s+\S+\s+for\s+(\d+\.?\d*)\s+hours?/) ||
                    lower.match(/studied\s+for\s+(\d+\.?\d*)\s+hours?/);
    if (studied) metrics['hours_studied'] = parseFloat(studied[1]);

    const miles = lower.match(/(\d+\.?\d*)\s+miles?/);
    if (miles) metrics['miles'] = parseFloat(miles[1]);

    const calories = lower.match(/(\d+)\s+calories?/);
    if (calories) metrics['calories'] = parseInt(calories[1]);

    const water = lower.match(/(\d+)\s+glasses?\s*(?:of\s+)?water/);
    if (water) metrics['glasses_water'] = parseInt(water[1]);

    const tasks = lower.match(/completed\s+(\d+)\s+tasks?/);
    if (tasks) metrics['tasks'] = parseInt(tasks[1]);

    const commits = lower.match(/made\s+(\d+)\s+commits?/);
    if (commits) metrics['commits'] = parseInt(commits[1]);

    const pages = lower.match(/read\s+(\d+)\s+pages?/);
    if (pages) metrics['pages'] = parseInt(pages[1]);

    const spentMatches = [...lower.matchAll(/spent\s+\$(\d+\.?\d*)/g)];
    if (spentMatches.length > 0) {
      metrics['dollars_spent'] = spentMatches.reduce((sum, m) => sum + parseFloat(m[1]), 0);
    }

    const earnedMatches = [...lower.matchAll(/(?:earned|made)\s+\$(\d+\.?\d*)/g)];
    if (earnedMatches.length > 0) {
      metrics['dollars_earned'] = earnedMatches.reduce((sum, m) => sum + parseFloat(m[1]), 0);
    }

    const excludedUnits = new Set([
      'mile', 'calorie', 'glass', 'task', 'commit', 'page',
      'hour', 'minute', 'second', 'min', 'sec',
    ]);

    const genericPattern = /(\d+\.?\d*)\s+(miles?|steps?|cups?|laps?|sets?|reps?|km|kilometers?|pounds?|lbs?|kg|ounces?|oz)/g;
    const genericMatches = [...lower.matchAll(genericPattern)];
    for (const m of genericMatches) {
      const value = parseFloat(m[1]);
      let unit = m[2].replace(/s$/, '').trim();
      if (excludedUnits.has(unit)) continue;
      if (unit === 'mile') continue;
      if (!metrics[unit]) metrics[unit] = 0;
      metrics[unit] += value;
    }

    return metrics;
  }

  private extractLines(content: string, dateStr: string): Fact[] {
    const facts: Fact[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let type: string | null = null;
      let text: string | null = null;

      if (/[*-]\s*Decision:/i.test(trimmed)) {
        type = 'decision';
        text = trimmed.replace(/[*-]\s*Decision:/i, '').trim();
      } else if (/[*-]\s*Error:/i.test(trimmed)) {
        type = 'error';
        text = trimmed.replace(/[*-]\s*Error:/i, '').trim();
      } else if (/[*-]\s*Preference:/i.test(trimmed)) {
        type = 'preference';
        text = trimmed.replace(/[*-]\s*Preference:/i, '').trim();
      } else if (/[*-]\s*Information:/i.test(trimmed)) {
        type = 'information';
        text = trimmed.replace(/[*-]\s*Information:/i, '').trim();
      } else if (/[*-]\s*Contact:/i.test(trimmed)) {
        type = 'contact';
        text = trimmed.replace(/[*-]\s*Contact:/i, '').trim();
      }

      if (!type || !text) continue;

      const metrics = type === 'information' ? this.extractMetrics(text) : {};
      const baseDetails: Record<string, unknown> = { metrics };

      if (type === 'decision') {
        baseDetails.choice = text;
        baseDetails.reasoning = '';
        baseDetails.rejected = [];
        baseDetails.constraints = [];
      } else if (type === 'error') {
        baseDetails.errorMessages = [text];
        baseDetails.affectedComponent = 'unknown';
        baseDetails.attempts = [];
      } else if (type === 'preference') {
        baseDetails.topic = 'general';
        baseDetails.preference = text;
        baseDetails.strength = 'moderate';
      } else if (type === 'information') {
        baseDetails.topic = 'general';
        baseDetails.fact = text;
      } else if (type === 'contact') {
        baseDetails.name = text.split(' ')[0];
        baseDetails.relationship = text;
      }

      const prefix = type.substring(0, 3);
      facts.push({
        id: `${prefix}_${dateStr}_${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        title: text.substring(0, 80),
        content: text,
        details: baseDetails,
        timestamp: new Date(dateStr).toISOString(),
        sessionId: dateStr,
        verified: false,
        source: 'distilled',
      });
    }

    return facts;
  }

  private deduplicate(facts: Fact[]): Fact[] {
    const seen = new Map<string, Fact>();
    for (const fact of facts) {
      const key = `${fact.type}:${fact.sessionId}:${fact.content}`;
      if (seen.has(key)) continue;
      let isDup = false;
      for (const existing of seen.values()) {
        if (this.similarity(fact.content, existing.content) > 0.8) {
          isDup = true;
          break;
        }
      }
      if (!isDup) seen.set(key, fact);
    }
    return Array.from(seen.values());
  }

  private evaluateStability(facts: Fact[]): Fact[] {
    return facts.filter(f =>
      ['decision', 'error', 'preference', 'contact', 'information'].includes(f.type)
    );
  }

  private reformulate(facts: Fact[]): Fact[] {
    return facts.map(f => ({
      ...f,
      content: f.content.length < 5 ? `${f.title}: ${f.content}` : f.content,
    }));
  }

  private appendDistillLog(facts: Fact[]): void {
    if (!fs.existsSync(this.skillPath)) {
      fs.mkdirSync(this.skillPath, { recursive: true });
    }

    const logPath = path.join(this.skillPath, 'distill-log.md');
    const today = new Date().toISOString().split('T')[0];
    let section = `\n## Distilled ${today}\n\n`;

    const byType = new Map<string, Fact[]>();
    for (const f of facts) {
      if (!byType.has(f.type)) byType.set(f.type, []);
      byType.get(f.type)!.push(f);
    }

    for (const [type, typeFacts] of byType) {
      section += `### ${type}\n`;
      for (const f of typeFacts) {
        section += `- ${f.title}\n`;
      }
      section += '\n';
    }

    fs.appendFileSync(logPath, section);
    console.log(`[DISTILL] Log written to ${logPath}`);
  }

  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let common = 0;
    for (const w of wordsA) {
      if (w.length > 3 && wordsB.has(w)) common++;
    }
    const union = wordsA.size + wordsB.size - common;
    return union > 0 ? common / union : 0;
  }
}