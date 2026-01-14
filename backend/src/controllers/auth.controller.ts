import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db, { Usuario } from '../models/database';
import { generateToken, AuthRequest } from '../middleware/auth.middleware';

export const authController = {
  // Login
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
      }

      const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email) as Usuario | undefined;

      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const token = generateToken(user);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          conductorId: user.conductor_id
        }
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener usuario actual
  async me(req: AuthRequest, res: Response) {
    res.json({ user: req.user });
  },

  // Crear usuario (solo admin)
  async createUser(req: AuthRequest, res: Response) {
    try {
      const { email, password, nombre, rol, conductorId } = req.body;

      if (!email || !password || !nombre || !rol) {
        return res.status(400).json({ error: 'Campos requeridos: email, password, nombre, rol' });
      }

      if (!['admin', 'supervisor', 'conductor'].includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }

      const existingUser = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({ error: 'El email ya está registrado' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const stmt = db.prepare(`
        INSERT INTO usuarios (email, password, nombre, rol, conductor_id)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(email, hashedPassword, nombre, rol, conductorId || null);

      res.status(201).json({
        id: result.lastInsertRowid,
        email,
        nombre,
        rol,
        conductorId: conductorId || null
      });
    } catch (error) {
      console.error('Error creando usuario:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Listar usuarios (solo admin)
  async listUsers(req: AuthRequest, res: Response) {
    try {
      const users = db.prepare(`
        SELECT u.id, u.email, u.nombre, u.rol, u.conductor_id, u.activo,
               c.nombre as conductor_nombre, c.apellidos as conductor_apellidos
        FROM usuarios u
        LEFT JOIN conductores c ON u.conductor_id = c.id
        ORDER BY u.nombre ASC
      `).all();

      res.json(users);
    } catch (error) {
      console.error('Error listando usuarios:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar usuario
  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, rol, activo, conductorId } = req.body;

      const updates: string[] = [];
      const values: any[] = [];

      if (nombre !== undefined) {
        updates.push('nombre = ?');
        values.push(nombre);
      }
      if (rol !== undefined) {
        updates.push('rol = ?');
        values.push(rol);
      }
      if (activo !== undefined) {
        updates.push('activo = ?');
        values.push(activo ? 1 : 0);
      }
      if (conductorId !== undefined) {
        updates.push('conductor_id = ?');
        values.push(conductorId);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      values.push(id);
      db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      res.json({ message: 'Usuario actualizado' });
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Cambiar contraseña
  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
      }

      const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user!.id) as Usuario;
      const validPassword = await bcrypt.compare(currentPassword, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(hashedPassword, req.user!.id);

      res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Login con Microsoft
  async microsoftLogin(req: Request, res: Response) {
    try {
      const { email, nombre, microsoftId } = req.body;

      if (!email || !microsoftId) {
        return res.status(400).json({ error: 'Email y microsoftId requeridos' });
      }

      // Buscar usuario por email o microsoft_id
      let user = db.prepare('SELECT * FROM usuarios WHERE email = ? OR microsoft_id = ?').get(email, microsoftId) as any;

      if (!user) {
        // Crear usuario nuevo con rol por defecto 'supervisor'
        // El admin puede cambiar el rol después
        const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);

        db.prepare(`
          INSERT INTO usuarios (email, password, nombre, rol, microsoft_id, activo)
          VALUES (?, ?, ?, 'supervisor', ?, 1)
        `).run(email, randomPassword, nombre || email.split('@')[0], microsoftId);

        // Buscar el usuario recién creado por email
        user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
      } else {
        // Actualizar microsoft_id si no lo tiene
        if (!user.microsoft_id) {
          db.prepare('UPDATE usuarios SET microsoft_id = ? WHERE id = ?').run(microsoftId, user.id);
        }
        // Actualizar nombre si cambió
        if (user.nombre !== nombre) {
          db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').run(nombre, user.id);
        }
      }

      if (!user.activo) {
        return res.status(403).json({ error: 'Usuario desactivado. Contacta con el administrador.' });
      }

      const token = generateToken(user);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          conductorId: user.conductor_id,
          microsoftId: user.microsoft_id
        }
      });
    } catch (error) {
      console.error('Error en login Microsoft:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};
