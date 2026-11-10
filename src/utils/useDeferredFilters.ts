/*
  file summary: deferred filter draft state hook for FilterModal hosts.
  responsibilities: holds uncommitted filter selections while FilterModal is open and commits them only when Apply is clicked.
  role in system: shared hook used by all table components and views hosting FilterModal.
*/

import { useState, type Dispatch, type SetStateAction } from 'react';

export interface UseDeferredFiltersOptions<T> {
  isOpen: boolean;
  applied: T;
  defaults: T;
  onCommit: (next: T) => void;
}

export interface UseDeferredFiltersResult<T> {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  setField: <K extends keyof T>(field: K, value: T[K]) => void;
  resetDraft: () => void;
  applyDraft: () => void;
}

/**
  what: manages modal-local draft filter values paired with committed table filter state.
  how: syncs draft from applied when isOpen transitions from false to true, resets draft to defaults on Clear All, and commits draft only on Apply.
  with what file: src/utils/useDeferredFilters.ts used by tables and list views with FilterModal.tsx.
*/
export function useDeferredFilters<T>({
  isOpen,
  applied,
  defaults,
  onCommit,
}: UseDeferredFiltersOptions<T>): UseDeferredFiltersResult<T> {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [draftState, setDraftState] = useState<T>(applied);

  const draft = !prevIsOpen && isOpen ? applied : draftState;

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraftState(applied);
    }
  }

  const setField = <K extends keyof T>(field: K, value: T[K]) => {
    setDraftState((prev) => ({
      ...(!prevIsOpen && isOpen ? applied : prev),
      [field]: value,
    }));
  };

  const resetDraft = () => {
    setDraftState(defaults);
  };

  const applyDraft = () => {
    onCommit(draft);
  };

  return {
    draft,
    setDraft: setDraftState,
    setField,
    resetDraft,
    applyDraft,
  };
}

