import { VaultDatabase } from './db';
import { VaultWriter } from './vault-writer';
export declare class DistillationEngine {
    private db;
    private writer;
    private indexer;
    private userUpdater;
    private workspacePath;
    private skillPath;
    constructor(workspacePath: string, db: VaultDatabase, writer: VaultWriter);
    distillAll(): Promise<void>;
    extractMetrics(content: string): Record<string, number>;
    private extractLines;
    private deduplicate;
    private evaluateStability;
    private reformulate;
    private appendDistillLog;
    private similarity;
}
//# sourceMappingURL=distillation.d.ts.map