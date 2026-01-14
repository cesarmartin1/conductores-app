import { Response } from 'express';
import db from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { calendarioService } from '../services/calendario.service';

export const festivoController = {
  // Listar festivos de un año
  async list(req: AuthRequest, res: Response) {
    try {
      const { año, ambito } = req.query;

      if (!año) {
        return res.status(400).json({ error: 'Parámetro requerido: año' });
      }

      const festivos = calendarioService.getFestivos(
        parseInt(año as string),
        ambito as 'nacional' | 'autonomico' | 'local' | undefined
      );

      res.json(festivos);
    } catch (error) {
      console.error('Error listando festivos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener festivos de un mes
  async getByMonth(req: AuthRequest, res: Response) {
    try {
      const { año, mes } = req.query;

      if (!año || !mes) {
        return res.status(400).json({ error: 'Parámetros requeridos: año, mes' });
      }

      const festivos = calendarioService.getFestivosDelMes(
        parseInt(año as string),
        parseInt(mes as string)
      );

      res.json(festivos);
    } catch (error) {
      console.error('Error obteniendo festivos del mes:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear festivo (admin/supervisor)
  async create(req: AuthRequest, res: Response) {
    try {
      const { fecha, nombre, ambito, comunidad } = req.body;

      if (!fecha || !nombre || !ambito) {
        return res.status(400).json({ error: 'Campos requeridos: fecha, nombre, ambito' });
      }

      const ambitosValidos = ['nacional', 'autonomico', 'local'];
      if (!ambitosValidos.includes(ambito)) {
        return res.status(400).json({ error: 'Ámbito inválido' });
      }

      // Verificar que no exista ya
      const existente = db.prepare(`
        SELECT id FROM festivos WHERE fecha = ? AND ambito = ? AND (comunidad = ? OR (comunidad IS NULL AND ? IS NULL))
      `).get(fecha, ambito, comunidad || null, comunidad || null);

      if (existente) {
        return res.status(400).json({ error: 'Ya existe un festivo con esa fecha y ámbito' });
      }

      const festivo = calendarioService.añadirFestivo(fecha, nombre, ambito, comunidad);

      res.status(201).json(festivo);
    } catch (error) {
      console.error('Error creando festivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar festivo
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, ambito, comunidad } = req.body;

      const updates: string[] = [];
      const values: any[] = [];

      if (nombre !== undefined) {
        updates.push('nombre = ?');
        values.push(nombre);
      }
      if (ambito !== undefined) {
        updates.push('ambito = ?');
        values.push(ambito);
      }
      if (comunidad !== undefined) {
        updates.push('comunidad = ?');
        values.push(comunidad);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      values.push(id);
      const result = db.prepare(`UPDATE festivos SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Festivo no encontrado' });
      }

      const festivo = db.prepare('SELECT * FROM festivos WHERE id = ?').get(id);
      res.json(festivo);
    } catch (error) {
      console.error('Error actualizando festivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar festivo
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const deleted = calendarioService.eliminarFestivo(parseInt(id));

      if (!deleted) {
        return res.status(404).json({ error: 'Festivo no encontrado' });
      }

      res.json({ message: 'Festivo eliminado' });
    } catch (error) {
      console.error('Error eliminando festivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Inicializar festivos nacionales para un año
  async inicializar(req: AuthRequest, res: Response) {
    try {
      const { año } = req.body;

      if (!año) {
        return res.status(400).json({ error: 'Campo requerido: año' });
      }

      calendarioService.inicializarFestivosNacionales(parseInt(año));

      const festivos = calendarioService.getFestivos(parseInt(año), 'nacional');

      res.json({
        message: `Festivos nacionales de ${año} inicializados`,
        festivos
      });
    } catch (error) {
      console.error('Error inicializando festivos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Verificar si una fecha es festivo
  async verificar(req: AuthRequest, res: Response) {
    try {
      const { fecha } = req.query;

      if (!fecha) {
        return res.status(400).json({ error: 'Parámetro requerido: fecha' });
      }

      const festivo = calendarioService.esFestivo(fecha as string);

      res.json({
        esFestivo: !!festivo,
        festivo
      });
    } catch (error) {
      console.error('Error verificando festivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
