import { Response } from 'express';
import db, { Contrato } from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';

export const contratoController = {
  // Listar contratos de un conductor
  async list(req: AuthRequest, res: Response) {
    try {
      const { conductorId } = req.params;

      const contratos = db.prepare(`
        SELECT * FROM contratos
        WHERE conductor_id = ?
        ORDER BY fecha_inicio DESC
      `).all(conductorId) as Contrato[];

      res.json(contratos);
    } catch (error) {
      console.error('Error listando contratos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener un contrato por ID
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const contrato = db.prepare('SELECT * FROM contratos WHERE id = ?').get(id) as Contrato | undefined;

      if (!contrato) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      res.json(contrato);
    } catch (error) {
      console.error('Error obteniendo contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear contrato
  async create(req: AuthRequest, res: Response) {
    try {
      const { conductorId, fecha_inicio, fecha_fin, tipo_contrato, horas_semanales, cobra_disponibilidad, notas, porcentaje_jornada, por_horas } = req.body;

      if (!conductorId || !fecha_inicio) {
        return res.status(400).json({ error: 'Campos requeridos: conductorId, fecha_inicio' });
      }

      // Verificar que el conductor existe
      const conductor = db.prepare('SELECT id FROM conductores WHERE id = ?').get(conductorId);
      if (!conductor) {
        return res.status(404).json({ error: 'Conductor no encontrado' });
      }

      const porcentaje = porcentaje_jornada !== undefined ? Number(porcentaje_jornada) : 100;
      if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        return res.status(400).json({ error: 'El porcentaje de jornada debe estar entre 0 y 100' });
      }

      const stmt = db.prepare(`
        INSERT INTO contratos (conductor_id, fecha_inicio, fecha_fin, tipo_contrato, horas_semanales, porcentaje_jornada, por_horas, cobra_disponibilidad, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        conductorId,
        fecha_inicio,
        fecha_fin || null,
        tipo_contrato || 'indefinido',
        horas_semanales || 40,
        porcentaje,
        por_horas ? 1 : 0,
        cobra_disponibilidad ? 1 : 0,
        notas || null
      );

      const contrato = db.prepare('SELECT * FROM contratos WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json(contrato);
    } catch (error) {
      console.error('Error creando contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar contrato
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_fin, tipo_contrato, horas_semanales, cobra_disponibilidad, notas, porcentaje_jornada, por_horas } = req.body;

      const contrato = db.prepare('SELECT * FROM contratos WHERE id = ?').get(id);
      if (!contrato) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (fecha_inicio !== undefined) {
        updates.push('fecha_inicio = ?');
        values.push(fecha_inicio);
      }
      if (fecha_fin !== undefined) {
        updates.push('fecha_fin = ?');
        values.push(fecha_fin || null);
      }
      if (tipo_contrato !== undefined) {
        updates.push('tipo_contrato = ?');
        values.push(tipo_contrato);
      }
      if (horas_semanales !== undefined) {
        updates.push('horas_semanales = ?');
        values.push(horas_semanales);
      }
      if (porcentaje_jornada !== undefined) {
        const porcentaje = Number(porcentaje_jornada);
        if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
          return res.status(400).json({ error: 'El porcentaje de jornada debe estar entre 0 y 100' });
        }
        updates.push('porcentaje_jornada = ?');
        values.push(porcentaje);
      }
      if (por_horas !== undefined) {
        updates.push('por_horas = ?');
        values.push(por_horas ? 1 : 0);
      }
      if (cobra_disponibilidad !== undefined) {
        updates.push('cobra_disponibilidad = ?');
        values.push(cobra_disponibilidad ? 1 : 0);
      }
      if (notas !== undefined) {
        updates.push('notas = ?');
        values.push(notas || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      values.push(id);
      db.prepare(`UPDATE contratos SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const updatedContrato = db.prepare('SELECT * FROM contratos WHERE id = ?').get(id);
      res.json(updatedContrato);
    } catch (error) {
      console.error('Error actualizando contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar contrato
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = db.prepare('DELETE FROM contratos WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      res.json({ message: 'Contrato eliminado' });
    } catch (error) {
      console.error('Error eliminando contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Verificar si una fecha está dentro de algún contrato del conductor
  async verificarFecha(req: AuthRequest, res: Response) {
    try {
      const { conductorId, fecha } = req.query;

      if (!conductorId || !fecha) {
        return res.status(400).json({ error: 'Parámetros requeridos: conductorId, fecha' });
      }

      const contrato = db.prepare(`
        SELECT * FROM contratos
        WHERE conductor_id = ?
          AND fecha_inicio <= ?
          AND (fecha_fin IS NULL OR fecha_fin >= ?)
        ORDER BY fecha_inicio DESC
        LIMIT 1
      `).get(conductorId, fecha, fecha) as Contrato | undefined;

      res.json({
        enContrato: !!contrato,
        contrato: contrato || null
      });
    } catch (error) {
      console.error('Error verificando fecha:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
