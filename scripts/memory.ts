/**
 * memory.ts
 *
 * Read/write helpers for the agent's MEMORY.md public identity file.
 * MEMORY.md uses the pattern: - **Key**: `value`
 *
 * IMPORTANT: This file stores ONLY public data (address, agentId, etc.).
 * Private keys are managed exclusively by keystore.ts.
 *
 * Dependencies: fs (Node built-in)
 */

import * as fs from 'fs';

const DEFAULT_MEMORY_PATH = './MEMORY.md';

/**
 * Ensure MEMORY.md exists. If not, copy from template or create minimal.
 */
export function ensureMemoryExists(
  memoryPath: string = DEFAULT_MEMORY_PATH,
  templatePath?: string
): void {
  if (fs.existsSync(memoryPath)) return;

  if (templatePath && fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, memoryPath);
  } else {
    const minimal = `# Agent Identity Memory

> This file contains **public** agent identity data only. The private key is stored
> securely in the keystore backend (OS keychain or encrypted file) — never here.

## Wallet

- **Address**: \`<NOT SET>\`
- **Keystore Backend**: \`<NOT SET>\`
- **Keystore Path**: \`<NOT SET>\`
- **Created At**: \`<NOT SET>\`

## Registration

- **Status**: \`unregistered\`
- **Agent ID**: \`<NOT SET>\`
- **Agent Registry**: \`<NOT SET>\`
- **Agent URI**: \`<NOT SET>\`
- **Chain ID**: \`<NOT SET>\`
- **Registered At**: \`<NOT SET>\`

## Agent Profile

- **Name**: \`<NOT SET>\`
- **Description**: \`<NOT SET>\`
- **Image**: \`<NOT SET>\`

## Services

## Sessions

## Notes
`;
    fs.writeFileSync(memoryPath, minimal);
  }
}

/**
 * Read all populated fields from MEMORY.md.
 * Returns a map of Key → value (skips <NOT SET> fields).
 */
export function readMemory(memoryPath: string = DEFAULT_MEMORY_PATH): Record<string, string> {
  if (!fs.existsSync(memoryPath)) return {};
  const content = fs.readFileSync(memoryPath, 'utf-8');
  const fields: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*`(.+?)`/);
    if (match && match[2] !== '<NOT SET>') {
      fields[match[1]] = match[2];
    }
  }
  return fields;
}

/**
 * Write a single field value in MEMORY.md.
 */
export function writeMemoryField(
  key: string,
  value: string,
  memoryPath: string = DEFAULT_MEMORY_PATH
): void {
  let content = fs.readFileSync(memoryPath, 'utf-8');
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(- \\*\\*${escaped}\\*\\*:\\s*)\`.+?\``);
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1\`${value}\``);
  } else {
    content += `\n- **${key}**: \`${value}\`\n`;
  }
  fs.writeFileSync(memoryPath, content);
}

/**
 * Append a line under a ## Section header in MEMORY.md.
 */
export function appendToMemorySection(
  section: string,
  line: string,
  memoryPath: string = DEFAULT_MEMORY_PATH
): void {
  let content = fs.readFileSync(memoryPath, 'utf-8');
  const marker = `## ${section}`;
  const idx = content.indexOf(marker);
  if (idx === -1) {
    content += `\n## ${section}\n\n${line}\n`;
  } else {
    const headerEnd = content.indexOf('\n', idx);
    if (headerEnd === -1) {
      content += `\n${line}\n`;
    } else {
      let insertPos = headerEnd + 1;
      const afterHeader = content.slice(insertPos);
      const commentMatch = afterHeader.match(/^<!--.*?-->\n/);
      if (commentMatch) insertPos += commentMatch[0].length;
      if (content[insertPos] === '\n') insertPos += 1;
      content = content.slice(0, insertPos) + line + '\n' + content.slice(insertPos);
    }
  }
  fs.writeFileSync(memoryPath, content);
}

/**
 * Check if the agent has a wallet address recorded.
 * Note: This only checks MEMORY.md — the actual key is in the keystore.
 */
export function hasWalletRecord(memoryPath: string = DEFAULT_MEMORY_PATH): boolean {
  const mem = readMemory(memoryPath);
  return !!mem['Address'];
}

/**
 * Check if the agent is registered on-chain.
 */
export function isRegistered(memoryPath: string = DEFAULT_MEMORY_PATH): boolean {
  const mem = readMemory(memoryPath);
  return mem['Status'] === 'registered' && !!mem['Agent ID'];
}
