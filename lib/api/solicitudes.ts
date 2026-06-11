import { supabase } from '@/lib/supabase';
import type { SolicitudFarmaciaRow } from '@/lib/database.types';

export type EstadoSolicitud =
  | 'pendiente'
  | 'en_revision'
  | 'aprobada'
  | 'rechazada'
  | 'con_observaciones';

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
  observaciones: string | null;
  documentoUrl: string | null;
  docLicenciaUrl: string | null;
  docRegistroUrl: string | null;
  docCedulaUrl: string | null;
  createdAt: string;
};

function mapSolicitud(r: SolicitudFarmaciaRow): SolicitudFarmacia {
  const x = r as any;
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    estado: x.estado,
    nombreComercial: r.nombre_comercial,
    rnc: r.rnc,
    direccion: r.direccion,
    ciudad: r.ciudad,
    telefonoFarmacia: r.telefono_farmacia,
    horario: r.horario,
    nombrePropietario: r.nombre_propietario,
    cedulaPropietario: r.cedula_propietario,
    motivoRechazo: r.motivo_rechazo,
    observaciones: x.observaciones ?? null,
    documentoUrl: x.documento_url ?? null,
    docLicenciaUrl: x.doc_licencia_url ?? null,
    docRegistroUrl: x.doc_registro_url ?? null,
    docCedulaUrl: x.doc_cedula_url ?? null,
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
  docLicenciaUri?: string | null;
  docRegistroUri?: string | null;
  docCedulaUri?: string | null;
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
  const documentoUrl = input.documentoUri ? await uploadDocumento(input.usuarioId, input.documentoUri) : null;
  const docLicencia = input.docLicenciaUri ? await uploadDocumento(input.usuarioId, input.docLicenciaUri) : null;
  const docRegistro = input.docRegistroUri ? await uploadDocumento(input.usuarioId, input.docRegistroUri) : null;
  const docCedula = input.docCedulaUri ? await uploadDocumento(input.usuarioId, input.docCedulaUri) : null;

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
      doc_licencia_url: docLicencia,
      doc_registro_url: docRegistro,
      doc_cedula_url: docCedula,
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

/** Admin: marcar una solicitud como "en revisión". */
export async function marcarEnRevision(
  solicitudId: number,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('marcar_solicitud_en_revision', {
    p_solicitud_id: solicitudId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Admin: pedir correcciones (deja la solicitud "con observaciones"). */
export async function solicitarObservaciones(
  solicitudId: number,
  observaciones: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('solicitar_observaciones_solicitud', {
    p_solicitud_id: solicitudId,
    p_observaciones: observaciones,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Documentos RD (licencia, registro, cédula) + reenvío ──────

export type DocsReenvio = {
  licenciaUri?: string | null;
  registroUri?: string | null;
  cedulaUri?: string | null;
};

/**
 * Farmacia: reenvía la solicitud corregida. Sube los documentos nuevos (si los
 * hay) y vuelve la solicitud a "pendiente" vía RPC. Los documentos no provistos
 * conservan su valor anterior.
 */
export async function reenviarSolicitud(
  usuarioId: string,
  solicitudId: number,
  docs: DocsReenvio,
): Promise<{ ok: boolean; error?: string }> {
  const licencia = docs.licenciaUri ? await uploadDocumento(usuarioId, docs.licenciaUri) : null;
  const registro = docs.registroUri ? await uploadDocumento(usuarioId, docs.registroUri) : null;
  const cedula = docs.cedulaUri ? await uploadDocumento(usuarioId, docs.cedulaUri) : null;

  const { error } = await supabase.rpc('reenviar_solicitud_farmacia', {
    p_solicitud_id: solicitudId,
    p_doc_licencia: licencia,
    p_doc_registro: registro,
    p_doc_cedula: cedula,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
