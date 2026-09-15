const ROLES = Object.freeze({
  ADMIN: 'Administrador General',
  RRHH: 'Recursos Humanos',
  COLABORADOR: 'Trabajador/Practicante'
});

const POLITICAS = new Map([
  [ROLES.ADMIN, {
    panel: 'Dashboard.html',
    modulos: ['dashboard', 'empresas', 'personal', 'documentos', 'contratos', 'capacitaciones', 'horarios', 'asistencia', 'reportes'],
    permisos: ['empresas:gestionar', 'personal:consultar', 'documentos:gestionar', 'contratos:gestionar', 'capacitaciones:gestionar', 'horarios:gestionar', 'asistencia:gestionar', 'reportes:consultar']
  }],
  [ROLES.RRHH, {
    panel: 'RecursosHumanos.html',
    modulos: ['rrhh', 'personal', 'documentos', 'contratos', 'capacitaciones', 'horarios', 'asistencia', 'reportes'],
    permisos: ['personal:consultar', 'documentos:gestionar', 'contratos:gestionar', 'capacitaciones:gestionar', 'horarios:gestionar', 'asistencia:gestionar', 'reportes:consultar']
  }],
  [ROLES.COLABORADOR, {
    panel: 'MiPanel.html',
    modulos: ['mi-panel'],
    permisos: ['perfil:consultar']
  }]
]);

function obtenerAcceso(rol) {
  const politica = POLITICAS.get(rol);
  if (!politica) return null;
  return { panel: politica.panel, modulos: [...politica.modulos], permisos: [...politica.permisos] };
}

module.exports = { ROLES, obtenerAcceso };
