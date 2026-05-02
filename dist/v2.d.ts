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
export declare class MemorySystemV2 {
    private workspacePath;
    private db;
    private writer;
    private distillation;
    private queryEngine;
    private retrieval;
    private selfImprovement;
    private cron;
    private atomic;
    private graph;
    constructor(workspacePath?: string);
    initialize(): Promise<void>;
    startCron(): void;
    distill(): Promise<void>;
    query(queryText: string): void;
    list(type?: string): void;
    review(): void;
    showGraph(): void;
    close(): void;
}
export default MemorySystemV2;
//# sourceMappingURL=v2.d.ts.map