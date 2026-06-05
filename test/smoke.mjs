import assert from 'node:assert/strict';
import {
  actionNode,
  capabilityNode,
  createDocument,
  createPatch,
  effectNode,
  entityNode,
  externNode,
  latticeNode,
  nativeSourceNode,
  typeNode
} from '@shapeshift-labs/frontier-lang-kernel';
import { checkDocument, checkPatchBundle, createEvidenceSummary } from '../dist/index.js';
const doc = createDocument({ id: 'mod', name: 'Example', nodes: [
  effectNode({ id: 'effect_clock', name: 'Clock', capability: 'Clock' }),
  capabilityNode({
    id: 'cap_http',
    name: 'HttpRequest',
    capability: 'http.request',
    category: 'network',
    input: 'Json',
    returns: 'Json',
    adapters: [
      { target: { language: 'typescript', platform: 'node', packageName: 'undici' }, symbol: 'fetch', kind: 'library' },
      { target: { language: 'rust', platform: 'native', packageName: 'reqwest' }, symbol: 'reqwest::Client::execute', kind: 'library' }
    ]
  }),
  effectNode({ id: 'effect_http', name: 'HttpEffect', capability: 'http.request', input: 'Json', returns: 'Json' }),
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
  nativeSourceNode({ id: 'native_todo', name: 'todo.ts', language: 'typescript', parser: 'typescript', sourcePath: 'src/todo.ts', frontierNodeIds: ['ent', 'act'], losses: [{ id: 'loss_note', severity: 'warning', kind: 'opaqueNative', message: 'Implementation body retained as native AST.' }] }),
  actionNode({ id: 'act', name: 'addTodo', input: 'TodoInput', returns: 'Patch', uses: ['Clock', 'storage', 'http.request'], reads: ['Todo.title'], writes: ['Todo.tags'] })
] });
const result = checkDocument(doc, { strictEffects: true });
assert.equal(result.ok, true);
assert.equal(createEvidenceSummary('check', result).status, 'passed');
const badType = createDocument({ id: 'bad', name: 'Bad', nodes: [entityNode({ id: 'bad_entity', name: 'Bad', fields: [{ id: 'bad_field', name: 'value', type: 'MissingType' }] })] });
assert.equal(checkDocument(badType).ok, false);
const badNative = createDocument({ id: 'bad_native', name: 'BadNative', nodes: [
  nativeSourceNode({ id: 'native_bad', name: 'bad.py', language: 'python', frontierNodeIds: ['missing'], losses: [{ id: 'loss_error', severity: 'error', kind: 'nonRoundTrippable', message: 'Cannot map metaclass mutation.' }] })
] });
assert.equal(checkDocument(badNative).ok, false);
const badCapability = createDocument({ id: 'bad_cap', name: 'BadCap', nodes: [
  capabilityNode({ id: 'cap_bad', name: 'BadCap', capability: 'broken.capability', adapters: [{ target: { language: 'rust' }, symbol: '' }] })
] });
assert.equal(checkDocument(badCapability).ok, false);
const failedPatch = createPatch({ id: 'patch_failed', operations: [{ op: 'addEvidence', evidence: { id: 'browser', kind: 'test', status: 'failed' } }] });
assert.equal(checkPatchBundle(failedPatch).ok, false);
