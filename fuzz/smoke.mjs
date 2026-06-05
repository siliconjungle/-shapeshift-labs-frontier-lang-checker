import assert from 'node:assert/strict';
import { createDocument, entityNode, latticeNode, typeNode } from '@shapeshift-labs/frontier-lang-kernel';
import { checkDocument } from '../dist/index.js';

for (let index = 0; index < 100; index += 1) {
  const document = createDocument({ id: `doc_${index}`, name: `Doc${index}`, nodes: [
    typeNode({ id: `type_id_${index}`, name: `Id${index}`, type: 'Text' }),
    latticeNode({ id: `lat_${index}`, name: `TagSet${index}`, carrier: 'Set<Text>', laws: ['semilattice', 'commutative'] }),
    entityNode({ id: `entity_${index}`, name: `Entity${index}`, fields: [
      { id: `field_id_${index}`, name: 'id', type: `Id${index}`, key: true },
      { id: `field_tags_${index}`, name: 'tags', type: { kind: 'set', item: 'Text' }, merge: { kind: 'union', latticeId: `lat_${index}` } }
    ] })
  ] });
  assert.equal(checkDocument(document, { strictEffects: true, strictRegions: true }).ok, true);
}
