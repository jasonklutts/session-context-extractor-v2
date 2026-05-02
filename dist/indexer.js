"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Indexer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Indexer {
    constructor(workspacePath) {
        this.vaultDir = path_1.default.join(workspacePath, 'context-vault');
        this.peopleDir = path_1.default.join(this.vaultDir, 'people');
        this.projectsDir = path_1.default.join(this.vaultDir, 'projects');
        this.errorsDir = path_1.default.join(this.vaultDir, 'errors');
        [this.peopleDir, this.projectsDir, this.errorsDir].forEach(d => {
            if (!fs_1.default.existsSync(d))
                fs_1.default.mkdirSync(d, { recursive: true });
        });
    }
    index(fact) {
        try {
            switch (fact.type) {
                case 'contact':
                    this.indexContact(fact);
                    break;
                case 'decision':
                    this.indexDecision(fact);
                    break;
                case 'error':
                    this.indexError(fact);
                    break;
            }
        }
        catch (err) {
            console.error('[INDEXER] Failed to index fact ' + fact.id + ':', err);
        }
    }
    indexContact(fact) {
        const details = fact.details;
        const name = this.extractName(fact.content, details?.name);
        if (!name)
            return;
        const slug = this.slugify(name);
        const filePath = path_1.default.join(this.peopleDir, slug + '.md');
        const date = new Date(fact.timestamp).toISOString().split('T')[0];
        if (!fs_1.default.existsSync(filePath)) {
            const relationship = this.extractRelationship(fact.content);
            const content = '# ' + name + '\n\n' +
                '**First seen:** ' + date + '\n' +
                (relationship ? '**Role/Relationship:** ' + relationship + '\n' : '') +
                '\n## Mentions\n' +
                '- [' + date + '] ' + fact.content + '\n';
            fs_1.default.writeFileSync(filePath, content);
            console.log('[INDEXER] Created people/' + slug + '.md');
        }
        else {
            const existing = fs_1.default.readFileSync(filePath, 'utf-8');
            const entry = '- [' + date + '] ' + fact.content;
            if (!existing.includes(entry)) {
                fs_1.default.appendFileSync(filePath, entry + '\n');
                console.log('[INDEXER] Updated people/' + slug + '.md');
            }
        }
    }
    indexDecision(fact) {
        const topic = this.extractTopic(fact.content);
        if (!topic)
            return;
        const slug = this.slugify(topic);
        const filePath = path_1.default.join(this.projectsDir, slug + '.md');
        const date = new Date(fact.timestamp).toISOString().split('T')[0];
        if (!fs_1.default.existsSync(filePath)) {
            const content = '# ' + topic + '\n\n' +
                '**First decision:** ' + date + '\n' +
                '\n## Decisions\n' +
                '- [' + date + '] ' + fact.content + '\n';
            fs_1.default.writeFileSync(filePath, content);
            console.log('[INDEXER] Created projects/' + slug + '.md');
        }
        else {
            const existing = fs_1.default.readFileSync(filePath, 'utf-8');
            const entry = '- [' + date + '] ' + fact.content;
            if (!existing.includes(entry)) {
                fs_1.default.appendFileSync(filePath, entry + '\n');
                console.log('[INDEXER] Updated projects/' + slug + '.md');
            }
        }
    }
    indexError(fact) {
        const details = fact.details;
        const component = (details?.affectedComponent || this.extractComponent(fact.content) || 'unknown').toLowerCase().replace(/\s+/g, '-');
        const date = new Date(fact.timestamp).toISOString().split('T')[0];
        const slug = date + '-' + this.slugify(component);
        const filePath = path_1.default.join(this.errorsDir, slug + '.md');
        if (!fs_1.default.existsSync(filePath)) {
            const resolution = details?.resolution || '';
            const status = resolution ? 'resolved' : 'unresolved';
            const content = '# Error: ' + date + ' — ' + component + '\n\n' +
                '**Date:** ' + date + '\n' +
                '**Component:** ' + component + '\n' +
                '**Status:** ' + status + '\n' +
                '\n## Details\n' + fact.content + '\n' +
                (resolution ? '\n## Resolution\n' + resolution + '\n' : '');
            fs_1.default.writeFileSync(filePath, content);
            console.log('[INDEXER] Created errors/' + slug + '.md');
        }
        else {
            const existing = fs_1.default.readFileSync(filePath, 'utf-8');
            const resolution = details?.resolution;
            if (resolution && existing.includes('**Status:** unresolved')) {
                const updated = existing.replace('**Status:** unresolved', '**Status:** resolved') + '\n## Resolution\n' + resolution + '\n';
                fs_1.default.writeFileSync(filePath, updated);
                console.log('[INDEXER] Marked errors/' + slug + '.md as resolved');
            }
        }
    }
    extractName(content, storedName) {
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
            if (match)
                return match[1];
        }
        const firstCap = content.match(/\b([A-Z][a-z]{2,})\b/);
        return firstCap ? firstCap[1] : null;
    }
    extractRelationship(content) {
        const match = content.match(/is\s+(?:my\s+)?(.+)/i);
        return match ? match[1].trim() : '';
    }
    extractTopic(content) {
        const lower = content.toLowerCase();
        const knownTopics = {
            'oci': 'OCI', 'oracle': 'OCI', 'azure': 'Azure', 'az-104': 'Azure',
            'proxmox': 'Proxmox', 'splunk': 'Splunk', 'thehive': 'TheHive',
            'raspberry pi': 'Raspberry-Pi', 'docker': 'Docker', 'nextcloud': 'Nextcloud',
            'tailscale': 'Tailscale', 'certification': 'Certifications', 'cert': 'Certifications',
            'homelab': 'Homelab', 'security': 'Security', 'python': 'Python',
            'flask': 'Flask', 'fastapi': 'FastAPI',
        };
        for (const [keyword, topic] of Object.entries(knownTopics)) {
            if (lower.includes(keyword))
                return topic;
        }
        const match = content.match(/\b([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)\b/);
        return match ? match[1] : 'General';
    }
    extractComponent(content) {
        const lower = content.toLowerCase();
        const components = ['proxmox', 'splunk', 'thehive', 'docker', 'nextcloud', 'tailscale', 'nginx', 'flask', 'fastapi', 'sqlite', 'raspberry', 'homelab', 'network', 'ssh', 'git'];
        for (const c of components) {
            if (lower.includes(c))
                return c;
        }
        return 'unknown';
    }
    slugify(str) {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
}
exports.Indexer = Indexer;
//# sourceMappingURL=indexer.js.map