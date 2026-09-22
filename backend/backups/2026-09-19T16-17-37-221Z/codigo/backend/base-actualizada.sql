-- Esquema y datos de DEMOSTRACIÓN. Para producción use npm run instalar.
CREATE DATABASE IF NOT EXISTS gestion_personal_sbss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestion_personal_sbss;

-- ==========================================================
-- 1. SEGURIDAD Y PERFILES
-- ==========================================================
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 2. ESTRUCTURA EMPRESARIAL GRUPO SBSS
-- ==========================================================
CREATE TABLE empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    ruc VARCHAR(11) NULL,
    direccion VARCHAR(255) NULL,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    empresa_id INT NOT NULL,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

CREATE TABLE cargos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    area_id INT NOT NULL,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

-- ==========================================================
-- 3. GESTIÓN DE PERSONAL Y USUARIOS
-- ==========================================================
CREATE TABLE empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_documento ENUM('DNI', 'CE', 'PASAPORTE') DEFAULT 'DNI',
    numero_documento VARCHAR(15) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    foto_perfil VARCHAR(255) NULL,
    fecha_nacimiento DATE NULL,
    telefono VARCHAR(20) NULL,
    correo_personal VARCHAR(120) NULL,
    direccion VARCHAR(255) NULL,
    carrera VARCHAR(100) NULL,
    institucion_educativa VARCHAR(150) NULL,
    
    empresa_id INT NOT NULL,
    area_id INT NOT NULL,
    cargo_id INT NOT NULL,
    puesto VARCHAR(150) NULL,
    
    tipo_vinculo VARCHAR(50) NOT NULL DEFAULT 'trabajador',
    horas_totales_asignadas DECIMAL(6,2) NULL DEFAULT 0.00,
    horas_completadas DECIMAL(6,2) NULL DEFAULT 0.00,
    estado ENUM('activo', 'inactivo', 'finalizado', 'suspendido') DEFAULT 'activo',
    fecha_ingreso DATE NOT NULL,
    fecha_finalizacion DATE NULL,
    observaciones_rrhh TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    FOREIGN KEY (area_id) REFERENCES areas(id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id)
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL UNIQUE,
    rol_id INT NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    sesion_version INT NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- ==========================================================
-- 4. CONTROL DE PRÁCTICAS Y HORAS
-- ==========================================================
CREATE TABLE practicante_detalles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL UNIQUE,
    horas_meta DECIMAL(8,2) NOT NULL DEFAULT 320,
    fecha_vencimiento_convenio DATE NULL,
    estado_completado BOOLEAN DEFAULT FALSE,
    fecha_completado DATE NULL,
    INDEX idx_practicante_vencimiento (fecha_vencimiento_convenio),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE
);

-- ==========================================================
-- 5. HORARIOS INDIVIDUALES Y MALLA SEMANAL
-- ==========================================================
CREATE TABLE horarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL,
    dia_semana TINYINT NOT NULL COMMENT '1=Lunes ... 7=Domingo',
    turno ENUM('manana', 'tarde', 'completo') DEFAULT 'manana',
    hora_entrada TIME NOT NULL,
    hora_salida TIME NOT NULL,
    tolerancia_minutos INT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    UNIQUE KEY uk_empleado_dia (empleado_id, dia_semana)
);

-- ==========================================================
-- 6. ASISTENCIA Y CONTROL DE TARDANZAS
-- ==========================================================
CREATE TABLE asistencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_programada_entrada TIME NULL,
    hora_programada_salida TIME NULL,
    tolerancia_minutos INT NULL,
    hora_ingreso TIME NULL,
    hora_salida TIME NULL,
    minutos_tardanza INT DEFAULT 0,
    horas_trabajadas DECIMAL(5,2) DEFAULT 0.00,
    estado ENUM('presente', 'falta', 'tardanza', 'permiso', 'descanso', 'feriado', 'vacaciones', 'justificado') NOT NULL DEFAULT 'presente',
    observacion VARCHAR(255) NULL,
    registrado_por_usuario_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE KEY uk_asistencia_diaria (empleado_id, fecha)
);

-- ==========================================================
-- 7. GESTIÓN DE PERMISOS
-- ==========================================================
CREATE TABLE tipo_permisos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE permisos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL,
    tipo_permiso VARCHAR(50) NOT NULL DEFAULT 'Personal',
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    hora_desde TIME NULL,
    hora_hasta TIME NULL,
    motivo TEXT NOT NULL,
    observaciones TEXT NULL,
    estado ENUM('Solicitado', 'Aprobado', 'Rechazado') DEFAULT 'Solicitado',
    archivo_sustento VARCHAR(255) NULL,
    archivo_sustento_nombre VARCHAR(200) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE
);

-- ==========================================================
-- 8. EXPEDIENTE DIGITAL Y GENERACIÓN DE DOCUMENTOS PDF
-- ==========================================================
CREATE TABLE tipo_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT NULL,
    es_obligatorio BOOLEAN DEFAULT FALSE
);

CREATE TABLE documentos_empleado (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL,
    tipo_documento_id INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NULL,
    observacion TEXT NULL,
    revisado_por INT NULL,
    fecha_revision DATETIME NULL,
    estado ENUM('pendiente', 'validado', 'rechazado') DEFAULT 'pendiente',
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (tipo_documento_id) REFERENCES tipo_documentos(id) ON DELETE CASCADE
);

CREATE TABLE plantillas_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    titulo VARCHAR(150) NOT NULL,
    cuerpo_html LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================================
-- 9. CONTRATOS Y VÍNCULO LABORAL
-- ==========================================================
CREATE TABLE contratos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL,
    codigo VARCHAR(40) NULL UNIQUE,
    tipo_contrato VARCHAR(80) NOT NULL,
    modalidad VARCHAR(80) NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    remuneracion DECIMAL(10,2) NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'PEN',
    horas_semanales DECIMAL(5,2) NULL,
    estado ENUM('borrador','vigente','finalizado','cancelado') NOT NULL DEFAULT 'borrador',
    observaciones TEXT NULL,
    documento_empleado_id INT NULL,
    creado_por_usuario_id INT NULL,
    actualizado_por_usuario_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    FOREIGN KEY (documento_empleado_id) REFERENCES documentos_empleado(id) ON DELETE SET NULL,
    FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (actualizado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_contratos_empleado (empleado_id),
    INDEX idx_contratos_estado_fechas (estado, fecha_inicio, fecha_fin),
    INDEX idx_contratos_fecha_fin (fecha_fin)
);

-- ==========================================================
-- 10. CAPACITACIONES Y PARTICIPANTES
-- ==========================================================
CREATE TABLE capacitaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(160) NOT NULL,
    categoria VARCHAR(100) NULL,
    descripcion TEXT NULL,
    modalidad ENUM('presencial','virtual','hibrida') NOT NULL DEFAULT 'presencial',
    proveedor VARCHAR(150) NULL,
    empresa_id INT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    horas DECIMAL(7,2) NOT NULL,
    lugar VARCHAR(255) NULL,
    enlace VARCHAR(1000) NULL,
    cupo INT NULL,
    obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
    estado ENUM('borrador','programada','en_curso','finalizada','cancelada') NOT NULL DEFAULT 'borrador',
    creado_por_usuario_id INT NULL,
    actualizado_por_usuario_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL,
    FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (actualizado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_capacitaciones_estado_fecha (estado, fecha_inicio, fecha_fin),
    INDEX idx_capacitaciones_empresa (empresa_id)
);

CREATE TABLE capacitacion_participantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    capacitacion_id INT NOT NULL,
    empleado_id INT NOT NULL,
    estado ENUM('inscrito','en_curso','aprobado','desaprobado','no_asistio','cancelado') NOT NULL DEFAULT 'inscrito',
    asistencia_porcentaje DECIMAL(5,2) NULL,
    nota DECIMAL(5,2) NULL,
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_completado DATETIME NULL,
    observaciones TEXT NULL,
    certificado_documento_id INT NULL,
    FOREIGN KEY (capacitacion_id) REFERENCES capacitaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    FOREIGN KEY (certificado_documento_id) REFERENCES documentos_empleado(id) ON DELETE SET NULL,
    UNIQUE KEY uk_capacitacion_empleado (capacitacion_id, empleado_id),
    INDEX idx_cap_part_empleado (empleado_id),
    INDEX idx_cap_part_estado (estado)
);

-- ==========================================================
-- 11. AUDITORÍA Y REGISTRO DE CAMBIOS
-- ==========================================================
CREATE TABLE historial_cambios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    tabla_afectada VARCHAR(60) NOT NULL,
    registro_id INT NOT NULL,
    accion ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FALLIDO', 'DENEGADO', 'ERROR') NOT NULL,
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    ip_origen VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ==========================================================
-- DATOS INICIALES Y MAESTROS
-- ==========================================================

-- ROLES
INSERT IGNORE INTO roles (id, nombre, descripcion) VALUES
(1, 'Administrador General', 'Acceso total al sistema'),
(2, 'Recursos Humanos', 'Gestión de personal, asistencia y legajos'),
(3, 'Trabajador/Practicante', 'Consulta de información y archivos propios, sin modificar asistencia');

-- EMPRESAS
INSERT IGNORE INTO empresas (id, razon_social, ruc, direccion, estado) VALUES
(1, 'Importadora y Distribuidora Silsan S.A.C.', '20601234567', 'Av. América Sur 123, Trujillo', 'activo'),
(2, 'Droguería Silsan S.A.C.', '20601234568', 'Jr. Unión 456, Trujillo', 'activo'),
(3, 'SBSS Outsourcing S.A.C.', '20601234569', 'Av. España 789, Trujillo', 'activo'),
(4, 'Silsan Logística Integral', '20601234570', 'Parque Industrial, Trujillo', 'activo'),
(5, 'Nanas & Amas', NULL, NULL, 'activo'),
(6, 'Centro de Conciliación SBSS', NULL, NULL, 'activo'),
(7, 'Estudio Jurídico SBSS', NULL, NULL, 'activo'),
(8, 'ONG MESPO', NULL, NULL, 'activo');

-- ÁREAS
INSERT IGNORE INTO areas (id, nombre, empresa_id) VALUES
(1, 'Recursos Humanos', 1),
(2, 'Sistemas y TI', 1),
(3, 'Operaciones y Almacén', 1),
(4, 'Administración y Finanzas', 2),
(5, 'Comercial y Ventas', 3),
(6, 'Logística y Distribución', 4);

-- CARGOS
INSERT IGNORE INTO cargos (id, nombre, area_id) VALUES
(1, 'Analista de Recursos Humanos', 1),
(2, 'Desarrollador de Sistemas', 2),
(3, 'Practicante de Sistemas', 2),
(4, 'Supervisor de Operaciones', 3),
(5, 'Coordinadora Administrativa', 4),
(6, 'Practicante de Finanzas', 4),
(7, 'Ejecutiva Comercial', 5),
(8, 'Supervisora de Distribución', 6);

-- 1. EMPLEADOS
INSERT IGNORE INTO empleados
(id, tipo_documento, numero_documento, nombres, apellidos, empresa_id, area_id, cargo_id, tipo_vinculo, horas_totales_asignadas, horas_completadas, estado, fecha_ingreso)
VALUES
(1, 'DNI', '70891234', 'Yenci Jose', 'Agreda Ramirez', 1, 2, 2, 'trabajador', NULL, 0.00, 'activo', '2026-01-15'),
(2, 'DNI', '45871290', 'Valeria Sofia', 'Mendoza Castro', 1, 1, 1, 'trabajador', NULL, 0.00, 'activo', '2026-02-01'),
(3, 'DNI', '73456789', 'Carlos Eduardo', 'Paredes Rios', 1, 2, 3, 'practicante', 720.00, 150.00, 'activo', '2026-03-01'),
(4, 'DNI', '72109845', 'Luciana Belen', 'Yamanaka Huamán', 2, 4, 6, 'practicante', 480.00, 95.00, 'activo', '2026-03-15'),
(5, 'DNI', '41235678', 'Jorge Luis', 'Vargas Silva', 1, 3, 4, 'trabajador', NULL, 0.00, 'activo', '2026-01-10'),
(6, 'DNI', '46890123', 'Rosa Mercedes', 'Ramos Ruiz', 2, 4, 5, 'trabajador', NULL, 0.00, 'activo', '2026-02-15'),
(7, 'DNI', '43567890', 'Melani Fiorella', 'López Rojas', 3, 5, 7, 'trabajador', NULL, 0.00, 'activo', '2026-01-20'),
(8, 'DNI', '48901234', 'Daysi Paola', 'Reyes Padilla', 4, 6, 8, 'trabajador', NULL, 0.00, 'activo', '2026-02-01');

-- 2. USUARIOS DEL SISTEMA
-- Credenciales predeterminadas: clave 123456 encriptada con BCrypt
INSERT IGNORE INTO usuarios
(id, empleado_id, rol_id, email, password, activo)
VALUES
(1, 1, 1, 'admin@silsan.pe', '$2b$10$.AdgrtAZ5NfOzg1QTJFRtONv5znNrlHtlrYr/bdyu5xnlGdlFPMDa', 1),
(2, 2, 2, 'rrhh@silsan.pe', '$2b$10$.AdgrtAZ5NfOzg1QTJFRtONv5znNrlHtlrYr/bdyu5xnlGdlFPMDa', 1),
(3, 3, 3, 'practicante@silsan.pe', '$2b$10$.AdgrtAZ5NfOzg1QTJFRtONv5znNrlHtlrYr/bdyu5xnlGdlFPMDa', 1);

-- 3. MALLA SEMANAL DE HORARIOS
-- 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
INSERT IGNORE INTO horarios
(empleado_id, dia_semana, hora_entrada, hora_salida, tolerancia_minutos, activo)
VALUES
(1, 1, '08:00:00', '17:00:00', 10, TRUE),
(1, 2, '08:00:00', '17:00:00', 10, TRUE),
(1, 3, '08:00:00', '17:00:00', 10, TRUE),
(1, 4, '08:00:00', '17:00:00', 10, TRUE),
(1, 5, '08:00:00', '17:00:00', 10, TRUE),
(2, 1, '08:00:00', '17:00:00', 10, TRUE),
(2, 2, '08:00:00', '17:00:00', 10, TRUE),
(2, 3, '08:00:00', '17:00:00', 10, TRUE),
(2, 4, '08:00:00', '17:00:00', 10, TRUE),
(2, 5, '08:00:00', '17:00:00', 10, TRUE),
(3, 1, '09:00:00', '15:00:00', 15, TRUE),
(3, 2, '09:00:00', '15:00:00', 15, TRUE),
(3, 3, '09:00:00', '15:00:00', 15, TRUE),
(3, 4, '09:00:00', '15:00:00', 15, TRUE),
(3, 5, '09:00:00', '15:00:00', 15, TRUE),
(4, 1, '08:30:00', '14:30:00', 15, TRUE),
(4, 2, '08:30:00', '14:30:00', 15, TRUE),
(4, 3, '08:30:00', '14:30:00', 15, TRUE),
(4, 4, '08:30:00', '14:30:00', 15, TRUE),
(4, 5, '08:30:00', '14:30:00', 15, TRUE),
(5, 1, '07:30:00', '16:30:00', 5, TRUE),
(5, 2, '07:30:00', '16:30:00', 5, TRUE),
(5, 3, '07:30:00', '16:30:00', 5, TRUE),
(5, 4, '07:30:00', '16:30:00', 5, TRUE),
(5, 5, '07:30:00', '16:30:00', 5, TRUE),
(6, 1, '08:00:00', '17:00:00', 10, TRUE),
(6, 2, '08:00:00', '17:00:00', 10, TRUE),
(6, 3, '08:00:00', '17:00:00', 10, TRUE),
(6, 4, '08:00:00', '17:00:00', 10, TRUE),
(6, 5, '08:00:00', '17:00:00', 10, TRUE),
(7, 1, '08:00:00', '17:00:00', 10, TRUE),
(7, 2, '08:00:00', '17:00:00', 10, TRUE),
(7, 3, '08:00:00', '17:00:00', 10, TRUE),
(7, 4, '08:00:00', '17:00:00', 10, TRUE),
(7, 5, '08:00:00', '17:00:00', 10, TRUE),
(8, 1, '08:00:00', '17:00:00', 10, TRUE),
(8, 2, '08:00:00', '17:00:00', 10, TRUE),
(8, 3, '08:00:00', '17:00:00', 10, TRUE),
(8, 4, '08:00:00', '17:00:00', 10, TRUE),
(8, 5, '08:00:00', '17:00:00', 10, TRUE);

-- 4. ASISTENCIAS
INSERT IGNORE INTO asistencias
(empleado_id, fecha, hora_ingreso, hora_salida, minutos_tardanza, horas_trabajadas, estado, observacion)
VALUES
(1, CURDATE(), '07:55:00', '17:05:00', 0, 9.17, 'presente', 'Asistencia puntual'),
(2, CURDATE(), '08:00:00', '17:00:00', 0, 9.00, 'presente', NULL),
(3, CURDATE(), '09:22:00', '15:10:00', 7, 5.80, 'tardanza', 'Tráfico en óvalo Grau'),
(4, CURDATE(), '08:48:00', '14:30:00', 3, 5.70, 'tardanza', 'Demora en transporte público'),
(5, CURDATE(), '07:28:00', '16:35:00', 0, 9.12, 'presente', NULL),
(6, CURDATE(), '08:02:00', '17:00:00', 0, 8.97, 'presente', NULL),
(3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '08:58:00', '15:02:00', 0, 6.07, 'presente', NULL),
(3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:30:00', '15:00:00', 15, 5.50, 'tardanza', 'Trámite universitario'),
(3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:00:00', '15:00:00', 0, 6.00, 'presente', NULL),
(4, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '08:30:00', '14:30:00', 0, 6.00, 'presente', NULL),
(4, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '08:30:00', '14:30:00', 0, 6.00, 'presente', NULL);

-- 5. PERMISOS
INSERT IGNORE INTO permisos
(empleado_id, tipo_permiso, fecha_inicio, fecha_fin, hora_desde, hora_hasta, motivo, estado, archivo_sustento)
VALUES
(3, 'Médico', DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY), '09:00:00', '12:00:00', 'Cita médica odontológica Essalud', 'Aprobado', 'cita_medica_carlos.pdf'),
(4, 'Personal', DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), '10:00:00', '13:00:00', 'Sustentación de avance académico en universidad', 'Solicitado', NULL),
(6, 'Familiar', DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY), '08:00:00', '12:00:00', 'Atención médica a familiar directo', 'Aprobado', 'sustento_familiar_rosa.pdf');

-- 6. TIPOS DE DOCUMENTOS
INSERT IGNORE INTO tipo_documentos
(id, nombre, descripcion, es_obligatorio)
VALUES
(1, 'DNI Legible', 'Copia escaneada de documento nacional de identidad vigente', TRUE),
(2, 'Convenio de Prácticas', 'Convenio preprofesional firmado por empresa y universidad', TRUE),
(3, 'Plan de Aprendizaje', 'Plan formativo validado por el supervisor del área', TRUE),
(4, 'Currículum Vitae', 'CV documentado y actualizado', TRUE),
(5, 'Carta de Presentación', 'Carta emitida por la universidad o instituto', FALSE),
(6, 'Certificado de Antecedentes', 'Certificado único laboral o antecedentes policiales', FALSE);

-- 7. DOCUMENTOS DEL LEGAJO
INSERT IGNORE INTO documentos_empleado
(empleado_id, tipo_documento_id, nombre_archivo, ruta_archivo, estado, fecha_subida)
VALUES
(1, 1, 'DNI_Agreda_Yenci.pdf', '/uploads/expedientes/1/DNI_Agreda_Yenci.pdf', 'validado', '2026-01-16'),
(1, 4, 'CV_Agreda_Yenci.pdf', '/uploads/expedientes/1/CV_Agreda_Yenci.pdf', 'validado', '2026-01-16'),
(3, 1, 'DNI_Paredes_Carlos.pdf', '/uploads/expedientes/3/DNI_Paredes_Carlos.pdf', 'validado', '2026-03-02'),
(3, 2, 'Convenio_Paredes_Carlos.pdf', '/uploads/expedientes/3/Convenio_Paredes_Carlos.pdf', 'validado', '2026-03-02'),
(4, 1, 'DNI_Yamanaka_Luciana.pdf', '/uploads/expedientes/4/DNI_Yamanaka_Luciana.pdf', 'validado', '2026-03-16');

-- ==========================================================
-- VERIFICACIÓN DE REGISTROS
-- ==========================================================

SELECT 'empresas' AS tabla, COUNT(*) AS registros FROM empresas
UNION ALL
SELECT 'areas', COUNT(*) FROM areas
UNION ALL
SELECT 'cargos', COUNT(*) FROM cargos
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'empleados', COUNT(*) FROM empleados
UNION ALL
SELECT 'usuarios', COUNT(*) FROM usuarios
UNION ALL
SELECT 'horarios', COUNT(*) FROM horarios
UNION ALL
SELECT 'asistencias', COUNT(*) FROM asistencias
UNION ALL
SELECT 'permisos', COUNT(*) FROM permisos
UNION ALL
SELECT 'tipo_documentos', COUNT(*) FROM tipo_documentos
UNION ALL
SELECT 'documentos_empleado', COUNT(*) FROM documentos_empleado
UNION ALL
SELECT 'contratos', COUNT(*) FROM contratos
UNION ALL
SELECT 'capacitaciones', COUNT(*) FROM capacitaciones
UNION ALL
SELECT 'capacitacion_participantes', COUNT(*) FROM capacitacion_participantes;
