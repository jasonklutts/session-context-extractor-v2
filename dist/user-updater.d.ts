import { Fact } from './types';
/**
 * USER.md Auto-Updater
 *
 * Scans newly distilled facts and appends relevant information to USER.md.
 * Rules:
 * - NEVER overwrites existing content
 * - NEVER modifies manually curated sections
 * - Only appends if the fact isn't already mentioned
 * - Contacts → ## People section
 * - Preferences → ## Preferences section
 * - Cert/work decisions → ## Active Projects section
 * - Everything else → ## Recently Learned section
 */
export declare class UserUpdater {
    private userMdPath;
    constructor(workspacePath: string);
    /**
    * Process a batch of newly distilled facts and update USER.md
    */
    update(facts: Fact[]): void;
    /**
    * Add new contacts to ## People section
    * Creates the section if it doesn't exist
    */
    private updatePeople;
    /**
    * Add new preferences to ## Preferences section
    * Creates the section if it doesn't exist
    */
    private updatePreferences;
    /**
    * Add relevant decisions to ## Active Projects
    * Only adds cert/work/project decisions — skips operational decisions
    */
    private updateProjects;
    /**
    * Add errors and other facts to ## Recently Learned
    * This is the catch-all section for anything that doesn't fit elsewhere
    */
    private updateRecentlyLearned;
}
//# sourceMappingURL=user-updater.d.ts.map