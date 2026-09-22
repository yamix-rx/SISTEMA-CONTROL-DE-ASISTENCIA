require('dotenv').config();
const pool = require('../config/database');

const sentencias = [
  `CREATE TABLE IF NOT EXISTS contratos (
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
    CONSTRAINT fk_contratos_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_contratos_documento FOREIGN KEY (documento_empleado_id) REFERENCES documentos_empleado(id) ON DELETE SET NULL,
    CONSTRAINT fk_contratos_creado_por FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_contratos_actualizado_por FOREIGN KEY (actualizado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_contratos_empleado (empleado_id),
    INDEX idx_contratos_estado_fechas (estado, fecha_inicio, fecha_fin),
    INDEX idx_contratos_fecha_fin (fecha_fin)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS capacitaciones (
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
    CONSTRAINT fk_capacitaciones_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL,
    CONSTRAINT fk_capacitaciones_creado_por FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_capacitaciones_actualizado_por FOREIGN KEY (actualizado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_capacitaciones_estado_fecha (estado, fecha_inicio, fecha_fin),
    INDEX idx_capacitaciones_empresa (empresa_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS capacitacion_participantes (
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
    CONSTRAINT fk_cap_part_capacitacion FOREIGN KEY (capacitacion_id) REFERENCES capacitaciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_cap_part_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cap_part_certificado FOREIGN KEY (certificado_documento_id) REFERENCES documentos_empleado(id) ON DELETE SET NULL,
    UNIQUE KEY uk_capacitacion_empleado (capacitacion_id, empleado_id),
    INDEX idx_cap_part_empleado (empleado_id),
    INDEX idx_cap_part_estado (estado)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

(async () => {
  try {
    for (const sql of sentencias) await pool.query(sql);
    console.log('✓ Tablas de Contratos y Capacitaciones preparadas correctamente.');
    console.log('  - contratos');
    console.log('  - capacitaciones');
    console.log('  - capacitacion_participantes');
  } catch (error) {
    console.error('✗ No se pudo completar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
