import React, { useEffect, useState } from 'react';

export type InputStatus = 'default' | 'valid' | 'warning' | 'error';

export interface InputFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  unit?: string;
  icon?: string;
  targetHint?: string;
  helperText?: string;
  hint?: string;
  error?: string;
  status?: InputStatus;
  inputSize?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
  /** Si es true, muestra el 0 numérico en lugar de dejar el campo vacío con placeholder */
  showZero?: boolean;
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

const formatPhInput = (raw: string): string => {
  const cleaned = raw.replace(/\./g, ',').replace(/[^\d,]/g, '');
  if (cleaned.includes(',')) {
    const [entero, ...resto] = cleaned.split(',');
    return `${entero.slice(0, 2)},${resto.join('').slice(0, 2)}`;
  }
  if (cleaned.length <= 1) return cleaned;
  return `${cleaned[0]},${cleaned.slice(1, 3)}`;
};

const parseDecimal = (raw: string): number => Number(raw.replace(',', '.'));

export const InputField: React.FC<InputFieldProps> = ({
  label,
  unit,
  icon,
  targetHint,
  helperText,
  hint,
  error,
  status = 'default',
  inputSize = 'md',
  disabled,
  readOnly,
  type,
  inputMode,
  value,
  onChange,
  onFocus,
  onBlur,
  showZero = false,
  containerClassName = '',
  className = '',
  ...rest
}) => {
  const isNumberInput = type === 'number';
  const isPhInput = unit === 'pH' && (type === 'number' || type === 'text' || type === undefined);
  const [isFocused, setIsFocused] = useState(false);

  const computeExternalString = (
    val: string | number | readonly string[] | undefined
  ): string => {
    if (val === undefined || val === null || val === '') return '';
    if (
      isNumberInput &&
      !showZero &&
      (val === 0 || val === '0' || Number.isNaN(val))
    ) {
      return '';
    }
    return isPhInput ? String(val).replace('.', ',') : String(val);
  };

  const [rawValue, setRawValue] = useState<string>(() =>
    computeExternalString(value)
  );

  useEffect(() => {
    if (!isFocused) {
      setRawValue(computeExternalString(value));
    } else if (value !== undefined) {
      const numericRaw = rawValue === '' ? 0 : parseDecimal(rawValue);
      const numericProp =
        typeof value === 'number' ? value : Number(value || 0);
      if (
        !Number.isNaN(numericProp) &&
        numericRaw !== numericProp &&
        rawValue !== ''
      ) {
        setRawValue(computeExternalString(value));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isFocused, showZero]);

  const sizePadding =
    inputSize === 'sm'
      ? 'min-h-[48px] py-2.5 text-sm font-bold'
      : inputSize === 'lg'
      ? 'min-h-[54px] py-3.5 text-lg font-mono font-black'
      : 'min-h-[48px] py-2.5 text-base font-bold';

  const resolvedStatus: InputStatus = error ? 'error' : status;
  const resolvedHelperText = error || helperText || hint;
  const resolvedInputMode =
    inputMode || (isNumberInput ? 'decimal' : undefined);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setRawValue(computeExternalString(value));
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setRawValue(computeExternalString(value));
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPhInput) {
      const formatted = formatPhInput(e.target.value);
      setRawValue(formatted);
      e.target.value = formatted.replace(',', '.').replace(/\.$/, '');
      onChange?.(e);
      return;
    }
    setRawValue(e.target.value);
    onChange?.(e);
  };

  const displayedValue =
    value !== undefined
      ? isFocused
        ? rawValue
        : computeExternalString(value)
      : undefined;

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
        <input
          type={isPhInput ? 'text' : type}
          step={rest.step ?? (type === 'time' ? '1' : undefined)}
          inputMode={resolvedInputMode}
          disabled={disabled}
          readOnly={readOnly}
          value={displayedValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`w-full rounded-xl px-3.5 ${
            unit ? 'pr-14' : ''
          } placeholder:text-[#9ca3af] placeholder:font-normal outline-none transition-all ${sizePadding} ${
            disabled || readOnly
              ? 'bg-[#F2F4F7] border-2 border-[#D6DEEA] text-[#5f6374] cursor-not-allowed select-none'
              : STATUS_BORDER[resolvedStatus]
          } ${className}`}
          {...rest}
        />
        {unit && (
          <span
            className={`absolute right-3.5 text-xs font-mono font-extrabold pointer-events-none select-none ${
              resolvedStatus === 'error'
                ? 'text-red-800'
                : resolvedStatus === 'warning'
                ? 'text-amber-900'
                : resolvedStatus === 'valid'
                ? 'text-emerald-800'
                : 'text-[#5f6374]'
            }`}
          >
            {unit}
          </span>
        )}
      </div>

      {resolvedHelperText && (
        <p className={`text-xs leading-snug ${STATUS_TEXT[resolvedStatus]}`}>
          {resolvedHelperText}
        </p>
      )}
    </div>
  );
};
