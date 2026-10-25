// Run: node evaluation/agent_md_sync_test.mjs
// Checks the agent's code uses the instructions in AGENT.md word for word.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGENT_INSTRUCTIONS } from '../lib/agent-instructions.mjs';

const md = readFileSync(new URL('../AGENT.md', import.meta.url), 'utf8');
const section = md.split('## Agent instructions')[1] ?? '';
const block = section.split('```text\n')[1]?.split('\n```')[0];
assert.ok(block, 'AGENT.md needs a ```text block under "## Agent instructions"');
assert.equal(block.trim(), AGENT_INSTRUCTIONS.trim(), 'AGENT.md instructions and lib/agent-instructions.mjs differ');
console.log('AGENT.md and the agent code use the same instructions.');
