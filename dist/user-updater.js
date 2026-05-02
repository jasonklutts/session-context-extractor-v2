"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserUpdater = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
class UserUpdater {
    constructor(workspacePath) {
        this.userMdPath = path_1.default.join(workspacePath, 'USER.md');
    }
    /**
    * Process a batch of newly distilled facts and update USER.md
    */
    update(facts) {
        if (!fs_1.default.existsSync(this.userMdPath)) {
            console.log('[USER-UPDATE] No USER.md found — skipping');
            return;
        }
        const contacts = facts.filter(f => f.type === 'contact');
        const preferences = facts.filter(f => f.type === 'preference');
        const decisions = facts.filter(f => f.type === 'decision');
        const errors = facts.filter(f => f.type === 'error');
        let updated = false;
        if (contacts.length > 0) {
            updated = this.updatePeople(contacts) || updated;
        }
        if (preferences.length > 0) {
            updated = this.updatePreferences(preferences) || updated;
        }
        if (decisions.length > 0) {
            updated = this.updateProjects(decisions) || updated;
        }
        if (errors.length > 0) {
            updated = this.updateRecentlyLearned(errors, 'error') || updated;
        }
        if (updated) {
            console.log('[USER-UPDATE] USER.md updated with new facts');
        }
    }
    /**
    * Add new contacts to ## People section
    * Creates the section if it doesn't exist
    */
    updatePeople(facts) {
        let content = fs_1.default.readFileSync(this.userMdPath, 'utf-8');
        let changed = false;
        const date = new Date().toISOString().split('T')[0];
        // Ensure ## People section exists
        if (!content.includes('## People')) {
            content += '\n## People\n<!-- Contacts learned from conversations -->\n';
            changed = true;
        }
        for (const fact of facts) {
            // Skip if already mentioned anywhere in the file
            const name = fact.details?.name || fact.content.split(' ')[0];
            if (content.toLowerCase().includes(name.toLowerCase()) &&
                content.includes(fact.content.substring(0, 30))) {
                continue;
            }
            const entry = `- **${name}** — ${fact.content} _(learned ${date})_\n`;
            // Insert before the next ## section after ## People
            const peopleIdx = content.indexOf('## People');
            const nextSection = content.indexOf('\n## ', peopleIdx + 1);
            if (nextSection === -1) {
                content += entry;
            }
            else {
                content = content.slice(0, nextSection) + entry + content.slice(nextSection);
            }
            changed = true;
            console.log(`[USER-UPDATE] Added ${name} to People section`);
        }
        if (changed)
            fs_1.default.writeFileSync(this.userMdPath, content);
        return changed;
    }
    /**
    * Add new preferences to ## Preferences section
    * Creates the section if it doesn't exist
    */
    updatePreferences(facts) {
        let content = fs_1.default.readFileSync(this.userMdPath, 'utf-8');
        let changed = false;
        const date = new Date().toISOString().split('T')[0];
        // Check for existing preferences section (either name works)
        const sectionName = content.includes('## Communication Preferences')
            ? '## Communication Preferences'
            : '## Preferences';
        if (!content.includes(sectionName)) {
            content += '\n## Preferences\n<!-- Preferences learned from conversations -->\n';
            changed = true;
        }
        for (const fact of facts) {
            // Skip if already mentioned
            if (content.includes(fact.content.substring(0, 40)))
                continue;
            const entry = `- ${fact.content} _(learned ${date})_\n`;
            const sectionIdx = content.indexOf(sectionName);
            const nextSection = content.indexOf('\n## ', sectionIdx + 1);
            if (nextSection === -1) {
                content += entry;
            }
            else {
                content = content.slice(0, nextSection) + entry + content.slice(nextSection);
            }
            changed = true;
            console.log(`[USER-UPDATE] Added preference to ${sectionName}`);
        }
        if (changed)
            fs_1.default.writeFileSync(this.userMdPath, content);
        return changed;
    }
    /**
    * Add relevant decisions to ## Active Projects
    * Only adds cert/work/project decisions — skips operational decisions
    */
    updateProjects(facts) {
        let content = fs_1.default.readFileSync(this.userMdPath, 'utf-8');
        let changed = false;
        const date = new Date().toISOString().split('T')[0];
        // Filter to only project-relevant decisions
        const projectKeywords = [
            'oci', 'azure', 'cert', 'certification', 'proxmox', 'homelab',
            'splunk', 'thehive', 'docker', 'project', 'study', 'learn',
            'deploy', 'build', 'migrate', 'upgrade', 'install',
        ];
        const relevant = facts.filter(f => {
            const lower = f.content.toLowerCase();
            return projectKeywords.some(k => lower.includes(k));
        });
        if (relevant.length === 0)
            return false;
        if (!content.includes('## Active Projects')) {
            content += '\n## Active Projects\n<!-- Projects and decisions -->\n';
            changed = true;
        }
        for (const fact of relevant) {
            if (content.includes(fact.content.substring(0, 40)))
                continue;
            const entry = `- ${fact.content} _(${date})_\n`;
            const sectionIdx = content.indexOf('## Active Projects');
            const nextSection = content.indexOf('\n## ', sectionIdx + 1);
            if (nextSection === -1) {
                content += entry;
            }
            else {
                content = content.slice(0, nextSection) + entry + content.slice(nextSection);
            }
            changed = true;
            console.log('[USER-UPDATE] Added decision to Active Projects');
        }
        if (changed)
            fs_1.default.writeFileSync(this.userMdPath, content);
        return changed;
    }
    /**
    * Add errors and other facts to ## Recently Learned
    * This is the catch-all section for anything that doesn't fit elsewhere
    */
    updateRecentlyLearned(facts, type) {
        let content = fs_1.default.readFileSync(this.userMdPath, 'utf-8');
        let changed = false;
        const date = new Date().toISOString().split('T')[0];
        if (!content.includes('## Recently Learned')) {
            content += '\n## Recently Learned\n<!-- Auto-updated from session context -->\n';
            changed = true;
        }
        for (const fact of facts) {
            if (content.includes(fact.content.substring(0, 40)))
                continue;
            const label = type === 'error' ? '⚠️ Error' : type;
            const entry = `- **[${label}]** ${fact.content} _(${date})_\n`;
            const sectionIdx = content.indexOf('## Recently Learned');
            const nextSection = content.indexOf('\n## ', sectionIdx + 1);
            if (nextSection === -1) {
                content += entry;
            }
            else {
                content = content.slice(0, nextSection) + entry + content.slice(nextSection);
            }
            changed = true;
            console.log('[USER-UPDATE] Added to Recently Learned');
        }
        if (changed)
            fs_1.default.writeFileSync(this.userMdPath, content);
        return changed;
    }
}
exports.UserUpdater = UserUpdater;
//# sourceMappingURL=user-updater.js.map