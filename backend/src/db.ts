import 'dotenv/config';
import { Pool } from 'pg';

/**
 * Pool único de conexiones a PostgreSQL.
 * Configuración por DATABASE_URL (ver backend/.env.example).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'Falta la variable de entorno DATABASE_URL. Copia backend/.env.example a backend/.env y configúrala.'
  );
}

export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Un error en un cliente inactivo del pool no debe tumbar el proceso sin registro.
pool.on('error', (err) => {
  console.error('[db] Error inesperado en un cliente inactivo del pool:', err.message);
});

/** Verifica que la base de datos responde. Usado por /api/health. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export default pool;
