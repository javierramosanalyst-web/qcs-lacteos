// Formats seconds into HH:MM:SS
export const formatSecondsToHMS = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

// Formats seconds into human-readable Spanish text: e.g. "14 min 32 s" or "1 h 12 min 5 s"
export const formatHumanDuration = (totalSeconds: number): string => {
  if (totalSeconds === 0) return '0 s';
  if (!totalSeconds || totalSeconds < 0) return '0 s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes} min`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} s`);
  return parts.join(' ');
};

// Formats duration between two timestamps in milliseconds
export const formatDurationBetweenTimestamps = (
  startTs: number,
  endTs: number
): string => {
  const diffSeconds = Math.max(0, Math.floor((endTs - startTs) / 1000));
  return formatHumanDuration(diffSeconds);
};

// Gets current formatted local time string in global format hh:mm:ss a (e.g. "11:25:39 am")
export const getCurrentTimeString = (): string => {
  const now = new Date();
  const h24 = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return `${h12}:${m}:${s} ${suffix}`;
};

/**
 * Converts a display time string (e.g. "11:25:39 am", "02:10:05 pm", "14:20:15")
 * into 24-hour "HH:mm:ss" format required by <input type="time" step="1" />.
 */
export const toTimeInputStep1 = (timeStr?: string | null): string => {
  if (!timeStr || !timeStr.trim()) {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }
  const clean = timeStr.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) return clean;
  if (/^\d{2}:\d{2}$/.test(clean)) return `${clean}:00`;

  const match = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const seconds = match[3] || '00';
  const lower = clean.toLowerCase();
  if ((lower.includes('p') || lower.includes('pm')) && hours < 12) {
    hours += 12;
  } else if ((lower.includes('a') || lower.includes('am')) && hours === 12) {
    hours = 0;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
};

/**
 * Converts a 24-hour "HH:mm:ss" (or "HH:mm") string from <input type="time" step="1" />
 * into the global display format "hh:mm:ss a" (e.g. "11:25:39 am").
 */
export const formatTimeFromStep1 = (hhmmss?: string | null): string => {
  if (!hhmmss || !hhmmss.includes(':')) return getCurrentTimeString();
  const clean = hhmmss.trim();
  // If already formatted with am/pm and seconds, normalize casing and padding
  if (/[ap]\.?\s*m\.?/i.test(clean)) {
    const as24 = toTimeInputStep1(clean);
    return formatTimeFromStep1(as24);
  }
  const parts = clean.split(':');
  const h24 = parseInt(parts[0], 10);
  if (Number.isNaN(h24)) return getCurrentTimeString();
  const m = String(parseInt(parts[1] || '0', 10) || 0).padStart(2, '0');
  const s = String(parseInt(parts[2] || '0', 10) || 0).padStart(2, '0');
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return `${h12}:${m}:${s} ${suffix}`;
};

/**
 * Convierte cualquier string de hora (ej: "10:14:25 am", "02:30:15 pm", "14:20:00")
 * a segundos transcurridos desde el inicio del día (00:00:00).
 */
export const timeStringToSecondsToday = (timeStr?: string | null): number => {
  if (!timeStr || !timeStr.trim()) return 0;
  const clean = timeStr.trim().toLowerCase();
  const match = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) || 0;
  const s = parseInt(match[3] || '0', 10) || 0;

  if ((clean.includes('pm') || clean.includes('p.m.')) && h < 12) {
    h += 12;
  } else if ((clean.includes('am') || clean.includes('a.m.')) && h === 12) {
    h = 0;
  }

  return h * 3600 + m * 60 + s;
};

/**
 * Calcula con precisión física la duración entre dos horas ("hh:mm:ss a" o "HH:mm:ss").
 * Devuelve tanto la cadena legible (ej: "14 min 32 s") como los segundos exactos.
 * Maneja el cambio de medianoche si la hora de fin es numéricamente menor que la de inicio.
 */
export const computeDurationBetweenTimes = (
  startTimeStr?: string | null,
  endTimeStr?: string | null
): { human: string; seconds: number } => {
  if (!startTimeStr || !endTimeStr) {
    return { human: '0 s', seconds: 0 };
  }

  const startSec = timeStringToSecondsToday(startTimeStr);
  const endSec = timeStringToSecondsToday(endTimeStr);

  if (startSec === 0 && endSec === 0) {
    return { human: '0 s', seconds: 0 };
  }

  let diffSec = endSec - startSec;
  if (diffSec < 0) {
    diffSec += 86400;
  }

  return {
    human: formatHumanDuration(diffSec),
    seconds: diffSec,
  };
};

/**
 * Convierte una hora en formato string ("hh:mm:ss a" o "HH:mm:ss")
 * a un timestamp en milisegundos correspondiente a la fecha de hoy.
 */
export const timeStringToTimestampToday = (timeStr?: string | null): number => {
  if (!timeStr) return Date.now();
  const sec = timeStringToSecondsToday(timeStr);
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  return startOfDay + sec * 1000;
};


