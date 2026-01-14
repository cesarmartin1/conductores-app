import { Response } from 'express';
import db, { Jornada, TipoJornada } from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { ce561Service } from '../services/ce561.service';
import { calendarioService } from '../services/calendario.service';

const TIPOS_VALIDOS: TipoJornada[] = ['trabajo', 'descanso_normal', 'descanso_reducido', 'festivo', 'vacaciones', 'baja', 'formacion', 'inactivo'];

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

      // Obtener todos los conductores activos
      const conductores = db.prepare('SELECT id, nombre, apellidos FROM conductores WHERE activo = 1 ORDER BY nombre, apellidos').all() as any[];

      // Obtener todas las jornadas en el rango
      const jornadas = db.prepare(`
        SELECT conductor_id, fecha, tipo
        FROM jornadas
        WHERE fecha BETWEEN ? AND ?
      `).all(desde, hasta) as any[];

      // Crear mapa de jornadas por conductor y fecha
      const jornadasMap: { [key: string]: string } = {};
      jornadas.forEach(j => {
        jornadasMap[`${j.conductor_id}-${j.fecha}`] = j.tipo;
      });

      // Obtener festivos en el rango
      const festivos = db.prepare(`
        SELECT fecha, nombre FROM festivos WHERE fecha BETWEEN ? AND ?
      `).all(desde, hasta) as any[];

      const festivosMap: { [key: string]: string } = {};
      festivos.forEach(f => {
        festivosMap[f.fecha] = f.nombre;
      });

      // Calcular alertas de días consecutivos para cada conductor
      const hoy = new Date().toISOString().split('T')[0];
      const alertasPorConductor: { [key: number]: any } = {};

      conductores.forEach(c => {
        alertasPorConductor[c.id] = ce561Service.calcularAlertasDescansoSemanal(c.id, hoy);
      });

      res.json({
        conductores,
        jornadas: jornadasMap,
        festivos: festivosMap,
        alertas: alertasPorConductor
      });
    } catch (error) {
      console.error('Error obteniendo cuadrante:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar rápidamente una celda del cuadrante
  async updateCelda(req: AuthRequest, res: Response) {
    try {
      const { conductorId, fecha, tipo, horasTrabajo = 8 } = req.body;

      if (!conductorId || !fecha) {
        return res.status(400).json({ error: 'Campos requeridos: conductorId, fecha' });
      }

      // Si tipo es null o vacío, eliminar la jornada
      if (!tipo) {
        db.prepare('DELETE FROM jornadas WHERE conductor_id = ? AND fecha = ?').run(conductorId, fecha);
        return res.json({ deleted: true, fechas: [fecha] });
      }

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de jornada inválido' });
      }

      // Determinar las fechas a actualizar
      const fechasActualizar: string[] = [fecha];

      // Si es descanso normal (45h), ocupa 2 días
      if (tipo === 'descanso_normal') {
        const fechaObj = new Date(fecha);
        fechaObj.setDate(fechaObj.getDate() + 1);
        fechasActualizar.push(fechaObj.toISOString().split('T')[0]);
      }

      // Actualizar todas las fechas
      for (const f of fechasActualizar) {
        const existente = db.prepare('SELECT id FROM jornadas WHERE conductor_id = ? AND fecha = ?')
          .get(conductorId, f) as { id: number } | undefined;

        const horas = tipo === 'trabajo' ? horasTrabajo : 0;

        if (existente) {
          db.prepare('UPDATE jornadas SET tipo = ?, horas_trabajo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(tipo, horas, existente.id);
        } else {
          db.prepare(`
            INSERT INTO jornadas (conductor_id, fecha, tipo, horas_conduccion, horas_trabajo, pausas_minutos, descanso_nocturno)
            VALUES (?, ?, ?, 0, ?, 0, 0)
          `).run(conductorId, f, tipo, horas);
        }
      }

      res.json({ success: true, tipo, fechas: fechasActualizar });
    } catch (error) {
      console.error('Error actualizando celda:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
