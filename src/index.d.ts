import type { EvidenceRecord, FrontierLangDocument, SemanticPatchBundle } from '@shapeshift-labs/frontier-lang-kernel';
export interface CheckerOptions { readonly strictEffects?: boolean; readonly strictRegions?: boolean; }
export interface Diagnostic { readonly severity: 'error' | 'warning' | 'info'; readonly code: string; readonly message: string; readonly nodeId?: string; }
export interface CheckResult { readonly ok: boolean; readonly diagnostics: readonly Diagnostic[]; }
export declare function checkDocument(document: FrontierLangDocument, options?: CheckerOptions): CheckResult;
export declare function checkPatchBundle(patch: SemanticPatchBundle): CheckResult;
export declare function createEvidenceSummary(kind: string, result: CheckResult): EvidenceRecord;
