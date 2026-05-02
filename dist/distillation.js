"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistillationEngine = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const indexer_1 = require("./indexer");
const user_updater_1 = require("./user-updater");
class DistillationEngine {
    constructor(workspacePath, db, writer) {
        this.workspacePath = workspacePath;
        this.db = db;
        this.writer = writer;
        this.indexer = new indexer_1.Indexer(workspacePath);
        this.userUpdater = new user_updater_1.UserUpdater(workspacePath);
        this.skillPath = path_1.default.join(workspacePath, 'skills', 'session-context-extractor-v2', 'memory');
    }
    async distillAll() {
        const dailiesDir = path_1.default.join(this.workspacePath, 'memory', 'dailies');
        const stateFile = path_1.default.join(this.workspacePath, '.last_distill_date');
        if (!fs_1.default.existsSync(dailiesDir)) {
            console.log('[DISTILL] No dailies directory');
            return;
        }
        let lastDate = '';
        if (fs_1.default.existsSync(stateFile)) {
            lastDate = fs_1.default.readFileSync(stateFile, 'utf-8').trim();
        }
        console.log(`[DISTILL] Processing since: ${lastDate || 'beginning'}`);
        const files = fs_1.default.readdirSync(dailiesDir).filter(f => f.endsWith('.md')).sort();
        const allFacts = [];
        for (const file of files) {
            const dateStr = file.replace('.md', '');
            if (lastDate && dateStr <= lastDate)
                continue;
            const filePath = path_1.default.join(dailiesDir, file);
            console.log(`[DISTILL] Extracting: ${file}`);
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
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
        fs_1.default.writeFileSync(stateFile, today);
        console.log(`[DISTILL] Complete. Stored ${reformulated.length} facts.`);
    }
    extractMetrics(content) {
        const metrics = {};
        const lower = content.toLowerCase();
        const sleepFull = lower.match(/slept\s+(\d+)\s+hours?\s+(\d+)\s+minutes?/);
        if (sleepFull) {
            metrics['hours_sleep'] = parseInt(sleepFull[1]) + parseInt(sleepFull[2]) / 60;
        }
        else {
            const sleepSimple = lower.match(/slept\s+(\d+\.?\d*)\s+hours?/);
            if (sleepSimple)
                metrics['hours_sleep'] = parseFloat(sleepSimple[1]);
        }
        const worked = lower.match(/worked\s+(\d+\.?\d*)\s+hours?/);
        if (worked)
            metrics['hours_worked'] = parseFloat(worked[1]);
        const studied = lower.match(/studied\s+\S+\s+for\s+(\d+\.?\d*)\s+hours?/) ||
            lower.match(/studied\s+for\s+(\d+\.?\d*)\s+hours?/);
        if (studied)
            metrics['hours_studied'] = parseFloat(studied[1]);
        const miles = lower.match(/(\d+\.?\d*)\s+miles?/);
        if (miles)
            metrics['miles'] = parseFloat(miles[1]);
        const calories = lower.match(/(\d+)\s+calories?/);
        if (calories)
            metrics['calories'] = parseInt(calories[1]);
        const water = lower.match(/(\d+)\s+glasses?\s*(?:of\s+)?water/);
        if (water)
            metrics['glasses_water'] = parseInt(water[1]);
        const tasks = lower.match(/completed\s+(\d+)\s+tasks?/);
        if (tasks)
            metrics['tasks'] = parseInt(tasks[1]);
        const commits = lower.match(/made\s+(\d+)\s+commits?/);
        if (commits)
            metrics['commits'] = parseInt(commits[1]);
        const pages = lower.match(/read\s+(\d+)\s+pages?/);
        if (pages)
            metrics['pages'] = parseInt(pages[1]);
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
            if (excludedUnits.has(unit))
                continue;
            if (unit === 'mile')
                continue;
            if (!metrics[unit])
                metrics[unit] = 0;
            metrics[unit] += value;
        }
        return metrics;
    }
    extractLines(content, dateStr) {
        const facts = [];
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            let type = null;
            let text = null;
            if (/[*-]\s*Decision:/i.test(trimmed)) {
                type = 'decision';
                text = trimmed.replace(/[*-]\s*Decision:/i, '').trim();
            }
            else if (/[*-]\s*Error:/i.test(trimmed)) {
                type = 'error';
                text = trimmed.replace(/[*-]\s*Error:/i, '').trim();
            }
            else if (/[*-]\s*Preference:/i.test(trimmed)) {
                type = 'preference';
                text = trimmed.replace(/[*-]\s*Preference:/i, '').trim();
            }
            else if (/[*-]\s*Information:/i.test(trimmed)) {
                type = 'information';
                text = trimmed.replace(/[*-]\s*Information:/i, '').trim();
            }
            else if (/[*-]\s*Contact:/i.test(trimmed)) {
                type = 'contact';
                text = trimmed.replace(/[*-]\s*Contact:/i, '').trim();
            }
            if (!type || !text)
                continue;
            const metrics = type === 'information' ? this.extractMetrics(text) : {};
            const baseDetails = { metrics };
            if (type === 'decision') {
                baseDetails.choice = text;
                baseDetails.reasoning = '';
                baseDetails.rejected = [];
                baseDetails.constraints = [];
            }
            else if (type === 'error') {
                baseDetails.errorMessages = [text];
                baseDetails.affectedComponent = 'unknown';
                baseDetails.attempts = [];
            }
            else if (type === 'preference') {
                baseDetails.topic = 'general';
                baseDetails.preference = text;
                baseDetails.strength = 'moderate';
            }
            else if (type === 'information') {
                baseDetails.topic = 'general';
                baseDetails.fact = text;
            }
            else if (type === 'contact') {
                baseDetails.name = text.split(' ')[0];
                baseDetails.relationship = text;
            }
            const prefix = type.substring(0, 3);
            facts.push({
                id: `${prefix}_${dateStr}_${Math.random().toString(36).substr(2, 9)}`,
                type: type,
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
    deduplicate(facts) {
        const seen = new Map();
        for (const fact of facts) {
            const key = `${fact.type}:${fact.sessionId}:${fact.content}`;
            if (seen.has(key))
                continue;
            let isDup = false;
            for (const existing of seen.values()) {
                if (this.similarity(fact.content, existing.content) > 0.8) {
                    isDup = true;
                    break;
                }
            }
            if (!isDup)
                seen.set(key, fact);
        }
        return Array.from(seen.values());
    }
    evaluateStability(facts) {
        return facts.filter(f => ['decision', 'error', 'preference', 'contact', 'information'].includes(f.type));
    }
    reformulate(facts) {
        return facts.map(f => ({
            ...f,
            content: f.content.length < 5 ? `${f.title}: ${f.content}` : f.content,
        }));
    }
    appendDistillLog(facts) {
        if (!fs_1.default.existsSync(this.skillPath)) {
            fs_1.default.mkdirSync(this.skillPath, { recursive: true });
        }
        const logPath = path_1.default.join(this.skillPath, 'distill-log.md');
        const today = new Date().toISOString().split('T')[0];
        let section = `\n## Distilled ${today}\n\n`;
        const byType = new Map();
        for (const f of facts) {
            if (!byType.has(f.type))
                byType.set(f.type, []);
            byType.get(f.type).push(f);
        }
        for (const [type, typeFacts] of byType) {
            section += `### ${type}\n`;
            for (const f of typeFacts) {
                section += `- ${f.title}\n`;
            }
            section += '\n';
        }
        fs_1.default.appendFileSync(logPath, section);
        console.log(`[DISTILL] Log written to ${logPath}`);
    }
    similarity(a, b) {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));
        let common = 0;
        for (const w of wordsA) {
            if (w.length > 3 && wordsB.has(w))
                common++;
        }
        const union = wordsA.size + wordsB.size - common;
        return union > 0 ? common / union : 0;
    }
}
exports.DistillationEngine = DistillationEngine;
//# sourceMappingURL=distillation.js.map