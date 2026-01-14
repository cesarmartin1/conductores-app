import bcrypt from 'bcryptjs';
import { initDatabase, getDb } from './models/database';

async function seed() {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  // Inicializar base de datos
  await initDatabase();
  const db = getDb();

  // 1. Crear usuario admin
  console.log('👤 Creando usuario admin...');
  const adminPassword = await bcrypt.hash('admin123', 10);

  try {
    const existingAdmin = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@conductores.app');
    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO usuarios (email, password, nombre, rol)
        VALUES (?, ?, ?, ?)
      `).run('admin@conductores.app', adminPassword, 'Administrador', 'admin');
      console.log('   ✓ Usuario admin creado (admin@conductores.app / admin123)');
    } else {
      console.log('   - Usuario admin ya existe');
    }
  } catch (e) {
    console.log('   - Error creando admin:', e);
  }

  // 2. Crear conductores de ejemplo
  console.log('\n🚗 Creando conductores de ejemplo...');
  const conductores = [
    { nombre: 'Juan', apellidos: 'García López', dni: '12345678A', licencia: 'C+E', telefono: '600111222', fecha_alta: '2023-01-15' },
    { nombre: 'María', apellidos: 'Martínez Ruiz', dni: '23456789B', licencia: 'C+E', telefono: '600222333', fecha_alta: '2023-03-01' },
    { nombre: 'Pedro', apellidos: 'Sánchez Fernández', dni: '34567890C', licencia: 'C+E', telefono: '600333444', fecha_alta: '2023-06-10' },
    { nombre: 'Ana', apellidos: 'López García', dni: '45678901D', licencia: 'C', telefono: '600444555', fecha_alta: '2024-01-08' },
    { nombre: 'Carlos', apellidos: 'Rodríguez Pérez', dni: '56789012E', licencia: 'C+E', telefono: '600555666', fecha_alta: '2024-03-15' },
  ];

  for (const c of conductores) {
    try {
      const existing = db.prepare('SELECT id FROM conductores WHERE dni = ?').get(c.dni);
      if (!existing) {
        db.prepare(`
          INSERT INTO conductores (nombre, apellidos, dni, licencia, telefono, fecha_alta)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(c.nombre, c.apellidos, c.dni, c.licencia, c.telefono, c.fecha_alta);
        console.log(`   ✓ ${c.nombre} ${c.apellidos}`);
      } else {
        console.log(`   - ${c.nombre} ${c.apellidos} ya existe`);
      }
    } catch (e) {
      console.log(`   - Error creando ${c.nombre}:`, e);
    }
  }

  // 3. Crear usuarios para conductores
  console.log('\n👥 Creando usuarios para conductores...');
  const conductoresDB = db.prepare('SELECT * FROM conductores').all() as any[];
  const conductorPassword = await bcrypt.hash('conductor123', 10);

  for (const c of conductoresDB) {
    const email = `${c.nombre.toLowerCase()}.${c.apellidos.split(' ')[0].toLowerCase()}@conductores.app`;
    try {
      const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
      if (!existing) {
        db.prepare(`
          INSERT INTO usuarios (email, password, nombre, rol, conductor_id)
          VALUES (?, ?, ?, 'conductor', ?)
        `).run(email, conductorPassword, `${c.nombre} ${c.apellidos}`, c.id);
        console.log(`   ✓ ${email}`);
      } else {
        console.log(`   - ${email} ya existe`);
      }
    } catch (e) {
      console.log(`   - Error creando ${email}:`, e);
    }
  }

  // 4. Crear usuario supervisor
  console.log('\n👔 Creando usuario supervisor...');
  const supervisorPassword = await bcrypt.hash('supervisor123', 10);
  try {
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('supervisor@conductores.app');
    if (!existing) {
      db.prepare(`
        INSERT INTO usuarios (email, password, nombre, rol)
        VALUES (?, ?, ?, ?)
      `).run('supervisor@conductores.app', supervisorPassword, 'Supervisor', 'supervisor');
      console.log('   ✓ Usuario supervisor creado (supervisor@conductores.app / supervisor123)');
    } else {
      console.log('   - Usuario supervisor ya existe');
    }
  } catch (e) {
    console.log('   - Error creando supervisor:', e);
  }

  // 5. Inicializar festivos nacionales
  console.log('\n📅 Inicializando festivos nacionales...');
  const festivosFijos = [
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

  const años = [2024, 2025, 2026];
  for (const año of años) {
    let count = 0;
    for (const f of festivosFijos) {
      const fecha = `${año}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;
      try {
        const existing = db.prepare('SELECT id FROM festivos WHERE fecha = ? AND ambito = ?').get(fecha, 'nacional');
        if (!existing) {
          db.prepare(`
            INSERT INTO festivos (fecha, nombre, ambito, año)
            VALUES (?, ?, 'nacional', ?)
          `).run(fecha, f.nombre, año);
          count++;
        }
      } catch (e) {
        // Ignorar duplicados
      }
    }
    console.log(`   ✓ ${año}: ${count} festivos añadidos`);
  }

  console.log('\n✅ Seed completado!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CREDENCIALES DE ACCESO:');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Admin:      admin@conductores.app / admin123');
  console.log('  Supervisor: supervisor@conductores.app / supervisor123');
  console.log('  Conductores: [nombre].[apellido]@conductores.app / conductor123');
  console.log('═══════════════════════════════════════════════════════\n');
}

seed().catch(console.error);
