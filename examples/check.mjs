import { createDocument } from '@shapeshift-labs/frontier-lang-kernel';
import { checkDocument } from '../dist/index.js';
console.log(checkDocument(createDocument({ id: 'empty', name: 'Empty', nodes: [] })));
