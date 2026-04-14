import type { ColumnInfo } from './api';

export type AppStep = 'select' | 'configure' | 'results';

export interface AppFile {
  name: string;
  headers: string[];
  columns: ColumnInfo[];
  rowCount: number;
}

export interface MappingSelectionState {
  keyColumnsA: string[];
  keyColumnsB: string[];
  comparisonColumnsA: string[];
  comparisonColumnsB: string[];
}

export const INITIAL_MAPPING_SELECTION: MappingSelectionState = {
  keyColumnsA: [],
  keyColumnsB: [],
  comparisonColumnsA: [],
  comparisonColumnsB: [],
};
