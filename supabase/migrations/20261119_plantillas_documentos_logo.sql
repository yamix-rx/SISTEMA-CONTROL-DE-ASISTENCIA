-- Cada plantilla puede conservar un logo propio. El binario se guarda en
-- el bucket privado sbss-documentos y aquí se conserva su referencia y metadatos.
ALTER TABLE public.plantillas_documentos
  ADD COLUMN IF NOT EXISTS logo_path VARCHAR(100),
  ADD COLUMN IF NOT EXISTS logo_mime VARCHAR(40),
  ADD COLUMN IF NOT EXISTS logo_nombre VARCHAR(200);
