import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';

export interface SearchableSelectItem {
  id: string;
  label: string;
  hint?: string;
}

export interface SearchableSelectProps {
  items: SearchableSelectItem[];
  onSelect: (item: SearchableSelectItem) => void;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  onCreate?: (text: string) => void;
  createLabel?: (text: string) => string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  items,
  onSelect,
  placeholder = 'Search...',
  id,
  'aria-label': ariaLabel,
  onCreate,
  createLabel,
  disabled = false,
  className = '',
}) => {
  const autoId = useId();
  const inputId = id || `searchable-select-${autoId}`;
  const listboxId = `${inputId}-listbox`;

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const matchLabel = item.label.toLowerCase().includes(q);
      const matchHint = item.hint ? item.hint.toLowerCase().includes(q) : false;
      return matchLabel || matchHint;
    });
  }, [items, query]);

  const trimmedQuery = query.trim();
  const exactMatchExists = useMemo(() => {
    if (!trimmedQuery) return false;
    const lower = trimmedQuery.toLowerCase();
    return items.some((item) => item.label.toLowerCase() === lower);
  }, [items, trimmedQuery]);

  const showCreateOption = Boolean(onCreate && trimmedQuery && !exactMatchExists);
  const totalOptions = filteredItems.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => Math.min(prev + 1, totalOptions - 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(totalOptions - 1);
      } else {
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        const selected = filteredItems[highlightedIndex];
        onSelect(selected);
        setQuery('');
        setIsOpen(false);
      } else if (showCreateOption && highlightedIndex === filteredItems.length && onCreate) {
        onCreate(trimmedQuery);
        setQuery('');
        setIsOpen(false);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelectOption = (item: SearchableSelectItem) => {
    onSelect(item);
    setQuery('');
    setIsOpen(false);
  };

  const handleCreateOption = () => {
    if (onCreate && trimmedQuery) {
      onCreate(trimmedQuery);
      setQuery('');
      setIsOpen(false);
    }
  };

  const activeDescendant = useMemo(() => {
    if (!isOpen || totalOptions === 0) return undefined;
    if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
      return `${listboxId}-option-${highlightedIndex}`;
    }
    if (showCreateOption && highlightedIndex === filteredItems.length) {
      return `${listboxId}-option-create`;
    }
    return undefined;
  }, [isOpen, totalOptions, highlightedIndex, filteredItems.length, showCreateOption, listboxId]);

  return (
    <div ref={containerRef} className={`position-relative ${className}`}>
      <div className="input-group input-group-sm">
        <span className="input-group-text bg-white border-secondary-subtle text-secondary">
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          className="form-control bg-white text-dark border-secondary-subtle"
          aria-label={ariaLabel || placeholder}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="dropdown-menu show w-100 mt-1 py-1 shadow-sm border border-secondary-subtle overflow-auto"
          style={{ maxHeight: '240px', zIndex: 1050 }}
        >
          {filteredItems.length === 0 && !showCreateOption ? (
            <div className="px-3 py-2 text-secondary small text-center">
              No matching documents
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isHighlighted = highlightedIndex === index;
              return (
                <div
                  key={item.id}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  className={`dropdown-item d-flex align-items-center justify-content-between px-3 py-2 cursor-pointer ${
                    isHighlighted ? 'active bg-primary text-white' : 'text-dark'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelectOption(item)}
                >
                  <span className="fw-medium small">{item.label}</span>
                  {item.hint && (
                    <span
                      className={`small ms-2 ${
                        isHighlighted ? 'text-white-50' : 'text-muted'
                      }`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {item.hint}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {showCreateOption && (
            <div
              id={`${listboxId}-option-create`}
              role="option"
              aria-selected={highlightedIndex === filteredItems.length}
              className={`dropdown-item d-flex align-items-center gap-2 px-3 py-2 border-top border-light-subtle cursor-pointer ${
                highlightedIndex === filteredItems.length
                  ? 'active bg-primary text-white'
                  : 'text-primary'
              }`}
              onMouseEnter={() => setHighlightedIndex(filteredItems.length)}
              onClick={handleCreateOption}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="fw-semibold small">
                {createLabel
                  ? createLabel(trimmedQuery)
                  : `Add '${trimmedQuery}' as a custom document`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
