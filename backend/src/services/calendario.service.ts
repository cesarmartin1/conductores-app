import db, { Festivo, Jornada } from '../models/database';

// Festivos nacionales de España (fijos)
const FESTIVOS_FIJOS = [
  { dia: 1, mes: 1, nombre: 'Año Nuevo' },
  { dia: 6, mes: 1, nombre: 'Día de Reyes' },
  { dia: 1, mes: 5, nombre: 'Día del Trabajo' },
  { dia: 15, mes: 8, nombre: 'Asunción de la Virgen' },
  { dia: 12, mes: 10, nombre: 'Fiesta Nacional de España' },
  { dia: 1, mes: 11, nombre: 'Todos los Santos' },
  { dia: 6, mes: 12, nombre: 'Día de la Constitución' },
  { dia: 8, mes: 12, nombre: 'Inmaculada Concepción' },
  { dia: 25, mes: 12, nombre: 'Navidad' },
];

// Calcular Semana Santa (Viernes Santo y Jueves Santo)
function calcularSemanaSanta(año: number): { jueves: Date; viernes: Date } {
  // Algoritmo de Gauss para calcular el Domingo de Pascua
  const a = año % 19;
  const b = Math.floor(año / 100);
  const c = año % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  const domingoPascua = new Date(año, mes - 1, dia);

  const viernesSanto = new Date(domingoPascua);
  viernesSanto.setDate(domingoPascua.getDate() - 2);

  const juevesSanto = new Date(domingoPascua);
  juevesSanto.setDate(domingoPascua.getDate() - 3);

  return { jueves: juevesSanto, viernes: viernesSanto };
}

export class CalendarioService {

  // Inicializar festivos nacionales para un año
  inicializarFestivosNacionales(año: number): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO festivos (fecha, nombre, ambito, año)
      VALUES (?, ?, 'nacional', ?)
    `);

    // Festivos fijos
    for (const festivo of FESTIVOS_FIJOS) {
      const fecha = `${año}-${String(festivo.mes).padStart(2, '0')}-${String(festivo.dia).padStart(2, '0')}`;
      stmt.run(fecha, festivo.nombre, año);
    }

    // Semana Santa
    const semanaSanta = calcularSemanaSanta(año);
    stmt.run(semanaSanta.jueves.toISOString().split('T')[0], 'Jueves Santo', año);
    stmt.run(semanaSanta.viernes.toISOString().split('T')[0], 'Viernes Santo', año);
  }

  // Obtener festivos de un año
  getFestivos(año: number, ambito?: 'nacional' | 'autonomico' | 'local'): Festivo[] {
    let query = 'SELECT * FROM festivos WHERE año = ?';
    const params: any[] = [año];

    if (ambito) {
      query += ' AND ambito = ?';
      params.push(ambito);
    }

    query += ' ORDER BY fecha ASC';
    return db.prepare(query).all(...params) as Festivo[];
  }

  // Obtener festivos de un mes
  getFestivosDelMes(año: number, mes: number): Festivo[] {
    const mesStr = String(mes).padStart(2, '0');
    const desde = `${año}-${mesStr}-01`;
    const hasta = `${año}-${mesStr}-31`;

    return db.prepare(`
      SELECT * FROM festivos
      WHERE fecha BETWEEN ? AND ?
      ORDER BY fecha ASC
    `).all(desde, hasta) as Festivo[];
  }

  // Verificar si una fecha es festivo
  esFestivo(fecha: string): Festivo | null {
    const festivo = db.prepare('SELECT * FROM festivos WHERE fecha = ?').get(fecha) as Festivo | undefined;
    return festivo || null;
  }

  // Añadir festivo personalizado
  añadirFestivo(fecha: string, nombre: string, ambito: 'nacional' | 'autonomico' | 'local', comunidad?: string): Festivo {
    const año = parseInt(fecha.split('-')[0]);
    const stmt = db.prepare(`
      INSERT INTO festivos (fecha, nombre, ambito, comunidad, año)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(fecha, nombre, ambito, comunidad || null, año);
    return {
      id: result.lastInsertRowid as number,
      fecha,
      nombre,
      ambito,
      comunidad: comunidad || null,
      año
    };
  }

  // Eliminar festivo
  eliminarFestivo(id: number): boolean {
    const result = db.prepare('DELETE FROM festivos WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Obtener calendario mensual de un conductor
  getCalendarioMensual(conductorId: number, año: number, mes: number): CalendarioDia[] {
    const mesStr = String(mes).padStart(2, '0');
    const primerDia = new Date(año, mes - 1, 1);
    const ultimoDia = new Date(año, mes, 0);
    const dias: CalendarioDia[] = [];

    // Obtener jornadas del mes
    const jornadas = db.prepare(`
      SELECT * FROM jornadas
      WHERE conductor_id = ? AND fecha BETWEEN ? AND ?
    `).all(conductorId, `${año}-${mesStr}-01`, `${año}-${mesStr}-${ultimoDia.getDate()}`) as Jornada[];

    const jornadasMap = new Map(jornadas.map(j => [j.fecha, j]));

    // Obtener festivos del mes
    const festivos = this.getFestivosDelMes(año, mes);
    const festivosMap = new Map(festivos.map(f => [f.fecha, f]));

    // Construir calendario
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = `${año}-${mesStr}-${String(dia).padStart(2, '0')}`;
      const diaSemana = new Date(año, mes - 1, dia).getDay();
      const esFinde = diaSemana === 0 || diaSemana === 6;

      const jornada = jornadasMap.get(fecha);
      const festivo = festivosMap.get(fecha);

      dias.push({
        fecha,
        diaSemana,
        esFinde,
        festivo: festivo || null,
        jornada: jornada || null,
        estado: this.determinarEstado(jornada, festivo, esFinde)
      });
    }

    return dias;
  }

  // Determinar estado visual del día
  private determinarEstado(jornada: Jornada | null, festivo: Festivo | null, esFinde: boolean): EstadoDia {
    if (jornada) {
      switch (jornada.tipo) {
        case 'trabajo': return 'trabajo';
        case 'descanso': return 'descanso';
        case 'festivo': return 'festivo';
        case 'vacaciones': return 'vacaciones';
        case 'baja': return 'baja';
      }
    }
    if (festivo) return 'festivo';
    if (esFinde) return 'finde';
    return 'pendiente';
  }

  // Calcular resumen mensual (acepta calendario pre-calculado para evitar queries duplicadas)
  getResumenMensual(conductorId: number, año: number, mes: number, calendarioExistente?: CalendarioDia[]): ResumenMensual {
    const calendario = calendarioExistente || this.getCalendarioMensual(conductorId, año, mes);

    let diasTrabajados = 0;
    let diasDescanso = 0;
    let diasFestivo = 0;
    let diasVacaciones = 0;
    let diasBaja = 0;
    let horasConduccion = 0;
    let horasTrabajo = 0;

    for (const dia of calendario) {
      if (dia.jornada) {
        switch (dia.jornada.tipo) {
          case 'trabajo':
            diasTrabajados++;
            horasConduccion += dia.jornada.horas_conduccion;
            horasTrabajo += dia.jornada.horas_trabajo;
            break;
          case 'descanso':
            diasDescanso++;
            break;
          case 'festivo':
            diasFestivo++;
            break;
          case 'vacaciones':
            diasVacaciones++;
            break;
          case 'baja':
            diasBaja++;
            break;
        }
      } else if (dia.festivo) {
        diasFestivo++;
      } else if (dia.esFinde) {
        diasDescanso++;
      }
    }

    return {
      año,
      mes,
      diasTrabajados,
      diasDescanso,
      diasFestivo,
      diasVacaciones,
      diasBaja,
      horasConduccion,
      horasTrabajo,
      diasPendientes: calendario.filter(d => d.estado === 'pendiente').length
    };
  }

  // Calcular días de descanso pendientes según convenio
  // Regla: cada 7 días trabajados = 2 días festivos de convenio + domingos trabajados + festivos nacionales trabajados
  // Vacaciones no cuentan (ni para días trabajados ni para descansos)
  // Formación cuenta como día trabajado para convenio, no para tacógrafo
  calcularDescansosPendientes(conductorId: number, año: number, mes: number): DescansosPendientes {
    // Obtener todas las jornadas desde el inicio del año hasta el mes actual
    const desde = `${año}-01-01`;
    const ultimoDiaMes = new Date(año, mes, 0).getDate();
    const hasta = `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    const jornadas = db.prepare(`
      SELECT * FROM jornadas
      WHERE conductor_id = ? AND fecha BETWEEN ? AND ?
      ORDER BY fecha ASC
    `).all(conductorId, desde, hasta) as Jornada[];

    // Obtener festivos nacionales del período
    const festivosNacionales = db.prepare(`
      SELECT fecha FROM festivos
      WHERE año = ? AND ambito = 'nacional'
    `).all(año) as { fecha: string }[];
    const festivosSet = new Set(festivosNacionales.map(f => f.fecha));

    let diasTrabajadosConvenio = 0; // Incluye trabajo + formación
    let diasTrabajadosTacografo = 0; // Solo trabajo
    let domingosTrabajados = 0;
    let festivosNacionalesTrabajados = 0;
    let diasDescansoTomados = 0;
    let diasVacaciones = 0;
    let diasFormacion = 0;

    for (const jornada of jornadas) {
      const fecha = new Date(jornada.fecha);
      const diaSemana = fecha.getDay(); // 0 = domingo
      const esDomingo = diaSemana === 0;
      const esFestivoNacional = festivosSet.has(jornada.fecha);

      switch (jornada.tipo) {
        case 'trabajo':
          diasTrabajadosConvenio++;
          diasTrabajadosTacografo++;
          if (esDomingo) domingosTrabajados++;
          if (esFestivoNacional) festivosNacionalesTrabajados++;
          break;

        case 'formacion':
          diasTrabajadosConvenio++; // Cuenta para convenio
          diasFormacion++;
          // NO cuenta para tacógrafo
          if (esDomingo) domingosTrabajados++;
          if (esFestivoNacional) festivosNacionalesTrabajados++;
          break;

        case 'descanso_normal':
        case 'descanso_reducido':
          diasDescansoTomados++;
          break;

        case 'vacaciones':
          diasVacaciones++; // No cuenta para nada
          break;

        // 'baja', 'inactivo' no cuentan
      }
    }

    // Calcular días de descanso correspondientes
    // Por cada 7 días trabajados = 2 días de descanso de convenio
    const descansosPorDiasTrabajados = Math.floor(diasTrabajadosConvenio / 7) * 2;

    // Total de descansos que le corresponden
    const descansosCorrespondientes = descansosPorDiasTrabajados + domingosTrabajados + festivosNacionalesTrabajados;

    // Días pendientes = correspondientes - tomados
    const diasPendientes = Math.max(0, descansosCorrespondientes - diasDescansoTomados);

    // Calcular porcentaje (excluyendo vacaciones del total de días)
    const diasTotalesContables = jornadas.filter(j => j.tipo !== 'vacaciones').length;
    const porcentajeDescanso = diasTotalesContables > 0
      ? ((diasDescansoTomados / diasTotalesContables) * 100)
      : 0;

    return {
      diasTrabajadosConvenio,
      diasTrabajadosTacografo,
      diasFormacion,
      domingosTrabajados,
      festivosNacionalesTrabajados,
      diasDescansoTomados,
      diasVacaciones,
      descansosCorrespondientes,
      diasPendientes,
      porcentajeDescanso: Math.round(porcentajeDescanso * 10) / 10,
      detalle: {
        porDiasTrabajados: descansosPorDiasTrabajados,
        porDomingos: domingosTrabajados,
        porFestivos: festivosNacionalesTrabajados
      }
    };
  }
}

export type EstadoDia = 'trabajo' | 'descanso' | 'festivo' | 'vacaciones' | 'baja' | 'finde' | 'pendiente';

export interface CalendarioDia {
  fecha: string;
  diaSemana: number;
  esFinde: boolean;
  festivo: Festivo | null;
  jornada: Jornada | null;
  estado: EstadoDia;
}

export interface ResumenMensual {
  año: number;
  mes: number;
  diasTrabajados: number;
  diasDescanso: number;
  diasFestivo: number;
  diasVacaciones: number;
  diasBaja: number;
  horasConduccion: number;
  horasTrabajo: number;
  diasPendientes: number;
}

export interface DescansosPendientes {
  diasTrabajadosConvenio: number;
  diasTrabajadosTacografo: number;
  diasFormacion: number;
  domingosTrabajados: number;
  festivosNacionalesTrabajados: number;
  diasDescansoTomados: number;
  diasVacaciones: number;
  descansosCorrespondientes: number;
  diasPendientes: number;
  porcentajeDescanso: number;
  detalle: {
    porDiasTrabajados: number;
    porDomingos: number;
    porFestivos: number;
  };
}

export const calendarioService = new CalendarioService();
