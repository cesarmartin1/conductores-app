import db, { Jornada } from '../models/database';

// Límites del Reglamento CE 561/2006
export const LIMITES_CE561 = {
  // Conducción
  CONDUCCION_DIARIA_MAX: 9,           // horas
  CONDUCCION_DIARIA_EXTENDIDA: 10,    // horas (máx 2 veces/semana)
  CONDUCCION_SEMANAL_MAX: 56,         // horas
  CONDUCCION_BISEMANAL_MAX: 90,       // horas (dos semanas consecutivas)

  // Pausas
  CONDUCCION_CONTINUA_MAX: 4.5,       // horas antes de pausa obligatoria
  PAUSA_MINIMA: 45,                   // minutos

  // Descansos
  DESCANSO_DIARIO_NORMAL: 11,         // horas
  DESCANSO_DIARIO_REDUCIDO: 9,        // horas (máx 3 veces entre descansos semanales)
  DESCANSO_SEMANAL_NORMAL: 45,        // horas
  DESCANSO_SEMANAL_REDUCIDO: 24,      // horas (máx 1 vez cada 2 semanas)

  // Convenio
  DIAS_TRABAJO_SEMANA: 5,             // días máximos de trabajo por semana
};

export interface ValidacionCE561 {
  valido: boolean;
  alertas: AlertaCE561[];
  estadisticas: EstadisticasConductor;
}

export interface AlertaCE561 {
  tipo: 'error' | 'warning' | 'info';
  codigo: string;
  mensaje: string;
}

export interface EstadisticasConductor {
  conduccionHoy: number;
  conduccionSemana: number;
  conduccionBisemanal: number;
  diasTrabajadosSemana: number;
  extensionesSemana: number;          // veces que se extendió a 10h esta semana
  descansosReducidosPeriodo: number;  // descansos reducidos entre semanales
  horasHastaLimiteDiario: number;
  horasHastaLimiteSemanal: number;
  proximoDescansoObligatorio: string;
}

export class CE561Service {

  // Obtener inicio de semana (lunes)
  private getInicioSemana(fecha: Date): Date {
    const d = new Date(fecha);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Obtener jornadas de un período
  private getJornadas(conductorId: number, desde: string, hasta: string): Jornada[] {
    const stmt = db.prepare(`
      SELECT * FROM jornadas
      WHERE conductor_id = ? AND fecha BETWEEN ? AND ?
      ORDER BY fecha ASC
    `);
    return stmt.all(conductorId, desde, hasta) as Jornada[];
  }

  // Validar una jornada antes de guardarla
  validarJornada(conductorId: number, fecha: string, horasConduccion: number, horasTrabajo: number): ValidacionCE561 {
    const alertas: AlertaCE561[] = [];
    const fechaObj = new Date(fecha);
    const inicioSemana = this.getInicioSemana(fechaObj);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 6);

    // Obtener jornadas de la semana actual
    const jornadasSemana = this.getJornadas(
      conductorId,
      inicioSemana.toISOString().split('T')[0],
      finSemana.toISOString().split('T')[0]
    );

    // Obtener jornadas de las últimas 2 semanas
    const inicioDosSemanas = new Date(inicioSemana);
    inicioDosSemanas.setDate(inicioDosSemanas.getDate() - 7);
    const jornadasBisemanal = this.getJornadas(
      conductorId,
      inicioDosSemanas.toISOString().split('T')[0],
      finSemana.toISOString().split('T')[0]
    );

    // Calcular estadísticas
    const conduccionSemana = jornadasSemana
      .filter(j => j.fecha !== fecha)
      .reduce((sum, j) => sum + j.horas_conduccion, 0) + horasConduccion;

    const conduccionBisemanal = jornadasBisemanal
      .filter(j => j.fecha !== fecha)
      .reduce((sum, j) => sum + j.horas_conduccion, 0) + horasConduccion;

    const diasTrabajadosSemana = jornadasSemana
      .filter(j => j.tipo === 'trabajo' && j.fecha !== fecha).length +
      (horasTrabajo > 0 ? 1 : 0);

    const extensionesSemana = jornadasSemana
      .filter(j => j.horas_conduccion > LIMITES_CE561.CONDUCCION_DIARIA_MAX && j.fecha !== fecha).length +
      (horasConduccion > LIMITES_CE561.CONDUCCION_DIARIA_MAX ? 1 : 0);

    // Validaciones

    // 1. Conducción diaria
    if (horasConduccion > LIMITES_CE561.CONDUCCION_DIARIA_EXTENDIDA) {
      alertas.push({
        tipo: 'error',
        codigo: 'CE561_DIARIO_MAX',
        mensaje: `Conducción diaria excede el máximo de ${LIMITES_CE561.CONDUCCION_DIARIA_EXTENDIDA}h`
      });
    } else if (horasConduccion > LIMITES_CE561.CONDUCCION_DIARIA_MAX) {
      if (extensionesSemana > 2) {
        alertas.push({
          tipo: 'error',
          codigo: 'CE561_EXTENSIONES_MAX',
          mensaje: `Ya se han usado las 2 extensiones permitidas esta semana`
        });
      } else {
        alertas.push({
          tipo: 'warning',
          codigo: 'CE561_DIARIO_EXTENDIDO',
          mensaje: `Conducción extendida a ${horasConduccion}h (${extensionesSemana}/2 extensiones usadas)`
        });
      }
    }

    // 2. Conducción semanal
    if (conduccionSemana > LIMITES_CE561.CONDUCCION_SEMANAL_MAX) {
      alertas.push({
        tipo: 'error',
        codigo: 'CE561_SEMANAL_MAX',
        mensaje: `Conducción semanal excede ${LIMITES_CE561.CONDUCCION_SEMANAL_MAX}h (${conduccionSemana.toFixed(1)}h)`
      });
    } else if (conduccionSemana > LIMITES_CE561.CONDUCCION_SEMANAL_MAX * 0.9) {
      alertas.push({
        tipo: 'warning',
        codigo: 'CE561_SEMANAL_CERCA',
        mensaje: `Cerca del límite semanal: ${conduccionSemana.toFixed(1)}h de ${LIMITES_CE561.CONDUCCION_SEMANAL_MAX}h`
      });
    }

    // 3. Conducción bisemanal
    if (conduccionBisemanal > LIMITES_CE561.CONDUCCION_BISEMANAL_MAX) {
      alertas.push({
        tipo: 'error',
        codigo: 'CE561_BISEMANAL_MAX',
        mensaje: `Conducción bisemanal excede ${LIMITES_CE561.CONDUCCION_BISEMANAL_MAX}h (${conduccionBisemanal.toFixed(1)}h)`
      });
    } else if (conduccionBisemanal > LIMITES_CE561.CONDUCCION_BISEMANAL_MAX * 0.9) {
      alertas.push({
        tipo: 'warning',
        codigo: 'CE561_BISEMANAL_CERCA',
        mensaje: `Cerca del límite bisemanal: ${conduccionBisemanal.toFixed(1)}h de ${LIMITES_CE561.CONDUCCION_BISEMANAL_MAX}h`
      });
    }

    // 4. Días de trabajo semanales (convenio)
    if (diasTrabajadosSemana > LIMITES_CE561.DIAS_TRABAJO_SEMANA) {
      alertas.push({
        tipo: 'error',
        codigo: 'CONVENIO_DIAS_MAX',
        mensaje: `Excede ${LIMITES_CE561.DIAS_TRABAJO_SEMANA} días de trabajo por semana (${diasTrabajadosSemana} días)`
      });
    }

    const estadisticas: EstadisticasConductor = {
      conduccionHoy: horasConduccion,
      conduccionSemana,
      conduccionBisemanal,
      diasTrabajadosSemana,
      extensionesSemana,
      descansosReducidosPeriodo: 0, // TODO: calcular
      horasHastaLimiteDiario: Math.max(0, LIMITES_CE561.CONDUCCION_DIARIA_MAX - horasConduccion),
      horasHastaLimiteSemanal: Math.max(0, LIMITES_CE561.CONDUCCION_SEMANAL_MAX - conduccionSemana),
      proximoDescansoObligatorio: this.calcularProximoDescanso(conductorId, fecha)
    };

    return {
      valido: !alertas.some(a => a.tipo === 'error'),
      alertas,
      estadisticas
    };
  }

  // Calcular cuándo debe ser el próximo descanso semanal
  calcularProximoDescanso(conductorId: number, fechaActual: string): string {
    const fecha = new Date(fechaActual);
    const haceDosSemanas = new Date(fecha);
    haceDosSemanas.setDate(haceDosSemanas.getDate() - 14);

    const jornadas = this.getJornadas(
      conductorId,
      haceDosSemanas.toISOString().split('T')[0],
      fechaActual
    );

    // Buscar último descanso semanal (día con >= 24h de descanso)
    let ultimoDescansoSemanal: Date | null = null;
    for (let i = jornadas.length - 1; i >= 0; i--) {
      if (jornadas[i].tipo === 'descanso' && jornadas[i].descanso_nocturno >= 24) {
        ultimoDescansoSemanal = new Date(jornadas[i].fecha);
        break;
      }
    }

    if (!ultimoDescansoSemanal) {
      // Si no hay descanso semanal en las últimas 2 semanas, urgente
      return 'URGENTE - Descanso semanal requerido';
    }

    // El próximo descanso semanal debe ser máximo 6 días después
    const proximoDescanso = new Date(ultimoDescansoSemanal);
    proximoDescanso.setDate(proximoDescanso.getDate() + 6);

    if (proximoDescanso <= fecha) {
      return 'URGENTE - Descanso semanal requerido';
    }

    return proximoDescanso.toISOString().split('T')[0];
  }

  // Obtener resumen semanal de un conductor
  getResumenSemanal(conductorId: number, fecha: string): EstadisticasConductor {
    const validacion = this.validarJornada(conductorId, fecha, 0, 0);
    return validacion.estadisticas;
  }

  // Obtener estado de todos los conductores con información detallada de descansos
  getEstadoGeneral(): Array<{
    conductorId: number;
    nombre: string;
    estado: 'ok' | 'warning' | 'error';
    alertas: number;
    diasTrabajadosSemana: number;
    diasDescansoSemana: number;
    horasConduccionSemana: number;
    horasConduccionHoy: number;
    ultimoDescanso: string | null;
    proximoDescansoObligatorio: string;
  }> {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const inicioSemana = this.getInicioSemana(hoy);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 6);

    const conductores = db.prepare('SELECT id, nombre, apellidos, apodo FROM conductores WHERE activo = 1').all() as any[];

    return conductores.map(c => {
      const validacion = this.validarJornada(c.id, hoyStr, 0, 0);
      const errores = validacion.alertas.filter(a => a.tipo === 'error').length;
      const warnings = validacion.alertas.filter(a => a.tipo === 'warning').length;

      // Obtener jornadas de la semana
      const jornadasSemana = this.getJornadas(
        c.id,
        inicioSemana.toISOString().split('T')[0],
        finSemana.toISOString().split('T')[0]
      );

      const diasTrabajo = jornadasSemana.filter(j => j.tipo === 'trabajo').length;
      const diasDescanso = jornadasSemana.filter(j => j.tipo === 'descanso' || j.tipo === 'festivo').length;
      const horasSemana = jornadasSemana.reduce((sum, j) => sum + j.horas_conduccion, 0);

      // Jornada de hoy
      const jornadaHoy = jornadasSemana.find(j => j.fecha === hoyStr);
      const horasHoy = jornadaHoy?.horas_conduccion || 0;

      // Buscar último descanso
      const ultimos30Dias = new Date(hoy);
      ultimos30Dias.setDate(ultimos30Dias.getDate() - 30);
      const jornadasRecientes = this.getJornadas(
        c.id,
        ultimos30Dias.toISOString().split('T')[0],
        hoyStr
      );
      const ultimoDescanso = jornadasRecientes
        .filter(j => j.tipo === 'descanso')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.fecha || null;

      return {
        conductorId: c.id,
        nombre: c.apodo ? c.apodo : `${c.nombre} ${c.apellidos}`,
        estado: errores > 0 ? 'error' : warnings > 0 ? 'warning' : 'ok',
        alertas: validacion.alertas.length,
        diasTrabajadosSemana: diasTrabajo,
        diasDescansoSemana: diasDescanso,
        horasConduccionSemana: horasSemana,
        horasConduccionHoy: horasHoy,
        ultimoDescanso,
        proximoDescansoObligatorio: validacion.estadisticas.proximoDescansoObligatorio
      };
    });
  }

  // Calcular días consecutivos trabajados y alertas de descanso semanal
  calcularAlertasDescansoSemanal(conductorId: number, fechaActual: string): AlertasDescansoSemanal {
    const fecha = new Date(fechaActual);
    const hace60Dias = new Date(fecha);
    hace60Dias.setDate(hace60Dias.getDate() - 60);

    // Buscar jornadas incluyendo futuras (por si hay registros adelantados)
    const futuro = new Date(fecha);
    futuro.setDate(futuro.getDate() + 30);

    const jornadas = this.getJornadas(
      conductorId,
      hace60Dias.toISOString().split('T')[0],
      futuro.toISOString().split('T')[0]
    );

    const alertas: AlertaCE561[] = [];

    // Ordenar jornadas por fecha descendente
    const jornadasOrdenadas = [...jornadas].sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (jornadasOrdenadas.length === 0) {
      return {
        diasConsecutivosTrabajados: 0,
        diasHastaDescansoObligatorio: 6,
        proximoDescansoRequerido: '24h',
        ultimoDescansoSemanal: null,
        alertas: []
      };
    }

    // Empezar desde la última jornada registrada (puede ser futura)
    const ultimaJornada = jornadasOrdenadas[0];
    let fechaEsperada = new Date(ultimaJornada.fecha);

    // Contar días consecutivos de trabajo hacia atrás
    let diasConsecutivos = 0;

    for (const jornada of jornadasOrdenadas) {
      const fechaJornada = jornada.fecha;
      const fechaEsperadaStr = fechaEsperada.toISOString().split('T')[0];

      if (fechaJornada !== fechaEsperadaStr) {
        // Hay un hueco, rompe la racha
        break;
      }

      // Tipos que cuentan como día trabajado
      if (jornada.tipo === 'trabajo' || jornada.tipo === 'formacion') {
        diasConsecutivos++;
        fechaEsperada.setDate(fechaEsperada.getDate() - 1);
      } else if (jornada.tipo === 'descanso_normal' || jornada.tipo === 'descanso_reducido') {
        // Encontró un descanso, rompe la racha
        break;
      } else {
        // Otros tipos (vacaciones, baja, festivo, inactivo) - sigue buscando
        fechaEsperada.setDate(fechaEsperada.getDate() - 1);
      }
    }

    // Buscar los últimos dos descansos semanales para determinar el tipo del próximo
    const descansosSemanales: { fecha: string; tipo: 'normal' | 'reducido' }[] = [];
    for (const jornada of jornadasOrdenadas) {
      if (jornada.tipo === 'descanso_normal') {
        descansosSemanales.push({ fecha: jornada.fecha, tipo: 'normal' });
      } else if (jornada.tipo === 'descanso_reducido') {
        descansosSemanales.push({ fecha: jornada.fecha, tipo: 'reducido' });
      }
      if (descansosSemanales.length >= 2) break;
    }

    // Determinar qué tipo de descanso necesita a continuación
    const ultimoDescanso = descansosSemanales[0];
    let proximoDescansoRequerido: '24h' | '45h' = '24h';

    if (ultimoDescanso?.tipo === 'reducido') {
      // Si el último fue reducido, el siguiente DEBE ser normal (45h)
      proximoDescansoRequerido = '45h';
    }

    // Calcular días hasta que necesita descanso
    const diasHastaDescanso = Math.max(0, 6 - diasConsecutivos);

    // Generar alertas según días consecutivos
    if (diasConsecutivos >= 7) {
      alertas.push({
        tipo: 'error',
        codigo: 'CE561_DIAS_CONSECUTIVOS_MAX',
        mensaje: `INFRACCIÓN: ${diasConsecutivos} días consecutivos trabajados. Máximo permitido: 6 días. Descanso semanal obligatorio AHORA.`
      });
    } else if (diasConsecutivos === 6) {
      alertas.push({
        tipo: 'error',
        codigo: 'CE561_DESCANSO_MAÑANA',
        mensaje: `URGENTE: 6 días consecutivos trabajados. Mañana DEBE tomar descanso semanal de ${proximoDescansoRequerido}.`
      });
    } else if (diasConsecutivos === 5) {
      alertas.push({
        tipo: 'warning',
        codigo: 'CE561_DIAS_CONSECUTIVOS_5',
        mensaje: `Atención: 5 días consecutivos trabajados. Quedan ${diasHastaDescanso} día(s) para descanso semanal de ${proximoDescansoRequerido}.`
      });
    }

    // Alerta sobre tipo de descanso necesario
    if (proximoDescansoRequerido === '45h' && diasConsecutivos >= 4) {
      alertas.push({
        tipo: 'warning',
        codigo: 'CE561_DESCANSO_45H_REQUERIDO',
        mensaje: `El próximo descanso semanal DEBE ser de 45h (descanso normal). El anterior fue reducido (24h).`
      });
    }

    return {
      diasConsecutivosTrabajados: diasConsecutivos,
      diasHastaDescansoObligatorio: diasHastaDescanso,
      proximoDescansoRequerido,
      ultimoDescansoSemanal: ultimoDescanso ? {
        fecha: ultimoDescanso.fecha,
        tipo: ultimoDescanso.tipo
      } : null,
      alertas
    };
  }
}

export interface AlertasDescansoSemanal {
  diasConsecutivosTrabajados: number;
  diasHastaDescansoObligatorio: number;
  proximoDescansoRequerido: '24h' | '45h';
  ultimoDescansoSemanal: {
    fecha: string;
    tipo: 'normal' | 'reducido';
  } | null;
  alertas: AlertaCE561[];
}

export const ce561Service = new CE561Service();
