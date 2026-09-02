import { useEffect, useRef, useState } from 'react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clear = () => onChange([]);

  const triggerLabel =
    selected.length === 0
      ? label
      : `${label}: ${selected.length}`;

  return (
    <div className="multi-select" ref={containerRef}>
      <button
        type="button"
        className={`multi-select-trigger ${selected.length > 0 ? 'multi-select-trigger-active' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="multi-select-trigger-label">{triggerLabel}</span>
        <span className="multi-select-trigger-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="multi-select-dropdown" role="listbox" aria-label={label}>
          <div className="multi-select-actions">
            <button type="button" className="multi-select-action" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="multi-select-action" onClick={clear}>
              Clear
            </button>
          </div>
          <div className="multi-select-options">
            {options.map((option) => (
              <label key={option} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleValue(option)}
                />
                <span className="multi-select-option-label">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
