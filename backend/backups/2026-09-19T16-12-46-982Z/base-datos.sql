-- Respaldo SBSS: esquema y datos bajo una instantánea consistente.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
SET @SBSS_OLD_SQL_MODE=@@SQL_MODE;
SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
CREATE TABLE `areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `empresa_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `empresa_id` (`empresa_id`),
  CONSTRAINT `areas_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `areas` (`id`,`nombre`,`empresa_id`) VALUES (1,'Recursos Humanos',1);
INSERT INTO `areas` (`id`,`nombre`,`empresa_id`) VALUES (2,'Sistemas y TI',1);
INSERT INTO `areas` (`id`,`nombre`,`empresa_id`) VALUES (3,'Operaciones y Almacén',1);
INSERT INTO `areas` (`id`,`nombre`,`empresa_id`) VALUES (4,'Administración y Finanzas',2);
INSERT INTO `areas` (`id`,`nombre`,`empresa_id`) VALUES (5,'Comercial y Ventas',3);
INSERT INTO `areas` (`id`,`nombre`,`empresa_id`) VALUES (6,'Logística y Distribución',4);
CREATE TABLE `asistencias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `fecha` date NOT NULL,
  `hora_programada_entrada` time DEFAULT NULL,
  `hora_programada_salida` time DEFAULT NULL,
  `hora_ingreso` time DEFAULT NULL,
  `hora_salida` time DEFAULT NULL,
  `minutos_tardanza` int DEFAULT '0',
  `horas_trabajadas` decimal(5,2) DEFAULT '0.00',
  `estado` enum('presente','falta','tardanza','permiso','descanso','feriado','vacaciones','justificado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'presente',
  `observacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registrado_por_usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tolerancia_minutos` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asistencia_diaria` (`empleado_id`,`fecha`),
  KEY `registrado_por_usuario_id` (`registrado_por_usuario_id`),
  KEY `idx_asistencias_fecha_estado` (`fecha`,`estado`),
  CONSTRAINT `asistencias_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asistencias_ibfk_2` FOREIGN KEY (`registrado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (1,1,'2026-09-14',NULL,NULL,'07:55:00','17:05:00',0,'9.17','presente','Asistencia puntual',NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (2,2,'2026-09-14',NULL,NULL,'08:00:00','17:00:00',0,'9.00','presente',NULL,NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (3,3,'2026-09-14',NULL,NULL,'09:22:00','15:10:00',7,'5.80','tardanza','Tráfico en óvalo Grau',NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (4,4,'2026-09-14',NULL,NULL,'08:48:00','14:30:00',3,'5.70','tardanza','Demora en transporte público',NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (5,5,'2026-09-14',NULL,NULL,'07:28:00','16:35:00',0,'9.12','presente',NULL,NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (6,6,'2026-09-14',NULL,NULL,'08:02:00','17:00:00',0,'8.97','presente',NULL,NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (7,3,'2026-09-13',NULL,NULL,'08:58:00','15:02:00',0,'6.07','presente',NULL,NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (8,3,'2026-09-12',NULL,NULL,'09:30:00','15:00:00',15,'5.50','tardanza','Trámite universitario',NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (9,3,'2026-09-11',NULL,NULL,'09:00:00','15:00:00',0,'6.00','presente',NULL,NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (10,4,'2026-09-13',NULL,NULL,'08:30:00','14:30:00',0,'6.00','presente',NULL,NULL,NULL);
INSERT INTO `asistencias` (`id`,`empleado_id`,`fecha`,`hora_programada_entrada`,`hora_programada_salida`,`hora_ingreso`,`hora_salida`,`minutos_tardanza`,`horas_trabajadas`,`estado`,`observacion`,`registrado_por_usuario_id`,`tolerancia_minutos`) VALUES (11,4,'2026-09-12',NULL,NULL,'08:30:00','14:30:00',0,'6.00','presente',NULL,NULL,NULL);
CREATE TABLE `capacitacion_participantes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `capacitacion_id` int NOT NULL,
  `empleado_id` int NOT NULL,
  `estado` enum('inscrito','en_curso','aprobado','desaprobado','no_asistio','cancelado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'inscrito',
  `asistencia_porcentaje` decimal(5,2) DEFAULT NULL,
  `nota` decimal(5,2) DEFAULT NULL,
  `fecha_inscripcion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_completado` datetime DEFAULT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `certificado_documento_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_capacitacion_empleado` (`capacitacion_id`,`empleado_id`),
  KEY `fk_cap_part_certificado` (`certificado_documento_id`),
  KEY `idx_cap_part_empleado` (`empleado_id`),
  KEY `idx_cap_part_estado` (`estado`),
  CONSTRAINT `fk_cap_part_capacitacion` FOREIGN KEY (`capacitacion_id`) REFERENCES `capacitaciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cap_part_certificado` FOREIGN KEY (`certificado_documento_id`) REFERENCES `documentos_empleado` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cap_part_empleado` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `capacitaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `modalidad` enum('presencial','virtual','hibrida') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'presencial',
  `proveedor` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `empresa_id` int DEFAULT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `hora_inicio` time DEFAULT NULL,
  `hora_fin` time DEFAULT NULL,
  `horas` decimal(7,2) NOT NULL,
  `lugar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enlace` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cupo` int DEFAULT NULL,
  `obligatorio` tinyint(1) NOT NULL DEFAULT '0',
  `estado` enum('borrador','programada','en_curso','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'borrador',
  `creado_por_usuario_id` int DEFAULT NULL,
  `actualizado_por_usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_capacitaciones_creado_por` (`creado_por_usuario_id`),
  KEY `fk_capacitaciones_actualizado_por` (`actualizado_por_usuario_id`),
  KEY `idx_capacitaciones_estado_fecha` (`estado`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_capacitaciones_empresa` (`empresa_id`),
  CONSTRAINT `fk_capacitaciones_actualizado_por` FOREIGN KEY (`actualizado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_capacitaciones_creado_por` FOREIGN KEY (`creado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_capacitaciones_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `cargos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `area_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `area_id` (`area_id`),
  CONSTRAINT `cargos_ibfk_1` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (1,'Analista de Recursos Humanos',1);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (2,'Desarrollador de Sistemas',2);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (3,'Practicante de Sistemas',2);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (4,'Supervisor de Operaciones',3);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (5,'Coordinadora Administrativa',4);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (6,'Practicante de Finanzas',4);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (7,'Ejecutiva Comercial',5);
INSERT INTO `cargos` (`id`,`nombre`,`area_id`) VALUES (8,'Supervisora de Distribución',6);
CREATE TABLE `contratos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `codigo` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_contrato` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `modalidad` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `remuneracion` decimal(10,2) DEFAULT NULL,
  `moneda` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PEN',
  `horas_semanales` decimal(5,2) DEFAULT NULL,
  `estado` enum('borrador','vigente','finalizado','cancelado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'borrador',
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `documento_empleado_id` int DEFAULT NULL,
  `creado_por_usuario_id` int DEFAULT NULL,
  `actualizado_por_usuario_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `fk_contratos_documento` (`documento_empleado_id`),
  KEY `fk_contratos_creado_por` (`creado_por_usuario_id`),
  KEY `fk_contratos_actualizado_por` (`actualizado_por_usuario_id`),
  KEY `idx_contratos_empleado` (`empleado_id`),
  KEY `idx_contratos_estado_fechas` (`estado`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_contratos_fecha_fin` (`fecha_fin`),
  CONSTRAINT `fk_contratos_actualizado_por` FOREIGN KEY (`actualizado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contratos_creado_por` FOREIGN KEY (`creado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contratos_documento` FOREIGN KEY (`documento_empleado_id`) REFERENCES `documentos_empleado` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contratos_empleado` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `documentos_empleado` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `tipo_documento_id` int NOT NULL,
  `nombre_archivo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ruta_archivo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` enum('pendiente','validado','rechazado') COLLATE utf8mb4_unicode_ci DEFAULT 'pendiente',
  `fecha_subida` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `observacion` text COLLATE utf8mb4_unicode_ci,
  `revisado_por` int DEFAULT NULL,
  `fecha_revision` datetime DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_documento_id` (`tipo_documento_id`),
  KEY `idx_documento_version` (`empleado_id`,`tipo_documento_id`,`id`),
  CONSTRAINT `documentos_empleado_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documentos_empleado_ibfk_2` FOREIGN KEY (`tipo_documento_id`) REFERENCES `tipo_documentos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (1,1,1,'DNI_Agreda_Yenci.pdf','/uploads/expedientes/1/DNI_Agreda_Yenci.pdf','validado',NULL,NULL,NULL,NULL);
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (2,1,4,'CV_Agreda_Yenci.pdf','/uploads/expedientes/1/CV_Agreda_Yenci.pdf','validado',NULL,NULL,NULL,NULL);
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (3,3,1,'DNI_Paredes_Carlos.pdf','/uploads/expedientes/3/DNI_Paredes_Carlos.pdf','validado',NULL,NULL,NULL,NULL);
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (4,3,2,'Convenio_Paredes_Carlos.pdf','/uploads/expedientes/3/Convenio_Paredes_Carlos.pdf','validado',NULL,NULL,NULL,NULL);
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (5,4,1,'DNI_Yamanaka_Luciana.pdf','/uploads/expedientes/4/DNI_Yamanaka_Luciana.pdf','validado',NULL,NULL,NULL,NULL);
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (6,1,2,'ChatGPT Image 1 sept 2026, 09_48_09 p.m.png','59e2331e-4e38-40b7-84a3-d14bd6744d3e.png','validado',NULL,1,'2026-09-17 08:20:43','image/png');
INSERT INTO `documentos_empleado` (`id`,`empleado_id`,`tipo_documento_id`,`nombre_archivo`,`ruta_archivo`,`estado`,`observacion`,`revisado_por`,`fecha_revision`,`mime_type`) VALUES (7,1,3,'Prompt de la Gestión de Proyectos de Desarrollo de Sotware.docx','484eed5a-afba-4fa7-8571-740b2f05256e.docx','validado',NULL,1,'2026-09-17 10:14:14','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
CREATE TABLE `empleados` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_documento` enum('DNI','CE','PASAPORTE') COLLATE utf8mb4_unicode_ci DEFAULT 'DNI',
  `numero_documento` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombres` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidos` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `foto_perfil` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo_personal` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `carrera` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institucion_educativa` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `area_id` int NOT NULL,
  `cargo_id` int NOT NULL,
  `tipo_vinculo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'trabajador',
  `horas_totales_asignadas` decimal(6,2) DEFAULT '0.00',
  `horas_completadas` decimal(6,2) DEFAULT '0.00',
  `estado` enum('activo','inactivo','finalizado','suspendido') COLLATE utf8mb4_unicode_ci DEFAULT 'activo',
  `fecha_ingreso` date NOT NULL,
  `fecha_finalizacion` date DEFAULT NULL,
  `observaciones_rrhh` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_documento` (`numero_documento`),
  KEY `empresa_id` (`empresa_id`),
  KEY `area_id` (`area_id`),
  KEY `cargo_id` (`cargo_id`),
  CONSTRAINT `empleados_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `empleados_ibfk_2` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`),
  CONSTRAINT `empleados_ibfk_3` FOREIGN KEY (`cargo_id`) REFERENCES `cargos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (1,'DNI','70891234','Yenci Jose','Agreda Ramirez',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,2,2,'trabajador',NULL,'0.00','activo','2026-01-15',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (2,'DNI','45871290','Valeria Sofia','Mendoza Castro',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,1,'trabajador',NULL,'0.00','activo','2026-02-01',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (3,'DNI','73456789','Carlos Eduardo','Paredes Rios',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,2,3,'practicante','720.00','150.00','activo','2026-03-01',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (4,'DNI','72109845','Luciana Belen','Yamanaka Huamán',NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,4,6,'practicante','480.00','95.00','activo','2026-03-15',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (5,'DNI','41235678','Jorge Luis','Vargas Silva',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,3,4,'trabajador',NULL,'0.00','activo','2026-01-10',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (6,'DNI','46890123','Rosa Mercedes','Ramos Ruiz',NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,4,5,'trabajador',NULL,'0.00','activo','2026-02-15',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (7,'DNI','43567890','Melani Fiorella','López Rojas',NULL,NULL,NULL,NULL,NULL,NULL,NULL,3,5,7,'trabajador',NULL,'0.00','activo','2026-01-20',NULL,NULL);
INSERT INTO `empleados` (`id`,`tipo_documento`,`numero_documento`,`nombres`,`apellidos`,`foto_perfil`,`fecha_nacimiento`,`telefono`,`correo_personal`,`direccion`,`carrera`,`institucion_educativa`,`empresa_id`,`area_id`,`cargo_id`,`tipo_vinculo`,`horas_totales_asignadas`,`horas_completadas`,`estado`,`fecha_ingreso`,`fecha_finalizacion`,`observaciones_rrhh`) VALUES (8,'DNI','48901234','Daysi Paola','Reyes Padilla',NULL,NULL,NULL,NULL,NULL,NULL,NULL,4,6,8,'trabajador',NULL,'0.00','activo','2026-02-01',NULL,NULL);
CREATE TABLE `empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `razon_social` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ruc` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` enum('activo','inactivo') COLLATE utf8mb4_unicode_ci DEFAULT 'activo',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (1,'Importadora y Distribuidora Silsan S.A.C.','20601234567','Av. América Sur 123, Trujillo','activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (2,'Droguería Silsan S.A.C.','20601234568','Jr. Unión 456, Trujillo','activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (3,'SBSS Outsourcing S.A.C.','20601234569','Av. España 789, Trujillo','activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (4,'Silsan Logística Integral','20601234570','Parque Industrial, Trujillo','activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (5,'Nanas & Amas',NULL,NULL,'activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (6,'Centro de Conciliación SBSS',NULL,NULL,'activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (7,'Estudio Jurídico SBSS',NULL,NULL,'activo');
INSERT INTO `empresas` (`id`,`razon_social`,`ruc`,`direccion`,`estado`) VALUES (8,'ONG MESPO',NULL,NULL,'activo');
CREATE TABLE `historial_cambios` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `tabla_afectada` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registro_id` int NOT NULL,
  `accion` enum('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO','DENEGADO','ERROR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `datos_anteriores` json DEFAULT NULL,
  `datos_nuevos` json DEFAULT NULL,
  `ip_origen` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_historial_created_at` (`created_at`),
  KEY `idx_historial_usuario` (`usuario_id`),
  KEY `idx_historial_tabla_accion` (`tabla_afectada`,`accion`),
  CONSTRAINT `historial_cambios_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (1,1,'sesiones',1,'LOGIN',NULL,'{\"rol\":\"Administrador General\",\"email\":\"admin@silsan.pe\"}','::1');
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (2,1,'sesiones',1,'LOGIN',NULL,'{\"rol\":\"Administrador General\",\"email\":\"admin@silsan.pe\"}','::1');
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (3,NULL,'empresas',5,'INSERT',NULL,'{\"origen\":\"Configuración de organizaciones del requerimiento SBSS\",\"razon_social\":\"Nanas & Amas\"}',NULL);
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (4,NULL,'empresas',6,'INSERT',NULL,'{\"origen\":\"Configuración de organizaciones del requerimiento SBSS\",\"razon_social\":\"Centro de Conciliación SBSS\"}',NULL);
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (5,NULL,'empresas',7,'INSERT',NULL,'{\"origen\":\"Configuración de organizaciones del requerimiento SBSS\",\"razon_social\":\"Estudio Jurídico SBSS\"}',NULL);
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (6,NULL,'empresas',8,'INSERT',NULL,'{\"origen\":\"Configuración de organizaciones del requerimiento SBSS\",\"razon_social\":\"ONG MESPO\"}',NULL);
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (7,1,'sesiones',1,'LOGIN',NULL,'{\"rol\":\"Administrador General\",\"email\":\"admin@silsan.pe\"}','::1');
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (8,1,'usuarios',4,'INSERT',NULL,'{\"metodo\":\"POST\",\"endpoint\":\"/api/administracion/usuarios\",\"registro\":{\"id\":4,\"email\":\"rosamelano@gmail.com\",\"activo\":1,\"rol_id\":2,\"password\":\"[OCULTO]\",\"created_at\":\"2026-09-19 10:04:35\",\"empleado_id\":6,\"sesion_version\":0},\"solicitud\":{\"email\":\"Rosamelano@gmail.com\",\"activo\":\"1\",\"rol_id\":\"2\",\"password\":\"[OCULTO]\",\"empleado_id\":\"6\"},\"resultado_http\":201}','::1');
INSERT INTO `historial_cambios` (`id`,`usuario_id`,`tabla_afectada`,`registro_id`,`accion`,`datos_anteriores`,`datos_nuevos`,`ip_origen`) VALUES (9,4,'sesiones',4,'LOGIN',NULL,'{\"rol\":\"Recursos Humanos\",\"email\":\"rosamelano@gmail.com\"}','::1');
CREATE TABLE `horarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `dia_semana` tinyint NOT NULL COMMENT '1=Lunes ... 7=Domingo',
  `turno` enum('manana','tarde','completo') COLLATE utf8mb4_unicode_ci DEFAULT 'manana',
  `hora_entrada` time NOT NULL,
  `hora_salida` time NOT NULL,
  `tolerancia_minutos` int DEFAULT '0',
  `activo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empleado_dia` (`empleado_id`,`dia_semana`),
  CONSTRAINT `horarios_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (1,1,1,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (2,1,2,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (3,1,3,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (4,1,4,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (5,1,5,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (6,2,1,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (7,2,2,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (8,2,3,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (9,2,4,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (10,2,5,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (11,3,1,'manana','09:00:00','15:00:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (12,3,2,'manana','09:00:00','15:00:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (13,3,3,'manana','09:00:00','15:00:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (14,3,4,'manana','09:00:00','15:00:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (15,3,5,'manana','09:00:00','15:00:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (16,4,1,'manana','08:30:00','14:30:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (17,4,2,'manana','08:30:00','14:30:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (18,4,3,'manana','08:30:00','14:30:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (19,4,4,'manana','08:30:00','14:30:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (20,4,5,'manana','08:30:00','14:30:00',15,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (21,5,1,'manana','07:30:00','16:30:00',5,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (22,5,2,'manana','07:30:00','16:30:00',5,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (23,5,3,'manana','07:30:00','16:30:00',5,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (24,5,4,'manana','07:30:00','16:30:00',5,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (25,5,5,'manana','07:30:00','16:30:00',5,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (26,6,1,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (27,6,2,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (28,6,3,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (29,6,4,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (30,6,5,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (31,7,1,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (32,7,2,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (33,7,3,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (34,7,4,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (35,7,5,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (36,8,1,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (37,8,2,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (38,8,3,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (39,8,4,'manana','08:00:00','17:00:00',10,1);
INSERT INTO `horarios` (`id`,`empleado_id`,`dia_semana`,`turno`,`hora_entrada`,`hora_salida`,`tolerancia_minutos`,`activo`) VALUES (40,8,5,'manana','08:00:00','17:00:00',10,1);
CREATE TABLE `permisos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `tipo_permiso` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Personal',
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `hora_desde` time DEFAULT NULL,
  `hora_hasta` time DEFAULT NULL,
  `motivo` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `estado` enum('Solicitado','Aprobado','Rechazado') COLLATE utf8mb4_unicode_ci DEFAULT 'Solicitado',
  `archivo_sustento` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `archivo_sustento_nombre` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_permisos_empleado_fecha` (`empleado_id`,`fecha_inicio`),
  CONSTRAINT `permisos_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `permisos` (`id`,`empleado_id`,`tipo_permiso`,`fecha_inicio`,`fecha_fin`,`hora_desde`,`hora_hasta`,`motivo`,`observaciones`,`estado`,`archivo_sustento`,`archivo_sustento_nombre`) VALUES (1,3,'Médico','2026-09-10','2026-09-10','09:00:00','12:00:00','Cita médica odontológica Essalud',NULL,'Aprobado','cita_medica_carlos.pdf',NULL);
INSERT INTO `permisos` (`id`,`empleado_id`,`tipo_permiso`,`fecha_inicio`,`fecha_fin`,`hora_desde`,`hora_hasta`,`motivo`,`observaciones`,`estado`,`archivo_sustento`,`archivo_sustento_nombre`) VALUES (2,4,'Personal','2026-09-16','2026-09-16','10:00:00','13:00:00','Sustentación de avance académico en universidad',NULL,'Solicitado',NULL,NULL);
INSERT INTO `permisos` (`id`,`empleado_id`,`tipo_permiso`,`fecha_inicio`,`fecha_fin`,`hora_desde`,`hora_hasta`,`motivo`,`observaciones`,`estado`,`archivo_sustento`,`archivo_sustento_nombre`) VALUES (3,6,'Familiar','2026-09-07','2026-09-07','08:00:00','12:00:00','Atención médica a familiar directo',NULL,'Aprobado','sustento_familiar_rosa.pdf',NULL);
CREATE TABLE `plantillas_documentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `titulo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cuerpo_html` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `practicante_detalles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `horas_meta` decimal(8,2) NOT NULL DEFAULT '320.00',
  `fecha_vencimiento_convenio` date DEFAULT NULL,
  `estado_completado` tinyint(1) DEFAULT '0',
  `fecha_completado` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `empleado_id` (`empleado_id`),
  CONSTRAINT `practicante_detalles_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `roles` (`id`,`nombre`,`descripcion`) VALUES (1,'Administrador General','Acceso total al sistema');
INSERT INTO `roles` (`id`,`nombre`,`descripcion`) VALUES (2,'Recursos Humanos','Gestión de personal, asistencia y legajos');
INSERT INTO `roles` (`id`,`nombre`,`descripcion`) VALUES (3,'Trabajador/Practicante','Marcación de asistencia y visualización de perfil');
CREATE TABLE `tipo_documentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `es_obligatorio` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `tipo_documentos` (`id`,`nombre`,`descripcion`,`es_obligatorio`) VALUES (1,'DNI Legible','Copia escaneada de documento nacional de identidad vigente',1);
INSERT INTO `tipo_documentos` (`id`,`nombre`,`descripcion`,`es_obligatorio`) VALUES (2,'Convenio de Prácticas','Convenio preprofesional firmado por empresa y universidad',1);
INSERT INTO `tipo_documentos` (`id`,`nombre`,`descripcion`,`es_obligatorio`) VALUES (3,'Plan de Aprendizaje','Plan formativo validado por el supervisor del área',1);
INSERT INTO `tipo_documentos` (`id`,`nombre`,`descripcion`,`es_obligatorio`) VALUES (4,'Currículum Vitae','CV documentado y actualizado',1);
INSERT INTO `tipo_documentos` (`id`,`nombre`,`descripcion`,`es_obligatorio`) VALUES (5,'Carta de Presentación','Carta emitida por la universidad o instituto',0);
INSERT INTO `tipo_documentos` (`id`,`nombre`,`descripcion`,`es_obligatorio`) VALUES (6,'Certificado de Antecedentes','Certificado único laboral o antecedentes policiales',0);
CREATE TABLE `tipo_permisos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `rol_id` int NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sesion_version` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `empleado_id` (`empleado_id`),
  UNIQUE KEY `email` (`email`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `usuarios` (`id`,`empleado_id`,`rol_id`,`email`,`password`,`activo`,`sesion_version`) VALUES (1,1,1,'admin@silsan.pe','$2b$10$.AdgrtAZ5NfOzg1QTJFRtONv5znNrlHtlrYr/bdyu5xnlGdlFPMDa',1,0);
INSERT INTO `usuarios` (`id`,`empleado_id`,`rol_id`,`email`,`password`,`activo`,`sesion_version`) VALUES (2,2,2,'rrhh@silsan.pe','$2b$10$.AdgrtAZ5NfOzg1QTJFRtONv5znNrlHtlrYr/bdyu5xnlGdlFPMDa',1,0);
INSERT INTO `usuarios` (`id`,`empleado_id`,`rol_id`,`email`,`password`,`activo`,`sesion_version`) VALUES (3,3,3,'practicante@silsan.pe','$2b$10$.AdgrtAZ5NfOzg1QTJFRtONv5znNrlHtlrYr/bdyu5xnlGdlFPMDa',1,0);
INSERT INTO `usuarios` (`id`,`empleado_id`,`rol_id`,`email`,`password`,`activo`,`sesion_version`) VALUES (4,6,2,'rosamelano@gmail.com','$2b$12$SEeUHarDJpoBB41XpR0RouhIi0ANtHeCy1LaBLl/2n2wyOwaC.4kG',1,0);
SET SQL_MODE=@SBSS_OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=1;
