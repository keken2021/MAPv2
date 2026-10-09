/*
  file summary: organization switcher shown in the sidebar footer.
  responsibilities: renders the active organization as a card, and a searchable popover list of organizations with keyboard support.
  role in system: used by AppSidebar; styles live in App.css under .map-org-switcher.
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import {
  OrganizationSwitcherOption,
  filterOrganizationSwitcherOptions,
  formatOrganizationSwitcherMeta,
} from '../../utils/demoSessionHelpers';

interface OrganizationSwitcherProps {
  options: OrganizationSwitcherOption[];
  activeOrganization: string;
  /* id of the visible "Organization" label that names the control */
  labelId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (organization: string) => void;
}

const TRIGGER_ID = 'demo-organization-switcher';
const LIST_ID = 'demo-organization-list';

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  options,
  activeOrganization,
  labelId,
  isOpen,
  onOpenChange,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeOption = options.find((option) => option.organization === activeOrganization);
  const filteredOptions = useMemo(
    () => filterOrganizationSwitcherOptions(options, searchTerm),
    [options, searchTerm],
  );

  /* each time the list opens it starts unfiltered, on the active organization, with the search field focused */
  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setHighlightedIndex(
      Math.max(0, options.findIndex((option) => option.organization === activeOrganization)),
    );
    searchRef.current?.focus();
  }, [isOpen]);

  /* keeps the highlighted row visible while moving with the arrow keys */
  useEffect(() => {
    if (!isOpen) return;
    document
      .getElementById(`${LIST_ID}-option-${highlightedIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  const closeAndReturnFocus = () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  };

  const selectOption = (option: OrganizationSwitcherOption | undefined) => {
    /* an organization with no roles cannot be entered */
    if (!option || option.roleCount === 0) return;
    if (option.organization !== activeOrganization) {
      onSelect(option.organization);
    }
    closeAndReturnFocus();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectOption(filteredOptions[highlightedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === 'Tab') {
      onOpenChange(false);
    }
  };

  return (
    <div className="map-org-switcher">
      <button
        type="button"
        ref={triggerRef}
        id={TRIGGER_ID}
        className={`map-org-switcher-trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${labelId} ${TRIGGER_ID}`}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className="map-org-switcher-badge is-current" aria-hidden="true">
          {activeOption?.initials ?? '--'}
        </span>
        <span className="map-org-switcher-text">
          <span className="map-org-switcher-name" title={activeOrganization}>
            {activeOrganization}
          </span>
          {activeOption && (
            <span className="map-org-switcher-meta">
              {formatOrganizationSwitcherMeta(activeOption)}
            </span>
          )}
        </span>
        <ChevronsUpDown size={16} className="map-org-switcher-chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="map-org-switcher-menu">
          <div className="map-org-switcher-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label="Search organizations"
              aria-expanded="true"
              aria-controls={LIST_ID}
              aria-autocomplete="list"
              aria-activedescendant={
                filteredOptions.length > 0 ? `${LIST_ID}-option-${highlightedIndex}` : undefined
              }
              placeholder="Search organizations..."
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          <ul id={LIST_ID} className="map-org-switcher-list" role="listbox" aria-labelledby={labelId}>
            {filteredOptions.map((option, index) => {
              const isCurrent = option.organization === activeOrganization;
              const isDisabled = option.roleCount === 0;
              return (
                <li
                  key={option.organization}
                  id={`${LIST_ID}-option-${index}`}
                  role="option"
                  aria-selected={isCurrent}
                  aria-disabled={isDisabled}
                  className={`map-org-switcher-option${index === highlightedIndex ? ' is-highlighted' : ''}${isCurrent ? ' is-current' : ''}${isDisabled ? ' is-disabled' : ''}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span className={`map-org-switcher-badge${isCurrent ? ' is-current' : ''}`} aria-hidden="true">
                    {option.initials}
                  </span>
                  <span className="map-org-switcher-text">
                    <span className="map-org-switcher-name" title={option.organization}>
                      {option.organization}
                    </span>
                    <span className="map-org-switcher-meta">
                      {formatOrganizationSwitcherMeta(option)}
                    </span>
                  </span>
                  {isCurrent && <Check size={16} className="map-org-switcher-check" aria-hidden="true" />}
                </li>
              );
            })}
            {filteredOptions.length === 0 && (
              <li className="map-org-switcher-empty" role="presentation">
                No organizations found.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
