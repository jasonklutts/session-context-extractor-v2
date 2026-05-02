"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ||
    path_1.default.join(process.env.HOME || '', '.openclaw', 'workspace');
const SKILL_DIR = path_1.default.join(WORKSPACE, 'skills', 'session-context-extractor-v2');
const VAULT_DIR = path_1.default.join(WORKSPACE, 'context-vault');
const DAILIES_DIR = path_1.default.join(WORKSPACE, 'memory', 'dailies');
const OPENCLAW_JSON = path_1.default.join(WORKSPACE, 'openclaw.json');
const MAIN_OPENCLAW_JSON = path_1.default.join(process.env.HOME || '', '.openclaw', 'workspace', 'openclaw.json');
const log = [];
const skip = [];
const warn = [];
function done(msg) { log.push(msg); console.log(' checkmark ' + msg); }
function skipped(msg) { skip.push(msg); console.log(' -> ' + msg + ' (already exists, skipped)'); }
function warning(msg) { warn.push(msg); console.log(' WARNING ' + msg); }
function ensureDir(dirPath, label) {
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
        done('Created ' + label);
    }
    else {
        skipped(label);
    }
}
function setupDirectories() {
    console.log('\n[1/6] Setting up directory structure...');
    ensureDir(DAILIES_DIR, 'memory/dailies/');
    ensureDir(VAULT_DIR, 'context-vault/');
    ensureDir(path_1.default.join(VAULT_DIR, 'people'), 'context-vault/people/');
    ensureDir(path_1.default.join(VAULT_DIR, 'projects'), 'context-vault/projects/');
    ensureDir(path_1.default.join(VAULT_DIR, 'errors'), 'context-vault/errors/');
    ensureDir(path_1.default.join(VAULT_DIR, 'atomic'), 'context-vault/atomic/');
    ensureDir(path_1.default.join(SKILL_DIR, 'memory'), 'skill memory/');
}
function setupUserMd() {
    console.log('\n[2/6] Checking USER.md...');
    const userMdPath = path_1.default.join(WORKSPACE, 'USER.md');
    if (fs_1.default.existsSync(userMdPath)) {
        skipped('USER.md');
        return;
    }
    const template = `# USER.md — About You\n\n## Identity\n- Name: \n- Location: \n- Timezone: \n\n## Work\n- Role: \n- Company: \n- Current projects: \n\n## Goals\n- Short term: \n- Long term: \n\n## Preferences\n- Communication style: \n- Working hours: \n- Tools and tech: \n\n## Health & Habits\n- Exercise: \n- Sleep target: \n- Diet notes: \n\n## Notes\n<!-- Your agent will update this file as it learns more about you -->\n`;
    fs_1.default.writeFileSync(userMdPath, template);
    done('Created USER.md template');
}
function setupHeartbeat() {
    console.log('\n[3/6] Configuring heartbeat...');
    const configPath = fs_1.default.existsSync(OPENCLAW_JSON) ? OPENCLAW_JSON : fs_1.default.existsSync(MAIN_OPENCLAW_JSON) ? MAIN_OPENCLAW_JSON : null;
    if (!configPath) {
        warning('Could not find openclaw.json — skipping heartbeat config');
        return;
    }
    let config;
    try {
        config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
    }
    catch (e) {
        warning('Could not parse openclaw.json');
        return;
    }
    if (config.heartbeat?.enabled) {
        skipped('Heartbeat already configured');
        return;
    }
    config.heartbeat = { enabled: true, prompt: "Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.", intervalMinutes: 60, activeHours: "00-24" };
    const backupPath = configPath + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs_1.default.copyFileSync(configPath, backupPath);
    done('Backed up openclaw.json');
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
    done('Added heartbeat config to openclaw.json');
}
function setupHeartbeatMd() {
    console.log('\n[4/6] Setting up HEARTBEAT.md...');
    const heartbeatPath = path_1.default.join(WORKSPACE, 'HEARTBEAT.md');
    if (fs_1.default.existsSync(heartbeatPath)) {
        const existing = fs_1.default.readFileSync(heartbeatPath, 'utf-8');
        if (existing.includes('session-context-extractor')) {
            skipped('HEARTBEAT.md already has distillation task');
            return;
        }
        fs_1.default.appendFileSync(heartbeatPath, '\n## Memory Distillation\n- Run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill\n- Only run if new daily files exist since last distillation\n');
        done('Added distillation task to existing HEARTBEAT.md');
    }
    else {
        const template = `# HEARTBEAT.md\n\nInstructions for periodic agent check-ins. Read this on every heartbeat.\nDo not repeat tasks already completed in prior sessions.\n\n## Every Hour\n- Write a brief session recap to memory/dailies/YYYY-MM-DD.md if anything significant happened\n- Check for pending tasks or follow-ups\n\n## Memory Distillation\n- Run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill\n- Only run if new daily files exist since last distillation\n- Confirm fact count after running\n\n## Every 6 Hours\n- Verify backup exists for today\n- Update USER.md if new permanent facts were learned\n\n## Daily\n- Archive completed tasks\n- Review context-vault/errors/ for unresolved issues\n\nIf nothing needs attention, reply: HEARTBEAT_OK\n`;
        fs_1.default.writeFileSync(heartbeatPath, template);
        done('Created HEARTBEAT.md');
    }
}
function setupBackupScript() {
    console.log('\n[5/6] Creating backup script...');
    const scriptsDir = path_1.default.join(WORKSPACE, 'scripts');
    ensureDir(scriptsDir, 'scripts/');
    const backupScriptPath = path_1.default.join(scriptsDir, 'backup-vault.sh');
    if (fs_1.default.existsSync(backupScriptPath)) {
        skipped('scripts/backup-vault.sh');
        return;
    }
    const backupDir = path_1.default.join(VAULT_DIR, 'backups');
    const script = `#!/bin/bash\nVAULT="${VAULT_DIR}/vault.db"\nBACKUP_DIR="${backupDir}"\nTIMESTAMP=$(date +%Y-%m-%d-%H%M%S)\nBACKUP_FILE="$BACKUP_DIR/vault-$TIMESTAMP.db"\nmkdir -p "$BACKUP_DIR"\nif [ -f "$VAULT" ]; then\n cp "$VAULT" "$BACKUP_FILE"\n echo "Backup created: $BACKUP_FILE"\n ls -t "$BACKUP_DIR"/vault-*.db | tail -n +8 | xargs rm -f 2>/dev/null\n echo "Kept last 7 backups"\nelse\n echo "No vault.db found — nothing to backup"\nfi\n`;
    fs_1.default.writeFileSync(backupScriptPath, script);
    fs_1.default.chmodSync(backupScriptPath, '755');
    ensureDir(backupDir, 'context-vault/backups/');
    done('Created scripts/backup-vault.sh');
}
function runInitialDistill() {
    console.log('\n[6/6] Running initial distillation...');
    const dailyFiles = fs_1.default.existsSync(DAILIES_DIR) ? fs_1.default.readdirSync(DAILIES_DIR).filter(f => f.endsWith('.md')) : [];
    if (dailyFiles.length === 0) {
        skipped('No daily files found yet — run npm run v2:distill after adding files to memory/dailies/');
        return;
    }
    try {
        (0, child_process_1.execSync)('cd "' + SKILL_DIR + '" && npm run v2:distill', { stdio: 'inherit' });
        done('Initial distillation complete');
    }
    catch (e) {
        warning('Distillation error — run npm run v2:distill manually');
    }
}
function printSummary() {
    console.log('\n==================================================');
    console.log(' Session Context Extractor V2 — Setup Complete');
    console.log('==================================================');
    if (log.length > 0) {
        console.log('\nCompleted:');
        log.forEach(l => console.log(' checkmark ' + l));
    }
    if (skip.length > 0) {
        console.log('\nAlready in place:');
        skip.forEach(s => console.log(' -> ' + s));
    }
    if (warn.length > 0) {
        console.log('\nNeeds attention:');
        warn.forEach(w => console.log(' WARNING ' + w));
    }
    console.log('\nNext steps:');
    console.log(' 1. Fill in your details in USER.md');
    console.log(' 2. Tell your agent about your day — it logs automatically');
    console.log(' 3. Ask: "Give me a weekly summary" to query your vault');
    console.log(' 4. Run scripts/backup-vault.sh anytime to back up your data');
    console.log('==================================================\n');
}
async function main() {
    console.log('\n==================================================');
    console.log(' Session Context Extractor V2 — Setup');
    console.log(' Workspace: ' + WORKSPACE);
    console.log('==================================================');
    setupDirectories();
    setupUserMd();
    setupHeartbeat();
    setupHeartbeatMd();
    setupBackupScript();
    runInitialDistill();
    printSummary();
}
main().catch(err => { console.error('\n[SETUP] Fatal error:', err); process.exit(1); });
//# sourceMappingURL=setup.js.map