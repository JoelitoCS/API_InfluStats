// ─────────────────────────────────────────────────────────────────────────────
//  lib/supabaseStorage.js — cliente de Supabase Storage para subida de avatares
//
//  Arquitectura: Frontend → Express → Multer → este módulo → Supabase Storage
//
//  Variables de entorno necesarias en .env:
//    SUPABASE_URL      = https://xxxx.supabase.co
//    SUPABASE_SERVICE_KEY = eyJ... (service_role key, NO la anon key)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'avatars'; // nombre del bucket en Supabase Storage

// Usamos la service_role key para bypass de RLS en Storage
let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

// ── uploadAvatar ──────────────────────────────────────────────────────────────
// Sube un archivo local (ruta temporal de Multer) a Supabase Storage.
// Devuelve la URL pública del archivo subido.
//
// @param {string} localPath  - Ruta temporal del archivo en disco (multer)
// @param {string} storagePath - Ruta destino en el bucket (ej: "avatars/uuid.webp")
// @param {string} mimeType   - MIME type del archivo (ej: "image/webp")
// @returns {{ publicUrl: string }}
export async function uploadAvatar(localPath, storagePath, mimeType) {
  const sb = getSupabase();

  // Leer el archivo desde disco (Multer lo dejó en /tmp)
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType:  mimeType,
      upsert:       true, // sobreescribir si existe (para actualizaciones)
      cacheControl: '3600',
    });

  if (error) throw new Error(`Supabase Storage upload error: ${error.message}`);

  // Obtener URL pública
  const { data } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl };
}

// ── deleteAvatar ──────────────────────────────────────────────────────────────
// Elimina un archivo del bucket dado su path interno.
// No lanza error si el archivo no existe (idempotente).
//
// @param {string} storagePath - Path en el bucket (ej: "user-id/avatar.webp")
export async function deleteAvatar(storagePath) {
  if (!storagePath) return;
  try {
    const sb = getSupabase();
    await sb.storage.from(BUCKET).remove([storagePath]);
  } catch (err) {
    // No propagamos el error: si falla el borrado no bloqueamos la operación
    console.warn('deleteAvatar warning:', err.message);
  }
}
