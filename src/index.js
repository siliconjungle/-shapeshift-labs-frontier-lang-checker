import { validateDocument } from '@shapeshift-labs/frontier-lang-kernel';

export function checkDocument(document, options = {}) {
  const diagnostics = [];
  for (const issue of validateDocument(document)) diagnostics.push(diag('error', 'document.invalid', issue));
  const builtins = new Set(['Text', 'String', 'Bool', 'Boolean', 'Int', 'Float', 'Number', 'Instant', 'Json', 'Patch', 'Void', 'Set', 'List', 'Map']);
  const declaredTypes = new Set([...builtins]);
  const lattices = new Set();
  const effects = new Set(Object.values(document.nodes).filter((node) => node.kind === 'effect').map((node) => node.capability));
  const declaredCapabilities = new Set();
  const nodeIds = new Set(Object.keys(document.nodes));
  const regions = new Set();
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'entity' || node.kind === 'type' || node.kind === 'lattice') declaredTypes.add(node.name);
    if (node.kind === 'capability') {
      declaredCapabilities.add(node.id);
      declaredCapabilities.add(node.name);
      declaredCapabilities.add(node.capability);
      effects.add(node.capability);
    }
    if (node.kind === 'lattice') {
      lattices.add(node.id);
      lattices.add(node.name);
    }
    if (node.kind === 'extern') {
      for (const effect of node.effects ?? []) effects.add(effect);
    }
  }
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'entity') {
      for (const field of node.fields) {
        regions.add(field.id);
        regions.add(`${node.name}.${field.name}`);
        checkTypeExpression(diagnostics, field.type, declaredTypes, `Entity ${node.name}.${field.name}`, node.id);
        checkMergePolicy(diagnostics, field.merge, field.id, lattices);
        checkValueSemantics(diagnostics, field.semantic, field.id, lattices);
      }
    }
    if (node.kind === 'state') {
      for (const collection of node.collections) {
        regions.add(collection.id);
        regions.add(`${node.name}.${collection.name}`);
        checkTypeExpression(diagnostics, collection.type, declaredTypes, `State ${node.name}.${collection.name}`, node.id);
        checkMergePolicy(diagnostics, collection.merge, collection.id, lattices);
        checkValueSemantics(diagnostics, collection.semantic, collection.id, lattices);
      }
    }
    if (node.kind === 'type') {
      if (node.type) checkTypeExpression(diagnostics, node.type, declaredTypes, `Type ${node.name}`, node.id);
      for (const field of node.fields ?? []) checkTypeExpression(diagnostics, field.type, declaredTypes, `Type ${node.name}.${field.name}`, node.id);
      for (const variant of node.variants ?? []) {
        for (const field of variant.fields ?? []) checkTypeExpression(diagnostics, field.type, declaredTypes, `Variant ${node.name}.${variant.name}.${field.name}`, node.id);
      }
    }
    if (node.kind === 'extern') {
      checkTypeExpression(diagnostics, node.signature?.input, declaredTypes, `Extern ${node.name} input`, node.id);
      checkTypeExpression(diagnostics, node.signature?.returns, declaredTypes, `Extern ${node.name} returns`, node.id);
      if (node.capability && declaredCapabilities.size > 0 && !declaredCapabilities.has(node.capability)) diagnostics.push(diag(options.strictCapabilities ? 'error' : 'warning', 'capability.undeclared', `Extern ${node.name} references undeclared capability ${node.capability}`, node.id));
    }
    if (node.kind === 'effect') {
      checkTypeExpression(diagnostics, node.input, declaredTypes, `Effect ${node.name} input`, node.id);
      checkTypeExpression(diagnostics, node.returns, declaredTypes, `Effect ${node.name} returns`, node.id);
      if (options.strictCapabilities && declaredCapabilities.size > 0 && !declaredCapabilities.has(node.capability)) diagnostics.push(diag('error', 'capability.undeclared', `Effect ${node.name} references undeclared capability ${node.capability}`, node.id));
    }
    if (node.kind === 'capability') {
      checkTypeExpression(diagnostics, node.input, declaredTypes, `Capability ${node.name} input`, node.id);
      checkTypeExpression(diagnostics, node.returns, declaredTypes, `Capability ${node.name} returns`, node.id);
      if (!node.capability) diagnostics.push(diag('error', 'capability.missing', `Capability ${node.name} is missing capability`, node.id));
      const adapterKeys = new Set();
      for (const adapter of node.adapters ?? []) {
        if (!adapter.target?.language) diagnostics.push(diag('error', 'capability.adapterTargetMissing', `Capability ${node.name} has adapter without target language`, node.id));
        if (!adapter.symbol) diagnostics.push(diag('error', 'capability.adapterSymbolMissing', `Capability ${node.name} has adapter without symbol`, node.id));
        const adapterKey = `${adapter.target?.language ?? ''}:${adapter.target?.platform ?? ''}:${adapter.symbol ?? ''}`;
        if (adapterKeys.has(adapterKey)) diagnostics.push(diag('error', 'capability.adapterDuplicate', `Capability ${node.name} has duplicate adapter ${adapterKey}`, node.id));
        adapterKeys.add(adapterKey);
      }
      for (const unsupported of node.unsupportedTargets ?? []) {
        if (!unsupported.target?.language) diagnostics.push(diag('error', 'capability.unsupportedTargetMissing', `Capability ${node.name} has unsupported target without language`, node.id));
        if (!unsupported.reason) diagnostics.push(diag('warning', 'capability.unsupportedReasonMissing', `Capability ${node.name} has unsupported target without reason`, node.id));
      }
    }
    if (node.kind === 'lattice') {
      checkTypeExpression(diagnostics, node.carrier, declaredTypes, `Lattice ${node.name}`, node.id);
      for (const law of node.laws ?? []) checkMergeLaw(diagnostics, law, node.id);
    }
    if (node.kind === 'nativeSource') {
      if (!node.language) diagnostics.push(diag('error', 'native.languageMissing', `Native source ${node.name} is missing language`, node.id));
      for (const mappedId of node.frontierNodeIds ?? []) {
        if (!nodeIds.has(mappedId)) diagnostics.push(diag('error', 'native.mappingMissing', `Native source ${node.name} maps to missing semantic node ${mappedId}`, node.id));
      }
      for (const loss of node.losses ?? []) {
        if (loss.severity === 'error') diagnostics.push(diag('error', 'native.loss', `Native source ${node.name} has import loss ${loss.id}: ${loss.message}`, node.id));
      }
    }
  }
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'action') {
      for (const capability of node.uses ?? []) if (effects.size > 0 && !effects.has(capability)) diagnostics.push(diag(options.strictEffects ? 'error' : 'warning', 'effect.undeclared', `Action ${node.name} uses undeclared capability ${capability}`, node.id));
      for (const region of [...(node.reads ?? []), ...(node.writes ?? [])]) if (options.strictRegions && !regions.has(region) && ![...regions].some((r) => region.endsWith(r))) diagnostics.push(diag('warning', 'region.unknown', `Action ${node.name} references unknown region ${region}`, node.id));
      checkTypeExpression(diagnostics, node.input, declaredTypes, `Action ${node.name} input`, node.id);
      checkTypeExpression(diagnostics, node.returns, declaredTypes, `Action ${node.name} returns`, node.id);
    }
  }
  return { ok: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
}

export function checkPatchBundle(patch) {
  const diagnostics = [];
  if (!patch.baseHash) diagnostics.push(diag('warning', 'patch.unanchored', `Patch ${patch.id} has no baseHash`));
  for (const record of patch.evidence ?? []) if (record.status === 'failed') diagnostics.push(diag('error', 'evidence.failed', `Evidence ${record.id} failed`));
  for (const operation of patch.operations ?? []) {
    if (operation.op === 'addEvidence' && operation.evidence?.status === 'failed') {
      diagnostics.push(diag('error', 'evidence.failed', `Evidence ${operation.evidence.id} failed`));
    }
  }
  return { ok: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
}

export function createEvidenceSummary(kind, result) {
  return { id: `evidence:${kind}`, kind: 'note', status: result.ok ? 'passed' : 'failed', summary: result.diagnostics.map((item) => `[${item.severity}] ${item.code}: ${item.message}`).join('\n') };
}

function checkMergePolicy(diagnostics, merge, owner, lattices = new Set()) {
  if (!merge) return;
  const known = new Set(['conflict', 'union', 'max', 'lastWriterWins', 'byKey', 'preserveMoves', 'manual', 'custom']);
  if (!known.has(merge.kind)) diagnostics.push(diag('error', 'merge.unknownPolicy', `Unknown merge policy ${merge.kind} on ${owner}`));
  if (merge.law) checkMergeLaw(diagnostics, merge.law, owner);
  for (const law of merge.laws ?? []) checkMergeLaw(diagnostics, law, owner);
  if (merge.latticeId && !lattices.has(merge.latticeId)) diagnostics.push(diag('error', 'merge.unknownLattice', `Unknown lattice ${merge.latticeId} on ${owner}`));
}
function checkMergeLaw(diagnostics, law, owner) {
  if (!['semilattice', 'commutative', 'associative', 'idempotent'].includes(law)) diagnostics.push(diag('error', 'merge.unknownLaw', `Unknown merge law ${law} on ${owner}`));
}
function checkValueSemantics(diagnostics, semantic, owner, lattices) {
  if (!semantic) return;
  if (!['plain', 'lattice', 'crdt'].includes(semantic.kind)) diagnostics.push(diag('error', 'semantic.unknownKind', `Unknown semantic kind ${semantic.kind} on ${owner}`));
  if (semantic.latticeId && !lattices.has(semantic.latticeId)) diagnostics.push(diag('error', 'semantic.unknownLattice', `Unknown lattice ${semantic.latticeId} on ${owner}`));
}
function checkTypeExpression(diagnostics, type, declaredTypes, owner, nodeId) {
  if (!type) return;
  if (typeof type === 'string') {
    const generic = /^([A-Za-z_$][\w$]*)<(.+)>$/.exec(type.trim());
    if (generic) {
      if (!declaredTypes.has(generic[1])) diagnostics.push(diag('error', 'type.unknown', `Unknown type ${generic[1]} in ${owner}`, nodeId));
      for (const inner of splitTypeArguments(generic[2])) checkTypeExpression(diagnostics, inner, declaredTypes, owner, nodeId);
      return;
    }
    const base = type.replace(/[?<].*$/, '').trim();
    if (base && !declaredTypes.has(base)) diagnostics.push(diag('error', 'type.unknown', `Unknown type ${base} in ${owner}`, nodeId));
    return;
  }
  if (type.kind === 'ref') {
    if (!declaredTypes.has(type.name)) diagnostics.push(diag('error', 'type.unknown', `Unknown type ${type.name} in ${owner}`, nodeId));
    for (const item of type.args ?? []) checkTypeExpression(diagnostics, item, declaredTypes, owner, nodeId);
    return;
  }
  if (type.kind === 'list' || type.kind === 'set') {
    checkTypeExpression(diagnostics, type.item, declaredTypes, owner, nodeId);
    return;
  }
  if (type.kind === 'map') {
    checkTypeExpression(diagnostics, type.key, declaredTypes, owner, nodeId);
    checkTypeExpression(diagnostics, type.value, declaredTypes, owner, nodeId);
    return;
  }
  if (type.kind === 'record') {
    for (const field of type.fields ?? []) checkTypeExpression(diagnostics, field.type, declaredTypes, `${owner}.${field.name}`, nodeId);
    return;
  }
  if (type.kind === 'union') {
    for (const variant of type.variants ?? []) {
      for (const field of variant.fields ?? []) checkTypeExpression(diagnostics, field.type, declaredTypes, `${owner}.${variant.name}.${field.name}`, nodeId);
    }
  }
}
function splitTypeArguments(text) {
  const args = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '<') depth += 1;
    if (ch === '>') depth -= 1;
    if (ch === ',' && depth === 0) {
      args.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  args.push(text.slice(start).trim());
  return args.filter(Boolean);
}
function diag(severity, code, message, nodeId) { return { severity, code, message, nodeId }; }
