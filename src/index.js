import { validateDocument } from '@shapeshift-labs/frontier-lang-kernel';

export function checkDocument(document, options = {}) {
  const diagnostics = [];
  for (const issue of validateDocument(document)) diagnostics.push(diag('error', 'document.invalid', issue));
  const effects = new Set(Object.values(document.nodes).filter((node) => node.kind === 'effect').map((node) => node.capability));
  const regions = new Set();
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'entity') for (const field of node.fields) { regions.add(field.id); checkMergePolicy(diagnostics, field.merge, field.id); }
    if (node.kind === 'state') for (const collection of node.collections) { regions.add(collection.id); checkMergePolicy(diagnostics, collection.merge, collection.id); }
  }
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'action') {
      for (const capability of node.uses ?? []) if (effects.size > 0 && !effects.has(capability)) diagnostics.push(diag(options.strictEffects ? 'error' : 'warning', 'effect.undeclared', `Action ${node.name} uses undeclared capability ${capability}`, node.id));
      for (const region of [...(node.reads ?? []), ...(node.writes ?? [])]) if (options.strictRegions && !regions.has(region) && ![...regions].some((r) => region.endsWith(r))) diagnostics.push(diag('warning', 'region.unknown', `Action ${node.name} references unknown region ${region}`, node.id));
    }
  }
  return { ok: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
}

export function checkPatchBundle(patch) {
  const diagnostics = [];
  if (!patch.baseHash) diagnostics.push(diag('warning', 'patch.unanchored', `Patch ${patch.id} has no baseHash`));
  for (const record of patch.evidence ?? []) if (record.status === 'failed') diagnostics.push(diag('error', 'evidence.failed', `Evidence ${record.id} failed`));
  return { ok: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
}

export function createEvidenceSummary(kind, result) {
  return { id: `evidence:${kind}`, kind: 'note', status: result.ok ? 'passed' : 'failed', summary: result.diagnostics.map((item) => `[${item.severity}] ${item.code}: ${item.message}`).join('\n') };
}

function checkMergePolicy(diagnostics, merge, owner) {
  if (!merge) return;
  const known = new Set(['conflict', 'union', 'max', 'lastWriterWins', 'byKey', 'preserveMoves', 'manual', 'custom']);
  if (!known.has(merge.kind)) diagnostics.push(diag('error', 'merge.unknownPolicy', `Unknown merge policy ${merge.kind} on ${owner}`));
  if (merge.law && !['semilattice', 'commutative', 'associative', 'idempotent'].includes(merge.law)) diagnostics.push(diag('error', 'merge.unknownLaw', `Unknown merge law ${merge.law} on ${owner}`));
}
function diag(severity, code, message, nodeId) { return { severity, code, message, nodeId }; }
