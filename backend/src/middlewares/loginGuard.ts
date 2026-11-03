import { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 30;
const MAX_FAILS_PER_USER = 5;
const LOCK_MS = 15 * 60 * 1000;

interface Counter {
  count: number;
  resetAt: number;
}

const byIp = new Map<string, Counter>();
const byUser = new Map<string, Counter>();

const normalizeCode = (value: unknown): string => String(value ?? '').trim().toUpperCase();

const sweep = (map: Map<string, Counter>, now: number) => {
  if (map.size < 500) return;
  map.forEach((v, k) => {
    if (v.resetAt <= now) map.delete(k);
  });
};

const bump = (map: Map<string, Counter>, key: string, windowMs: number, now: number): Counter => {
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    map.set(key, fresh);
    return fresh;
  }
  current.count += 1;
  return current;
};

const minutesLeft = (resetAt: number, now: number) => Math.max(1, Math.ceil((resetAt - now) / 60000));

export function loginGuard(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  sweep(byIp, now);
  sweep(byUser, now);

  const ip = req.ip || req.socket.remoteAddress || 'desconocida';
  const ipCounter = bump(byIp, ip, WINDOW_MS, now);
  if (ipCounter.count > MAX_ATTEMPTS_PER_IP) {
    res.status(429).json({
      error: 'TOO_MANY_ATTEMPTS',
      message: `Demasiados intentos desde este equipo. Intenta de nuevo en ${minutesLeft(ipCounter.resetAt, now)} min.`,
    });
    return;
  }

  const code = normalizeCode(req.body?.codigo_empleado ?? req.body?.codigoEmpleado ?? req.body?.code);
  if (code) {
    const userCounter = byUser.get(code);
    if (userCounter && userCounter.resetAt > now && userCounter.count >= MAX_FAILS_PER_USER) {
      res.status(429).json({
        error: 'ACCOUNT_LOCKED',
        message: `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${minutesLeft(userCounter.resetAt, now)} min.`,
      });
      return;
    }
  }

  res.on('finish', () => {
    if (!code) return;
    const at = Date.now();
    if (res.statusCode === 401) bump(byUser, code, LOCK_MS, at);
    else if (res.statusCode === 200) byUser.delete(code);
  });

  next();
}
