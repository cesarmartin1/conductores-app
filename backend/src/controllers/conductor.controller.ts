import { Response } from 'express';
import db, { Conductor } from '../models/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { ce561Service, AlertasDescansoSemanal } from '../services/ce561.service';
import { calendarioService } from '../services/calendario.service';
import * as XLSX from 'xlsx';
import path from 'path';

export const conductorController = {
  // Listar todos los conductores
  async list(req: AuthRequest, res: Response) {
    try {
      const { activo } = req.query;
      let query = 'SELECT * FROM conductores';
      const params: any[] = [];

      if (activo !== undefined) {
        query += ' WHERE activo = ?';
        params.push(activo === 'true' ? 1 : 0);
      }

      query += ' ORDER BY apellidos, nombre ASC';
      const conductores = db.prepare(query).all(...params);

      res.json(conductores);
    } catch (error) {
      console.error('Error listando conductores:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener un conductor por ID
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const conductor = db.prepare('SELECT * FROM conductores WHERE id = ?').get(id) as Conductor | undefined;

      if (!conductor) {
        return res.status(404).json({ error: 'Conductor no encontrado' });
      }

      // Si es conductor, solo puede ver su propio perfil
      if (req.user!.rol === 'conductor' && req.user!.conductorId !== conductor.id) {
        return res.status(403).json({ error: 'No tienes permiso para ver este conductor' });
      }

      // Obtener estadísticas CE 561
      const hoy = new Date().toISOString().split('T')[0];
      const estadisticas = ce561Service.getResumenSemanal(conductor.id, hoy);

      res.json({
        ...conductor,
        estadisticas
      });
    } catch (error) {
      console.error('Error obteniendo conductor:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crear conductor
  async create(req: AuthRequest, res: Response) {
    try {
      const { nombre, apellidos, dni, licencia, telefono, fechaAlta } = req.body;

      if (!nombre || !apellidos || !dni || !fechaAlta) {
        return res.status(400).json({ error: 'Campos requeridos: nombre, apellidos, dni, fechaAlta' });
      }

      // Verificar DNI único
      const existingDni = db.prepare('SELECT id FROM conductores WHERE dni = ?').get(dni);
      if (existingDni) {
        return res.status(400).json({ error: 'Ya existe un conductor con ese DNI' });
      }

      const stmt = db.prepare(`
        INSERT INTO conductores (nombre, apellidos, dni, licencia, telefono, fecha_alta)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(nombre, apellidos, dni, licencia || null, telefono || null, fechaAlta);

      const conductor = db.prepare('SELECT * FROM conductores WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json(conductor);
    } catch (error) {
      console.error('Error creando conductor:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualizar conductor
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, apellidos, dni, licencia, telefono, activo } = req.body;

      const conductor = db.prepare('SELECT * FROM conductores WHERE id = ?').get(id);
      if (!conductor) {
        return res.status(404).json({ error: 'Conductor no encontrado' });
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
        // Verificar DNI único
        const existingDni = db.prepare('SELECT id FROM conductores WHERE dni = ? AND id != ?').get(dni, id);
        if (existingDni) {
          return res.status(400).json({ error: 'Ya existe un conductor con ese DNI' });
        }
        updates.push('dni = ?');
        values.push(dni);
      }
      if (licencia !== undefined) {
        updates.push('licencia = ?');
        values.push(licencia);
      }
      if (telefono !== undefined) {
        updates.push('telefono = ?');
        values.push(telefono);
      }
      if (activo !== undefined) {
        updates.push('activo = ?');
        values.push(activo ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      values.push(id);
      db.prepare(`UPDATE conductores SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const updatedConductor = db.prepare('SELECT * FROM conductores WHERE id = ?').get(id);
      res.json(updatedConductor);
    } catch (error) {
      console.error('Error actualizando conductor:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Eliminar conductor (soft delete)
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = db.prepare('UPDATE conductores SET activo = 0 WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Conductor no encontrado' });
      }

      res.json({ message: 'Conductor desactivado' });
    } catch (error) {
      console.error('Error eliminando conductor:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener calendario mensual del conductor
  async getCalendario(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { año, mes } = req.query;

      if (!año || !mes) {
        return res.status(400).json({ error: 'Parámetros requeridos: año, mes' });
      }

      // Si es conductor, solo puede ver su propio calendario
      if (req.user!.rol === 'conductor' && req.user!.conductorId !== parseInt(id)) {
        return res.status(403).json({ error: 'No tienes permiso para ver este calendario' });
      }

      const calendario = calendarioService.getCalendarioMensual(
        parseInt(id),
        parseInt(año as string),
        parseInt(mes as string)
      );

      // Pasar calendario existente para evitar queries duplicadas
      const resumen = calendarioService.getResumenMensual(
        parseInt(id),
        parseInt(año as string),
        parseInt(mes as string),
        calendario
      );

      // Calcular días de descanso pendientes
      const descansosPendientes = calendarioService.calcularDescansosPendientes(
        parseInt(id),
        parseInt(año as string),
        parseInt(mes as string)
      );

      // Calcular alertas de días consecutivos trabajados
      const hoy = new Date().toISOString().split('T')[0];
      const alertasDescanso = ce561Service.calcularAlertasDescansoSemanal(
        parseInt(id),
        hoy
      );

      res.json({ calendario, resumen, descansosPendientes, alertasDescanso });
    } catch (error) {
      console.error('Error obteniendo calendario:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Obtener estado de cumplimiento de todos los conductores
  async getEstadoGeneral(req: AuthRequest, res: Response) {
    try {
      const estado = ce561Service.getEstadoGeneral();
      res.json(estado);
    } catch (error) {
      console.error('Error obteniendo estado general:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Importar conductores desde Excel
  async importarExcel(req: AuthRequest, res: Response) {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'Se requiere la ruta del archivo Excel' });
      }

      // Leer archivo Excel
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Función para convertir número de serie Excel a fecha
      const excelDateToISO = (serial: number): string => {
        if (!serial || typeof serial !== 'number') return new Date().toISOString().split('T')[0];
        const utc_days = Math.floor(serial - 25569);
        const date = new Date(utc_days * 86400 * 1000);
        return date.toISOString().split('T')[0];
      };

      // Separar nombre completo en nombre y apellidos
      const separarNombre = (nombreCompleto: string): { nombre: string; apellidos: string } => {
        if (!nombreCompleto) return { nombre: '', apellidos: '' };
        const partes = nombreCompleto.trim().split(' ');
        if (partes.length === 1) {
          return { nombre: partes[0], apellidos: '' };
        }
        // Primer palabra es el nombre, el resto apellidos
        return {
          nombre: partes[0],
          apellidos: partes.slice(1).join(' ')
        };
      };

      const resultados = {
        importados: 0,
        actualizados: 0,
        errores: [] as string[]
      };

      // Saltar la cabecera (fila 0)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        try {
          const dni = row[1]?.toString()?.trim(); // NIF
          const nombreCompleto = row[4]?.toString()?.trim(); // Nombre
          const telefono = row[12]?.toString()?.trim() || row[11]?.toString()?.trim() || row[13]?.toString()?.trim(); // Teléfonos
          const licencia = row[16]?.toString()?.trim(); // Clase de permiso
          const fechaAltaSerial = row[18]; // Alta Empresa
          const estado = row[20]?.toString()?.trim(); // Estado

          if (!dni || !nombreCompleto) {
            resultados.errores.push(`Fila ${i + 1}: DNI o nombre vacío`);
            continue;
          }

          const { nombre, apellidos } = separarNombre(nombreCompleto);
          const fechaAlta = excelDateToISO(fechaAltaSerial);
          const activo = estado === 'A' ? 1 : 0;

          // Verificar si ya existe
          const existente = db.prepare('SELECT id FROM conductores WHERE dni = ?').get(dni) as { id: number } | undefined;

          if (existente) {
            // Actualizar
            db.prepare(`
              UPDATE conductores
              SET nombre = ?, apellidos = ?, licencia = ?, telefono = ?, activo = ?
              WHERE dni = ?
            `).run(nombre, apellidos, licencia || null, telefono || null, activo, dni);
            resultados.actualizados++;
          } else {
            // Insertar
            db.prepare(`
              INSERT INTO conductores (nombre, apellidos, dni, licencia, telefono, fecha_alta, activo)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(nombre, apellidos, dni, licencia || null, telefono || null, fechaAlta, activo);
            resultados.importados++;
          }
        } catch (err: any) {
          resultados.errores.push(`Fila ${i + 1}: ${err.message}`);
        }
      }

      res.json({
        message: 'Importación completada',
        ...resultados
      });
    } catch (error: any) {
      console.error('Error importando Excel:', error);
      res.status(500).json({ error: `Error importando archivo: ${error.message}` });
    }
  }
};
