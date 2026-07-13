export type WorkflowOperationKind =
  | 'file_a'
  | 'file_b'
  | 'compare'
  | 'snapshot_restore';

export type WorkflowRequestToken = {
  sessionId: string | null;
  generation: number;
  mutation: number;
  operationKind?: WorkflowOperationKind;
  operationSequence?: number;
};

export const SUPERSEDED_OPERATION_KINDS: Record<
  WorkflowOperationKind,
  readonly WorkflowOperationKind[]
> = {
  file_a: ['file_a', 'compare', 'snapshot_restore'],
  file_b: ['file_b', 'compare', 'snapshot_restore'],
  compare: ['file_a', 'file_b', 'compare', 'snapshot_restore'],
  snapshot_restore: ['file_a', 'file_b', 'compare', 'snapshot_restore'],
};
