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
            className={`flex h-11 min-w-0 items-center justify-center rounded-[1.1rem] border px-2 text-sm font-semibold tracking-[-0.01em] transition ${
              active
                ? 'border-emerald-500 bg-[linear-gradient(135deg,_#059669,_#10b981)] text-white shadow-[0_16px_34px_rgba(16,185,129,0.26)]'
                : 'border-emerald-100/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(236,253,245,0.9))] text-slate-700 shadow-[0_10px_24px_rgba(15,118,110,0.08)]'
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
