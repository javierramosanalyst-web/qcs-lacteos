import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentTimeString } from '../../utils/timer';

export interface PopoverTimePickerProps {
  value?: string; // Formato admitido: "hh:mm:ss a" (ej: "12:29:16 PM" o "11:25:39 am") o "HH:mm:ss"
  onChange: (timeStr: string) => void; // Devuelve estrictamente "hh:mm:ss a"
  label?: string;
  icon?: string;
  hint?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

const ITEM_HEIGHT = 38; // Altura de cada fila en px
const VISIBLE_COUNT = 5;
const HALF_VISIBLE = Math.floor(VISIBLE_COUNT / 2); // 2 arriba, 1 centro, 2 abajo
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 190px exactos
const SPACING_PAD = ITEM_HEIGHT * HALF_VISIBLE; // 76px exactos

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const SECONDS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['am', 'pm'];

interface ParsedTime {
  hour12: string;
  minutes: string;
  seconds: string;
  period: 'am' | 'pm';
}

const parseTimeString = (timeStr?: string | null): ParsedTime => {
  const now = new Date();
  const defaultHour24 = now.getHours();
  const defaultPeriod: 'am' | 'pm' = defaultHour24 >= 12 ? 'pm' : 'am';
  const defaultHour12 = String(defaultHour24 % 12 || 12).padStart(2, '0');
  const defaultMinutes = String(now.getMinutes()).padStart(2, '0');
  const defaultSeconds = String(now.getSeconds()).padStart(2, '0');

  if (!timeStr || !timeStr.trim()) {
    return {
      hour12: defaultHour12,
      minutes: defaultMinutes,
      seconds: defaultSeconds,
      period: defaultPeriod,
    };
  }

  const clean = timeStr.trim().toLowerCase();
  const match = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return {
      hour12: defaultHour12,
      minutes: defaultMinutes,
      seconds: defaultSeconds,
      period: defaultPeriod,
    };
  }

  let h = parseInt(match[1], 10);
  const m = String(parseInt(match[2], 10) || 0).padStart(2, '0');
  const s = String(parseInt(match[3] || '0', 10) || 0).padStart(2, '0');

  let period: 'am' | 'pm' = defaultPeriod;
  if (clean.includes('pm') || clean.includes('p.m.')) {
    period = 'pm';
    if (h > 12) h = h % 12 || 12;
  } else if (clean.includes('am') || clean.includes('a.m.')) {
    period = 'am';
    if (h > 12) h = h % 12 || 12;
  } else {
    if (h >= 12) {
      period = 'pm';
      h = h % 12 || 12;
    } else {
      period = 'am';
      if (h === 0) h = 12;
    }
  }

  const hour12 = String(h === 0 ? 12 : h).padStart(2, '0');
  return {
    hour12: HOURS.includes(hour12) ? hour12 : '12',
    minutes: MINUTES.includes(m) ? m : '00',
    seconds: SECONDS.includes(s) ? s : '00',
    period,
  };
};

/**
 * Lista deslizable individual de 190px (Scroll snap centrado matemáticamente)
 */
interface WheelListProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  displayItem?: (item: string) => string;
}

const WheelList: React.FC<WheelListProps> = ({
  items,
  selectedIndex,
  onSelect,
  displayItem = (it) => it,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef<boolean>(false);

  const scrollToCurrentIndex = useCallback(
    (idx: number, smooth: boolean = true) => {
      if (!scrollRef.current) return;
      const targetTop = idx * ITEM_HEIGHT;
      if (Math.abs(scrollRef.current.scrollTop - targetTop) > 1) {
        scrollRef.current.scrollTo({
          top: targetTop,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!isInteractingRef.current) {
      scrollToCurrentIndex(selectedIndex, false);
    }
  }, [selectedIndex, scrollToCurrentIndex]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    isInteractingRef.current = true;

    if (isScrollingTimeoutRef.current) {
      clearTimeout(isScrollingTimeoutRef.current);
    }

    isScrollingTimeoutRef.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const top = scrollRef.current.scrollTop;
      const nearestIdx = Math.min(
        Math.max(0, Math.round(top / ITEM_HEIGHT)),
        items.length - 1
      );

      scrollRef.current.scrollTo({
        top: nearestIdx * ITEM_HEIGHT,
        behavior: 'smooth',
      });

      if (nearestIdx !== selectedIndex) {
        onSelect(nearestIdx);
      }
      isInteractingRef.current = false;
    }, 70);
  };

  const handleItemClick = (idx: number) => {
    if (idx === selectedIndex) return;
    scrollToCurrentIndex(idx, true);
    onSelect(idx);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        height: `${CONTAINER_HEIGHT}px`,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      className="flex-1 w-full relative overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-popover-scrollbar touch-pan-y z-10"
    >
      {/* Espaciador superior exacto de 76px */}
      <div style={{ height: `${SPACING_PAD}px`, flexShrink: 0 }} aria-hidden="true" />

      {items.map((item, idx) => {
        const dist = Math.abs(idx - selectedIndex);

        // Alto contraste y tipografía nítida
        let itemStyle = 'text-gray-500 text-xs font-semibold scale-95';
        if (dist === 0) {
          itemStyle = 'text-gray-900 text-lg font-bold scale-110';
        } else if (dist === 1) {
          itemStyle = 'text-gray-700 text-sm font-bold scale-100';
        }

        return (
          <div
            key={`${item}-${idx}`}
            onClick={() => handleItemClick(idx)}
            style={{ height: `${ITEM_HEIGHT}px` }}
            className={`flex items-center justify-center snap-center cursor-pointer transition-all duration-150 select-none ${itemStyle}`}
          >
            <span className="font-mono tracking-tight leading-none">
              {displayItem(item)}
            </span>
          </div>
        );
      })}

      {/* Espaciador inferior exacto de 76px */}
      <div style={{ height: `${SPACING_PAD}px`, flexShrink: 0 }} aria-hidden="true" />
    </div>
  );
};

export const PopoverTimePicker: React.FC<PopoverTimePickerProps> = ({
  value,
  onChange,
  label,
  icon = 'schedule',
  hint,
  disabled = false,
  readOnly = false,
  className = '',
  placeholder = '--:--:--',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  const parsed = useMemo(() => parseTimeString(value), [value]);

  const [hourIndex, setHourIndex] = useState(() =>
    Math.max(0, HOURS.indexOf(parsed.hour12))
  );
  const [minuteIndex, setMinuteIndex] = useState(() =>
    Math.max(0, MINUTES.indexOf(parsed.minutes))
  );
  const [secondIndex, setSecondIndex] = useState(() =>
    Math.max(0, SECONDS.indexOf(parsed.seconds))
  );
  const [periodIndex, setPeriodIndex] = useState(() =>
    parsed.period === 'pm' ? 1 : 0
  );

  useEffect(() => {
    setHourIndex(Math.max(0, HOURS.indexOf(parsed.hour12)));
    setMinuteIndex(Math.max(0, MINUTES.indexOf(parsed.minutes)));
    setSecondIndex(Math.max(0, SECONDS.indexOf(parsed.seconds)));
    setPeriodIndex(parsed.period === 'pm' ? 1 : 0);
  }, [parsed]);

  // Cálculo preciso de coordenadas para React Portal
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 300;
    const popoverHeight = 330;
    const padding = 12;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - popoverWidth - padding);
    }
    if (left < padding) left = padding;

    let top = rect.bottom + 6;
    if (
      top + popoverHeight > window.innerHeight - padding &&
      rect.top > popoverHeight + 6
    ) {
      top = rect.top - popoverHeight - 6;
    }

    setPopoverCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // useOutsideClick
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const clickedTrigger =
        triggerRef.current && triggerRef.current.contains(target);
      const clickedPopover =
        popoverRef.current && popoverRef.current.contains(target);

      if (!clickedTrigger && !clickedPopover) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const emitTimeChange = (
    hIdx: number,
    mIdx: number,
    sIdx: number,
    pIdx: number
  ) => {
    const h = HOURS[hIdx] || '12';
    const m = MINUTES[mIdx] || '00';
    const s = SECONDS[sIdx] || '00';
    const p = PERIODS[pIdx] || 'am';
    const formatted = `${h}:${m}:${s} ${p}`;
    onChange(formatted);
  };

  const handleHourSelect = (newIdx: number) => {
    setHourIndex(newIdx);
    emitTimeChange(newIdx, minuteIndex, secondIndex, periodIndex);
  };

  const handleMinuteSelect = (newIdx: number) => {
    setMinuteIndex(newIdx);
    emitTimeChange(hourIndex, newIdx, secondIndex, periodIndex);
  };

  const handleSecondSelect = (newIdx: number) => {
    setSecondIndex(newIdx);
    emitTimeChange(hourIndex, minuteIndex, newIdx, periodIndex);
  };

  const handlePeriodSelect = (newIdx: number) => {
    setPeriodIndex(newIdx);
    emitTimeChange(hourIndex, minuteIndex, secondIndex, newIdx);
  };

  const handleStepHour = (delta: number) => {
    let next = hourIndex + delta;
    if (next < 0) next = HOURS.length - 1;
    if (next >= HOURS.length) next = 0;
    handleHourSelect(next);
  };

  const handleStepMinute = (delta: number) => {
    let next = minuteIndex + delta;
    if (next < 0) next = MINUTES.length - 1;
    if (next >= MINUTES.length) next = 0;
    handleMinuteSelect(next);
  };

  const handleStepSecond = (delta: number) => {
    let next = secondIndex + delta;
    if (next < 0) next = SECONDS.length - 1;
    if (next >= SECONDS.length) next = 0;
    handleSecondSelect(next);
  };

  const handleStepPeriod = (delta: number) => {
    let next = periodIndex + delta;
    if (next < 0) next = PERIODS.length - 1;
    if (next >= PERIODS.length) next = 0;
    handlePeriodSelect(next);
  };

  const handleSetCurrentTime = () => {
    const nowTimeStr = getCurrentTimeString();
    const nowParsed = parseTimeString(nowTimeStr);
    const hIdx = Math.max(0, HOURS.indexOf(nowParsed.hour12));
    const mIdx = Math.max(0, MINUTES.indexOf(nowParsed.minutes));
    const sIdx = Math.max(0, SECONDS.indexOf(nowParsed.seconds));
    const pIdx = nowParsed.period === 'pm' ? 1 : 0;

    setHourIndex(hIdx);
    setMinuteIndex(mIdx);
    setSecondIndex(sIdx);
    setPeriodIndex(pIdx);
    onChange(nowTimeStr);
  };

  const isInteractive = !disabled && !readOnly;
  const displayTime = value ? value.trim() : placeholder;

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      <style>{`
        .hide-popover-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Etiqueta superior */}
      {label && (
        <label className="text-xs font-black text-[#191c1e] flex items-center gap-1.5 uppercase tracking-wide select-none">
          {icon && (
            <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
              {icon}
            </span>
          )}
          {label}
        </label>
      )}

      {/* Trigger: Botón visible con apariencia de input */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isInteractive) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full h-11 px-3.5 py-2 rounded-xl border flex items-center justify-between text-left transition-all duration-150 select-none shadow-sm focus:outline-none ${
          !isInteractive
            ? 'bg-[#F2F4F7] text-[#74777f] border-[#D6DEEA] cursor-default'
            : isOpen
            ? 'bg-blue-50/40 border-[#1B4E9B] ring-2 ring-[#1B4E9B]/20'
            : 'bg-white border-[#d8c2bf]/80 hover:border-[#1B4E9B] cursor-pointer'
        }`}
        title={isInteractive ? 'Toca para abrir el selector de hora exacta' : undefined}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={`font-mono text-sm font-extrabold tracking-wide ${
              value ? 'text-[#191c1e]' : 'text-[#74777f]'
            }`}
          >
            {displayTime}
          </span>
        </div>

        <span
          className={`material-symbols-outlined text-[20px] transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#1B4E9B]' : 'text-[#1B4E9B]'
          }`}
        >
          {isOpen ? 'expand_circle_up' : 'schedule'}
        </span>
      </button>

      {hint && <span className="text-[11px] text-[#434655] px-1">{hint}</span>}

      {/* POPOVER FLOTANTE RENDERIZADO CON REACT PORTAL (Inmune a clipping) */}
      {isOpen &&
        isInteractive &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              zIndex: 99999,
            }}
            className="w-[300px] p-3.5 rounded-2xl bg-white border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Cabecera del Popover */}
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                  schedule
                </span>
                <span className="text-xs font-black text-gray-900">
                  Ajuste de Hora Exacta
                </span>
              </div>

              <button
                type="button"
                onClick={handleSetCurrentTime}
                className="px-2 py-0.5 text-[10px] font-black text-[#1B4E9B] bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Establecer a la hora actual de la tablet"
              >
                <span className="material-symbols-outlined text-[12px]">update</span>
                <span>Hora actual</span>
              </button>
            </div>

            {/* Contenedor Completo de las Ruedas */}
            <div className="p-2.5 rounded-xl bg-stone-50 border border-gray-200 select-none">
              {/* FILA 1: Etiquetas de cada columna */}
              <div className="flex items-center justify-between mb-1">
                <span className="flex-1 text-center text-[10px] font-black text-gray-600 uppercase tracking-wider">
                  Hora
                </span>
                <div className="w-3" />
                <span className="flex-1 text-center text-[10px] font-black text-gray-600 uppercase tracking-wider">
                  Min
                </span>
                <div className="w-3" />
                <span className="flex-1 text-center text-[10px] font-black text-gray-600 uppercase tracking-wider">
                  Seg
                </span>
                <div className="w-3" />
                <span className="flex-1 text-center text-[10px] font-black text-gray-600 uppercase tracking-wider">
                  Período
                </span>
              </div>

              {/* FILA 2: Botones de flecha arriba (expand_less) */}
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => handleStepHour(-1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Anterior Hora"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_less
                  </span>
                </button>
                <div className="w-3" />
                <button
                  type="button"
                  onClick={() => handleStepMinute(-1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Anterior Minuto"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_less
                  </span>
                </button>
                <div className="w-3" />
                <button
                  type="button"
                  onClick={() => handleStepSecond(-1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Anterior Segundo"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_less
                  </span>
                </button>
                <div className="w-3" />
                <button
                  type="button"
                  onClick={() => handleStepPeriod(-1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Cambiar Período"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_less
                  </span>
                </button>
              </div>

              {/* FILA 3: ÁREA EXCLUSIVA DE LAS RUEDAS (190px exactos) */}
              {/* Aquí el Highlight Box y los Separadores comparten matemáticamente el centro exacto (y = 95px) */}
              <div
                style={{ height: `${CONTAINER_HEIGHT}px` }}
                className="relative flex items-center justify-between overflow-hidden"
              >
                {/* 1. CAJA GRIS RESALTADORA (HIGHLIGHT BOX) - CENTRADA MATEMÁTICAMENTE */}
                <div
                  style={{
                    top: `${SPACING_PAD}px`,
                    height: `${ITEM_HEIGHT}px`,
                  }}
                  className="absolute left-1 right-1 rounded-lg bg-gray-200/90 border border-gray-300 pointer-events-none z-0 shadow-sm"
                />

                {/* 2. GRADIENTES SUPERIOR E INFERIOR SUAVES */}
                <div
                  style={{ height: '60px' }}
                  className="absolute top-0 left-0 right-0 bg-gradient-to-b from-stone-50/80 to-transparent pointer-events-none z-20"
                />
                <div
                  style={{ height: '60px' }}
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-stone-50/80 to-transparent pointer-events-none z-20"
                />

                {/* 3. RUEDA HORAS (01-12) */}
                <WheelList
                  items={HOURS}
                  selectedIndex={hourIndex}
                  onSelect={handleHourSelect}
                />

                {/* 4. SEPARADOR DOS PUNTOS (:) - ALINEADO AL CENTRO EXACTO */}
                <div className="w-3 flex items-center justify-center text-base font-black text-gray-700 select-none pointer-events-none z-10 leading-none">
                  :
                </div>

                {/* 5. RUEDA MINUTOS (00-59) */}
                <WheelList
                  items={MINUTES}
                  selectedIndex={minuteIndex}
                  onSelect={handleMinuteSelect}
                />

                {/* 6. SEPARADOR DOS PUNTOS (:) - ALINEADO AL CENTRO EXACTO */}
                <div className="w-3 flex items-center justify-center text-base font-black text-gray-700 select-none pointer-events-none z-10 leading-none">
                  :
                </div>

                {/* 7. RUEDA SEGUNDOS (00-59) */}
                <WheelList
                  items={SECONDS}
                  selectedIndex={secondIndex}
                  onSelect={handleSecondSelect}
                />

                {/* 8. SEPARADOR DIVISOR (|) - CENTRADO */}
                <div className="w-3 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-[1px] h-7 bg-gray-300" />
                </div>

                {/* 9. RUEDA PERÍODO (AM/PM) */}
                <WheelList
                  items={PERIODS}
                  selectedIndex={periodIndex}
                  onSelect={handlePeriodSelect}
                  displayItem={(it) => it.toUpperCase()}
                />
              </div>

              {/* FILA 4: Botones de flecha abajo (expand_more) */}
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={() => handleStepHour(1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Siguiente Hora"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_more
                  </span>
                </button>
                <div className="w-3" />
                <button
                  type="button"
                  onClick={() => handleStepMinute(1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Siguiente Minuto"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_more
                  </span>
                </button>
                <div className="w-3" />
                <button
                  type="button"
                  onClick={() => handleStepSecond(1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Siguiente Segundo"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_more
                  </span>
                </button>
                <div className="w-3" />
                <button
                  type="button"
                  onClick={() => handleStepPeriod(1)}
                  className="flex-1 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 active:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="Cambiar Período"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    expand_more
                  </span>
                </button>
              </div>
            </div>

            {/* Pie del Popover: Botón Listo */}
            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-gray-200">
              <span className="font-mono text-xs font-black text-[#1B4E9B]">
                {HOURS[hourIndex]}:{MINUTES[minuteIndex]}:{SECONDS[secondIndex]}{' '}
                {PERIODS[periodIndex].toUpperCase()}
              </span>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 text-xs font-black text-white bg-[#1B4E9B] hover:bg-[#003da8] active:bg-[#002f85] rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
