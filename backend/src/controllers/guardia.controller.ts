import { Response } from 'express';
import db, { Guardia, JornadaGuardia, TipoJornadaGuardia, ContratoGuardia } from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';

const TIPOS_VALIDOS: TipoJornadaGuardia[] = ['trabajo', 'vacaciones', 'baja', 'inactivo'];

export const guardiaController = {
  // ==================== GUARDIAS ====================

  // Listar todos los guardias
  async list(req: AuthRequest, res: Response) {
    try {
      const { activo } = req.query;
      let query = 'SELECT * FROM guardias';
      const params: any[] = [];

      if (activo !== undefined) {
        query += ' WHERE activo = ?';
        params.push(activo === 'true' ? 1 : 0);
      }

      query += ' ORDER BY apellidos, nombre ASC';
      const guardias = db.prepare(query).all(...params);

      res.json(guardias);
    } catch (error) {
      console.error('Error listando guardias:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener un guardia por ID
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const guardia = db.prepare('SELECT * FROM guardias WHERE id = ?').get(id) as Guardia | undefined;

      if (!guardia) {
        return res.status(404).json({ error: 'Guardia no encontrado' });
      }

      res.json(guardia);
    } catch (error) {
      console.error('Error obteniendo guardia:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear guardia
  async create(req: AuthRequest, res: Response) {
    try {
      const { nombre, apellidos, dni, telefono, fecha_alta } = req.body;

      if (!nombre || !apellidos || !dni || !fecha_alta) {
        return res.status(400).json({ error: 'Campos requeridos: nombre, apellidos, dni, fecha_alta' });
      }

      // Verificar DNI único
      const existingDni = db.prepare('SELECT id FROM guardias WHERE dni = ?').get(dni);
      if (existingDni) {
        return res.status(400).json({ error: 'Ya existe un guardia con ese DNI' });
      }

      const stmt = db.prepare(`
        INSERT INTO guardias (nombre, apellidos, dni, telefono, fecha_alta)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(nombre, apellidos, dni, telefono || null, fecha_alta);

      const guardia = db.prepare('SELECT * FROM guardias WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json(guardia);
    } catch (error) {
      console.error('Error creando guardia:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar guardia
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, apellidos, dni, telefono, activo, fecha_alta } = req.body;

      const guardia = db.prepare('SELECT * FROM guardias WHERE id = ?').get(id);
      if (!guardia) {
        return res.status(404).json({ error: 'Guardia no encontrado' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (nombre !== undefined) {
        updates.push('nombre = ?');
        values.push(nombre);
      }
      if (apellidos !== undefined) {
        updates.push('apellidos = ?');
        values.push(apellidos);
      }
      if (dni !== undefined) {
        const existingDni = db.prepare('SELECT id FROM guardias WHERE dni = ? AND id != ?').get(dni, id);
        if (existingDni) {
          return res.status(400).json({ error: 'Ya existe un guardia con ese DNI' });
        }
        updates.push('dni = ?');
        values.push(dni);
      }
      if (telefono !== undefined) {
        updates.push('telefono = ?');
        values.push(telefono);
      }
      if (activo !== undefined) {
        updates.push('activo = ?');
        values.push(activo ? 1 : 0);
      }
      if (fecha_alta !== undefined) {
        updates.push('fecha_alta = ?');
        values.push(fecha_alta);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      values.push(id);
      db.prepare(`UPDATE guardias SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const updatedGuardia = db.prepare('SELECT * FROM guardias WHERE id = ?').get(id);
      res.json(updatedGuardia);
    } catch (error) {
      console.error('Error actualizando guardia:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar guardia (soft delete)
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = db.prepare('UPDATE guardias SET activo = 0 WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Guardia no encontrado' });
      }

      res.json({ message: 'Guardia desactivado' });
    } catch (error) {
      console.error('Error eliminando guardia:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ==================== CUADRANTE ====================

  // Obtener cuadrante de guardias
  async getCuadrante(req: AuthRequest, res: Response) {
    try {
      const { desde, hasta } = req.query;

      if (!desde || !hasta) {
        return res.status(400).json({ error: 'Parámetros requeridos: desde, hasta' });
      }

      // Obtener todos los guardias activos con su DNI
      const guardias = db.prepare('SELECT id, nombre, apellidos, dni, fecha_alta FROM guardias WHERE activo = 1 ORDER BY apellidos, nombre').all() as any[];

      // Obtener todos los conductores para buscar coincidencias por DNI
      const conductores = db.prepare('SELECT id, dni FROM conductores').all() as any[];
      const conductorPorDni: { [key: string]: number } = {};
      conductores.forEach(c => {
        conductorPorDni[c.dni] = c.id;
      });

      // Obtener todos los contratos de guardias
      const contratos = db.prepare('SELECT * FROM contratos_guardias ORDER BY fecha_inicio DESC').all() as ContratoGuardia[];
      const contratosPorGuardia: { [key: number]: ContratoGuardia[] } = {};
      contratos.forEach(c => {
        if (!contratosPorGuardia[c.guardia_id]) {
          contratosPorGuardia[c.guardia_id] = [];
        }
        contratosPorGuardia[c.guardia_id].push(c);
      });

      // Añadir conductor_id y contratos a cada guardia
      const guardiasConDatos = guardias.map(g => ({
        ...g,
        conductor_id: conductorPorDni[g.dni] || null,
        contratos: contratosPorGuardia[g.id] || []
      }));

      // Obtener todas las jornadas en el rango
      const jornadas = db.prepare(`
        SELECT guardia_id, fecha, tipo, turno, horas
        FROM jornadas_guardias
        WHERE fecha BETWEEN ? AND ?
      `).all(desde, hasta) as any[];

      // Crear mapa de jornadas por guardia y fecha
      const jornadasMap: { [key: string]: { tipo: string; turno: string | null; horas: number } } = {};
      jornadas.forEach(j => {
        jornadasMap[`${j.guardia_id}-${j.fecha}`] = {
          tipo: j.tipo,
          turno: j.turno,
          horas: j.horas
        };
      });

      // Obtener jornadas de conductores asociados para evitar acumular guardia si trabajan
      const conductorIds = [...new Set(guardiasConDatos.map(g => g.conductor_id).filter(Boolean))] as number[];
      const conductorJornadasMap: { [key: string]: string } = {};
      if (conductorIds.length > 0) {
        const placeholders = conductorIds.map(() => '?').join(',');
        const jornadasConductores = db.prepare(`
          SELECT conductor_id, fecha, tipo
          FROM jornadas
          WHERE conductor_id IN (${placeholders}) AND fecha BETWEEN ? AND ?
        `).all(...conductorIds, desde, hasta) as any[];
        jornadasConductores.forEach(j => {
          conductorJornadasMap[`${j.conductor_id}-${j.fecha}`] = j.tipo;
        });
      }

      res.json({
        guardias: guardiasConDatos,
        jornadas: jornadasMap,
        conductorJornadas: conductorJornadasMap
      });
    } catch (error) {
      console.error('Error obteniendo cuadrante de guardias:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar celda del cuadrante
  async updateCelda(req: AuthRequest, res: Response) {
    try {
      const { guardiaId, fecha, tipo, turno, horas = 8 } = req.body;

      if (!guardiaId || !fecha) {
        return res.status(400).json({ error: 'Campos requeridos: guardiaId, fecha' });
      }

      // Si tipo es null o vacío, eliminar la jornada
      if (!tipo) {
        db.prepare('DELETE FROM jornadas_guardias WHERE guardia_id = ? AND fecha = ?').run(guardiaId, fecha);
        return res.json({ deleted: true });
      }

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de jornada inválido' });
      }

      const existente = db.prepare('SELECT id FROM jornadas_guardias WHERE guardia_id = ? AND fecha = ?')
        .get(guardiaId, fecha) as { id: number } | undefined;

      if (existente) {
        db.prepare('UPDATE jornadas_guardias SET tipo = ?, turno = ?, horas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(tipo, turno || null, horas, existente.id);
      } else {
        db.prepare(`
          INSERT INTO jornadas_guardias (guardia_id, fecha, tipo, turno, horas)
          VALUES (?, ?, ?, ?, ?)
        `).run(guardiaId, fecha, tipo, turno || null, horas);
      }

      res.json({ success: true, tipo, turno, horas });
    } catch (error) {
      console.error('Error actualizando celda:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ==================== CONTRATOS ====================

  // Listar contratos de un guardia
  async listContratos(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const guardia = db.prepare('SELECT id FROM guardias WHERE id = ?').get(id);
      if (!guardia) {
        return res.status(404).json({ error: 'Guardia no encontrado' });
      }

      const contratos = db.prepare(`
        SELECT * FROM contratos_guardias
        WHERE guardia_id = ?
        ORDER BY fecha_inicio DESC
      `).all(id) as ContratoGuardia[];

      res.json(contratos);
    } catch (error) {
      console.error('Error listando contratos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear contrato para un guardia
  async createContrato(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_fin, tipo_contrato, notas } = req.body;

      if (!fecha_inicio) {
        return res.status(400).json({ error: 'Fecha de inicio requerida' });
      }

      const guardia = db.prepare('SELECT id FROM guardias WHERE id = ?').get(id);
      if (!guardia) {
        return res.status(404).json({ error: 'Guardia no encontrado' });
      }

      const result = db.prepare(`
        INSERT INTO contratos_guardias (guardia_id, fecha_inicio, fecha_fin, tipo_contrato, notas)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, fecha_inicio, fecha_fin || null, tipo_contrato || 'indefinido', notas || null);

      const contrato = db.prepare('SELECT * FROM contratos_guardias WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json(contrato);
    } catch (error) {
      console.error('Error creando contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar contrato
  async updateContrato(req: AuthRequest, res: Response) {
    try {
      const { contratoId } = req.params;
      const { fecha_inicio, fecha_fin, tipo_contrato, notas } = req.body;

      const contrato = db.prepare('SELECT * FROM contratos_guardias WHERE id = ?').get(contratoId);
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
        values.push(fecha_fin);
      }
      if (tipo_contrato !== undefined) {
        updates.push('tipo_contrato = ?');
        values.push(tipo_contrato);
      }
      if (notas !== undefined) {
        updates.push('notas = ?');
        values.push(notas);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      values.push(contratoId);
      db.prepare(`UPDATE contratos_guardias SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const updatedContrato = db.prepare('SELECT * FROM contratos_guardias WHERE id = ?').get(contratoId);
      res.json(updatedContrato);
    } catch (error) {
      console.error('Error actualizando contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar contrato
  async deleteContrato(req: AuthRequest, res: Response) {
    try {
      const { contratoId } = req.params;

      const result = db.prepare('DELETE FROM contratos_guardias WHERE id = ?').run(contratoId);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      res.json({ message: 'Contrato eliminado' });
    } catch (error) {
      console.error('Error eliminando contrato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
