import {
  AuditLogEntry,
  LineType,
  ProductDefinition,
  ProductionLine,
  StageId,
  UserProfile,
  UserRole,
} from '../types';
import { INITIAL_PRODUCTS } from '../data/initialData';

const TOKEN_KEY = 'qcs_token';
const API_BASE = '/api';

export interface ApiUser {
  id: string;
  codigo_empleado: string;
  nombre_completo: string;
  rol: UserRole | 'superadmin';
  turno: UserProfile['shift'];
  linea_asignada_id: string | null;
  linea_codigo?: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: any = {}) {
    super(message);
  }
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    window.dispatchEvent(new CustomEvent('qcs:session-expired'));
  }
  if (!res.ok) throw new ApiError(res.status, body.message ?? 'Error del servidor.', body);
  return body as T;
}

const LINE_UI_IDS: Record<string, string> = {
  'L-HILADA-01': 'line-pasta-hilada',
  'L-FERMENT-02': 'line-fermentacion',
};

export const lineUiId = (code: string): string => LINE_UI_IDS[code] ?? code;
export const lineCodeFromUiId = (uiId: string): string =>
  Object.entries(LINE_UI_IDS).find(([, v]) => v === uiId)?.[0] ?? uiId;

export const productUiIdFromCode = (code: string): string =>
  INITIAL_PRODUCTS.find((p) => p.code === code)?.id ?? code;
export const productCodeFromUiId = (uiId: string): string =>
  INITIAL_PRODUCTS.find((p) => p.id === uiId)?.code ?? uiId;

export const isSuperAdmin = (u: ApiUser) => u.rol === 'superadmin';

export const toProfile = (u: ApiUser): UserProfile => ({
  id: u.id,
  name: u.nombre_completo,
  code: u.codigo_empleado,
  role: u.rol === 'superadmin' ? 'administrador' : u.rol,
  shift: u.turno,
  assignedLineId: u.linea_codigo ? lineUiId(u.linea_codigo) : undefined,
});

export async function loginRequest(code: string, password: string): Promise<UserProfile> {
  const data = await apiFetch<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ codigo_empleado: code, password_o_pin: password }),
  });
  localStorage.setItem(TOKEN_KEY, data.token);
  return toProfile(data.user);
}

export async function meRequest(): Promise<UserProfile> {
  const data = await apiFetch<{ user: ApiUser }>('/auth/me');
  return toProfile(data.user);
}

export async function checkHealth(): Promise<boolean> {
  try {
    await apiFetch('/health');
    return true;
  } catch {
    return false;
  }
}

const LINE_TYPE_NAMES: Record<string, string> = {
  pasta_hilada: 'Línea de Producción de Pasta Hilada',
  fermentacion: 'Línea de Fermentación',
};

interface ApiLine {
  id: string;
  codigo: string;
  nombre: string;
  tipo_linea: LineType;
  capacidad_litros: string | number;
  estado: ProductionLine['status'];
  allowed_product_codes: string[];
}

export async function fetchLines(): Promise<ProductionLine[]> {
  const rows = await apiFetch<ApiLine[]>('/catalogs/lines');
  return rows
    .filter((l) => l.tipo_linea !== 'dulces')
    .sort((a, b) => {
      const rank = (t: string) => (t === 'pasta_hilada' ? 0 : t === 'fermentacion' ? 1 : 2);
      return rank(a.tipo_linea) - rank(b.tipo_linea) || a.codigo.localeCompare(b.codigo);
    })
    .map((l) => ({
      id: lineUiId(l.codigo),
      name: l.nombre,
      code: l.codigo,
      lineType: l.tipo_linea,
      lineTypeName: LINE_TYPE_NAMES[l.tipo_linea] ?? l.tipo_linea,
      capacityLiters: Number(l.capacidad_litros),
      status: l.estado,
      activeBatchId: null,
      assignedOperatorName: null,
      allowedProductIds: (l.allowed_product_codes ?? []).map(productUiIdFromCode),
    }));
}

export async function fetchProducts(): Promise<ProductDefinition[]> {
  const rows = await apiFetch<
    { codigo: string; nombre: string; tipo_linea: LineType; descripcion: string | null; norma_tecnica: string | null }[]
  >('/catalogs/products');
  return rows
    .filter((p) => p.tipo_linea !== 'dulces')
    .map((p) => {
      const base = INITIAL_PRODUCTS.find((ip) => ip.code === p.codigo);
      return {
        id: base?.id ?? p.codigo,
        name: base?.name ?? p.nombre,
        code: p.codigo,
        lineType: p.tipo_linea,
        description: p.descripcion ?? base?.description ?? '',
        standards: p.norma_tecnica ?? base?.standards ?? '',
        isTargetProduct: base?.isTargetProduct ?? true,
      };
    });
}

export interface LinePayload {
  codigo: string;
  nombre: string;
  tipo_linea: LineType;
  capacidad_litros: number;
  estado?: ProductionLine['status'];
  productos: string[];
}

export const createLineRequest = (payload: LinePayload) =>
  apiFetch<{ id: string }>('/catalogs/lines', { method: 'POST', body: JSON.stringify(payload) });

export const updateLineRequest = (code: string, payload: Partial<LinePayload>) =>
  apiFetch<{ id: string }>(`/catalogs/lines/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deactivateLineRequest = (code: string) =>
  apiFetch<{ message: string }>(`/catalogs/lines/${encodeURIComponent(code)}`, { method: 'DELETE' });

export async function fetchUsers(): Promise<UserProfile[]> {
  const rows = await apiFetch<ApiUser[]>('/users');
  return rows.map(toProfile);
}

export interface UserPayload {
  nombre_completo?: string;
  codigo_empleado?: string;
  pin?: string;
  password?: string;
  turno?: UserProfile['shift'];
  linea_asignada_id?: string | null;
  rol?: UserRole;
}

export async function createUserRequest(payload: UserPayload): Promise<UserProfile> {
  const row = await apiFetch<ApiUser>('/users', { method: 'POST', body: JSON.stringify(payload) });
  return toProfile(row);
}

export async function updateUserRequest(id: string, payload: UserPayload): Promise<UserProfile> {
  const row = await apiFetch<ApiUser>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  return toProfile(row);
}

export const deactivateUserRequest = (id: string) =>
  apiFetch<{ message: string }>(`/users/${id}`, { method: 'DELETE' });

export interface DraftRow {
  producto_ui_id: string;
  estado: any;
  etapa_actual: string;
  version: number;
  lote_id: string | null;
  codigo_lote: string | null;
  lote_estado: string | null;
}

export interface WorkspaceResponse {
  workspace: { estado: any; version: number } | null;
  drafts: DraftRow[];
  cerrados?: { codigo_lote: string; estado: string }[];
}

export const fetchWorkspace = (lineCode: string) =>
  apiFetch<WorkspaceResponse>(`/workspace/${encodeURIComponent(lineCode)}`);

export const saveWorkspaceRequest = (lineCode: string, estado: unknown, version: number) =>
  apiFetch<{ version: number }>(`/workspace/${encodeURIComponent(lineCode)}`, {
    method: 'PUT',
    body: JSON.stringify({ estado, version }),
  });

export interface DraftPayload {
  lineCode: string;
  productCode: string;
  estado: unknown;
  etapaActual: string;
  stageStatuses: Record<string, string>;
  version: number;
  started: boolean;
  completed?: boolean;
  volumen?: number;
  llevaAzucar?: boolean;
  variante?: string | null;
  elapsedSeconds?: number;
  observaciones?: string;
}

export const saveDraftRequest = (productUiId: string, payload: DraftPayload) =>
  apiFetch<{ version: number; lote_id: string | null; codigo_lote: string | null; completed?: boolean }>(
    `/workspace/drafts/${encodeURIComponent(productUiId)}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  );

export interface BatchHistoryRow {
  id: string;
  codigo_lote: string;
  estado: string;
  etapa_actual_codigo: string | null;
  volumen_leche_base_litros: string | number | null;
  iniciado_at: string;
  finalizado_at: string | null;
  duracion_total_segundos: number | null;
  producto_nombre: string;
  producto_codigo: string;
  linea_nombre: string;
  linea_codigo: string;
  responsable_nombre: string;
  rectificaciones: number;
  anulacion_justificacion?: string | null;
  anulado_at?: string | null;
  anulado_por?: string | null;
}

export const fetchBatchHistory = (limit = 100) =>
  apiFetch<BatchHistoryRow[]>(`/workspace/history?limit=${limit}`);

export interface RectifyPayload {
  codigoLote: string;
  estado: unknown;
  stageId: string;
  stageLabel: string;
  fieldKey: string;
  fieldLabel: string;
  oldValue: string | number;
  newValue: string | number;
  unit?: string;
  reasonCategory: string;
  justification: string;
}

export const rectifyRequest = (payload: RectifyPayload) =>
  apiFetch<{ id: string; registrado_at: string }>('/workspace/rectify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const rows = await apiFetch<any[]>('/workspace/audit');
  return rows.map((r) => {
    const ts = new Date(r.registrado_at).getTime();
    return {
      id: r.id,
      batchId: r.codigo_lote ?? '—',
      lineName: r.linea_nombre ?? '—',
      timestamp: ts,
      dateStr: new Date(ts).toLocaleString('es-CO'),
      adminName: r.autorizado_por_nombre,
      stageId: (r.etapa_codigo ?? 'acidificar') as StageId,
      stageLabel: r.etapa_label ?? '',
      fieldKey: r.campo_modificado,
      fieldLabel: r.campo_label ?? r.campo_modificado,
      oldValue: r.valor_anterior ?? '',
      newValue: r.valor_nuevo ?? '',
      unit: r.unidad ?? undefined,
      reasonCategory: r.categoria_motivo,
      justificationText: r.justificacion_tecnica,
    };
  });
}

export interface BatchDetail extends BatchHistoryRow {
  producto_ui_id: string | null;
  estado_ui: { batch?: any; stage?: string } | null;
}

export const fetchBatchDetail = (idOrCode: string) =>
  apiFetch<BatchDetail>(`/workspace/batches/${encodeURIComponent(idOrCode)}`);

export const annulBatchRequest = (idOrCode: string, justification: string) =>
  apiFetch<{ message: string }>(`/workspace/batches/${encodeURIComponent(idOrCode)}/anular`, {
    method: 'POST',
    body: JSON.stringify({ justification }),
  });

export async function fetchInactiveUsers(): Promise<UserProfile[]> {
  const rows = await apiFetch<ApiUser[]>('/users?estado=inactivos');
  return rows.map(toProfile);
}

export const reactivateUserRequest = (id: string, pin: string) =>
  apiFetch<{ message: string }>(`/users/${id}/reactivar`, { method: 'POST', body: JSON.stringify({ pin }) });

export interface InactiveLine {
  id: string;
  codigo: string;
  nombre: string;
  tipo_linea: LineType;
  capacidad_litros: string | number;
}

export const fetchInactiveLines = () => apiFetch<InactiveLine[]>('/catalogs/lines/inactive');

export const reactivateLineRequest = (code: string) =>
  apiFetch<{ message: string }>(`/catalogs/lines/${encodeURIComponent(code)}/reactivar`, { method: 'POST' });
