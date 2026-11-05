import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search...',
      wrapperClassName = '',
      wrapperStyle,
      className = '',
      style,
      'aria-label': ariaLabel,
      ...rest
    },
    ref
  ) => {
    const handleClear = () => {
      onChange('');
      onClear?.();
    };

    return (
      <div
        className={`position-relative ${wrapperClassName}`.trim()}
        style={wrapperStyle}
      >
        <Search
          size={16}
          aria-hidden="true"
          className="position-absolute top-50 translate-middle-y text-muted"
          style={{ left: '12px', pointerEvents: 'none' }}
        />
        <input
          ref={ref}
          type="text"
          className={`form-control form-control-sm map-list-toolbar-search-input ${className}`.trim()}
          style={{
            paddingLeft: '36px',
            paddingRight: value ? '32px' : '12px',
            height: '36px',
            fontSize: '0.875rem',
            ...style,
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel || placeholder}
          {...rest}
        />
        {value && (
          <button
            type="button"
            className="btn btn-link btn-sm position-absolute top-50 translate-middle-y text-muted p-0"
            style={{ right: '10px', textDecoration: 'none' }}
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
