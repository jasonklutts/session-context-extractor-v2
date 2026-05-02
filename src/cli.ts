import { VaultDatabase } from './db';
import { VaultWriter } from './vault-writer';
import { QueryEngine } from './query-engine';
import path from 'path';
import fs from 'fs';

const workspacePath = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME || '', '.openclaw', 'workspace');

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    // Ensure vault directory exists
    const vaultDir = path.join(workspacePath, 'context-vault');
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true });
    }

    const db = new VaultDatabase(workspacePath);
    await db.initialize();
    const writer = new VaultWriter(workspacePath);
    const engine = new QueryEngine(db);

    switch (command) {
      case 'query': {
        const query = args.join(' ');
        if (!query) {
          console.log('Usage: npm run query "your question here"');
          break;
        }

        console.log(`\n🔍 Searching vault for: "${query}"\n`);
        const results = engine.askQuestion(query);

        if (results.length === 0) {
          console.log('No results found.');
          break;
        }

        for (const result of results.slice(0, 5)) {
          const { fact, context } = result;
          console.log(`[${context}] ${fact.title}`);
          console.log(`  ${fact.content.substring(0, 100)}...`);
          if (fact.system) console.log(`  System: ${fact.system}`);
          console.log();
        }
        break;
      }

      case 'list': {
        const type = args[0] as any;
        const facts = type ? engine.getByType(type, 20) : engine.getRecent(7);

        console.log(`\n📚 Found ${facts.length} facts:\n`);
        for (const fact of facts) {
          const verified = fact.verified ? '✓' : '○';
          const date = new Date(fact.timestamp).toLocaleDateString();
          console.log(`[${verified}] ${fact.type} - ${fact.title} (${date})`);
        }
        break;
      }

      case 'verify': {
        const factId = args[0];
        if (!factId) {
          console.log('Usage: npm run verify <fact-id>');
          break;
        }
        db.verifyFact(factId);
        console.log(`✓ Fact ${factId} verified`);
        break;
      }

      case 'unverified': {
        const unverified = engine.getUnverified();
        console.log(`\n⚠️  Unverified facts (${unverified.length}):\n`);
        for (const fact of unverified.slice(0, 10)) {
          console.log(`${fact.id} - ${fact.title}`);
        }
        break;
      }

      case 'stale': {
        const stale = engine.getStaleDecisions(90);
        console.log(`\n⏰ Decisions older than 90 days (${stale.length}):\n`);
        for (const decision of stale.slice(0, 10)) {
          const date = new Date(decision.timestamp).toLocaleDateString();
          console.log(`${date} - ${decision.title}`);
        }
        break;
      }

      case 'export': {
        const format = args[0] || 'json';
        const recent = engine.getRecent(30);

        if (format === 'json') {
          console.log(JSON.stringify(recent, null, 2));
        } else if (format === 'csv') {
          console.log('id,type,title,timestamp,verified,system');
          for (const fact of recent) {
            console.log(
              `"${fact.id}","${fact.type}","${fact.title}","${fact.timestamp}",${fact.verified ? 'yes' : 'no'},"${fact.system || ''}"`
            );
          }
        }
        break;
      }

      default: {
        console.log(`
Session Context Extractor

Usage:
  npm run query "your question"     - Search the vault
  npm run extract                   - Extract from daily logs (for agent use)
  npm run list [type]               - List facts (optional: decision|error|preference|contact)
  npm run unverified                - Show unverified preferences
  npm run stale                     - Show decisions older than 90 days
  npm run verify <fact-id>          - Mark a preference as verified
  npm run export [json|csv]         - Export recent facts

Examples:
  npm run query "What did we decide about OCI?"
  npm run list decision
  npm run export json > facts.json
        `);
      }
    }

    db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
