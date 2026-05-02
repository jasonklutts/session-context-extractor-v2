"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySystemV2 = void 0;
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const vault_writer_1 = require("./vault-writer");
const distillation_1 = require("./distillation");
const query_engine_1 = require("./query-engine");
const retrieval_strategies_1 = require("./retrieval-strategies");
const self_improvement_1 = require("./self-improvement");
const cron_1 = require("./cron");
const atomic_1 = require("./atomic");
const graph_1 = require("./graph");
/**
 * COMPLETE SYSTEM: 5-Layer OpenClaw Architecture
 * Layer 1: CAPTURE      → memory/dailies/YYYY-MM-DD.md (handled by user)
 * Layer 2: DISTILLATION → Auto-extract via cron daily at 21:00
 * Layer 3: ATOMIC STORAGE → One fact per file (context-vault/atomic/)
 * Layer 4: GRAPH LINKING → Relationship detection
 * Layer 5: RETRIEVAL    → 8 strategies + aggregation via QueryEngine
 *
 * SELF-IMPROVEMENT: Pattern detection, promotion to skill-local distill-log.md
 */
class MemorySystemV2 {
    constructor(workspacePath = process.env.OPENCLAW_WORKSPACE ||
        path_1.default.join(process.env.HOME || '', '.openclaw', 'workspace')) {
        this.workspacePath = workspacePath;
        this.db = new db_1.VaultDatabase(workspacePath);
        this.writer = new vault_writer_1.VaultWriter(workspacePath);
        this.distillation = new distillation_1.DistillationEngine(workspacePath, this.db, this.writer);
        this.queryEngine = new query_engine_1.QueryEngine(this.db);
        this.retrieval = new retrieval_strategies_1.RetrievalSystem();
        this.selfImprovement = new self_improvement_1.SelfImprovementManager(workspacePath);
        this.cron = new cron_1.CronManager(workspacePath);
        this.atomic = new atomic_1.AtomicFileManager(workspacePath);
        this.graph = new graph_1.GraphLinkManager(workspacePath);
    }
    async initialize() {
        console.log('[V2] Initializing Memory System v2...');
        await this.db.initialize();
        await this.cron.initialize();
        console.log('[V2] Ready');
    }
    // LAYER 2: Start cron distillation
    startCron() {
        console.log('[V2] Starting daily distillation cron (21:00)');
        this.cron.startDistillationCron();
    }
    // LAYER 2: Manual distillation
    async distill() {
        console.log('[V2] Running distillation...');
        await this.distillation.distillAll();
        console.log('[V2] Distillation complete');
        const allFacts = this.db.getRecentFacts(7);
        if (allFacts.length > 0) {
            this.graph.autoLinkFacts(allFacts.map(f => ({ id: f.id, content: f.content, title: f.title })));
        }
    }
    // LAYER 5: Query via QueryEngine (aggregation + 8 retrieval strategies)
    query(queryText) {
        console.log(`[V2] Query: "${queryText}"\n`);
        // Use QueryEngine for aggregation-aware search
        const results = this.queryEngine.askQuestion(queryText);
        if (results.length === 0) {
            // Fallback: raw retrieval across last 30 days
            const allFacts = this.db.getRecentFacts(30);
            const rawResults = this.retrieval.search(queryText, allFacts);
            if (rawResults.length === 0) {
                console.log('No results found.\n');
                return;
            }
            console.log(`Found ${rawResults.length} results (raw retrieval):\n`);
            for (const { fact, score } of rawResults.slice(0, 10)) {
                console.log(`[${(score * 100).toFixed(0)}%] ${fact.title}`);
                console.log(`  ${fact.content.substring(0, 150)}`);
                const relations = this.graph.getRelations(fact.id);
                if (relations.length > 0) {
                    console.log(`  Related: ${relations.map(r => r.description).join(', ')}`);
                }
                console.log();
            }
            return;
        }
        console.log(`Found ${results.length} result(s):\n`);
        for (const { fact, score, context } of results.slice(0, 10)) {
            console.log(`[${score.toFixed(1)}] ${fact.title}`);
            console.log(`  ${fact.content.substring(0, 2000)}`);
            if (context)
                console.log(`  ${context}`);
            const relations = this.graph.getRelations(fact.id);
            if (relations.length > 0) {
                console.log(`  Related: ${relations.map(r => r.description).join(', ')}`);
            }
            console.log();
        }
    }
    // LAYER 3: List facts
    list(type) {
        const facts = type
            ? this.db.getFactsByType(type, 50)
            : this.db.getRecentFacts(7);
        if (facts.length === 0) {
            console.log(`No ${type ? type : 'recent'} facts found.`);
            return;
        }
        console.log(`${type ? type : 'Recent'} facts:\n`);
        for (const f of facts) {
            const verify = f.verified ? '✓' : '○';
            console.log(`[${verify}] ${f.type} - ${f.title}`);
        }
    }
    // Self-review
    review() {
        console.log(this.selfImprovement.generateSelfReview());
    }
    // LAYER 4: Show graph
    showGraph() {
        console.log(this.graph.generateGraphVisualization());
    }
    close() {
        this.cron.close();
        this.db.close();
    }
}
exports.MemorySystemV2 = MemorySystemV2;
// CLI
if (require.main === module) {
    const cmd = process.argv[2];
    const args = process.argv.slice(3);
    const system = new MemorySystemV2();
    (async () => {
        try {
            await system.initialize();
            switch (cmd) {
                case 'start-cron':
                    system.startCron();
                    setInterval(() => { }, 1000);
                    break;
                case 'distill':
                    await system.distill();
                    system.close();
                    break;
                case 'query':
                    system.query(args.join(' '));
                    system.close();
                    break;
                case 'list':
                    system.list(args[0]);
                    system.close();
                    break;
                case 'review':
                    system.review();
                    system.close();
                    break;
                case 'graph':
                    system.showGraph();
                    system.close();
                    break;
                default:
                    console.log(`
Session Context Extractor — V2 Production

Commands:
  start-cron         Start daily distillation at 21:00
  distill            Run distillation immediately
  query "<text>"     Search with aggregation + 8 retrieval strategies
  list [type]        List facts (decision|error|preference|contact|information)
  review             Self-improvement report
  graph              Relationship visualization

Examples:
  npm run v2:distill
  npm run v2:query "What did we decide about OCI?"
  npm run v2:query "total this week"
  npm run v2:query "how many miles did I run"
`);
                    system.close();
            }
        }
        catch (error) {
            console.error('[V2] Error:', error);
            system.close();
            process.exit(1);
        }
    })();
}
exports.default = MemorySystemV2;
//# sourceMappingURL=v2.js.map