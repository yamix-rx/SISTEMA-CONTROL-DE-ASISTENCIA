const ESTADOS = ['presente', 'falta', 'tardanza', 'permiso', 'descanso', 'feriado', 'vacaciones', 'justificado'];
const ADMINISTRATIVOS = new Set(['falta', 'permiso', 'descanso', 'feriado', 'vacaciones']);
const error = mensaje => Object.assign(new Error(mensaje), { status: 400 });
function entero(valor, nombre, min = 1, max = 2147483647) {
  const n = Number(valor);
  if (valor === '' || valor == null || !Number.isInteger(n) || n < min || n > max) throw error(`${nombre} no válido.`);
  return n;
}
function fecha(valor, nombre = 'Fecha') {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw error(`${nombre} no válida.`);
  const d = new Date(valor + 'T12:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor || Number(valor.slice(0, 4)) < 1900) throw error(`${nombre} no válida.`);
  return valor;
}
function hoy() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function hora(valor, nombre = 'Hora', opcional = false) {
  if ((valor == null || valor === '') && opcional) return null;
  if (typeof valor !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(valor)) throw error(`${nombre} no válida; utilice HH:MM.`);
  return valor.slice(0, 5) + ':00';
}
function minutos(valor) { const [h, m] = valor.split(':').map(Number); return h * 60 + m; }
function texto(valor, nombre, max, obligatorio = false) {
  if (valor != null && typeof valor !== 'string') throw error(`${nombre} no válido.`);
  const s = (valor || '').trim();
  if (s.length > max || obligatorio && !s) throw error(`${nombre}: ${obligatorio ? 'complete el campo, ' : ''}máximo ${max} caracteres.`);
  return s || null;
}
function rango(inicio, fin, defecto = 'mensual') {
  const actual = hoy();
  const desde = fecha(inicio || (defecto === 'diario' ? actual : actual.slice(0, 7) + '-01'));
  const hasta = fecha(fin || actual);
  if (desde > hasta) throw error('La fecha inicial no puede ser posterior a la final.');
  if ((new Date(hasta) - new Date(desde)) / 86400000 > 366) throw error('Seleccione un rango de hasta 367 días.');
  return [desde, hasta];
}
function filtrosPersonal(query, alias = 'e') {
  const condiciones = [], params = [];
  for (const campo of ['empresa_id', 'area_id', 'cargo_id', 'empleado_id']) {
    if (query[campo]) { condiciones.push(`${alias}.${campo === 'empleado_id' ? 'id' : campo} = ?`); params.push(entero(query[campo], campo)); }
  }
  if (query.tipo_vinculo) {
    const tipos = ['trabajador', 'practicante', 'practicante preprofesional', 'practicante profesional', 'voluntario', 'otro'];
    if (!tipos.includes(query.tipo_vinculo)) throw error('Tipo de vínculo no válido.');
    condiciones.push(query.tipo_vinculo === 'practicante' ? `LOWER(${alias}.tipo_vinculo) LIKE 'practicante%'` : `${alias}.tipo_vinculo = ?`);
    if (query.tipo_vinculo !== 'practicante') params.push(query.tipo_vinculo);
  }
  if (query.buscar) {
    const busqueda = texto(query.buscar, 'Búsqueda', 120, true);
    condiciones.push(`(${alias}.nombres LIKE ? OR ${alias}.apellidos LIKE ? OR ${alias}.numero_documento LIKE ?)`);
    params.push(...Array(3).fill(`%${busqueda}%`));
  }
  return { where: condiciones.length ? condiciones.join(' AND ') : '1=1', params };
}
function confirmarProgramacionHistorica(payload, anterior) {
  if (!anterior) throw error('La confirmación del horario original solo corresponde a una asistencia existente.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.confirmada !== true) {
    throw error('Confirme expresamente que verificó la programación original.');
  }
  if (anterior.hora_programada_entrada && anterior.hora_programada_salida && anterior.tolerancia_minutos != null) {
    throw Object.assign(error('Esta asistencia ya conserva su programación original y no se puede sobrescribir.'), { status: 409 });
  }
  const entrada = hora(payload.hora_entrada, 'Entrada programada original');
  const salida = hora(payload.hora_salida, 'Salida programada original');
  const tolerancia = entero(payload.tolerancia_minutos, 'Tolerancia original', 0, 120);
  const motivo = texto(payload.motivo, 'Motivo de la confirmación', 500, true);
  if (entrada === salida) throw error('La entrada y salida programadas no pueden ser iguales.');
  if (typeof payload.cruza_medianoche !== 'boolean' || payload.cruza_medianoche !== (salida < entrada)) {
    throw error('Confirme si la salida programada original corresponde al día siguiente.');
  }
  // Una instantánea parcial puede completarse; sus campos conocidos son inmutables.
  if (anterior.hora_programada_entrada && hora(anterior.hora_programada_entrada) !== entrada ||
      anterior.hora_programada_salida && hora(anterior.hora_programada_salida) !== salida ||
      anterior.tolerancia_minutos != null && Number(anterior.tolerancia_minutos) !== tolerancia) {
    throw Object.assign(error('No puede cambiar los valores históricos que ya están registrados; complete únicamente los campos faltantes.'), { status: 409 });
  }
  return { hora_entrada: entrada, hora_salida: salida, tolerancia_minutos: tolerancia, cruza_medianoche: payload.cruza_medianoche, motivo };
}
function calcularMarcacion(body, programacion, anterior = null) {
  let estado = body.estado || 'presente';
  if (!ESTADOS.includes(estado)) throw error('Estado de asistencia no válido.');
  let ingreso = hora(body.hora_ingreso, 'Hora de ingreso', true), salida = hora(body.hora_salida, 'Hora de salida', true);
  if (ADMINISTRATIVOS.has(estado)) { ingreso = null; salida = null; }
  if (['presente', 'tardanza'].includes(estado) && !ingreso) throw error('Indique la hora de ingreso.');
  if (salida && !ingreso) throw error('No puede registrar una salida sin ingreso.');
  let horas = 0, tardanza = 0;
  const nocturno = programacion?.hora_entrada && programacion?.hora_salida && minutos(programacion.hora_salida) < minutos(programacion.hora_entrada);
  if (ingreso && salida) {
    const conservarHoras = anterior && !programacion?.hora_entrada &&
      String(anterior.hora_ingreso || '').slice(0, 5) === ingreso.slice(0, 5) &&
      String(anterior.hora_salida || '').slice(0, 5) === salida.slice(0, 5) &&
      Number.isFinite(Number(anterior.horas_trabajadas));
    let duracion = minutos(salida) - minutos(ingreso);
    if (duracion <= 0) {
      if ((!nocturno || duracion === 0) && !conservarHoras) throw error('La salida debe ser posterior al ingreso; para cruzar medianoche asigne un horario nocturno.');
      duracion += 1440;
    }
    horas = conservarHoras ? Number(anterior.horas_trabajadas) : Math.round(duracion / 60 * 100) / 100;
  }
  if (ingreso && ['presente', 'tardanza'].includes(estado)) {
    const programacionIncompleta = anterior && (anterior.tolerancia_minutos == null || !anterior.hora_programada_entrada || !anterior.hora_programada_salida);
    const conservarLegado = programacionIncompleta && String(anterior.hora_ingreso || '').slice(0, 5) === ingreso.slice(0, 5) && ['presente', 'tardanza'].includes(anterior.estado);
    if (conservarLegado) {
      tardanza = Number(anterior.minutos_tardanza || 0);
    } else if (programacionIncompleta) {
      throw error('Confirme la programación original y su tolerancia para recalcular este registro. Puede conservar el ingreso y editar la observación sin modificar el cálculo histórico.');
    } else if (programacion?.hora_entrada) {
      let diferencia = minutos(ingreso) - minutos(programacion.hora_entrada);
      if (nocturno && diferencia < -720) diferencia += 1440;
      tardanza = diferencia > Number(programacion.tolerancia_minutos || 0) ? diferencia : 0;
    } else if (estado === 'tardanza') throw error('Asigne un horario para calcular la tardanza.');
    estado = tardanza > 0 ? 'tardanza' : 'presente';
  }
  return { estado, hora_ingreso: ingreso, hora_salida: salida, minutos_tardanza: tardanza, horas_trabajadas: horas };
}
module.exports = { ESTADOS, error, entero, fecha, hora, hoy, minutos, texto, rango, filtrosPersonal, calcularMarcacion, confirmarProgramacionHistorica };
