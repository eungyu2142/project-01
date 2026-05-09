import { getAnimalLabel } from '../lib/format';
import type { AnimalFilter } from '../types';

interface AnimalTabsProps {
  value: AnimalFilter;
  onChange: (value: AnimalFilter) => void;
  counts?: Partial<Record<AnimalFilter, number>>;
}

const options: AnimalFilter[] = ['all', 'reptile', 'rodent', 'bird'];

export function AnimalTabs({ value, onChange, counts }: AnimalTabsProps) {
  return (
    <div className="grid w-full grid-cols-4 gap-2">
      {options.map((option) => {
        const active = option === value;
        const count = counts?.[option];

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex min-w-0 items-center justify-center rounded-full px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-emerald-600 text-white shadow-[0_10px_30px_rgba(17,122,95,0.18)]'
                : 'bg-white/80 text-slate-600'
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
