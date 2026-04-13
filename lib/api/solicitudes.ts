import { supabase } from '@/lib/supabase';
import type { SolicitudFarmaciaRow } from '@/lib/database.types';

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export type SolicitudFarmacia = {
  id: number;
  usuarioId: string;
  estado: EstadoSolicitud;
  nombreComercial: string;
  rnc: string;
  direccion: string;
  ciudad: string;
  telefonoFarmacia: string;
  horario: string;
  nombrePropietario: string;
  cedulaPropietario: string;
  motivoRechazo: string | null;
  documentoUrl: string | null;
  createdAt: string;
};

function mapSolicitud(r: SolicitudFarmaciaRow): SolicitudFarmacia {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    estado: r.estado,
    nombreComercial: r.nombre_comercial,
    rnc: r.rnc,
    direccion: r.direccion,
    ciudad: r.ciudad,
    telefonoFarmacia: r.telefono_farmacia,
    horario: r.horario,
    nombrePropietario: r.nombre_propietario,
    cedulaPropietario: r.cedula_propietario,
    motivoRechazo: r.motivo_rechazo,
    documentoUrl: (r as any).documento_url ?? null,
    createdAt: r.created_at,
  };
}

// ── User functions ──────────────────────────────────────────

export type CreateSolicitudInput = {
  usuarioId: string;
  nombreComercial: string;
  rnc: string;
  direccion: string;
  ciudad: string;
  telefonoFarmacia: string;
  horario: string;
  nombrePropietario: string;
  cedulaPropietario: string;
  documentoUri?: string | null;
  latitud?: number;
  longitud?: number;
};

async function uploadDocumento(userId: string, uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const type = blob.type || 'application/pdf';
    const ext = type.includes('pdf') ? 'pdf' : type.includes('png') ? 'png' : 'jpg';
    const filename = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('solicitud-docs')
      .upload(filename, blob, { contentType: type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('solicitud-docs').getPublicUrl(filename);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function createSolicitud(
  input: CreateSolicitudInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  let documentoUrl: string | null = null;
  if (input.documentoUri) {
    documentoUrl = await uploadDocumento(input.usuarioId, input.documentoUri);
  }

  const { data, error } = await supabase
    .from('solicitudes_farmacia')
    .insert({
      usuario_id: input.usuarioId,
      nombre_comercial: input.nombreComercial,
      rnc: input.rnc,
      direccion: input.direccion,
      ciudad: input.ciudad,
      telefono_farmacia: input.telefonoFarmacia,
      horario: input.horario,
      nombre_propietario: input.nombrePropietario,
      cedula_propietario: input.cedulaPropietario,
      documento_url: documentoUrl,
      latitud: input.latitud ?? 0,
      longitud: input.longitud ?? 0,
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.includes('solicitudes_farmacia_one_pending')) {
      return { ok: false, error: 'Ya tienes una solicitud pendiente' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as number };
}

export async function getMySolicitud(
  usuarioId: string,
): Promise<SolicitudFarmacia | null> {
  const { data, error } = await supabase
    .from('solicitudes_farmacia')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapSolicitud(data as SolicitudFarmaciaRow);
}

// ── Admin functions ─────────────────────────────────────────

export async function getPendingSolicitudes(): Promise<SolicitudFarmacia[]> {
  const { data, error } = await supabase
    .from('solicitudes_farmacia')
    .select('*')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true });

  if (error) return [];
  return ((data as SolicitudFarmaciaRow[]) ?? []).map(mapSolicitud);
}

export async function aprobarSolicitud(
  solicitudId: number,
): Promise<{ ok: boolean; error?: string; farmaciaId?: number }> {
  const { data, error } = await supabase.rpc('aprobar_solicitud_farmacia', {
    p_solicitud_id: solicitudId,
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; farmacia_id?: number } | null;
  return { ok: true, farmaciaId: result?.farmacia_id };
}

export async function rechazarSolicitud(
  solicitudId: number,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('rechazar_solicitud_farmacia', {
    p_solicitud_id: solicitudId,
    p_motivo: motivo ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
