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

## 🚀 Ejecución local

**Requisitos:** Node.js, npm y una instancia de MySQL con el esquema de base de datos correspondiente.

1. Clona este repositorio e ingresa a la carpeta `backend`:

   ```bash
   git clone https://github.com/yamix-rx/SISTEMA-CONTROL-DE-ASISTENCIA.git
   cd SISTEMA-CONTROL-DE-ASISTENCIA/backend
   npm install
   ```

2. Crea `backend/.env` con los valores de **tu propia instalación**:

   ```dotenv
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=tu_usuario
   DB_PASSWORD=tu_contrasena
   DB_NAME=tu_base_de_datos
   DB_TIMEZONE=-05:00
   ```

3. Prepara la base de datos siguiendo el esquema de tu entorno. El repositorio contiene archivos SQL y scripts de migración que debes revisar antes de ejecutar sobre una base existente.

4. Inicia el servidor:

   ```bash
   npm start
   ```

5. Abre **http://localhost:3000**. El backend también sirve las pantallas y recursos del frontend.

Para ejecutar las pruebas del backend:

```bash
npm test
```

> **Importante:** no publiques archivos `.env`, credenciales, datos personales ni respaldos de una base de datos real. Si reconstruyes los recursos del frontend, revisa el requisito de Node.js 24 o superior indicado en `frontend/package.json`.

## 👨‍💻 Autor

**RX** · [Perfil de GitHub](https://github.com/yamix-rx) · [Portafolio](https://yamix-rx-portafolio.vercel.app/)
