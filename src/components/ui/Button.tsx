import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1B4E9B] hover:bg-[#143A73] text-white shadow-md shadow-[#1B4E9B]/20 border border-transparent',
  secondary:
    'bg-[#F2F4F7] hover:bg-[#eae2d3] text-[#191c1e] border border-[#C5D0E0]',
  success:
    'bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 border border-transparent',
  warning:
    'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 border border-transparent',
  danger:
    'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 border border-transparent',
  outline:
    'bg-white hover:bg-[#F2F4F7] text-[#1B4E9B] border-2 border-[#1B4E9B]/30 hover:border-[#1B4E9B]',
  ghost:
    'bg-transparent hover:bg-[#F2F4F7] text-[#434655] border border-transparent',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[42px] px-3.5 py-2 text-xs rounded-xl gap-1.5',
  md: 'min-h-[48px] px-5 py-3 text-sm rounded-xl gap-2',
  lg: 'min-h-[52px] px-6 py-3.5 text-sm sm:text-base rounded-xl gap-2.5',
  xl: 'min-h-[56px] px-8 py-4 text-base rounded-2xl gap-3',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-extrabold tracking-wide transition-all duration-150 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[18px]">
          progress_activity
        </span>
      ) : (
        icon && (
          <span className="material-symbols-outlined text-[20px] leading-none">
            {icon}
          </span>
        )
      )}
      <span>{children}</span>
      {!loading && iconRight && (
        <span className="material-symbols-outlined text-[20px] leading-none">
          {iconRight}
        </span>
      )}
    </button>
  );
};
