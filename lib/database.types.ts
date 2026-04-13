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
      Farmacias: Pick<Farmacia, 'nombre' | 'direccion'> | null;
    }
  >;
};
