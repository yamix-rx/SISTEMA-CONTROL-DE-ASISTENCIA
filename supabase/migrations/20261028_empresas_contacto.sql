-- SBSS: contacto empresarial opcional.
-- Migración aditiva: conserva todas las empresas y valores existentes.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(120) NULL;

COMMENT ON COLUMN public.empresas.telefono IS
  'Teléfono general de contacto de la empresa; opcional.';
COMMENT ON COLUMN public.empresas.email_contacto IS
  'Correo de contacto institucional; opcional y distinto de usuarios.email.';
