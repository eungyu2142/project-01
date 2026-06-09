import { getAnimalLabel } from '../lib/format';
import type { AnimalFilter, HospitalAnimalFilter } from '../types';

interface AnimalTabsProps<T extends HospitalAnimalFilter = AnimalFilter> {
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
  includeUnclear?: boolean;
  fitAll?: boolean;
  className?: string;
}

const baseOptions: AnimalFilter[] = ['all', 'reptile', 'rodent', 'bird'];

export function AnimalTabs<T extends HospitalAnimalFilter = AnimalFilter>({
  value,
  onChange,
  counts,
  includeUnclear = false,
  fitAll = false,
  className = '',
}: AnimalTabsProps<T>) {
  const options = (includeUnclear ? [...baseOptions, 'unclear'] : baseOptions) as T[];

  return (
    <div
      className={`w-full gap-1 rounded-lg border border-emerald-100 bg-white p-1 shadow-[0_6px_14px_rgba(15,118,110,0.07)] ${
        fitAll ? `grid ${includeUnclear ? 'grid-cols-5' : 'grid-cols-4'}` : 'flex overflow-x-auto'
      } ${className}`}
    >
      {options.map((option) => {
        const active = option === value;
        const count = counts?.[option];

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex h-9 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition ${
              fitAll ? 'min-w-0 px-1 text-[11px] sm:text-xs' : 'min-w-fit flex-1 px-2 text-[13px]'
            } ${
              active
                ? 'bg-emerald-600 text-white shadow-[0_4px_10px_rgba(5,150,105,0.16)]'
                : 'bg-[#f4fbf7] text-slate-700'
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
