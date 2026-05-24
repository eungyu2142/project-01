import { getAnimalLabel } from '../lib/format';
import type { AnimalFilter } from '../types';

interface AnimalTabsProps {
  value: AnimalFilter;
  onChange: (value: AnimalFilter) => void;
  counts?: Partial<Record<AnimalFilter, number>>;
  className?: string;
}

const options: AnimalFilter[] = ['all', 'reptile', 'rodent', 'bird'];

export function AnimalTabs({ value, onChange, counts, className = '' }: AnimalTabsProps) {
  return (
    <div
      className={`grid w-full grid-cols-4 gap-1 rounded-full border border-emerald-100 bg-white/90 p-1 shadow-[0_8px_18px_rgba(15,118,110,0.08)] ${className}`}
    >
      {options.map((option) => {
        const active = option === value;
        const count = counts?.[option];

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex h-9 min-w-0 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold transition ${
              active
                ? 'bg-emerald-600 text-white shadow-[0_6px_14px_rgba(5,150,105,0.20)]'
                : 'bg-transparent text-slate-700'
            }`}
          >
            {getAnimalLabel(option)}
            {typeof count === 'number' ? ` ${count}` : ''}
          </button>
        );
      })}
    </div>
  );
}
