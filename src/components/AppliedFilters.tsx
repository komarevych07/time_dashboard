interface AppliedFilterGroup {
  label: string;
  values: string[];
  onRemove: (value: string) => void;
}

interface AppliedFiltersProps {
  groups: AppliedFilterGroup[];
}

export function AppliedFilters({ groups }: AppliedFiltersProps) {
  const activeGroups = groups.filter((group) => group.values.length > 0);

  if (activeGroups.length === 0) {
    return null;
  }

  return (
    <div className="applied-filters" aria-label="Застосовані фільтри">
      {activeGroups.map((group) => (
        <div key={group.label} className="applied-filter-group">
          <span className="applied-filter-label">{group.label}:</span>
          <div className="applied-filter-values">
            {group.values.map((value) => (
              <span key={value} className="applied-filter-chip">
                <span>{value}</span>
                <button
                  type="button"
                  className="applied-filter-remove"
                  onClick={() => group.onRemove(value)}
                  aria-label={`Видалити фільтр ${group.label}: ${value}`}
                  title="Видалити фільтр"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
