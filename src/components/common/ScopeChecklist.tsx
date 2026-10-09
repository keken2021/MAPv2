/*
  file summary: reusable multi-select scope checklist shown as a dropdown of checkboxes.
  responsibilities: renders the ticked scopes as the field value, toggles scopes, keeps locked scopes ticked, closes on outside click.
  role in system: used by RequestAssuranceSetModal and CreateAssuranceSetView.
*/

import React, { useEffect, useRef, useState } from 'react';

interface ScopeChecklistProps<T extends string> {
  id: string;
  labelId: string;
  options: readonly T[];
  selected: readonly T[];
  onToggle: (scope: T) => void;
  /* text shown when nothing is ticked */
  emptyLabel: string;
  /* scopes that stay ticked and cannot be changed */
  lockedOptions?: readonly T[];
  invalid?: boolean;
  /* extra classes for the field button, e.g. to match the sizing of the surrounding form */
  className?: string;
  describedBy?: string;
}

export const ScopeChecklist = <T extends string>({
  id,
  labelId,
  options,
  selected,
  onToggle,
  emptyLabel,
  lockedOptions = [],
  invalid = false,
  className = '',
  describedBy,
}: ScopeChecklistProps<T>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  const selectedLabel =
    selected.length === 0 ? emptyLabel : options.filter((scope) => selected.includes(scope)).join(', ');

  return (
    <div className="position-relative" ref={menuRef}>
      <button
        type="button"
        id={id}
        className={`form-select text-start d-flex align-items-center justify-content-between${invalid ? ' is-invalid border-danger' : ''}${className ? ` ${className}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-labelledby={`${labelId} ${id}`}
        aria-describedby={describedBy}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="text-truncate">{selectedLabel}</span>
      </button>
      {menuOpen && (
        <ul
          className="dropdown-menu show w-100 shadow-sm border py-2"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
          role="listbox"
          aria-multiselectable="true"
        >
          {options.map((scope) => {
            const isLocked = lockedOptions.includes(scope);
            return (
              <li key={scope}>
                <label className="dropdown-item d-flex align-items-center gap-2 mb-0 small cursor-pointer">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0 flex-shrink-0"
                    checked={selected.includes(scope)}
                    disabled={isLocked}
                    onChange={() => onToggle(scope)}
                  />
                  <span>{scope}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
