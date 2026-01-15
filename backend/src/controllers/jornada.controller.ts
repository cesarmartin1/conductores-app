import { Response } from 'express';
import db, { Jornada, TipoJornada } from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { ce561Service } from '../services/ce561.service';
import { calendarioService } from '../services/calendario.service';

const TIPOS_VALIDOS: TipoJornada[] = ['trabajo', 'descanso_normal', 'descanso_reducido', 'compensatorio', 'festivo', 'vacaciones', 'baja', 'formacion', 'inactivo'];

export const jornadaController = {
  // Obtener jornadas de un conductor en un rango de fechas
  async list(req: AuthRequest, res: Response) {
    try {
      const { conductorId, desde, hasta } = req.query;

      if (!conductorId || !desde || !hasta) {
        return res.status(400).json({ error: 'Parámetros requeridos: conductorId, desde, hasta' });
      }

      // Si es conductor, solo puede ver sus propias jornadas
      if (req.user!.rol === 'conductor' && req.user!.conductorId !== parseInt(conductorId as string)) {
        return res.status(403).json({ error: 'No tienes permiso para ver estas jornadas' });
      }

      const jornadas = db.prepare(`
        SELECT j.*, c.nombre, c.apellidos
        FROM jornadas j
        JOIN conductores c ON j.conductor_id = c.id
        WHERE j.conductor_id = ? AND j.fecha BETWEEN ? AND ?
        ORDER BY j.fecha ASC
      `).all(conductorId, desde, hasta);

      res.json(jornadas);
    } catch (error) {
      console.error('Error listando jornadas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener una jornada específica
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const jornada = db.prepare(`
        SELECT j.*, c.nombre, c.apellidos
        FROM jornadas j
        JOIN conductores c ON j.conductor_id = c.id
        WHERE j.id = ?
      `).get(id) as (Jornada & { nombre: string; apellidos: string }) | undefined;

      if (!jornada) {
        return res.status(404).json({ error: 'Jornada no encontrada' });
      }

      // Si es conductor, solo puede ver sus propias jornadas
      if (req.user!.rol === 'conductor' && req.user!.conductorId !== jornada.conductor_id) {
        return res.status(403).json({ error: 'No tienes permiso para ver esta jornada' });
      }

      res.json(jornada);
    } catch (error) {
      console.error('Error obteniendo jornada:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear o actualizar jornada
  async upsert(req: AuthRequest, res: Response) {
    try {
      const {
        conductorId,
        fecha,
        tipo,
        horasConduccion = 0,
        horasTrabajo = 0,
        pausasMinutos = 0,
        descansoNocturno = 0,
        notas,
        forzar = false  // Para admin: ignorar validaciones CE 561
      } = req.body;

      if (!conductorId || !fecha || !tipo) {
        return res.status(400).json({ error: 'Campos requeridos: conductorId, fecha, tipo' });
      }

      // Si es conductor, solo puede editar sus propias jornadas
      if (req.user!.rol === 'conductor' && req.user!.conductorId !== conductorId) {
        return res.status(403).json({ error: 'No tienes permiso para editar esta jornada' });
      }

      // Validar tipo
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de jornada inválido' });
      }

      // Validar CE 561 solo para jornadas de trabajo
      let validacion = null;
      if (tipo === 'trabajo') {
        validacion = ce561Service.validarJornada(conductorId, fecha, horasConduccion, horasTrabajo);

        if (!validacion.valido && !forzar) {
          return res.status(400).json({
            error: 'La jornada incumple el Reglamento CE 561/2006',
            alertas: validacion.alertas,
            estadisticas: validacion.estadisticas
          });
        }
      }

      // Verificar si existe una jornada para ese día
      const existente = db.prepare('SELECT id FROM jornadas WHERE conductor_id = ? AND fecha = ?')
        .get(conductorId, fecha) as { id: number } | undefined;

      let result;
      if (existente) {
        // Actualizar
        db.prepare(`
          UPDATE jornadas SET
            tipo = ?,
            horas_conduccion = ?,
            horas_trabajo = ?,
            pausas_minutos = ?,
            descanso_nocturno = ?,
            notas = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(tipo, horasConduccion, horasTrabajo, pausasMinutos, descansoNocturno, notas || null, existente.id);
        result = { id: existente.id, updated: true };
      } else {
        // Crear
        const stmt = db.prepare(`
          INSERT INTO jornadas (conductor_id, fecha, tipo, horas_conduccion, horas_trabajo, pausas_minutos, descanso_nocturno, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertResult = stmt.run(conductorId, fecha, tipo, horasConduccion, horasTrabajo, pausasMinutos, descansoNocturno, notas || null);
        result = { id: insertResult.lastInsertRowid, created: true };
      }

      const jornada = db.prepare('SELECT * FROM jornadas WHERE id = ?').get(result.id);

      // Guardar alertas si las hay
      if (validacion && validacion.alertas.length > 0) {
        const stmtAlerta = db.prepare(`
          INSERT INTO alertas (conductor_id, tipo, mensaje, fecha)
          VALUES (?, ?, ?, ?)
        `);

        for (const alerta of validacion.alertas) {
          stmtAlerta.run(conductorId, alerta.codigo, alerta.mensaje, fecha);
        }
      }

      res.status(existente ? 200 : 201).json({
        jornada,
        validacion: validacion ? {
          alertas: validacion.alertas,
          estadisticas: validacion.estadisticas
        } : null
      });
    } catch (error) {
      console.error('Error guardando jornada:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar jornada
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const jornada = db.prepare('SELECT * FROM jornadas WHERE id = ?').get(id) as Jornada | undefined;

      if (!jornada) {
        return res.status(404).json({ error: 'Jornada no encontrada' });
      }

      // Si es conductor, solo puede eliminar sus propias jornadas
      if (req.user!.rol === 'conductor' && req.user!.conductorId !== jornada.conductor_id) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta jornada' });
      }

      db.prepare('DELETE FROM jornadas WHERE id = ?').run(id);

      res.json({ message: 'Jornada eliminada' });
    } catch (error) {
      console.error('Error eliminando jornada:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Validar jornada sin guardar
  async validar(req: AuthRequest, res: Response) {
    try {
      const { conductorId, fecha, horasConduccion, horasTrabajo } = req.body;

      if (!conductorId || !fecha) {
        return res.status(400).json({ error: 'Campos requeridos: conductorId, fecha' });
      }

      const validacion = ce561Service.validarJornada(
        conductorId,
        fecha,
        horasConduccion || 0,
        horasTrabajo || 0
      );

      res.json(validacion);
    } catch (error) {
      console.error('Error validando jornada:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Registrar jornadas masivas (ej: vacaciones)
  async registrarMasivo(req: AuthRequest, res: Response) {
    try {
      const { conductorId, desde, hasta, tipo, notas } = req.body;

      if (!conductorId || !desde || !hasta || !tipo) {
        return res.status(400).json({ error: 'Campos requeridos: conductorId, desde, hasta, tipo' });
      }

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido para registro masivo' });
      }

      const fechaDesde = new Date(desde);
      const fechaHasta = new Date(hasta);
      const jornadasCreadas: string[] = [];

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO jornadas (conductor_id, fecha, tipo, horas_conduccion, horas_trabajo, pausas_minutos, descanso_nocturno, notas)
        VALUES (?, ?, ?, 0, 0, 0, 0, ?)
      `);

      const current = new Date(fechaDesde);
      while (current <= fechaHasta) {
        const fechaStr = current.toISOString().split('T')[0];
        stmt.run(conductorId, fechaStr, tipo, notas || null);
        jornadasCreadas.push(fechaStr);
        current.setDate(current.getDate() + 1);
      }

      res.status(201).json({
        message: `${jornadasCreadas.length} jornadas registradas`,
        fechas: jornadasCreadas
      });
    } catch (error) {
      console.error('Error en registro masivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener cuadrante: todas las jornadas de todos los conductores en un rango
  async getCuadrante(req: AuthRequest, res: Response) {
    try {
      const { desde, hasta } = req.query;

      if (!desde || !hasta) {
        return res.status(400).json({ error: 'Parámetros requeridos: desde, hasta' });
      }

      const hoy = new Date().toISOString().split('T')[0];

      // Obtener todos los conductores activos
      const todosConductores = db.prepare(`
        SELECT
          c.id,
          c.nombre,
          c.apellidos,
          c.apodo,
          c.porcentaje_jornada,
          (
            SELECT porcentaje_jornada
            FROM contratos
            WHERE conductor_id = c.id
              AND fecha_inicio <= ?
              AND (fecha_fin IS NULL OR fecha_fin >= ?)
            ORDER BY fecha_inicio DESC
            LIMIT 1
          ) AS contrato_activo_porcentaje,
          (
            SELECT por_horas
            FROM contratos
            WHERE conductor_id = c.id
              AND fecha_inicio <= ?
              AND (fecha_fin IS NULL OR fecha_fin >= ?)
            ORDER BY fecha_inicio DESC
            LIMIT 1
          ) AS contrato_activo_por_horas
        FROM conductores c
        WHERE c.activo = 1
        ORDER BY c.apellidos, c.nombre
      `).all(hoy, hoy, hoy, hoy) as any[];

      // Obtener todos los contratos de los conductores activos
      const contratos = db.prepare(`
        SELECT * FROM contratos
        WHERE conductor_id IN (SELECT id FROM conductores WHERE activo = 1)
        ORDER BY conductor_id, fecha_inicio DESC
      `).all() as any[];

      // Agrupar contratos por conductor
      const contratosPorConductor: { [key: number]: any[] } = {};
      contratos.forEach(c => {
        if (!contratosPorConductor[c.conductor_id]) {
          contratosPorConductor[c.conductor_id] = [];
        }
        contratosPorConductor[c.conductor_id].push(c);
      });

      // Función para verificar si un conductor tiene contrato en algún día del período
      const tieneContratoEnPeriodo = (conductorId: number): boolean => {
        const contratosDelConductor = contratosPorConductor[conductorId];
        if (!contratosDelConductor || contratosDelConductor.length === 0) {
          return false;
        }

        // Verificar si algún contrato solapa con el período [desde, hasta]
        return contratosDelConductor.some(contrato => {
          const inicioContrato = contrato.fecha_inicio;
          const finContrato = contrato.fecha_fin || '9999-12-31'; // Sin fin = indefinido

          // Hay solapamiento si: inicioContrato <= hasta Y finContrato >= desde
          return inicioContrato <= hasta && finContrato >= desde;
        });
      };

      // Filtrar solo conductores con contrato en el período
      const conductores = todosConductores.filter(c => tieneContratoEnPeriodo(c.id));

      // Obtener todas las jornadas en el rango
      const jornadas = db.prepare(`
        SELECT conductor_id, fecha, tipo, horas_trabajo
        FROM jornadas
        WHERE fecha BETWEEN ? AND ?
      `).all(desde, hasta) as any[];

      // Crear mapa de jornadas por conductor y fecha
      const jornadasMap: { [key: string]: string } = {};
      const horasMap: { [key: string]: number } = {};
      jornadas.forEach(j => {
        jornadasMap[`${j.conductor_id}-${j.fecha}`] = j.tipo;
        if (typeof j.horas_trabajo === 'number') {
          horasMap[`${j.conductor_id}-${j.fecha}`] = j.horas_trabajo;
        }
      });

      // Obtener festivos en el rango
      const festivos = db.prepare(`
        SELECT fecha, nombre, ambito FROM festivos WHERE fecha BETWEEN ? AND ?
      `).all(desde, hasta) as any[];

      const festivosMap: { [key: string]: string } = {};
      const festivosNacionalesMap: { [key: string]: boolean } = {};
      festivos.forEach(f => {
        festivosMap[f.fecha] = f.nombre;
        if (f.ambito === 'nacional') {
          festivosNacionalesMap[f.fecha] = true;
        }
      });

      // Calcular alertas de días consecutivos para cada conductor
      const alertasPorConductor: { [key: number]: any } = {};

      conductores.forEach(c => {
        alertasPorConductor[c.id] = ce561Service.calcularAlertasDescansoSemanal(c.id, hoy);
      });

      const importeConfig = db.prepare('SELECT valor FROM configuracion WHERE clave = ?')
        .get('importe_domingo_festivo') as { valor?: string } | undefined;
      const importeDomingoFestivo = importeConfig?.valor ? parseFloat(importeConfig.valor) : 16.79;

      res.json({
        conductores,
        jornadas: jornadasMap,
        horas: horasMap,
        festivos: festivosMap,
        festivosNacionales: festivosNacionalesMap,
        alertas: alertasPorConductor,
        contratos: contratosPorConductor,
        importeDomingoFestivo
      });
    } catch (error) {
      console.error('Error obteniendo cuadrante:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar rápidamente una celda del cuadrante
  async updateCelda(req: AuthRequest, res: Response) {
    try {
      const { conductorId, fecha, tipo, horasTrabajo = 8, autoExpandir = true } = req.body;

      if (!conductorId || !fecha) {
        return res.status(400).json({ error: 'Campos requeridos: conductorId, fecha' });
      }

      // Si tipo es null o vacío, eliminar la jornada
      if (!tipo) {
        // Verificar si es un descanso_normal (45h) para borrar ambos días
        const jornadaActual = db.prepare('SELECT tipo FROM jornadas WHERE conductor_id = ? AND fecha = ?')
          .get(conductorId, fecha) as { tipo: string } | undefined;

        const fechasABorrar: string[] = [fecha];

        if (jornadaActual?.tipo === 'descanso_normal') {
          // Verificar día anterior
          const fechaObj = new Date(fecha);
          const fechaAnterior = new Date(fechaObj);
          fechaAnterior.setDate(fechaAnterior.getDate() - 1);
          const fechaAnteriorStr = fechaAnterior.toISOString().split('T')[0];

          const jornadaAnterior = db.prepare('SELECT tipo FROM jornadas WHERE conductor_id = ? AND fecha = ?')
            .get(conductorId, fechaAnteriorStr) as { tipo: string } | undefined;

          if (jornadaAnterior?.tipo === 'descanso_normal') {
            fechasABorrar.push(fechaAnteriorStr);
          }

          // Verificar día siguiente
          const fechaSiguiente = new Date(fechaObj);
          fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
          const fechaSiguienteStr = fechaSiguiente.toISOString().split('T')[0];

          const jornadaSiguiente = db.prepare('SELECT tipo FROM jornadas WHERE conductor_id = ? AND fecha = ?')
            .get(conductorId, fechaSiguienteStr) as { tipo: string } | undefined;

          if (jornadaSiguiente?.tipo === 'descanso_normal') {
            fechasABorrar.push(fechaSiguienteStr);
          }

          // Si hay un compensatorio inmediato despues del 45h, borrarlo tambien
          const fechaFinBloque = fechasABorrar.reduce((maxFecha, current) => current > maxFecha ? current : maxFecha, fecha);
          const fechaFinObj = new Date(fechaFinBloque);
          fechaFinObj.setDate(fechaFinObj.getDate() + 1);
          const fechaCompStr = fechaFinObj.toISOString().split('T')[0];
          const jornadaComp = db.prepare('SELECT tipo FROM jornadas WHERE conductor_id = ? AND fecha = ?')
            .get(conductorId, fechaCompStr) as { tipo: string } | undefined;
          if (jornadaComp?.tipo === 'compensatorio') {
            fechasABorrar.push(fechaCompStr);
          }
        }

        // Borrar todas las fechas identificadas
        for (const f of fechasABorrar) {
          db.prepare('DELETE FROM jornadas WHERE conductor_id = ? AND fecha = ?').run(conductorId, f);
        }

        return res.json({ deleted: true, fechas: fechasABorrar });
      }

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de jornada inválido' });
      }

      // Convertir descanso reducido a compensatorio si viene justo despues de un 45h
      let tipoFinal = tipo;
      if (tipo === 'descanso_reducido') {
        const fechaObj = new Date(fecha);
        fechaObj.setDate(fechaObj.getDate() - 1);
        const fechaAnterior = fechaObj.toISOString().split('T')[0];
        const jornadaAnterior = db.prepare('SELECT tipo FROM jornadas WHERE conductor_id = ? AND fecha = ?')
          .get(conductorId, fechaAnterior) as { tipo: string } | undefined;
        if (jornadaAnterior?.tipo === 'descanso_normal') {
          tipoFinal = 'compensatorio';
        }
      }

      // Determinar las fechas a actualizar
      const fechasActualizar: string[] = [fecha];

      // Si es descanso normal (45h) y autoExpandir está activo, ocupa 2 días automáticamente
      if (tipoFinal === 'descanso_normal' && autoExpandir) {
        const fechaObj = new Date(fecha);
        fechaObj.setDate(fechaObj.getDate() + 1);
        fechasActualizar.push(fechaObj.toISOString().split('T')[0]);
      }

      // Actualizar todas las fechas
      for (const f of fechasActualizar) {
        const existente = db.prepare('SELECT id FROM jornadas WHERE conductor_id = ? AND fecha = ?')
          .get(conductorId, f) as { id: number } | undefined;

        const horas = tipoFinal === 'trabajo' ? horasTrabajo : 0;

        if (existente) {
          db.prepare('UPDATE jornadas SET tipo = ?, horas_trabajo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(tipoFinal, horas, existente.id);
        } else {
          db.prepare(`
            INSERT INTO jornadas (conductor_id, fecha, tipo, horas_conduccion, horas_trabajo, pausas_minutos, descanso_nocturno)
            VALUES (?, ?, ?, 0, ?, 0, 0)
          `).run(conductorId, f, tipoFinal, horas);
        }
      }

      res.json({ success: true, tipo: tipoFinal, fechas: fechasActualizar });
    } catch (error) {
      console.error('Error actualizando celda:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
