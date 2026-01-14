import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { conductoresApi, informesApi } from '../services/api';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
}

interface InformeMensual {
  conductor: {
    id: number;
    nombre: string;
    apellidos: string;
    dni: string;
  };
  periodo: {
    año: string;
    mes: string;
  };
  calendario: Array<{
    fecha: string;
    estado: string;
    jornada: {
      tipo: string;
      horas_conduccion: number;
      horas_trabajo: number;
    } | null;
  }>;
  resumen: {
    diasTrabajados: number;
    diasDescanso: number;
    diasFestivo: number;
    diasVacaciones: number;
    diasBaja: number;
    horasConduccion: number;
    horasTrabajo: number;
  };
  alertas: Array<{
    tipo: string;
    mensaje: string;
    fecha: string;
  }>;
}

export default function Informes() {
  const { user, isConductor } = useAuth();
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [conductorId, setConductorId] = useState<number | null>(
    isConductor ? user?.conductorId || null : null
  );
  const [año, setAño] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [informe, setInforme] = useState<InformeMensual | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConductor) {
      fetchConductores();
    }
  }, [isConductor]);

  const fetchConductores = async () => {
    try {
      const response = await conductoresApi.list(true);
      setConductores(response.data);
    } catch (error) {
      console.error('Error cargando conductores:', error);
    }
  };

  const generarInforme = async () => {
    if (!conductorId) return;
    setLoading(true);
    try {
      const response = await informesApi.getMensual(conductorId, año, mes);
      setInforme(response.data);
    } catch (error) {
      console.error('Error generando informe:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = () => {
    if (!informe) return;

    const doc = new jsPDF();
    const nombreMes = new Date(año, mes - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // Título
    doc.setFontSize(18);
    doc.text('Informe Mensual de Conductor', 14, 20);

    // Datos del conductor
    doc.setFontSize(12);
    doc.text(`Conductor: ${informe.conductor.nombre} ${informe.conductor.apellidos}`, 14, 35);
    doc.text(`DNI: ${informe.conductor.dni}`, 14, 42);
    doc.text(`Período: ${nombreMes}`, 14, 49);

    // Resumen
    doc.setFontSize(14);
    doc.text('Resumen', 14, 65);

    autoTable(doc, {
      startY: 70,
      head: [['Concepto', 'Valor']],
      body: [
        ['Días trabajados', informe.resumen.diasTrabajados.toString()],
        ['Días descanso', informe.resumen.diasDescanso.toString()],
        ['Días festivo', informe.resumen.diasFestivo.toString()],
        ['Días vacaciones', informe.resumen.diasVacaciones.toString()],
        ['Días baja', informe.resumen.diasBaja.toString()],
        ['Horas conducción', `${informe.resumen.horasConduccion.toFixed(1)}h`],
        ['Horas trabajo', `${informe.resumen.horasTrabajo.toFixed(1)}h`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    // Detalle diario
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Detalle diario', 14, finalY);

    const jornadasTrabajo = informe.calendario.filter(d => d.jornada?.tipo === 'trabajo');

    if (jornadasTrabajo.length > 0) {
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Fecha', 'H. Conducción', 'H. Trabajo']],
        body: jornadasTrabajo.map(d => [
          new Date(d.fecha).toLocaleDateString('es-ES'),
          `${d.jornada?.horas_conduccion || 0}h`,
          `${d.jornada?.horas_trabajo || 0}h`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    // Alertas
    if (informe.alertas.length > 0) {
      const alertasY = (doc as any).lastAutoTable?.finalY + 15 || finalY + 50;
      doc.setFontSize(14);
      doc.text('Alertas CE 561/2006', 14, alertasY);

      autoTable(doc, {
        startY: alertasY + 5,
        head: [['Fecha', 'Mensaje']],
        body: informe.alertas.map(a => [a.fecha, a.mensaje]),
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] },
      });
    }

    // Pie de página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(
        `Generado el ${new Date().toLocaleDateString('es-ES')} - Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`informe_${informe.conductor.apellidos}_${año}_${mes}.pdf`);
  };

  const exportarExcel = () => {
    if (!informe) return;

    // Hoja de resumen
    const resumenData = [
      ['Informe Mensual de Conductor'],
      [],
      ['Conductor', `${informe.conductor.nombre} ${informe.conductor.apellidos}`],
      ['DNI', informe.conductor.dni],
      ['Año', año],
      ['Mes', mes],
      [],
      ['RESUMEN'],
      ['Días trabajados', informe.resumen.diasTrabajados],
      ['Días descanso', informe.resumen.diasDescanso],
      ['Días festivo', informe.resumen.diasFestivo],
      ['Días vacaciones', informe.resumen.diasVacaciones],
      ['Días baja', informe.resumen.diasBaja],
      ['Horas conducción', informe.resumen.horasConduccion],
      ['Horas trabajo', informe.resumen.horasTrabajo],
    ];

    // Hoja de detalle
    const detalleData = [
      ['Fecha', 'Tipo', 'H. Conducción', 'H. Trabajo'],
      ...informe.calendario
        .filter(d => d.jornada)
        .map(d => [
          d.fecha,
          d.jornada?.tipo || '',
          d.jornada?.horas_conduccion || 0,
          d.jornada?.horas_trabajo || 0,
        ]),
    ];

    // Hoja de alertas
    const alertasData = [
      ['Fecha', 'Tipo', 'Mensaje'],
      ...informe.alertas.map(a => [a.fecha, a.tipo, a.mensaje]),
    ];

    const wb = XLSX.utils.book_new();
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
    const wsAlertas = XLSX.utils.aoa_to_sheet(alertasData);

    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');
    XLSX.utils.book_append_sheet(wb, wsAlertas, 'Alertas');

    XLSX.writeFile(wb, `informe_${informe.conductor.apellidos}_${año}_${mes}.xlsx`);
  };

  const nombreMes = new Date(año, mes - 1).toLocaleDateString('es-ES', { month: 'long' });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Informes</h1>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {!isConductor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conductor</label>
              <select
                value={conductorId || ''}
                onChange={(e) => setConductorId(e.target.value ? parseInt(e.target.value) : null)}
                className="input"
              >
                <option value="">Seleccionar conductor</option>
                {conductores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellidos}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <select value={año} onChange={(e) => setAño(parseInt(e.target.value))} className="input">
              {[2024, 2025, 2026].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))} className="input">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={generarInforme}
            disabled={!conductorId || loading}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            {loading ? 'Generando...' : 'Generar informe'}
          </button>
        </div>
      </div>

      {/* Informe */}
      {informe && (
        <div className="space-y-6">
          {/* Header con exportación */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {informe.conductor.nombre} {informe.conductor.apellidos}
                </h2>
                <p className="text-gray-500 capitalize">{nombreMes} {año}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={exportarPDF} className="btn-secondary flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button onClick={exportarExcel} className="btn-secondary flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen del mes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{informe.resumen.diasTrabajados}</p>
                <p className="text-sm text-blue-600">Trabajo</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{informe.resumen.diasDescanso}</p>
                <p className="text-sm text-green-600">Descanso</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-700">{informe.resumen.diasFestivo}</p>
                <p className="text-sm text-purple-600">Festivo</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">{informe.resumen.diasVacaciones}</p>
                <p className="text-sm text-yellow-600">Vacaciones</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{informe.resumen.diasBaja}</p>
                <p className="text-sm text-red-600">Baja</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{informe.resumen.horasConduccion.toFixed(1)}h</p>
                <p className="text-sm text-gray-600">Conducción</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{informe.resumen.horasTrabajo.toFixed(1)}h</p>
                <p className="text-sm text-gray-600">Trabajo</p>
              </div>
            </div>
          </div>

          {/* Alertas */}
          {informe.alertas.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Alertas CE 561/2006 ({informe.alertas.length})
              </h3>
              <div className="space-y-2">
                {informe.alertas.map((alerta, i) => (
                  <div key={i} className="p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-800">{alerta.mensaje}</span>
                      <span className="text-xs text-red-600">{alerta.fecha}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalle de jornadas */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalle de jornadas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">H. Conducción</th>
                    <th className="pb-2 font-medium">H. Trabajo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {informe.calendario
                    .filter(d => d.jornada)
                    .map((dia) => (
                      <tr key={dia.fecha} className="hover:bg-gray-50">
                        <td className="py-2">
                          {new Date(dia.fecha).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-2 capitalize">{dia.jornada?.tipo}</td>
                        <td className="py-2">{dia.jornada?.horas_conduccion || '-'}h</td>
                        <td className="py-2">{dia.jornada?.horas_trabajo || '-'}h</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!informe && !loading && (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Selecciona un conductor y período para generar el informe</p>
        </div>
      )}
    </div>
  );
}
