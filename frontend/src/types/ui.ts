import type { ColumnInfo } from './api';

export type AppStep = 'select' | 'configure' | 'results';

export interface AppFile {
  name: string;
  headers: string[];
  virtualHeaders?: string[];
  columns: ColumnInfo[];
  rowCount: number;
}

export type SelectedFileSource = File | string;
export type WorkflowOperationKind =
  | 'file_a'
  | 'file_b'
  | 'compare'
  | 'snapshot_restore';

export interface WorkflowRequestToken {
  sessionId: string | null;
  generation: number;
  mutation: number;
  operationKind?: WorkflowOperationKind;
  operationSequence?: number;
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
