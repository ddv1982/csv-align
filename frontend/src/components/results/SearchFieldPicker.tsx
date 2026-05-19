import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { SearchableFieldId, SearchableFieldOption } from '../../features/results/search';

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
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeField = options.find((option) => option.id === value) ?? options[0];

  const closePicker = (restoreFocus = false) => {
    setIsOpen(false);

    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const focusOption = (index: number) => {
    optionRefs.current[index]?.focus();
  };

  const openAndFocusOption = (index: number) => {
    setIsOpen(true);
    window.setTimeout(() => focusOption(index), 0);
  };

  const handleSelect = (fieldId: SearchableFieldId) => {
    onChange(fieldId);
    closePicker(true);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocusOption(event.key === 'ArrowDown' ? 0 : options.length - 1);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closePicker();
      return;
    }

    if (event.key === 'Tab' && isOpen) {
      closePicker();
    }
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
      return;
    }

    if (event.key === 'Tab') {
      closePicker();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(Math.min(optionIndex + 1, options.length - 1));
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
      focusOption(options.length - 1);
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
        <div className="result-search-field-popover surface-panel absolute right-0 z-20 mt-2 w-56 p-1.5 shadow-xl">
          <div id={listboxId} role="listbox" aria-label="Search field options" className="result-search-field-list grid gap-1">
            {options.map((option, optionIndex) => (
              <button
                key={option.id}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                type="button"
                role="option"
                aria-selected={option.id === activeField.id}
                className={`result-search-field-option w-full rounded-md px-2.5 py-2 text-left text-sm ${
                  option.id === activeField.id ? 'app-surface-accent app-text' : 'app-text'
                }`}
                onClick={() => handleSelect(option.id)}
                onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
