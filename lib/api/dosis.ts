import { restGet } from '@/lib/api/_rest';

// =====================================================================
// Tipos
// =====================================================================
export type ProductoPediatrico = {
  skuId: string;
  nombreComercial: string;
  principioActivo: string | null;
  presentacion: string | null;
  // dosis_pediatricas
  dosisMgPorKg: number | null;
  dosisMaxMg: number | null;
  frecuenciaHoras: number | null;
  viaAdministracion: string | null;
  dosisNotas: string | null;
  dosisFuente: string | null;
  // restricciones_pediatricas
  edadMinimaMeses: number | null;
  edadMaximaMeses: number | null;
  contraindicado: boolean;
  restriccionAdvertencia: string | null;
  restriccionFuente: string | null;
};

type ProductoPediatricoRow = {
  sku_id: string;
  nombre_comercial: string;
  principio_activo: string | null;
  presentacion: string | null;
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

function toProducto(row: ProductoPediatricoRow): ProductoPediatrico {
  return {
    skuId: row.sku_id,
    nombreComercial: row.nombre_comercial,
    principioActivo: row.principio_activo,
    presentacion: row.presentacion,
    dosisMgPorKg: row.dosis_mg_por_kg,
    dosisMaxMg: row.dosis_max_mg,
    frecuenciaHoras: row.frecuencia_horas,
    viaAdministracion: row.via_administracion,
    dosisNotas: row.dosis_notas,
    dosisFuente: row.dosis_fuente,
    edadMinimaMeses: row.edad_minima_meses,
    edadMaximaMeses: row.edad_maxima_meses,
    contraindicado: row.contraindicado ?? false,
    restriccionAdvertencia: row.restriccion_advertencia,
    restriccionFuente: row.restriccion_fuente,
  };
}

// =====================================================================
// Queries
// =====================================================================

/** Lista productos con datos pediátricos (dosis o restricciones). */
export async function listProductosPediatricos(
  search?: string,
): Promise<ProductoPediatrico[]> {
  let path =
    'v_producto_pediatrico?select=*&dosis_mg_por_kg=not.is.null&order=nombre_comercial.asc&limit=50';

  if (search && search.trim().length >= 2) {
    const q = encodeURIComponent(`%${search.trim()}%`);
    path += `&or=(nombre_comercial.ilike.${q},principio_activo.ilike.${q})`;
  }

  try {
    const data = await restGet(path);
    return (data ?? []).map((r: any) => toProducto(r as ProductoPediatricoRow));
  } catch (e) {
    console.warn('listProductosPediatricos error', e);
    return [];
  }
}

export async function getProductoPediatrico(
  skuId: string,
): Promise<ProductoPediatrico | null> {
  try {
    const data = await restGet(
      `v_producto_pediatrico?select=*&sku_id=eq.${skuId}&limit=1`,
    );
    if (!Array.isArray(data) || data.length === 0) return null;
    return toProducto(data[0] as ProductoPediatricoRow);
  } catch {
    return null;
  }
}

// =====================================================================
// Cálculo de dosis pediátrica — Brief §4.1
// =====================================================================
export type CalcularDosisInput = {
  pesoLb: number;       // peso del perfil en libras (estándar RD)
  edadMeses?: number | null;
  producto: ProductoPediatrico;
};

export type CalcularDosisResult =
  | {
      ok: true;
      pesoLb: number;
      pesoKg: number;
      dosisMg: number;             // dosis individual estimada
      frecuenciaHoras: number;
      topeAplicado: boolean;
      advertencia: string | null;  // advertencia por edad (no contraindicación)
      notas: string | null;
    }
  | {
      ok: false;
      reason: 'sin_peso' | 'sin_dosis' | 'contraindicado' | 'fuera_rango_edad';
      message: string;
    };

const LB_TO_KG = 2.20462;

export function calcularDosisPediatrica(
  input: CalcularDosisInput,
): CalcularDosisResult {
  const { pesoLb, edadMeses, producto } = input;

  if (!Number.isFinite(pesoLb) || pesoLb <= 0) {
    return {
      ok: false,
      reason: 'sin_peso',
      message: 'Ingresa el peso del perfil en libras para continuar.',
    };
  }

  if (!producto.dosisMgPorKg || !producto.frecuenciaHoras) {
    return {
      ok: false,
      reason: 'sin_dosis',
      message:
        'Dosis pediátrica no disponible para este medicamento. Consulte con su médico.',
    };
  }

  if (producto.contraindicado) {
    return {
      ok: false,
      reason: 'contraindicado',
      message:
        producto.restriccionAdvertencia ||
        'Este medicamento está contraindicado para uso pediátrico.',
    };
  }

  // Verificación de rango de edad si se proporcionó edad
  if (edadMeses != null) {
    if (
      producto.edadMinimaMeses != null &&
      edadMeses < producto.edadMinimaMeses
    ) {
      return {
        ok: false,
        reason: 'fuera_rango_edad',
        message:
          producto.restriccionAdvertencia ||
          `Este medicamento no se recomienda en menores de ${producto.edadMinimaMeses} meses.`,
      };
    }
    if (
      producto.edadMaximaMeses != null &&
      edadMeses > producto.edadMaximaMeses
    ) {
      return {
        ok: false,
        reason: 'fuera_rango_edad',
        message: `Este medicamento no se recomienda para mayores de ${producto.edadMaximaMeses} meses (use formulación adulta).`,
      };
    }
  }

  // Cálculo
  const pesoKg = Math.round((pesoLb / LB_TO_KG) * 1000) / 1000;
  let dosisMg = Math.round(pesoKg * producto.dosisMgPorKg * 10) / 10;
  let topeAplicado = false;

  if (producto.dosisMaxMg != null && dosisMg > producto.dosisMaxMg) {
    dosisMg = producto.dosisMaxMg;
    topeAplicado = true;
  }

  return {
    ok: true,
    pesoLb,
    pesoKg,
    dosisMg,
    frecuenciaHoras: producto.frecuenciaHoras,
    topeAplicado,
    advertencia: producto.restriccionAdvertencia,
    notas: producto.dosisNotas,
  };
}
