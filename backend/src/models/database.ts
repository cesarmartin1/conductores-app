import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/conductores.db');

let db: SqlJsDatabase;

// Wrapper para compatibilidad con mejor API
class DatabaseWrapper {
  private db: SqlJsDatabase;
  private dbPath: string;

  constructor(database: SqlJsDatabase, filePath: string) {
    this.db = database;
    this.dbPath = filePath;
  }

  prepare(sql: string) {
    const self = this;
    return {
      run(...params: any[]) {
        self.db.run(sql, params);
        self.save();
        return {
          changes: self.db.getRowsModified(),
          lastInsertRowid: self.getLastInsertRowId()
        };
      },
      get(...params: any[]) {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params: any[]) {
        const results: any[] = [];
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql: string) {
    this.db.exec(sql);
    this.save();
  }

  pragma(sql: string) {
    this.db.exec(`PRAGMA ${sql}`);
  }

  private getLastInsertRowId(): number {
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number;
    }
    return 0;
  }

  private save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }
}

let wrapper: DatabaseWrapper;

export async function initDatabase(): Promise<DatabaseWrapper> {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs();

  // Cargar base de datos existente o crear nueva
  let database: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  wrapper = new DatabaseWrapper(database, dbPath);

  // Habilitar foreign keys
  wrapper.pragma('foreign_keys = ON');

  // Crear tablas
  wrapper.exec(`
    -- Usuarios del sistema
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'supervisor', 'conductor')),
      conductor_id INTEGER,
      microsoft_id TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conductor_id) REFERENCES conductores(id)
    );

    -- Conductores
    CREATE TABLE IF NOT EXISTS conductores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL,
      licencia TEXT,
      telefono TEXT,
      fecha_alta TEXT NOT NULL,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Jornadas de trabajo
    CREATE TABLE IF NOT EXISTS jornadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conductor_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('trabajo', 'descanso_normal', 'descanso_reducido', 'festivo', 'vacaciones', 'baja', 'formacion', 'inactivo')),
      horas_conduccion REAL DEFAULT 0,
      horas_trabajo REAL DEFAULT 0,
      pausas_minutos INTEGER DEFAULT 0,
      descanso_nocturno REAL DEFAULT 0,
      notas TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conductor_id) REFERENCES conductores(id),
      UNIQUE(conductor_id, fecha)
    );

    -- Festivos
    CREATE TABLE IF NOT EXISTS festivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      nombre TEXT NOT NULL,
      ambito TEXT NOT NULL CHECK (ambito IN ('nacional', 'autonomico', 'local')),
      comunidad TEXT,
      año INTEGER NOT NULL,
      UNIQUE(fecha, ambito, comunidad)
    );

    -- Alertas de cumplimiento
    CREATE TABLE IF NOT EXISTS alertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conductor_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      fecha TEXT NOT NULL,
      leida INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conductor_id) REFERENCES conductores(id)
    );

    -- Configuracion del sistema
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT
    );

    -- Descansos compensatorios pendientes
    CREATE TABLE IF NOT EXISTS compensatorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conductor_id INTEGER NOT NULL,
      semana_origen TEXT NOT NULL,
      dias_pendientes INTEGER NOT NULL,
      fecha_limite TEXT NOT NULL,
      compensado INTEGER DEFAULT 0,
      fecha_compensacion TEXT,
      pagado INTEGER DEFAULT 0,
      importe_pagado REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conductor_id) REFERENCES conductores(id)
    );

    -- Indices para acelerar consultas
    CREATE INDEX IF NOT EXISTS idx_jornadas_conductor_fecha ON jornadas(conductor_id, fecha);
    CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON festivos(fecha);
    CREATE INDEX IF NOT EXISTS idx_festivos_año ON festivos(año);
    CREATE INDEX IF NOT EXISTS idx_alertas_conductor ON alertas(conductor_id);
    CREATE INDEX IF NOT EXISTS idx_compensatorios_conductor ON compensatorios(conductor_id);
  `);

  // Insertar configuración por defecto
  try {
    wrapper.exec(`
      INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
        ('importe_domingo_festivo', '50', 'Importe a pagar por trabajar domingo o festivo nacional'),
        ('importe_compensatorio_no_disfrutado', '100', 'Importe a pagar por día compensatorio no disfrutado'),
        ('semanas_limite_compensatorio', '14', 'Semanas límite para disfrutar descanso compensatorio')
    `);
  } catch (e) {
    // Ya existen, ignorar
  }

  // Migración: añadir columna microsoft_id si no existe
  try {
    wrapper.exec(`ALTER TABLE usuarios ADD COLUMN microsoft_id TEXT`);
  } catch (e) {
    // La columna ya existe, ignorar el error
  }

  return wrapper;
}

// Para compatibilidad, exportamos una promesa que se resuelve con el wrapper
let dbPromise: Promise<DatabaseWrapper> | null = null;

export function getDb(): DatabaseWrapper {
  if (!wrapper) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return wrapper;
}

export default {
  get instance() {
    return getDb();
  },
  prepare(sql: string) {
    return getDb().prepare(sql);
  },
  exec(sql: string) {
    return getDb().exec(sql);
  },
  pragma(sql: string) {
    return getDb().pragma(sql);
  }
};

// Tipos TypeScript
export interface Usuario {
  id: number;
  email: string;
  password: string;
  nombre: string;
  rol: 'admin' | 'supervisor' | 'conductor';
  conductor_id: number | null;
  microsoft_id: string | null;
  activo: number;
  created_at: string;
}

export interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  licencia: string | null;
  telefono: string | null;
  fecha_alta: string;
  activo: number;
  created_at: string;
}

export type TipoJornada = 'trabajo' | 'descanso_normal' | 'descanso_reducido' | 'festivo' | 'vacaciones' | 'baja' | 'formacion' | 'inactivo';

export interface Jornada {
  id: number;
  conductor_id: number;
  fecha: string;
  tipo: TipoJornada;
  horas_conduccion: number;
  horas_trabajo: number;
  pausas_minutos: number;
  descanso_nocturno: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Festivo {
  id: number;
  fecha: string;
  nombre: string;
  ambito: 'nacional' | 'autonomico' | 'local';
  comunidad: string | null;
  año: number;
}

export interface Alerta {
  id: number;
  conductor_id: number;
  tipo: string;
  mensaje: string;
  fecha: string;
  leida: number;
  created_at: string;
}
