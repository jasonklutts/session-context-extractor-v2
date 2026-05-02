import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE = process.env.OPENCLAW_WORKSPACE ||
  path.join(process.env.HOME || '', '.openclaw', 'workspace');

const SKILL_DIR = path.join(WORKSPACE, 'skills', 'session-context-extractor-v2');
const VAULT_DIR = path.join(WORKSPACE, 'context-vault');
const DAILIES_DIR = path.join(WORKSPACE, 'memory', 'dailies');
const ARCHIVE_DIR = path.join(WORKSPACE, 'memory', 'archive');
const OPENCLAW_JSON = path.join(WORKSPACE, 'openclaw.json');
const MAIN_OPENCLAW_JSON = path.join(process.env.HOME || '', '.openclaw', 'workspace', 'openclaw.json');

const log: string[] = [];
const skip: string[] = [];
const warn: string[] = [];

function done(msg: string) { log.push(msg); console.log('  + ' + msg); }
function skipped(msg: string) { skip.push(msg); console.log('  . ' + msg + ' (already exists)'); }
function warning(msg: string) { warn.push(msg); console.log('  ! ' + msg); }

function ensureDir(dirPath: string, label: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    done('Created ' + label);
  } else {
    skipped(label);
  }
}

function setupDirectories() {
  console.log('\n[1/6] Setting up directory structure...');
  ensureDir(DAILIES_DIR, 'memory/dailies/');
  ensureDir(ARCHIVE_DIR, 'memory/archive/');
  ensureDir(VAULT_DIR, 'context-vault/');
  ensureDir(path.join(VAULT_DIR, 'people'), 'context-vault/people/');
  ensureDir(path.join(VAULT_DIR, 'projects'), 'context-vault/projects/');
  ensureDir(path.join(VAULT_DIR, 'errors'), 'context-vault/errors/');
  ensureDir(path.join(VAULT_DIR, 'backups'), 'context-vault/backups/');
  ensureDir(path.join(VAULT_DIR, 'atomic'), 'context-vault/atomic/');
  ensureDir(path.join(SKILL_DIR, 'memory'), 'skill memory/');
  ensureDir(path.join(WORKSPACE, 'scripts'), 'scripts/');
}

function setupUserMd() {
  console.log('\n[2/6] Checking USER.md...');
  const userMdPath = path.join(WORKSPACE, 'USER.md');
  if (fs.existsSync(userMdPath)) { skipped('USER.md'); return; }
  const template = [
    '# USER.md — About You',
    '',
    '## Identity',
    '- Name: ',
    '- Location: ',
    '- Timezone: ',
    '',
    '## Work',
    '- Role: ',
    '- Company: ',
    '- Current projects: ',
    '',
    '## Goals',
    '- Short term: ',
    '- Long term: ',
    '',
    '## Preferences',
    '- Communication style: ',
    '- Working hours: ',
    '- Tools and tech: ',
    '',
    '## Health & Habits',
    '- Exercise: ',
    '- Sleep target: ',
    '- Diet notes: ',
    '',
    '## People',
    '<!-- Contacts learned from conversations -->',
    '',
    '## Recently Learned',
    '<!-- Auto-updated from session context -->',
    '',
  ].join('\n');
  fs.writeFileSync(userMdPath, template);
  done('Created USER.md template — fill in your details');
}

function setupHeartbeat() {
  console.log('\n[3/6] Configuring heartbeat in openclaw.json...');
  const configPath = fs.existsSync(OPENCLAW_JSON)
    ? OPENCLAW_JSON
    : fs.existsSync(MAIN_OPENCLAW_JSON)
      ? MAIN_OPENCLAW_JSON
      : null;

  if (!configPath) {
    warning('Could not find openclaw.json — add heartbeat config manually (see README)');
    return;
  }

  let config: any;
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); }
  catch (e) { warning('Could not parse openclaw.json — skipping heartbeat config'); return; }

  if (config.heartbeat?.enabled) { skipped('Heartbeat already configured in openclaw.json'); return; }

  config.heartbeat = {
    enabled: true,
    prompt: 'Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.',
    intervalMinutes: 60,
    activeHours: '00-24',
  };

  const backupPath = configPath + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(configPath, backupPath);
  done('Backed up openclaw.json to ' + path.basename(backupPath));

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  done('Added heartbeat config to openclaw.json (60 min, 24hr)');
}

function setupHeartbeatMd() {
  console.log('\n[4/6] Setting up HEARTBEAT.md...');
  const heartbeatPath = path.join(WORKSPACE, 'HEARTBEAT.md');

  if (fs.existsSync(heartbeatPath)) {
    const existing = fs.readFileSync(heartbeatPath, 'utf-8');

    let appended = false;

    if (!existing.includes('session-context-extractor')) {
      fs.appendFileSync(heartbeatPath, [
        '',
        '## Memory Distillation',
        '- Run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill',
        '- Only run if new daily files exist since last distillation',
        '- Confirm fact count after running',
        '',
      ].join('\n'));
      done('Added distillation task to existing HEARTBEAT.md');
      appended = true;
    }

    if (!existing.includes('v2:archive')) {
      fs.appendFileSync(heartbeatPath, [
        '',
        '## Weekly Archive (Sundays only)',
        '- Check if today is Sunday',
        '- If yes, run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:archive',
        '- This moves old daily files to memory/archive/, compresses the distill log, and backs up the vault',
        '',
      ].join('\n'));
      done('Added weekly archive task to HEARTBEAT.md');
      appended = true;
    }

    if (!appended) skipped('HEARTBEAT.md already has all required tasks');
  } else {
    const template = [
      '# HEARTBEAT.md',
      '',
      'Instructions for periodic agent check-ins. Read this on every heartbeat.',
      'Do not repeat tasks already completed in prior sessions.',
      '',
      '## Every Hour',
      '- Write a brief session recap to memory/dailies/YYYY-MM-DD.md if anything significant happened',
      '- Check for pending tasks or follow-ups',
      '',
      '## Memory Distillation',
      '- Run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:distill',
      '- Only run if new daily files exist since last distillation',
      '- Confirm fact count after running',
      '',
      '## Weekly Archive (Sundays only)',
      '- Check if today is Sunday',
      '- If yes, run: cd /home/openclaw/.openclaw/workspace/skills/session-context-extractor-v2 && npm run v2:archive',
      '- This moves old daily files to memory/archive/, compresses the distill log, and backs up the vault',
      '',
      '## Every 6 Hours',
      '- Verify backup exists for today',
      '- Update USER.md if new permanent facts were learned about the user',
      '',
      '## Daily',
      '- Archive completed tasks',
      '- Review context-vault/errors/ for unresolved issues',
      '',
      'If nothing needs attention, reply: HEARTBEAT_OK',
      '',
    ].join('\n');
    fs.writeFileSync(heartbeatPath, template);
    done('Created HEARTBEAT.md with distillation and archive schedules');
  }
}

function setupBackupScript() {
  console.log('\n[5/6] Creating backup script...');
  const backupScriptPath = path.join(WORKSPACE, 'scripts', 'backup-vault.sh');
  if (fs.existsSync(backupScriptPath)) { skipped('scripts/backup-vault.sh'); return; }

  const backupDir = path.join(VAULT_DIR, 'backups');
  const script = [
    '#!/bin/bash',
    '# backup-vault.sh — backs up vault.db with a timestamp',
    '# Run manually or triggered by agent',
    '',
    'VAULT="' + VAULT_DIR + '/vault.db"',
    'BACKUP_DIR="' + backupDir + '"',
    'TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)',
    'BACKUP_FILE="$BACKUP_DIR/vault-$TIMESTAMP.db"',
    '',
    'mkdir -p "$BACKUP_DIR"',
    '',
    'if [ -f "$VAULT" ]; then',
    '  cp "$VAULT" "$BACKUP_FILE"',
    '  echo "Backup created: $BACKUP_FILE"',
    '  ls -t "$BACKUP_DIR"/vault-*.db | tail -n +8 | xargs rm -f 2>/dev/null',
    '  echo "Kept last 7 backups"',
    'else',
    '  echo "No vault.db found — nothing to backup"',
    'fi',
    '',
  ].join('\n');

  fs.writeFileSync(backupScriptPath, script);
  fs.chmodSync(backupScriptPath, '755');
  done('Created scripts/backup-vault.sh (keeps last 7 backups)');
}

function runInitialDistill() {
  console.log('\n[6/6] Running initial distillation...');
  const dailyFiles = fs.existsSync(DAILIES_DIR)
    ? fs.readdirSync(DAILIES_DIR).filter(f => f.endsWith('.md'))
    : [];

  if (dailyFiles.length === 0) {
    skipped('No daily files found yet');
    console.log('       Add files to memory/dailies/ and run: npm run v2:distill');
    return;
  }

  try {
    execSync('cd "' + SKILL_DIR + '" && npm run v2:distill', { stdio: 'inherit' });
    done('Initial distillation complete');
  } catch (e) {
    warning('Distillation encountered an error — run npm run v2:distill manually');
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(52));
  console.log('  Session Context Extractor V2 — Setup Complete');
  console.log('='.repeat(52));

  if (log.length > 0) {
    console.log('\nCompleted:');
    log.forEach(l => console.log('  + ' + l));
  }

  if (skip.length > 0) {
    console.log('\nAlready in place:');
    skip.forEach(s => console.log('  . ' + s));
  }

  if (warn.length > 0) {
    console.log('\nNeeds attention:');
    warn.forEach(w => console.log('  ! ' + w));
  }

  console.log('\nNext steps:');
  console.log('  1. Fill in your details in USER.md');
  console.log('  2. Paste the standing instruction from README.md to your agent');
  console.log('  3. Talk to your agent — it logs everything automatically');
  console.log('  4. Ask: "Give me a weekly summary" to query your vault');
  console.log('  5. Every Sunday, npm run v2:archive archives the previous week');
  console.log('\n' + '='.repeat(52) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(52));
  console.log('  Session Context Extractor V2 — Setup');
  console.log('  Workspace: ' + WORKSPACE);
  console.log('='.repeat(52));

  setupDirectories();
  setupUserMd();
  setupHeartbeat();
  setupHeartbeatMd();
  setupBackupScript();
  runInitialDistill();
  printSummary();
}

main().catch(err => {
  console.error('\n[SETUP] Fatal error:', err);
  process.exit(1);
});