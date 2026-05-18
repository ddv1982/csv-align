import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  SEARCHABLE_FIELD_GROUPS,
  SEARCH_FIELD_GROUP_LABELS,
  type SearchableFieldGroup,
  type SearchableFieldId,
  type SearchableFieldOption,
} from '../../features/results/search';

export function SearchFieldPicker({
  options,
  value,
  onChange,
}: {
  options: SearchableFieldOption[];
  value: SearchableFieldId;
  onChange: (fieldId: SearchableFieldId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [optionQuery, setOptionQuery] = useState('');
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeField = options.find((option) => option.id === value) ?? options[0];
  const normalizedOptionQuery = optionQuery.trim().toLowerCase();
  const filteredOptions = normalizedOptionQuery.length === 0
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(normalizedOptionQuery));
  const optionIndexById = new Map(filteredOptions.map((option, index) => [option.id, index]));
  const groupedOptions = filteredOptions.reduce<Record<SearchableFieldGroup, SearchableFieldOption[]>>((groups, option) => {
    groups[option.group].push(option);
    return groups;
  }, { general: [], mapped: [], fileA: [], fileB: [] });

  const closePicker = (restoreFocus = false) => {
    setOptionQuery('');
    setIsOpen(false);

    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const focusOption = (index: number) => {
    optionRefs.current[index]?.focus();
  };

  const handleSelect = (fieldId: SearchableFieldId) => {
    onChange(fieldId);
    closePicker(true);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      window.setTimeout(() => focusOption(event.key === 'ArrowDown' ? 0 : filteredOptions.length - 1), 0);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closePicker();
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(event.key === 'ArrowDown' ? 0 : filteredOptions.length - 1);
    }
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(Math.min(optionIndex + 1, filteredOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(Math.max(optionIndex - 1, 0));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusOption(filteredOptions.length - 1);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closePicker();
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="result-search-field relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search field"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="result-search-field-button input app-text inline-flex w-full items-center justify-between gap-2 px-3 py-2 text-sm"
        onClick={() => (isOpen ? closePicker() : setIsOpen(true))}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="truncate">{activeField.label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="result-search-field-popover surface-panel absolute right-0 z-20 mt-2 w-72 p-2 shadow-xl">
          <label className="block">
            <span className="sr-only">Filter search fields</span>
            <input
              className="input w-full px-3 py-2 text-sm"
              value={optionQuery}
              onChange={(event) => setOptionQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Find a field"
              autoFocus
            />
          </label>
          <div id={listboxId} role="listbox" aria-label="Search field options" className="result-search-field-list mt-2 grid max-h-64 gap-2 overflow-auto">
            {SEARCHABLE_FIELD_GROUPS.map((group) => {
              const groupOptions = groupedOptions[group];
              if (groupOptions.length === 0) {
                return null;
              }

              return (
                <div key={group} className="result-search-field-group">
                  <div className="result-search-field-group-label hud-label px-2 py-1">{SEARCH_FIELD_GROUP_LABELS[group]}</div>
                  {groupOptions.map((option) => {
                    const optionIndex = optionIndexById.get(option.id) ?? 0;

                    return (
                      <button
                        key={option.id}
                        ref={(element) => {
                          optionRefs.current[optionIndex] = element;
                        }}
                        type="button"
                        role="option"
                        aria-selected={option.id === activeField.id}
                        className={`result-search-field-option w-full rounded-md px-2 py-1.5 text-left text-sm ${
                          option.id === activeField.id ? 'app-surface-accent app-text' : 'app-text'
                        }`}
                        onClick={() => handleSelect(option.id)}
                        onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filteredOptions.length === 0 && <p className="app-muted px-2 py-3 text-sm">No fields found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
