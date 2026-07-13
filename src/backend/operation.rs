#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OperationKind {
    FileA,
    FileB,
    Compare,
    SnapshotRestore,
}

impl OperationKind {
    const fn index(self) -> usize {
        match self {
            Self::FileA => 0,
            Self::FileB => 1,
            Self::Compare => 2,
            Self::SnapshotRestore => 3,
        }
    }

    const fn superseded_kinds(self) -> &'static [Self] {
        match self {
            Self::FileA => &[Self::FileA, Self::Compare, Self::SnapshotRestore],
            Self::FileB => &[Self::FileB, Self::Compare, Self::SnapshotRestore],
            Self::Compare => &[
                Self::FileA,
                Self::FileB,
                Self::Compare,
                Self::SnapshotRestore,
            ],
            Self::SnapshotRestore => &[
                Self::FileA,
                Self::FileB,
                Self::Compare,
                Self::SnapshotRestore,
            ],
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OperationToken {
    entry_id: u64,
    sequence: u64,
    kind: OperationKind,
}

impl OperationToken {
    pub const fn kind(self) -> OperationKind {
        self.kind
    }

    pub(crate) const fn entry_id(self) -> u64 {
        self.entry_id
    }
}

#[derive(Debug, Default)]
pub(crate) struct OperationState {
    sequence: u64,
    active: [Option<u64>; 4],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum OperationStateError {
    SequenceExhausted,
    Superseded,
}

impl OperationState {
    pub(crate) fn issue(
        &mut self,
        entry_id: u64,
        kind: OperationKind,
    ) -> Result<OperationToken, OperationStateError> {
        let sequence = self
            .sequence
            .checked_add(1)
            .ok_or(OperationStateError::SequenceExhausted)?;
        self.sequence = sequence;

        for superseded in kind.superseded_kinds() {
            self.active[superseded.index()] = None;
        }
        self.active[kind.index()] = Some(sequence);

        Ok(OperationToken {
            entry_id,
            sequence,
            kind,
        })
    }

    pub(crate) fn consume(&mut self, token: OperationToken) -> Result<(), OperationStateError> {
        let active = &mut self.active[token.kind.index()];
        if *active != Some(token.sequence) {
            return Err(OperationStateError::Superseded);
        }

        *active = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sequence_exhaustion_is_reported_without_wraparound() {
        let mut state = OperationState {
            sequence: u64::MAX,
            active: [None; 4],
        };

        assert_eq!(
            state.issue(7, OperationKind::Compare),
            Err(OperationStateError::SequenceExhausted)
        );
        assert_eq!(state.sequence, u64::MAX);
        assert_eq!(state.active, [None; 4]);
    }
}
