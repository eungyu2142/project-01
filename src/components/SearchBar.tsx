import { Icon } from './Icon';

interface SearchBarProps {
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onFocus?: () => void;
  onClear: () => void;
  clearVisible?: boolean;
  className?: string;
  inputClassName?: string;
  clearLabel?: string;
}

export function SearchBar({
  value,
  placeholder,
  onValueChange,
  onFocus,
  onClear,
  clearVisible = Boolean(value),
  className = '',
  inputClassName = '',
  clearLabel = '검색어 지우기',
}: SearchBarProps) {
  return (
    <label
      className={`relative flex items-center gap-3 rounded-[1.6rem] border border-white/90 bg-white/96 px-5 py-4 text-slate-500 shadow-[0_16px_34px_rgba(15,118,110,0.12)] ${className}`}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Icon name="search" className="h-5 w-5" />
      </span>
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`w-full min-w-0 bg-transparent pr-2 text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400 ${inputClassName}`}
      />
      {clearVisible ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClear}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          aria-label={clearLabel}
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      ) : null}
    </label>
  );
}
