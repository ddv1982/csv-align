export const API_TRANSPORT_OPERATIONS = {
  createSession: { method: 'POST', path: '/api/sessions' },
  deleteSession: { method: 'DELETE', path: '/api/sessions/{sessionId}' },
  loadFile: { method: 'POST', path: '/api/sessions/{sessionId}/files/{fileLetter}' },
  suggestMappings: { method: 'POST', path: '/api/sessions/{sessionId}/mappings' },
  compare: { method: 'POST', path: '/api/sessions/{sessionId}/compare' },
  exportResults: { method: 'GET', path: '/api/sessions/{sessionId}/export' },
  savePairOrder: { method: 'POST', path: '/api/sessions/{sessionId}/pair-order/save' },
  loadPairOrder: { method: 'POST', path: '/api/sessions/{sessionId}/pair-order/load' },
  saveComparisonSnapshot: { method: 'POST', path: '/api/sessions/{sessionId}/comparison-snapshot/save' },
  loadComparisonSnapshot: { method: 'POST', path: '/api/sessions/{sessionId}/comparison-snapshot/load' },
} as const;

export const API_ROUTE_TEMPLATES = {
  createSession: API_TRANSPORT_OPERATIONS.createSession.path,
  deleteSession: API_TRANSPORT_OPERATIONS.deleteSession.path,
  loadFile: API_TRANSPORT_OPERATIONS.loadFile.path,
  suggestMappings: API_TRANSPORT_OPERATIONS.suggestMappings.path,
  compare: API_TRANSPORT_OPERATIONS.compare.path,
  exportResults: API_TRANSPORT_OPERATIONS.exportResults.path,
  savePairOrder: API_TRANSPORT_OPERATIONS.savePairOrder.path,
  loadPairOrder: API_TRANSPORT_OPERATIONS.loadPairOrder.path,
  saveComparisonSnapshot: API_TRANSPORT_OPERATIONS.saveComparisonSnapshot.path,
  loadComparisonSnapshot: API_TRANSPORT_OPERATIONS.loadComparisonSnapshot.path,
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
