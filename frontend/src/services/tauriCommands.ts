export const TAURI_COMMANDS = {
  createSession: 'create_session',
  deleteSession: 'delete_session',
  loadCsv: 'load_csv',
  loadCsvBytes: 'load_csv_bytes',
  suggestMappings: 'suggest_mappings',
  compare: 'compare',
  exportResults: 'export_results',
  savePairOrder: 'save_pair_order',
  loadPairOrder: 'load_pair_order',
  saveComparisonSnapshot: 'save_comparison_snapshot',
  loadComparisonSnapshot: 'load_comparison_snapshot',
} as const;
