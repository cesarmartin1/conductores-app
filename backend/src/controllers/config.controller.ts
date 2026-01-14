import { Response } from 'express';
import db from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';

export const configController = {
  // Obtener toda la configuración
  async getAll(req: AuthRequest, res: Response) {
    try {
      const config = db.prepare('SELECT clave, valor, descripcion FROM configuracion').all() as any[];

      // Convertir a objeto
      const configObj: { [key: string]: { valor: string; descripcion: string } } = {};
      config.forEach(c => {
        configObj[c.clave] = { valor: c.valor, descripcion: c.descripcion };
      });

      res.json(configObj);
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener un valor de configuración
  async get(req: AuthRequest, res: Response) {
    try {
      const { clave } = req.params;
      const config = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave) as { valor: string } | undefined;

      if (!config) {
        return res.status(404).json({ error: 'Configuración no encontrada' });
      }

      res.json({ clave, valor: config.valor });
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar configuración
  async update(req: AuthRequest, res: Response) {
    try {
      const { clave } = req.params;
      const { valor } = req.body;

      if (valor === undefined) {
        return res.status(400).json({ error: 'Valor requerido' });
      }

      const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ?').get(clave);

      if (existente) {
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run(String(valor), clave);
      } else {
        db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)').run(clave, String(valor));
      }

      res.json({ clave, valor: String(valor) });
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar múltiples configuraciones
  async updateBatch(req: AuthRequest, res: Response) {
    try {
      const configs = req.body;

      if (!configs || typeof configs !== 'object') {
        return res.status(400).json({ error: 'Configuraciones requeridas' });
      }

      for (const [clave, valor] of Object.entries(configs)) {
        const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ?').get(clave);

        if (existente) {
          db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run(String(valor), clave);
        } else {
          db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)').run(clave, String(valor));
        }
      }

      res.json({ message: 'Configuración actualizada', configs });
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
