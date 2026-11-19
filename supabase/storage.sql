-- SBSS: bucket privado para documentos de personal y sustentos de permisos.
-- Se requiere validación de autorización en la API antes de firmar subidas o descargas.
-- Ninguna política pública de storage.objects debe permitir acceso al bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sbss-documentos','sbss-documentos', FALSE, 5242880,
  ARRAY['application/pdf','image/png','image/jpeg','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
ON CONFLICT (id) DO NOTHING;
