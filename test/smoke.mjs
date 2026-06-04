import assert from 'node:assert/strict';
import { actionNode, createDocument, effectNode, entityNode } from '@shapeshift-labs/frontier-lang-kernel';
import { checkDocument, createEvidenceSummary } from '../dist/index.js';
const doc = createDocument({ id: 'mod', name: 'Example', nodes: [effectNode({ id: 'effect_clock', name: 'Clock', capability: 'Clock' }), entityNode({ id: 'ent', name: 'Todo', fields: [{ id: 'title', name: 'title', type: 'Text', merge: { kind: 'conflict' } }] }), actionNode({ id: 'act', name: 'addTodo', uses: ['Clock'] })] });
const result = checkDocument(doc, { strictEffects: true });
assert.equal(result.ok, true);
assert.equal(createEvidenceSummary('check', result).status, 'passed');
