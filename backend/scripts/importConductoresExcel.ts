import XLSX from 'xlsx';
import { initDatabase, getDb } from '../src/models/database';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: tsx scripts/importConductoresExcel.ts /ruta/Conductores.xlsx');
    process.exit(1);
  }

  await initDatabase();
  const db = getDb();

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const excelDateToISO = (serial: number): string => {
    if (!serial || typeof serial !== 'number') return new Date().toISOString().split('T')[0];
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().split('T')[0];
  };

  const separarNombre = (nombreCompleto: string): { nombre: string; apellidos: string } => {
    if (!nombreCompleto) return { nombre: '', apellidos: '' };
    const partes = nombreCompleto.trim().split(' ');
    if (partes.length === 1) return { nombre: partes[0], apellidos: '' };
    return { nombre: partes[0], apellidos: partes.slice(1).join(' ') };
  };

  const resultados = { importados: 0, actualizados: 0, errores: [] as string[] };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const dni = row[1]?.toString()?.trim();
      const nombreCompleto = row[4]?.toString()?.trim();
      const telefono = row[12]?.toString()?.trim() || row[11]?.toString()?.trim() || row[13]?.toString()?.trim();
      const licencia = row[16]?.toString()?.trim();
      const fechaAltaSerial = row[18];
      const estado = row[20]?.toString()?.trim();

      if (!dni || !nombreCompleto) {
        resultados.errores.push(`Fila ${i + 1}: DNI o nombre vacío`);
        continue;
      }

      const { nombre, apellidos } = separarNombre(nombreCompleto);
      const fechaAlta = excelDateToISO(fechaAltaSerial);
      const activo = estado === 'A' ? 1 : 0;

      const existente = db.prepare('SELECT id FROM conductores WHERE dni = ?').get(dni) as { id: number } | undefined;
      if (existente) {
        db.prepare(`
          UPDATE conductores
          SET nombre = ?, apellidos = ?, licencia = ?, telefono = ?, activo = ?
          WHERE dni = ?
        `).run(nombre, apellidos, licencia || null, telefono || null, activo, dni);
        resultados.actualizados++;
      } else {
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

  console.log('Importación completada:', resultados);
}

main().catch((err) => {
  console.error('Error importando Excel:', err);
  process.exit(1);
});
