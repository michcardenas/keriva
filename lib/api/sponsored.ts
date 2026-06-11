import { supabase } from '@/lib/supabase';

// =====================================================================
// Pin Patrocinado (adendum v2.1 §3.1)
// =====================================================================
// Un laboratorio paga por fijar un SKU como resultado #1 cuando el usuario
// busca dentro de una categoría terapéutica NO restringida. Máximo 1 por
// búsqueda. La vista v_sponsored_pins_activos ya filtra activo + vigente +
// no-restringido; aquí solo elegimos el de mayor prioridad.
// =====================================================================

export type SponsoredPin = {
  skuId: string;
  nombreComercial: string;
  laboratorioNombre: string;
  categoriaSlug: string;
  /** Id del Medicamento legado que coincide por nombre (para navegar al detalle). */
  medicamentoId: number | null;
};

/** Convierte el label de categoría del Home a su slug del catálogo. */
export function categoriaSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Pin patrocinado vigente para una categoría (por slug). Retorna null si no
 * hay ninguno o si la categoría es 'todo'/restringida.
 */
export async function getSponsoredPin(slug: string): Promise<SponsoredPin | null> {
  if (!slug || slug === 'todo') return null;

  const { data, error } = await supabase
    .from('v_sponsored_pins_activos')
    .select('sku_id, nombre_comercial, laboratorio_nombre, categoria_slug, prioridad')
    .eq('categoria_slug', slug)
    .order('prioridad', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Resolver el Medicamento legado por nombre para poder abrir su detalle.
  let medicamentoId: number | null = null;
  const { data: med } = await supabase
    .from('Medicamentos')
    .select('id')
    .ilike('nombre', data.nombre_comercial)
    .limit(1)
    .maybeSingle();
  if (med) medicamentoId = med.id as number;

  return {
    skuId: data.sku_id as string,
    nombreComercial: data.nombre_comercial as string,
    laboratorioNombre: data.laboratorio_nombre as string,
    categoriaSlug: data.categoria_slug as string,
    medicamentoId,
  };
}
