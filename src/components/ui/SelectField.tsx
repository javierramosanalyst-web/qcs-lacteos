import React from 'react';
import { InputStatus } from './InputField';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  icon?: string;
  targetHint?: string;
  helperText?: string;
  hint?: string;
  error?: string;
  status?: InputStatus;
  options: (string | SelectOption)[];
  placeholder?: string;
  selectSize?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
}

const STATUS_BORDER: Record<InputStatus, string> = {
  default:
    'border-2 border-[#C5D0E0] bg-white text-[#191c1e] focus:border-[#1B4E9B] focus:ring-4 focus:ring-[#1B4E9B]/15',
  valid:
    'border-2 border-emerald-500 bg-emerald-50/70 text-emerald-950 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20',
  warning:
    'border-2 border-amber-500 bg-amber-100/80 text-amber-950 focus:border-amber-600 focus:ring-4 focus:ring-amber-500/25',
  error:
    'border-2 border-red-500 bg-red-100/85 text-red-950 focus:border-red-600 focus:ring-4 focus:ring-red-500/25',
};

const STATUS_TEXT: Record<InputStatus, string> = {
  default: 'text-[#5f6374]',
  valid: 'text-emerald-800 font-bold',
  warning: 'text-amber-900 font-bold',
  error: 'text-red-800 font-bold',
};

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  icon,
  targetHint,
  helperText,
  hint,
  error,
  status = 'default',
  options,
  placeholder = 'Seleccionar',
  selectSize = 'md',
  disabled,
  containerClassName = '',
  className = '',
  ...rest
}) => {
  const sizePadding =
    selectSize === 'sm'
      ? 'min-h-[48px] py-2.5 text-sm font-bold'
      : selectSize === 'lg'
      ? 'min-h-[54px] py-3.5 text-lg font-black'
      : 'min-h-[48px] py-2.5 text-base font-bold';

  const isEmpty = rest.value === '' || rest.value === undefined || rest.value === null;
  const resolvedStatus: InputStatus = error ? 'error' : status === 'default' && isEmpty && !disabled ? 'warning' : status;
  const resolvedHelperText = error || helperText || hint;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {(label || targetHint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label className="text-xs font-extrabold uppercase tracking-wider text-[#434655] flex items-center gap-1.5">
              {icon && (
                <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                  {icon}
                </span>
              )}
              <span>{label}</span>
            </label>
          )}
          {targetHint && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#EAF1FB] text-[#1B4E9B] border border-[#BFD3EE]">
              {targetHint}
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        <select
          disabled={disabled}
          className={`w-full appearance-none rounded-xl pl-3.5 pr-10 outline-none transition-all ${sizePadding} ${
            disabled
              ? 'bg-[#F2F4F7] border-2 border-[#D6DEEA] text-[#5f6374] cursor-not-allowed'
              : `${STATUS_BORDER[resolvedStatus]} cursor-pointer`
          } ${className}`}
          {...rest}
          value={isEmpty ? '' : rest.value}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const text = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {text}
              </option>
            );
          })}
        </select>
        <span className="material-symbols-outlined text-[20px] text-[#5f6374] absolute right-3 pointer-events-none select-none">
          expand_more
        </span>
      </div>

      {resolvedHelperText && (
        <p className={`text-xs leading-snug ${STATUS_TEXT[resolvedStatus]}`}>
          {resolvedHelperText}
        </p>
      )}
    </div>
  );
};
