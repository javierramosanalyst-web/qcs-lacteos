import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getCurrentTimeString } from '../../utils/timer';

export interface WheelTimePickerProps {
  value?: string; // Formato admitido: "hh:mm:ss a" (ej: "11:25:39 am") o "HH:mm:ss"
  onChange: (timeStr: string) => void; // Devuelve estrictamente "hh:mm:ss a"
  label?: string;
  icon?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  showNowButton?: boolean;
}

const ITEM_HEIGHT = 40; // Altura de cada fila en px (óptima para touch en tablets)
const VISIBLE_COUNT = 5; // Cantidad de filas visibles
const HALF_VISIBLE = Math.floor(VISIBLE_COUNT / 2); // 2 arriba, 1 centro, 2 abajo
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 200px
const SPACING_PAD = ITEM_HEIGHT * HALF_VISIBLE; // 80px arriba y abajo

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

/**
 * Parsea cualquier formato de hora (12h con am/pm o 24h) de forma ultra segura.
 */
export const parseTimeString = (timeStr?: string | null): ParsedTime => {
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
    // Modo 24h
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
 * Columna deslizable individual (iOS Wheel Column)
 */
interface WheelColumnProps {
  label: string;
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  displayItem?: (item: string) => string;
  disabled?: boolean;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  label,
  items,
  selectedIndex,
  onSelect,
  displayItem = (it) => it,
  disabled = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserInteractingRef = useRef<boolean>(false);

  // Sincronizar posición de scroll con selectedIndex
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
    // Si el usuario no está arrastrando activamente, mantener el scroll en la posición seleccionada
    if (!isUserInteractingRef.current) {
      scrollToCurrentIndex(selectedIndex, false);
    }
  }, [selectedIndex, scrollToCurrentIndex]);

  // Manejador del evento scroll con detección de parada y snap
  const handleScroll = () => {
    if (!scrollRef.current || disabled) return;
    isUserInteractingRef.current = true;

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

      // Snap magnético al centro
      scrollRef.current.scrollTo({
        top: nearestIdx * ITEM_HEIGHT,
        behavior: 'smooth',
      });

      if (nearestIdx !== selectedIndex) {
        onSelect(nearestIdx);
      }
      isUserInteractingRef.current = false;
    }, 90);
  };

  // Botones de ajuste paso a paso (+ / -) para operarios con guantes en planta
  const handleStep = (delta: number) => {
    if (disabled) return;
    let nextIdx = selectedIndex + delta;
    if (nextIdx < 0) nextIdx = items.length - 1;
    if (nextIdx >= items.length) nextIdx = 0;
    scrollToCurrentIndex(nextIdx, true);
    onSelect(nextIdx);
  };

  const handleItemClick = (idx: number) => {
    if (disabled || idx === selectedIndex) return;
    scrollToCurrentIndex(idx, true);
    onSelect(idx);
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-[52px] select-none">
      {/* Etiqueta de la columna */}
      <span className="text-[11px] font-black text-stone-500 uppercase tracking-wider mb-1">
        {label}
      </span>

      {/* Botón flecha arriba (Incremento fino) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleStep(-1)}
        className="w-full h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 active:bg-stone-200/80 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
        title={`Anterior ${label}`}
      >
        <span className="material-symbols-outlined text-[18px]">expand_less</span>
      </button>

      {/* Rueda deslizable vertical */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: `${CONTAINER_HEIGHT}px`,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="w-full relative overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-wheel-scrollbar touch-pan-y"
      >
        {/* Espaciador superior para que el primer ítem quede centrado */}
        <div style={{ height: `${SPACING_PAD}px`, flexShrink: 0 }} aria-hidden="true" />

        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const dist = Math.abs(idx - selectedIndex);

          let itemStyle = 'text-stone-400 text-xs font-medium opacity-30 scale-90';
          if (dist === 0) {
            itemStyle = 'text-[#1B4E9B] text-xl font-black scale-110';
          } else if (dist === 1) {
            itemStyle = 'text-stone-700 text-sm font-bold opacity-75 scale-95';
          }

          return (
            <div
              key={`${label}-${item}-${idx}`}
              onClick={() => handleItemClick(idx)}
              style={{ height: `${ITEM_HEIGHT}px` }}
              className={`flex items-center justify-center snap-center cursor-pointer transition-all duration-150 ${itemStyle}`}
            >
              <span className="font-mono tracking-tight">{displayItem(item)}</span>
            </div>
          );
        })}

        {/* Espaciador inferior para que el último ítem quede centrado */}
        <div style={{ height: `${SPACING_PAD}px`, flexShrink: 0 }} aria-hidden="true" />
      </div>

      {/* Botón flecha abajo (Decremento fino) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleStep(1)}
        className="w-full h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 active:bg-stone-200/80 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
        title={`Siguiente ${label}`}
      >
        <span className="material-symbols-outlined text-[18px]">expand_more</span>
      </button>
    </div>
  );
};

export const WheelTimePicker: React.FC<WheelTimePickerProps> = ({
  value,
  onChange,
  label = 'Hora exacta',
  icon = 'schedule',
  hint,
  disabled = false,
  className = '',
  showNowButton = true,
}) => {
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

  // Sincronizar estado interno si `value` cambia desde el exterior
  useEffect(() => {
    setHourIndex(Math.max(0, HOURS.indexOf(parsed.hour12)));
    setMinuteIndex(Math.max(0, MINUTES.indexOf(parsed.minutes)));
    setSecondIndex(Math.max(0, SECONDS.indexOf(parsed.seconds)));
    setPeriodIndex(parsed.period === 'pm' ? 1 : 0);
  }, [parsed]);

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

  const currentDisplayTime = `${HOURS[hourIndex]}:${MINUTES[minuteIndex]}:${
    SECONDS[secondIndex]
  } ${PERIODS[periodIndex].toUpperCase()}`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <style>{`
        .hide-wheel-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Cabecera del selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {label && (
          <label className="text-xs font-black text-[#191c1e] flex items-center gap-1.5 uppercase tracking-wide">
            {icon && (
              <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                {icon}
              </span>
            )}
            {label}
          </label>
        )}

        <div className="flex items-center gap-2">
          {/* Badge de hora actual seleccionada */}
          <span className="font-mono text-xs font-black text-[#1B4E9B] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1 shadow-sm">
            <span className="material-symbols-outlined text-[14px]">timer</span>
            {currentDisplayTime}
          </span>

          {/* Botón rápido "Poner hora actual" */}
          {showNowButton && !disabled && (
            <button
              type="button"
              onClick={handleSetCurrentTime}
              className="px-2.5 py-1 text-[11px] font-extrabold text-[#1B4E9B] bg-white hover:bg-blue-50/80 active:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
              title="Establecer automáticamente a la hora actual de la tablet"
            >
              <span className="material-symbols-outlined text-[14px]">
                update
              </span>
              <span>Hora actual</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor principal de la Rueda iOS (Touch-Friendly) */}
      <div className="relative p-3 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] shadow-inner overflow-hidden select-none">
        {/* Lente / Barra de selección central (Highlighter) */}
        <div
          style={{ top: `${SPACING_PAD + 28}px`, height: `${ITEM_HEIGHT}px` }}
          className="absolute left-2.5 right-2.5 rounded-xl bg-blue-500/10 border-y border-[#1B4E9B]/30 pointer-events-none z-0 shadow-sm"
        />

        {/* Máscara de gradiente superior para efecto de curvatura cilíndrica */}
        <div
          style={{ height: `${SPACING_PAD + 28}px` }}
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-[#FFFFFF] via-[#FFFFFF]/85 to-transparent pointer-events-none z-10"
        />

        {/* Máscara de gradiente inferior */}
        <div
          style={{ height: `${SPACING_PAD + 28}px` }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF]/85 to-transparent pointer-events-none z-10"
        />

        {/* Columnas de la rueda */}
        <div className="relative z-0 flex items-center justify-between gap-1">
          {/* 1. Horas (01-12) */}
          <WheelColumn
            label="Hora"
            items={HOURS}
            selectedIndex={hourIndex}
            onSelect={handleHourSelect}
            disabled={disabled}
          />

          <span
            style={{ marginTop: '-4px' }}
            className="text-xl font-black text-stone-400 select-none"
          >
            :
          </span>

          {/* 2. Minutos (00-59) */}
          <WheelColumn
            label="Min"
            items={MINUTES}
            selectedIndex={minuteIndex}
            onSelect={handleMinuteSelect}
            disabled={disabled}
          />

          <span
            style={{ marginTop: '-4px' }}
            className="text-xl font-black text-stone-400 select-none"
          >
            :
          </span>

          {/* 3. Segundos (00-59) */}
          <WheelColumn
            label="Seg"
            items={SECONDS}
            selectedIndex={secondIndex}
            onSelect={handleSecondSelect}
            disabled={disabled}
          />

          <div className="w-[1px] h-28 bg-[#D6DEEA] mx-0.5 self-center my-auto" />

          {/* 4. Selector AM / PM */}
          <WheelColumn
            label="Período"
            items={PERIODS}
            selectedIndex={periodIndex}
            onSelect={handlePeriodSelect}
            displayItem={(it) => it.toUpperCase()}
            disabled={disabled}
          />
        </div>
      </div>

      {hint && <span className="text-[11px] text-[#434655] px-1">{hint}</span>}
    </div>
  );
};
