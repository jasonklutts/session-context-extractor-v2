import { VaultDatabase } from './db';
import { Fact, FactType, QueryResult, VaultQuery } from './types';
export declare class QueryEngine {
    private db;
    private index;
    private retrieval;
    constructor(db: VaultDatabase);
    search(query: VaultQuery): QueryResult[];
    getByType(type: FactType, limit?: number): Fact[];
    getRecent(days?: number): Fact[];
    askQuestion(question: string): QueryResult[];
    private isAggregateQuery;
    private aggregateResults;
    private detectGroupKey;
    private extractGroupValue;
    /**
     * Build aggregation summary using pre-extracted metrics from fact.details.metrics.
     * Falls back to content string if metrics not present (facts distilled before this version).
     * Any metric key found across the group is summed automatically — no hardcoded units.
     */
    private buildAggregationSummary;
    private scoreRelevance;
    private generateContext;
    getUnverified(): Fact[];
    getStaleDecisions(daysThreshold?: number): Fact[];
    getErrorsBySystem(system: string): Fact[];
    getDecisionHistory(topic: string): Fact[];
}
//# sourceMappingURL=query-engine.d.ts.map