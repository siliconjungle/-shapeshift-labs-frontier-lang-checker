import assert from 'node:assert/strict';
import {
  actionNode,
  createDocument,
  createPatch,
  effectNode,
  entityNode,
  externNode,
  latticeNode,
  typeNode
} from '@shapeshift-labs/frontier-lang-kernel';
import { checkDocument, checkPatchBundle, createEvidenceSummary } from '../dist/index.js';
const doc = createDocument({ id: 'mod', name: 'Example', nodes: [
  effectNode({ id: 'effect_clock', name: 'Clock', capability: 'Clock' }),
  latticeNode({
    id: 'lat_tags',
    name: 'TagSet',
    carrier: 'Set<Text>',
    laws: ['semilattice', 'commutative'],
    frontierCrdt: { packageName: '@shapeshift-labs/frontier-crdt', exportName: 'createCrdtOrSetLattice' }
  }),
  typeNode({ id: 'type_input', name: 'TodoInput', fields: [{ id: 'input_title', name: 'title', type: 'Text' }] }),
  externNode({ id: 'extern_persist', name: 'persistTodo', language: 'typescript', symbol: 'persistTodo', signature: { input: 'TodoInput', returns: 'Patch' }, effects: ['storage'] }),
  entityNode({ id: 'ent', name: 'Todo', fields: [
    { id: 'title', name: 'title', type: 'Text', merge: { kind: 'conflict' } },
    { id: 'tags', name: 'tags', type: { kind: 'set', item: 'Text' }, merge: { kind: 'union', latticeId: 'TagSet' }, semantic: { kind: 'crdt', latticeId: 'lat_tags', crdt: { type: 'or-set' } } }
  ] }),
  actionNode({ id: 'act', name: 'addTodo', input: 'TodoInput', returns: 'Patch', uses: ['Clock', 'storage'], reads: ['Todo.title'], writes: ['Todo.tags'] })
] });
const result = checkDocument(doc, { strictEffects: true });
assert.equal(result.ok, true);
assert.equal(createEvidenceSummary('check', result).status, 'passed');
const badType = createDocument({ id: 'bad', name: 'Bad', nodes: [entityNode({ id: 'bad_entity', name: 'Bad', fields: [{ id: 'bad_field', name: 'value', type: 'MissingType' }] })] });
assert.equal(checkDocument(badType).ok, false);
const failedPatch = createPatch({ id: 'patch_failed', operations: [{ op: 'addEvidence', evidence: { id: 'browser', kind: 'test', status: 'failed' } }] });
assert.equal(checkPatchBundle(failedPatch).ok, false);
