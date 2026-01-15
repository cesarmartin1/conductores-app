import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { guardiasApi } from '../services/api';
import { ArrowLeft, ChevronLeft, ChevronRight, Shield, FileText, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Guardia {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  telefono: string | null;
  fecha_alta: string;
  activo: number;
}

interface JornadaGuardia {
  tipo: string;
  turno: string | null;
  horas: number;
}

interface ContratoGuardia {
  id: number;
  guardia_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_contrato: string;
  notas: string | null;
}

const PRECIO_DIA_GUARDIA = 36.67;

const TIPOS_CONFIG: { [key: string]: { label: string; short: string; color: string; bgColor: string } } = {
  trabajo: { label: 'Trabajo', short: 'T', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  vacaciones: { label: 'Vacaciones', short: 'V', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  baja: { label: 'Baja', short: 'B', color: 'text-red-700', bgColor: 'bg-red-100' },
  inactivo: { label: 'Inactivo', short: 'I', color: 'text-gray-700', bgColor: 'bg-gray-200' },
};

const TIPOS_CONTRATO = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'practicas', label: 'Practicas' },
  { value: 'formacion', label: 'Formacion' },
];

export default function GuardiaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [guardia, setGuardia] = useState<Guardia | null>(null);
  const [loading, setLoading] = useState(true);
  const [jornadas, setJornadas] = useState<{ [key: string]: JornadaGuardia }>({});
  const [contratos, setContratos] = useState<ContratoGuardia[]>([]);
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState<ContratoGuardia | null>(null);
  const [contratoForm, setContratoForm] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    tipo_contrato: 'indefinido',
    notas: '',
  });
  const [savingContrato, setSavingContrato] = useState(false);

  const hoy = new Date();
  const [mesReferencia, setMesReferencia] = useState(hoy.getMonth() + 1);
  const [añoReferencia, setAñoReferencia] = useState(hoy.getFullYear());

  // Calcular fechas del periodo
  const calcularPeriodo = () => {
    let mesInicio = mesReferencia - 1;
    let añoInicio = añoReferencia;
    if (mesInicio < 1) {
      mesInicio = 12;
      añoInicio--;
    }
    const desde = `${añoInicio}-${String(mesInicio).padStart(2, '0')}-26`;
    const hasta = `${añoReferencia}-${String(mesReferencia).padStart(2, '0')}-25`;
    return { desde, hasta, mesInicio, añoInicio };
  };

  const { desde, hasta, mesInicio, añoInicio } = calcularPeriodo();

  // Obtener dias del periodo
  const getDiasDelPeriodo = () => {
    const inicio = new Date(desde);
    const fin = new Date(hasta);
    const dias: Date[] = [];
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      dias.push(new Date(d));
    }
    return dias;
  };

  const dias = getDiasDelPeriodo();

  useEffect(() => {
    if (id) {
      fetchGuardia();
      fetchContratos();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchJornadas();
    }
  }, [id, desde, hasta]);

  const fetchGuardia = async () => {
    try {
      const response = await guardiasApi.get(parseInt(id!));
      setGuardia(response.data);
    } catch (error) {
      console.error('Error cargando guardia:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJornadas = async () => {
    try {
      const response = await guardiasApi.getCuadrante(desde, hasta);
      // Filtrar solo las jornadas de este guardia
      const todasJornadas = response.data.jornadas;
      const misJornadas: { [key: string]: JornadaGuardia } = {};
      Object.keys(todasJornadas).forEach(key => {
        if (key.startsWith(`${id}-`)) {
          const fecha = key.replace(`${id}-`, '');
          misJornadas[fecha] = todasJornadas[key];
        }
      });
      setJornadas(misJornadas);
    } catch (error) {
      console.error('Error cargando jornadas:', error);
    }
  };

  const fetchContratos = async () => {
    try {
      const response = await guardiasApi.listContratos(parseInt(id!));
      setContratos(response.data);
    } catch (error) {
      console.error('Error cargando contratos:', error);
    }
  };

  const openNewContratoForm = () => {
    setEditingContrato(null);
    setContratoForm({
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      tipo_contrato: 'indefinido',
      notas: '',
    });
    setShowContratoForm(true);
  };

  const openEditContratoForm = (contrato: ContratoGuardia) => {
    setEditingContrato(contrato);
    setContratoForm({
      fecha_inicio: contrato.fecha_inicio,
      fecha_fin: contrato.fecha_fin || '',
      tipo_contrato: contrato.tipo_contrato,
      notas: contrato.notas || '',
    });
    setShowContratoForm(true);
  };

  const handleSaveContrato = async () => {
    setSavingContrato(true);
    try {
      const data = {
        ...contratoForm,
        fecha_fin: contratoForm.fecha_fin || null,
        notas: contratoForm.notas || null,
      };

      if (editingContrato) {
        await guardiasApi.updateContrato(editingContrato.id, data);
      } else {
        await guardiasApi.createContrato(parseInt(id!), data);
      }

      setShowContratoForm(false);
      fetchContratos();
    } catch (error) {
      console.error('Error guardando contrato:', error);
      alert('Error al guardar el contrato');
    } finally {
      setSavingContrato(false);
    }
  };

  const handleDeleteContrato = async (contratoId: number) => {
    if (!confirm('¿Eliminar este contrato?')) return;
    try {
      await guardiasApi.deleteContrato(contratoId);
      fetchContratos();
    } catch (error) {
      console.error('Error eliminando contrato:', error);
    }
  };

  const esContratoActivo = (contrato: ContratoGuardia): boolean => {
    const hoyStr = new Date().toISOString().split('T')[0];
    return contrato.fecha_inicio <= hoyStr && (!contrato.fecha_fin || contrato.fecha_fin >= hoyStr);
  };

  const cambiarPeriodo = (delta: number) => {
    let nuevoMes = mesReferencia + delta;
    let nuevoAño = añoReferencia;
    if (nuevoMes > 12) {
      nuevoMes = 1;
      nuevoAño++;
    } else if (nuevoMes < 1) {
      nuevoMes = 12;
      nuevoAño--;
    }
    setMesReferencia(nuevoMes);
    setAñoReferencia(nuevoAño);
  };

  const getNombrePeriodo = () => {
    const mesInicioNombre = new Date(añoInicio, mesInicio - 1).toLocaleDateString('es-ES', { month: 'long' });
    const mesFinNombre = new Date(añoReferencia, mesReferencia - 1).toLocaleDateString('es-ES', { month: 'long' });
    return `26 ${mesInicioNombre} - 25 ${mesFinNombre} ${añoReferencia}`;
  };

  const formatFecha = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const estaActivo = (fecha: string): boolean => {
    if (!guardia) return false;
    // Si no tiene contratos, usar fecha_alta como fallback
    if (contratos.length === 0) {
      return fecha >= guardia.fecha_alta;
    }
    // Verificar si algún contrato cubre la fecha
    return contratos.some(c =>
      c.fecha_inicio <= fecha && (!c.fecha_fin || c.fecha_fin >= fecha)
    );
  };

  const esDomingo = (date: Date): boolean => date.getDay() === 0;
  const esSabado = (date: Date): boolean => date.getDay() === 6;

  // Calcular resumen
  const calcularResumen = () => {
    let diasTrabajados = 0;
    let diasVacaciones = 0;
    let diasBaja = 0;

    dias.forEach(dia => {
      const fecha = formatFecha(dia);
      if (!estaActivo(fecha)) return;

      const jornada = jornadas[fecha];
      if (jornada?.tipo === 'trabajo') {
        diasTrabajados++;
      } else if (jornada?.tipo === 'vacaciones') {
        diasVacaciones++;
      } else if (jornada?.tipo === 'baja') {
        diasBaja++;
      }
    });

    return {
      diasTrabajados,
      diasVacaciones,
      diasBaja,
      totalEuros: diasTrabajados * PRECIO_DIA_GUARDIA
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!guardia) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Guardia no encontrado</p>
        <Link to="/cuadrante-guardias" className="text-primary-600 hover:underline mt-4 inline-block">
          Volver al cuadrante
        </Link>
      </div>
    );
  }

  const resumen = calcularResumen();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/cuadrante-guardias"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {guardia.nombre} {guardia.apellidos}
            </h1>
            <p className="text-sm text-gray-500">Guardia de Trafico</p>
          </div>
        </div>
        <span className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
          guardia.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {guardia.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Info basica */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacion Personal</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">DNI</p>
            <p className="font-medium">{guardia.dni}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Telefono</p>
            <p className="font-medium">{guardia.telefono || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fecha de Alta</p>
            <p className="font-medium">{new Date(guardia.fecha_alta).toLocaleDateString('es-ES')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estado</p>
            <p className="font-medium">{guardia.activo ? 'Activo' : 'Inactivo'}</p>
          </div>
        </div>
      </div>

      {/* Contratos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Contratos</h2>
          </div>
          {isAdmin && (
            <button
              onClick={openNewContratoForm}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Contrato
            </button>
          )}
        </div>

        {contratos.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay contratos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Inicio</th>
                  <th className="pb-2 font-medium">Fin</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Notas</th>
                  {isAdmin && <th className="pb-2 font-medium w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {contratos.map((contrato) => {
                  const activo = esContratoActivo(contrato);
                  return (
                    <tr key={contrato.id} className="hover:bg-gray-50">
                      <td className="py-2">{contrato.fecha_inicio}</td>
                      <td className="py-2">
                        <span className={contrato.fecha_fin ? '' : 'text-gray-400'}>
                          {contrato.fecha_fin || 'Indefinido'}
                        </span>
                      </td>
                      <td className="py-2">
                        {TIPOS_CONTRATO.find(t => t.value === contrato.tipo_contrato)?.label || contrato.tipo_contrato}
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {activo ? 'Activo' : 'Finalizado'}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 text-xs max-w-[200px] truncate">
                        {contrato.notas || '-'}
                      </td>
                      {isAdmin && (
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditContratoForm(contrato)}
                              className="p-1 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContrato(contrato.id)}
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen del periodo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Resumen del Periodo</h2>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2">
            <button onClick={() => cambiarPeriodo(-1)} className="p-2 hover:bg-gray-200 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[220px] text-center">
              {getNombrePeriodo()}
            </span>
            <button onClick={() => cambiarPeriodo(1)} className="p-2 hover:bg-gray-200 rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{resumen.diasTrabajados}</p>
            <p className="text-sm text-blue-600">Dias Trabajados</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-orange-700">{resumen.diasVacaciones}</p>
            <p className="text-sm text-orange-600">Vacaciones</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{resumen.diasBaja}</p>
            <p className="text-sm text-red-600">Baja</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{resumen.totalEuros.toFixed(2)}</p>
            <p className="text-sm text-green-600">Total EUR</p>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Calendario del Periodo</h2>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {Object.entries(TIPOS_CONFIG).map(([key, config]) => (
            <div key={key} className={`px-2 py-1 rounded ${config.bgColor} ${config.color}`}>
              {config.short} = {config.label}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-1">
          {/* Header dias de la semana */}
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(dia => (
            <div key={dia} className="text-center text-xs font-medium text-gray-500 py-2">
              {dia}
            </div>
          ))}

          {/* Dias del periodo agrupados por semana */}
          {(() => {
            const semanas: Date[][] = [];
            let semanaActual: Date[] = [];

            dias.forEach((dia, index) => {
              const diaSemana = dia.getDay();

              // Si es el primer dia y no es lunes, añadir espacios vacios
              if (index === 0 && diaSemana !== 1) {
                const espacios = diaSemana === 0 ? 6 : diaSemana - 1;
                for (let i = 0; i < espacios; i++) {
                  semanaActual.push(null as any);
                }
              }

              semanaActual.push(dia);

              // Si es domingo o ultimo dia, cerrar semana
              if (diaSemana === 0 || index === dias.length - 1) {
                // Rellenar hasta domingo si es necesario
                while (semanaActual.length < 7) {
                  semanaActual.push(null as any);
                }
                semanas.push(semanaActual);
                semanaActual = [];
              }
            });

            return semanas.flat().map((dia, index) => {
              if (!dia) {
                return <div key={`empty-${index}`} className="h-10" />;
              }

              const fecha = formatFecha(dia);
              const activo = estaActivo(fecha);
              const jornada = jornadas[fecha];
              const tipo = activo ? jornada?.tipo : 'inactivo';
              const config = tipo ? TIPOS_CONFIG[tipo] : null;
              const domingo = esDomingo(dia);
              const sabado = esSabado(dia);

              return (
                <div
                  key={fecha}
                  className={`h-10 rounded flex items-center justify-center text-xs font-medium ${
                    config ? `${config.bgColor} ${config.color}` :
                    domingo ? 'bg-red-50 text-red-400' :
                    sabado ? 'bg-gray-50 text-gray-400' :
                    'bg-gray-50 text-gray-600'
                  } ${!activo ? 'opacity-50' : ''}`}
                  title={`${dia.toLocaleDateString('es-ES')}${config ? ` - ${config.label}` : ''}`}
                >
                  <span className="text-[10px]">{dia.getDate()}</span>
                  {config && <span className="ml-0.5 text-[9px] font-bold">{config.short}</span>}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Modal Contrato Form */}
      {showContratoForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingContrato ? 'Editar Contrato' : 'Nuevo Contrato'}
              </h2>
              <button
                onClick={() => setShowContratoForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                  <input
                    type="date"
                    value={contratoForm.fecha_inicio}
                    onChange={(e) => setContratoForm({ ...contratoForm, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={contratoForm.fecha_fin}
                    onChange={(e) => setContratoForm({ ...contratoForm, fecha_fin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Tipo Contrato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Contrato</label>
                <select
                  value={contratoForm.tipo_contrato}
                  onChange={(e) => setContratoForm({ ...contratoForm, tipo_contrato: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {TIPOS_CONTRATO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={contratoForm.notas}
                  onChange={(e) => setContratoForm({ ...contratoForm, notas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowContratoForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveContrato}
                  disabled={savingContrato || !contratoForm.fecha_inicio}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingContrato ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
