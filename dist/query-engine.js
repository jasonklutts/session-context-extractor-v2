"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryEngine = void 0;
const retrieval_strategies_1 = require("./retrieval-strategies");
class QueryEngine {
    constructor(db) {
        this.index = null;
        this.retrieval = new retrieval_strategies_1.RetrievalSystem();
        this.db = db;
    }
    search(query) {
        const facts = this.db.searchFacts(query.text, query.type, query.system, query.verifiedOnly);
        const results = facts.map(fact => ({
            fact,
            score: this.scoreRelevance(fact, query),
            context: this.generateContext(fact),
        }));
        if (this.isAggregateQuery(query.text)) {
            return this.aggregateResults(results, query);
        }
        return results.sort((a, b) => b.score - a.score);
    }
    getByType(type, limit = 50) {
        return this.db.getFactsByType(type, limit);
    }
    getRecent(days = 7) {
        return this.db.getRecentFacts(days);
    }
    askQuestion(question) {
        const lowerQuestion = question.toLowerCase();
        let query = { text: question };
        if (lowerQuestion.includes('decision') || lowerQuestion.includes('decide')) {
            query.type = 'decision';
        }
        else if (lowerQuestion.includes('error') || lowerQuestion.includes('failed')) {
            query.type = 'error';
        }
        else if (lowerQuestion.includes('prefer') || lowerQuestion.includes('like')) {
            query.type = 'preference';
        }
        else if (lowerQuestion.includes('who') || lowerQuestion.includes('contact')) {
            query.type = 'contact';
        }
        if (this.isAggregateQuery(question)) {
            const allFacts = this.db.getRecentFacts(30);
            const results = allFacts.map(fact => ({
                fact,
                score: this.scoreRelevance(fact, query),
                context: this.generateContext(fact),
            }));
            return this.aggregateResults(results, query);
        }
        return this.search(query);
    }
    isAggregateQuery(text) {
        const triggers = [
            'total', 'how many', 'how much', 'count', 'sum', 'all',
            'this week', 'today', 'last week', 'per day', 'breakdown', 'summary',
            'miles', 'ran', 'run', 'drove', 'walked', 'calories', 'sleep', 'slept',
            'hours', 'water', 'glasses', 'spent', 'earned', 'made', 'income',
            'tasks', 'commits', 'pages', 'steps', 'cups', 'reps', 'sets',
        ];
        const lower = text.toLowerCase();
        return triggers.some(t => lower.includes(t));
    }
    aggregateResults(results, query) {
        const groupKey = this.detectGroupKey(query.text);
        const groups = new Map();
        for (const result of results) {
            const key = this.extractGroupValue(result.fact, groupKey);
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(result);
        }
        const aggregated = [];
        for (const [key, group] of groups) {
            const topFact = group.reduce((a, b) => a.score > b.score ? a : b).fact;
            const totalScore = group.reduce((sum, r) => sum + r.score, 0);
            const summary = this.buildAggregationSummary(key, group, groupKey);
            aggregated.push({
                fact: {
                    ...topFact,
                    content: summary,
                    title: `[${groupKey}: ${key}] ${group.length} fact(s)`,
                },
                score: totalScore,
                context: `${group.length} fact(s) grouped by ${groupKey} — ${this.generateContext(topFact)}`,
            });
        }
        return aggregated.sort((a, b) => b.score - a.score);
    }
    detectGroupKey(text) {
        const lower = text.toLowerCase();
        if (lower.includes('system') || lower.includes('proxmox') || lower.includes('splunk'))
            return 'system';
        if (lower.includes('type') || lower.includes('error') || lower.includes('decision'))
            return 'type';
        return 'date';
    }
    extractGroupValue(fact, key) {
        if (key === 'date') {
            return new Date(fact.timestamp).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
            });
        }
        if (key === 'system')
            return fact.system ?? 'unknown';
        return fact.type;
    }
    /**
     * Build aggregation summary using pre-extracted metrics from fact.details.metrics.
     * Falls back to content string if metrics not present (facts distilled before this version).
     * Any metric key found across the group is summed automatically — no hardcoded units.
     */
    buildAggregationSummary(key, group, groupKey) {
        const totals = {};
        const lines = [];
        for (const r of group) {
            const rawDetails = r.fact.details;
            const metrics = (rawDetails?.metrics && Object.keys(rawDetails.metrics).length > 0)
                ? rawDetails.metrics
                : rawDetails;
            if (metrics && Object.keys(metrics).length > 0) {
                // Use pre-extracted metrics stored at distill time
                for (const [unit, value] of Object.entries(metrics)) {
                    if (typeof value === 'number' && isFinite(value)) {
                        totals[unit] = (totals[unit] || 0) + value;
                    }
                }
            }
            lines.push(`- [${new Date(r.fact.timestamp).toLocaleDateString()}] ${r.fact.content}`);
        }
        // Compute net if we have both earned and spent
        const earned = totals['dollars_earned'] || 0;
        const spent = totals['dollars_spent'] || 0;
        if (earned > 0 || spent > 0) {
            totals['net'] = earned - spent;
        }
        let summary = '';
        if (Object.keys(totals).length > 0) {
            summary += `Totals for ${groupKey}="${key}":\n`;
            // Sort keys for consistent output order
            const sortedKeys = Object.keys(totals).sort();
            for (const metric of sortedKeys) {
                const value = totals[metric];
                const label = metric.replace(/_/g, ' ');
                const display = Math.round(value * 100) / 100;
                summary += `  ${label}: ${display}\n`;
            }
            summary += '\nSource facts:\n';
        }
        else {
            summary += `${group.length} fact(s) for ${groupKey}="${key}":\n`;
        }
        summary += lines.join('\n');
        return summary;
    }
    scoreRelevance(fact, query) {
        let score = 0;
        if (query.verifiedOnly && fact.verified)
            score += 10;
        if (query.type && fact.type === query.type)
            score += 5;
        if (query.system && fact.system === query.system)
            score += 3;
        const daysOld = (Date.now() - new Date(fact.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 5 - daysOld / 10);
        return score;
    }
    generateContext(fact) {
        const date = new Date(fact.timestamp).toLocaleDateString();
        const verified = fact.verified ? '[verified]' : '[unverified]';
        return `${date} ${verified} - ${fact.type}`;
    }
    getUnverified() {
        return this.db.searchFacts('', undefined, undefined, false)
            .filter(f => !f.verified);
    }
    getStaleDecisions(daysThreshold = 90) {
        const decisions = this.db.getFactsByType('decision', 1000);
        const cutoff = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
        return decisions.filter(d => new Date(d.timestamp).getTime() < cutoff);
    }
    getErrorsBySystem(system) {
        return this.db.searchFacts('', 'error', system, false);
    }
    getDecisionHistory(topic) {
        const results = this.db.searchFacts(topic, 'decision', undefined, false);
        return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}
exports.QueryEngine = QueryEngine;
//# sourceMappingURL=query-engine.js.map