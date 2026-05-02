import fs from 'fs';
import path from 'path';

/**
 * Weekly Archiver
 *
 * Runs every Sunday to archive the previous week's data:
 * 1. Moves daily files older than 7 days to memory/archive/YYYY-WXX/
 * 2. Compresses distill-log.md entries older than 7 days into a weekly summary
 * 3. Backs up vault.db with a weekly timestamp
 * 4. Leaves current week's files untouched
 *
 * Safe to run multiple times — skips already-archived files.
 */
export class WeeklyArchiver {
 private workspacePath: string;
 private dailiesDir: string;
 private archiveDir: string;
 private vaultDir: string;
 private distillLogPath: string;

 constructor(workspacePath: string, skillPath: string) {
 this.workspacePath = workspacePath;
 this.dailiesDir = path.join(workspacePath, 'memory', 'dailies');
 this.archiveDir = path.join(workspacePath, 'memory', 'archive');
 this.vaultDir = path.join(workspacePath, 'context-vault');
 this.distillLogPath = path.join(skillPath, 'distill-log.md');
 }

 /**
 * Run the full weekly archive process
 */
 run(): void {
 console.log('[ARCHIVE] Starting weekly archive...');

 const archived = this.archiveDailyFiles();
 const compressed = this.compressDistillLog();
 const backed = this.backupVault();

 console.log(`[ARCHIVE] Complete — ${archived} daily files archived, distill log ${compressed ? 'compressed' : 'unchanged'}, vault ${backed ? 'backed up' : 'backup skipped'}`);
 }

 /**
 * Move daily files older than 7 days into weekly archive folders
 * Folder format: memory/archive/YYYY-WXX/
 */
 private archiveDailyFiles(): number {
 if (!fs.existsSync(this.dailiesDir)) return 0;

 const cutoff = new Date();
 cutoff.setDate(cutoff.getDate() - 7);
 const cutoffStr = cutoff.toISOString().split('T')[0];

 const files = fs.readdirSync(this.dailiesDir)
 .filter(f => f.endsWith('.md') && f <= cutoffStr)
 .sort();

 if (files.length === 0) {
 console.log('[ARCHIVE] No daily files to archive');
 return 0;
 }

 let count = 0;

 for (const file of files) {
 const dateStr = file.replace('.md', '');
 const weekLabel = this.getWeekLabel(dateStr);
 const weekDir = path.join(this.archiveDir, weekLabel);

 if (!fs.existsSync(weekDir)) {
 fs.mkdirSync(weekDir, { recursive: true });
 console.log(`[ARCHIVE] Created archive folder: ${weekLabel}/`);
 }

 const src = path.join(this.dailiesDir, file);
 const dst = path.join(weekDir, file);

 if (!fs.existsSync(dst)) {
 fs.renameSync(src, dst);
 console.log(`[ARCHIVE] Archived ${file} → ${weekLabel}/${file}`);
 count++;
 }
 }

 return count;
 }

 /**
 * Compress distill-log.md by replacing entries older than 7 days
 * with a single weekly summary line per week
 */
 private compressDistillLog(): boolean {
 if (!fs.existsSync(this.distillLogPath)) return false;

 const content = fs.readFileSync(this.distillLogPath, 'utf-8');
 const sections = content.split(/\n(?=## Distilled )/);

 const cutoff = new Date();
 cutoff.setDate(cutoff.getDate() - 7);
 const cutoffStr = cutoff.toISOString().split('T')[0];

 const recent: string[] = [];
 const toArchive: Map<string, string[]> = new Map();

 for (const section of sections) {
 const dateMatch = section.match(/## Distilled (\d{4}-\d{2}-\d{2})/);
 if (!dateMatch) {
 recent.push(section);
 continue;
 }

 const date = dateMatch[1];
 if (date >= cutoffStr) {
 recent.push(section);
 } else {
 const weekLabel = this.getWeekLabel(date);
 if (!toArchive.has(weekLabel)) toArchive.set(weekLabel, []);
 toArchive.get(weekLabel)!.push(section);
 }
 }

 if (toArchive.size === 0) {
 console.log('[ARCHIVE] Distill log — nothing old enough to compress');
 return false;
 }

 // Build compressed summaries for old weeks
 const summaries: string[] = [];
 for (const [week, sections] of toArchive) {
 const factCount = (sections.join('').match(/^- /gm) || []).length;
 summaries.push(`## Archive: ${week} (${factCount} facts distilled)\n`);
 }

 const newContent = [...summaries, ...recent].join('\n');
 fs.writeFileSync(this.distillLogPath, newContent);
 console.log(`[ARCHIVE] Distill log compressed — ${toArchive.size} week(s) archived`);
 return true;
 }

 /**
 * Create a weekly backup of vault.db
 * Keeps last 4 weekly backups
 */
 private backupVault(): boolean {
 const vaultPath = path.join(this.vaultDir, 'vault.db');
 if (!fs.existsSync(vaultPath)) {
 console.log('[ARCHIVE] No vault.db to back up');
 return false;
 }

 const backupDir = path.join(this.vaultDir, 'backups');
 if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

 const week = this.getWeekLabel(new Date().toISOString().split('T')[0]);
 const backupPath = path.join(backupDir, `vault-${week}.db`);

 fs.copyFileSync(vaultPath, backupPath);
 console.log(`[ARCHIVE] Vault backed up to backups/vault-${week}.db`);

 // Keep last 4 weekly backups
 const backups = fs.readdirSync(backupDir)
 .filter(f => f.startsWith('vault-') && f.endsWith('.db'))
 .sort()
 .reverse();

 if (backups.length > 4) {
 const toDelete = backups.slice(4);
 for (const f of toDelete) {
 fs.unlinkSync(path.join(backupDir, f));
 console.log(`[ARCHIVE] Removed old backup: ${f}`);
 }
 }

 return true;
 }

 /**
 * Convert a date string to ISO week label: YYYY-WXX
 * e.g. "2026-04-27" → "2026-W18"
 */
 private getWeekLabel(dateStr: string): string {
 const date = new Date(dateStr);
 const year = date.getFullYear();

 // Get ISO week number
 const startOfYear = new Date(year, 0, 1);
 const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
 const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

 return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
 }
}

// CLI entry point — can be run directly
if (require.main === module) {
 const workspacePath = process.env.OPENCLAW_WORKSPACE ||
 require('path').join(process.env.HOME || '', '.openclaw', 'workspace');
 const skillPath = require('path').join(
 workspacePath, 'skills', 'session-context-extractor-v2', 'memory'
 );
 const archiver = new WeeklyArchiver(workspacePath, skillPath);
 archiver.run();
}