<div align="center">
  <img src="https://raw.githubusercontent.com/yamix-rx/yamix-rx/main/assets/proyecto-asistencia.svg" width="75%" alt="Sistema de Control de Asistencia" />
  <h1>Sistema de Control de Asistencia</h1>
  <p>Aplicación web para gestionar asistencia, personal y procesos administrativos desde un mismo entorno.</p>
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-API-222222?logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/MySQL-Base_de_datos-4479A1?logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript" />
</div>

## 📌 Descripción

Este repositorio contiene una aplicación de **gestión de asistencia y procesos administrativos**, con una interfaz web y una API desarrollada con **Node.js + Express**, respaldada por una base de datos **MySQL**.

## ✨ Módulos incluidos

- **Autenticación y administración:** acceso de usuarios y funciones de administración.
- **Asistencia y horarios:** registros, seguimiento y organización de horarios.
- **Gestión de personal:** información de recursos humanos y fichas individuales.
- **Contratos, documentos y capacitaciones:** módulos de gestión documental y de personal.
- **Dashboard y reportes:** paneles e información para el seguimiento.
- **Auditoría:** consultas relacionadas con los registros de actividad.

Estas áreas corresponden a las pantallas y rutas presentes en el código del proyecto.

## 🛠️ Tecnologías

| Capa | Tecnologías |
| :--- | :--- |
| Backend | Node.js, Express |
| Base de datos | MySQL (mysql2) |
| Interfaz | HTML, CSS, JavaScript, Bootstrap |
| Seguridad y archivos | JWT, bcryptjs, multer |
| Documentos y reportes | PDFKit y utilidades de exportación |

## 📁 Estructura del proyecto

```text
SISTEMA-CONTROL-DE-ASISTENCIA/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── tests/
│   └── server.js
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   ├── tests/
│   └── index.html
└── Diagramas/
```

## Instalación y uso

Requiere **Node.js 24 o superior** y **MySQL 8**. Interfaz y API se sirven desde el mismo origen.

1. En `backend`, ejecutar `npm ci` y `npm run configurar`.
2. Completar privadamente `backend/.env` siguiendo [`.env.example`](backend/.env.example). Para una instalación nueva, completar `ADMIN_*` y ejecutar `npm run instalar` sobre una base vacía. Para una existente, seguir el manual de actualización y usar `npm run migrar`.
3. En `frontend`, ejecutar `npm ci`, `npm run build` y `npm test`.
4. En `backend`, ejecutar `npm test` y `npm start`. Abrir **http://localhost:3000**.

Las claves JWT y de cifrado se generan localmente y nunca deben publicarse. `base-actualizada.sql` incluye datos de demostración; para una instalación real se utiliza el instalador.

- [Manual de instalación, actualización, respaldo y recuperación](docs/INSTALACION.md)
- [Manual de usuario](docs/MANUAL_USUARIO.md)
- [Diagrama de base de datos](Diagramas/DiagramaBD.mmd)

## Comprobaciones y mantenimiento

Desde `backend`: `npm test`, `npm run revisar:documentos`, `npm run diagrama`, `npm run backup`.
Desde `frontend`: `npm run build`, `npm run verify:assets`, `npm test`.

La revisión identifica archivos ausentes y permite recuperar copias exactas desde respaldos con `npm run revisar:documentos -- --recuperar`. Conserva el historial: si no existe una copia, RR. HH. debe volver a cargar el original desde Documentos.

Respaldos, archivos subidos, sesiones de prueba y referencias de la carpeta `Documentos/` son privados y están excluidos de Git. El respaldo omite `.env` salvo que se añada `--incluir-configuracion`. Los responsables deben coordinar aparte la limpieza de secretos que ya existan en el historial remoto.

## 👨‍💻 Autor

**RX** · [Perfil de GitHub](https://github.com/yamix-rx) · [Portafolio](https://yamix-rx-portafolio.vercel.app/)
