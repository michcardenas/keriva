// Types for the Supabase public schema.
// These reflect the actual table and column names in the database
// (Spanish / PascalCase), not the English aliases used in older code.

export type Farmacia = {
  id: number;
  created_at: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  latitud: string | number;
  longitud: string | number;
  telefono: string | null;
  horario: string | null;
  activa: boolean;
};

// Tabla farmacias_osm — 839 farmacias importadas de OpenStreetMap
// (ver scripts/fetch_farmacias_osm.js). Fuente primaria del mapa.
export type FarmaciaOsm = {
  id: string;                     // uuid
  osm_id: string;                 // "node/1234" | "way/5678"
  osm_type: 'node' | 'way' | 'relation';
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  whatsapp: string | null;
  website: string | null;
  horario: string | null;
  marca: string | null;
  latitud: string | number;
  longitud: string | number;
  farmacia_id: number | null;     // link opcional a "Farmacias"(id) legacy
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export type Medicamento = {
  id: number;
  created_at: string;
  nombre: string;
  nombre_generico: string | null;
  concentracion: string | null;
  presentacion: string | null;
  laboratorio: string | null;
  categoria: string | null;
  precio_referencia_rd: string | number | null;
};

export type Precio = {
  id: number;
  created_at: string;
  medicamento_id: number;
  farmacia_id: number;
  usuario_id: string | null;
  precio: string | number;
  tiene_foto: boolean;
  verificado: boolean;
};

// =====================================================================
// Multi-Perfil / Keriva Care (Brief Fase 1 — Semana 1)
// =====================================================================

export type TipoPerfilDB =
  | 'titular'
  | 'dependiente_pediatrico'
  | 'dependiente_adulto';

export type KerivaPerfilRow = {
  id: string;
  user_id: string;
  nombre: string;
  apellido: string | null;
  tipo_perfil: TipoPerfilDB;
  fecha_nacimiento: string | null;
  peso_lb: number | null;
  peso_kg: number | null;
  avatar_emoji: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CareMedicamentoRow = {
  id: string;
  perfil_id: string;
  perfil_tipo: TipoPerfilDB;
  sku_id: string;
  nombre_display: string;
  frecuencia_tipo: 'diaria' | 'horas' | 'semanal';
  frecuencia_valor: number | null;
  horas_toma: string[];                  // time[]
  dias_semana: number[] | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CareConsentimientoRow = {
  id: string;
  user_id: string;
  acepta_tec: boolean;
  acepta_geolocalizacion: boolean;
  acepta_historial: boolean;
  acepta_notificaciones: boolean;
  version_tec: string;
  ip_aceptacion: string | null;
  timestamp_aceptacion: string;
};

export type PerfilDisclaimerLogRow = {
  id: string;
  perfil_id: string;
  user_id: string;
  version_disclaimer: string;
  tipo_disclaimer: 'pediatrico' | 'adulto_care';
  texto_disclaimer: string;
  ip_aceptacion: string | null;
  device_fingerprint: string | null;
  timestamp_aceptacion: string;
  activo: boolean;
};

export type DosisPediatricaRow = {
  id: string;
  sku_id: string;
  dosis_mg_por_kg: number;
  dosis_max_mg: number | null;
  frecuencia_horas: number;
  via_administracion: string | null;
  notas: string | null;
  fuente: string;
  created_at: string;
  updated_at: string;
};

export type RestriccionPediatricaRow = {
  id: string;
  sku_id: string;
  edad_minima_meses: number | null;
  edad_maxima_meses: number | null;
  contraindicado: boolean;
  advertencia: string | null;
  fuente: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductoPediatricoRow = {
  sku_id: string;
  nombre_comercial: string;
  principio_activo: string | null;
  presentacion: string | null;
  categoria_id: string | null;
  dosis_mg_por_kg: number | null;
  dosis_max_mg: number | null;
  frecuencia_horas: number | null;
  via_administracion: string | null;
  dosis_notas: string | null;
  dosis_fuente: string | null;
  edad_minima_meses: number | null;
  edad_maxima_meses: number | null;
  contraindicado: boolean | null;
  restriccion_advertencia: string | null;
  restriccion_fuente: string | null;
};

// Vista v_familia_dashboard — incluye campos derivados (edad, contadores)
export type FamiliaDashboardRowDB = KerivaPerfilRow & {
  perfil_id: string;
  edad_anios: number | null;
  medicamentos_activos: number;
  disclaimer_aceptado: boolean;
};

export type SolicitudFarmaciaRow = {
  id: number;
  usuario_id: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  nombre_comercial: string;
  rnc: string;
  direccion: string;
  ciudad: string;
  telefono_farmacia: string;
  horario: string;
  nombre_propietario: string;
  cedula_propietario: string;
  motivo_rechazo: string | null;
  documento_url: string | null;
  latitud: number;
  longitud: number;
  revisado_por: string | null;
  created_at: string;
  updated_at: string;
};

// Shapes returned by the joined queries used in the app.
// These mirror what PostgREST returns when using `select=...,Precios(...)` etc.

export type MedicamentoConPrecios = Medicamento & {
  Precios: Array<Pick<Precio, 'precio'>>;
};

export type FarmaciaConPrecios = Farmacia & {
  Precios: Array<Pick<Precio, 'precio'>>;
};

export type MedicamentoDetalle = Medicamento & {
  Precios: Array<
    Pick<Precio, 'precio'> & {
      Farmacias: Pick<Farmacia, 'nombre' | 'direccion' | 'latitud' | 'longitud'> | null;
    }
  >;
};
