import fs from 'fs';
import path from 'path';
import { Fact } from './types';

export class Indexer {
  private vaultDir: string;
  private peopleDir: string;
  private projectsDir: string;
  private errorsDir: string;

  constructor(workspacePath: string) {
    this.vaultDir = path.join(workspacePath, 'context-vault');
    this.peopleDir = path.join(this.vaultDir, 'people');
    this.projectsDir = path.join(this.vaultDir, 'projects');
    this.errorsDir = path.join(this.vaultDir, 'errors');
    [this.peopleDir, this.projectsDir, this.errorsDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  index(fact: Fact): void {
    try {
      switch (fact.type) {
        case 'contact': this.indexContact(fact); break;
        case 'decision': this.indexDecision(fact); break;
        case 'error': this.indexError(fact); break;
      }
    } catch (err) {
      console.error('[INDEXER] Failed to index fact ' + fact.id + ':', err);
    }
  }

  private indexContact(fact: Fact): void {
    const details = fact.details as any;
    const name = this.extractName(fact.content, details?.name);
    if (!name) return;
    const slug = this.slugify(name);
    const filePath = path.join(this.peopleDir, slug + '.md');
    const date = new Date(fact.timestamp).toISOString().split('T')[0];
    if (!fs.existsSync(filePath)) {
      const relationship = this.extractRelationship(fact.content);
      const content = '# ' + name + '\n\n' +
        '**First seen:** ' + date + '\n' +
        (relationship ? '**Role/Relationship:** ' + relationship + '\n' : '') +
        '\n## Mentions\n' +
        '- [' + date + '] ' + fact.content + '\n';
      fs.writeFileSync(filePath, content);
      console.log('[INDEXER] Created people/' + slug + '.md');
    } else {
      const existing = fs.readFileSync(filePath, 'utf-8');
      const entry = '- [' + date + '] ' + fact.content;
      if (!existing.includes(entry)) {
        fs.appendFileSync(filePath, entry + '\n');
        console.log('[INDEXER] Updated people/' + slug + '.md');
      }
    }
  }

  private indexDecision(fact: Fact): void {
    const topic = this.extractTopic(fact.content);
    if (!topic) return;
    const slug = this.slugify(topic);
    const filePath = path.join(this.projectsDir, slug + '.md');
    const date = new Date(fact.timestamp).toISOString().split('T')[0];
    if (!fs.existsSync(filePath)) {
      const content = '# ' + topic + '\n\n' +
        '**First decision:** ' + date + '\n' +
        '\n## Decisions\n' +
        '- [' + date + '] ' + fact.content + '\n';
      fs.writeFileSync(filePath, content);
      console.log('[INDEXER] Created projects/' + slug + '.md');
    } else {
      const existing = fs.readFileSync(filePath, 'utf-8');
      const entry = '- [' + date + '] ' + fact.content;
      if (!existing.includes(entry)) {
        fs.appendFileSync(filePath, entry + '\n');
        console.log('[INDEXER] Updated projects/' + slug + '.md');
      }
    }
  }

  private indexError(fact: Fact): void {
    const details = fact.details as any;
    const component = (details?.affectedComponent || this.extractComponent(fact.content) || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const date = new Date(fact.timestamp).toISOString().split('T')[0];
    const slug = date + '-' + this.slugify(component);
    const filePath = path.join(this.errorsDir, slug + '.md');
    if (!fs.existsSync(filePath)) {
      const resolution = details?.resolution || '';
      const status = resolution ? 'resolved' : 'unresolved';
      const content = '# Error: ' + date + ' — ' + component + '\n\n' +
        '**Date:** ' + date + '\n' +
        '**Component:** ' + component + '\n' +
        '**Status:** ' + status + '\n' +
        '\n## Details\n' + fact.content + '\n' +
        (resolution ? '\n## Resolution\n' + resolution + '\n' : '');
      fs.writeFileSync(filePath, content);
      console.log('[INDEXER] Created errors/' + slug + '.md');
    } else {
      const existing = fs.readFileSync(filePath, 'utf-8');
      const resolution = details?.resolution;
      if (resolution && existing.includes('**Status:** unresolved')) {
        const updated = existing.replace('**Status:** unresolved', '**Status:** resolved') + '\n## Resolution\n' + resolution + '\n';
        fs.writeFileSync(filePath, updated);
        console.log('[INDEXER] Marked errors/' + slug + '.md as resolved');
      }
    }
  }

  private extractName(content: string, storedName?: string): string | null {
    if (storedName && storedName.length > 1 && storedName !== 'unknown') {
      return storedName.charAt(0).toUpperCase() + storedName.slice(1);
    }
    const patterns = [
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+is\s+/,
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+was\s+/,
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+works?\s+/,
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1];
    }
    const firstCap = content.match(/\b([A-Z][a-z]{2,})\b/);
    return firstCap ? firstCap[1] : null;
  }

  private extractRelationship(content: string): string {
    const match = content.match(/is\s+(?:my\s+)?(.+)/i);
    return match ? match[1].trim() : '';
  }

  private extractTopic(content: string): string | null {
    const lower = content.toLowerCase();

    // Known topics — checked first, highest priority
    const knownTopics: Record<string, string> = {
      'oci': 'OCI', 'oracle': 'OCI', 'azure': 'Azure', 'az-104': 'Azure',
      'proxmox': 'Proxmox', 'splunk': 'Splunk', 'thehive': 'TheHive',
      'raspberry pi': 'Raspberry-Pi', 'docker': 'Docker', 'nextcloud': 'Nextcloud',
      'tailscale': 'Tailscale', 'certification': 'Certifications', 'cert': 'Certifications',
      'homelab': 'Homelab', 'security': 'Security', 'python': 'Python',
      'flask': 'Flask', 'fastapi': 'FastAPI', 'wazuh': 'Wazuh',
      'terraform': 'Terraform', 'kubernetes': 'Kubernetes', 'ansible': 'Ansible',
    };

    for (const [keyword, topic] of Object.entries(knownTopics)) {
      if (lower.includes(keyword)) return topic;
    }

    // Words that should never become topic names
    const blocklist = new Set([
      'spent', 'worked', 'studied', 'completed', 'decided', 'chose',
      'picked', 'started', 'finished', 'today', 'yesterday', 'morning',
      'evening', 'meeting', 'long', 'short', 'good', 'bad', 'great',
      'hours', 'minutes', 'time', 'work', 'day', 'week',
    ]);

    // Only index if content looks like a real strategic decision
    // Must contain a verb suggesting deliberate choice
    const decisionVerbs = [
      'chose', 'decided', 'will use', 'switching to', 'moving to',
      'going with', 'prioritizing', 'deprioritizing', 'selected', 'picked',
      'agreed to', 'planning to', 'committed to',
    ];
    const hasDecisionVerb = decisionVerbs.some(v => lower.includes(v));
    if (!hasDecisionVerb) return null;

    // Try first capitalized word as fallback
    const match = content.match(/\b([A-Z][a-zA-Z0-9]{2,})\b/);
    if (match && !blocklist.has(match[1].toLowerCase())) return match[1];

    return null;
  }

  private extractComponent(content: string): string {
    const lower = content.toLowerCase();
    const components = [
      'proxmox', 'splunk', 'thehive', 'docker', 'nextcloud', 'tailscale',
      'nginx', 'flask', 'fastapi', 'sqlite', 'raspberry', 'homelab',
      'network', 'ssh', 'git',
    ];
    for (const c of components) {
      if (lower.includes(c)) return c;
    }
    return 'unknown';
  }

  private slugify(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}