-- Los logos se almacenan en el bucket privado sbss-documentos.
-- Esta migración ya figura aplicada en el proyecto Supabase SBSS.
ALTER TABLE public.plantillas_documentos
  ADD COLUMN IF NOT EXISTS logo_path VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS logo_mime VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS logo_nombre VARCHAR(200) NULL;
