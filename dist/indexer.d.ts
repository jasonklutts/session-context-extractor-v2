import { Fact } from './types';
export declare class Indexer {
    private vaultDir;
    private peopleDir;
    private projectsDir;
    private errorsDir;
    constructor(workspacePath: string);
    index(fact: Fact): void;
    private indexContact;
    private indexDecision;
    private indexError;
    private extractName;
    private extractRelationship;
    private extractTopic;
    private extractComponent;
    private slugify;
}
//# sourceMappingURL=indexer.d.ts.map