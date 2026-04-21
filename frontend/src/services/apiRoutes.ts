export const API_ROUTE_TEMPLATES = {
  createSession: '/api/sessions',
  deleteSession: '/api/sessions/{sessionId}',
  loadFile: '/api/sessions/{sessionId}/files/{fileLetter}',
  suggestMappings: '/api/sessions/{sessionId}/mappings',
  compare: '/api/sessions/{sessionId}/compare',
  exportResults: '/api/sessions/{sessionId}/export',
  savePairOrder: '/api/sessions/{sessionId}/pair-order/save',
  loadPairOrder: '/api/sessions/{sessionId}/pair-order/load',
  saveComparisonSnapshot: '/api/sessions/{sessionId}/comparison-snapshot/save',
  loadComparisonSnapshot: '/api/sessions/{sessionId}/comparison-snapshot/load',
} as const;

function fillTemplate(
  template: string,
  replacements: Record<string, string>,
): string {
  return Object.entries(replacements).reduce(
    (path, [key, value]) => path.replace(`{${key}}`, encodeURIComponent(value)),
    template,
  );
}

export function buildLoadFileRoute(sessionId: string, fileLetter: 'a' | 'b'): string {
  return fillTemplate(API_ROUTE_TEMPLATES.loadFile, { sessionId, fileLetter });
}

export function buildCreateSessionRoute(): string {
  return API_ROUTE_TEMPLATES.createSession;
}

export function buildDeleteSessionRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.deleteSession, { sessionId });
}

export function buildSuggestMappingsRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.suggestMappings, { sessionId });
}

export function buildCompareRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.compare, { sessionId });
}

export function buildExportResultsRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.exportResults, { sessionId });
}

export function buildSavePairOrderRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.savePairOrder, { sessionId });
}

export function buildLoadPairOrderRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.loadPairOrder, { sessionId });
}

export function buildSaveComparisonSnapshotRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.saveComparisonSnapshot, { sessionId });
}

export function buildLoadComparisonSnapshotRoute(sessionId: string): string {
  return fillTemplate(API_ROUTE_TEMPLATES.loadComparisonSnapshot, { sessionId });
}
