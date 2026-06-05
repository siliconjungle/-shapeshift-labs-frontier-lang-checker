import { performance } from 'node:perf_hooks';
import { createDocument, entityNode, latticeNode } from '@shapeshift-labs/frontier-lang-kernel';
import { checkDocument } from '../dist/index.js';

const lattice = latticeNode({ id: 'lat_tags', name: 'TagSet', carrier: 'Set<Text>', laws: ['semilattice', 'commutative'] });
const entities = Array.from({ length: 150 }, (_, index) => entityNode({ id: `entity_${index}`, name: `Entity${index}`, fields: [
  { id: `field_title_${index}`, name: 'title', type: 'Text' },
  { id: `field_tags_${index}`, name: 'tags', type: { kind: 'set', item: 'Text' }, merge: { kind: 'union', latticeId: 'lat_tags' } }
] }));
const document = createDocument({ id: 'doc_bench', name: 'Bench', nodes: [lattice, ...entities] });
const start = performance.now();
for (let index = 0; index < 500; index += 1) checkDocument(document, { strictEffects: true });
const durationMs = performance.now() - start;
console.log(JSON.stringify({ checks: 500, nodes: Object.keys(document.nodes).length, durationMs: Math.round(durationMs * 100) / 100 }, null, 2));
