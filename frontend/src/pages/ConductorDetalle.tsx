import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { conductoresApi, contratosApi } from '../services/api';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, AlertTriangle, Plus, Edit2, Trash2, FileText } from 'lucide-react';
import Calendar from '../components/Calendar';
import { useAuth } from '../context/AuthContext';

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
  apodo?: string | null;
  dni: string;
  licencia: string;
  telefono: string;
  fecha_alta: string;
  activo: number;
  porcentaje_jornada?: number | null;
  estadisticas?: {
    conduccionHoy: number;
    conduccionSemana: number;
    conduccionBisemanal: number;
    diasTrabajadosSemana: number;
    horasHastaLimiteDiario: number;
    horasHastaLimiteSemanal: number;
    proximoDescansoObligatorio: string;
  };
}

interface CalendarioDia {
  fecha: string;
  diaSemana: number;
  esFinde: boolean;
  festivo: { nombre: string } | null;
  jornada: {
    tipo: string;
    horas_conduccion: number;
    horas_trabajo: number;
  } | null;
  estado: string;
}

interface ResumenMensual {
  diasTrabajados: number;
  diasDescanso: number;
  diasFestivo: number;
  diasVacaciones: number;
  diasBaja: number;
  horasConduccion: number;
  horasTrabajo: number;
}

interface DescansosPendientes {
  diasTrabajadosConvenio: number;
  diasTrabajadosTacografo: number;
  diasFormacion: number;
  domingosTrabajados: number;
  festivosNacionalesTrabajados: number;
  diasDescansoTomados: number;
  diasVacaciones: number;
  descansosCorrespondientes: number;
  diasPendientes: number;
  porcentajeDescanso: number;
  detalle: {
    porDiasTrabajados: number;
    porDomingos: number;
    porFestivos: number;
  };
}

interface AlertaCE561 {
  tipo: 'error' | 'warning' | 'info';
  codigo: string;
  mensaje: string;
}

interface AlertasDescansoSemanal {
  diasConsecutivosTrabajados: number;
  diasHastaDescansoObligatorio: number;
  proximoDescansoRequerido: '24h' | '45h';
  ultimoDescansoSemanal: {
    fecha: string;
    tipo: 'normal' | 'reducido';
  } | null;
  alertas: AlertaCE561[];
}

interface Contrato {
  id: number;
  conductor_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_contrato: string;
  horas_semanales: number;
  porcentaje_jornada: number;
  por_horas: number;
  cobra_disponibilidad: number;
  notas: string | null;
}

const TIPOS_CONTRATO = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'practicas', label: 'Prácticas' },
  { value: 'formacion', label: 'Formación' },
];

export default function ConductorDetalle() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isConductor, user } = useAuth();
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [calendario, setCalendario] = useState<CalendarioDia[]>([]);
  const [resumen, setResumen] = useState<ResumenMensual | null>(null);
  const [descansosPendientes, setDescansosPendientes] = useState<DescansosPendientes | null>(null);
  const [alertasDescanso, setAlertasDescanso] = useState<AlertasDescansoSemanal | null>(null);
  const [loading, setLoading] = useState(true);
  const [año, setAño] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [apodoDraft, setApodoDraft] = useState('');
  const [apodoError, setApodoError] = useState('');
  const [apodoSaving, setApodoSaving] = useState(false);
  const [porcentajeDraft, setPorcentajeDraft] = useState(100);
  const [porcentajeError, setPorcentajeError] = useState('');
  const [porcentajeSaving, setPorcentajeSaving] = useState(false);

  // Contratos
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);

  const getContratoActivo = (lista: Contrato[]) => {
    const hoy = new Date().toISOString().split('T')[0];
    return lista.find(c => c.fecha_inicio <= hoy && (!c.fecha_fin || c.fecha_fin >= hoy)) || null;
  };

  useEffect(() => {
    fetchConductor();
    fetchContratos();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchCalendario();
    }
  }, [id, año, mes]);

  const fetchConductor = async () => {
    try {
      const response = await conductoresApi.get(parseInt(id!));
      setConductor(response.data);
      setApodoDraft(response.data.apodo || '');
    } catch (error) {
      console.error('Error cargando conductor:', error);
    }
  };

  const fetchContratos = async () => {
    try {
      const response = await contratosApi.list(parseInt(id!));
      setContratos(response.data);
      const contratoActivo = getContratoActivo(response.data);
      setPorcentajeDraft(contratoActivo?.porcentaje_jornada ?? conductor?.porcentaje_jornada ?? 100);
    } catch (error) {
      console.error('Error cargando contratos:', error);
    }
  };

  const handleDeleteContrato = async (contratoId: number) => {
    if (!confirm('¿Estás seguro de eliminar este contrato?')) return;
    try {
      await contratosApi.delete(contratoId);
      fetchContratos();
    } catch (error) {
      console.error('Error eliminando contrato:', error);
    }
  };

  const fetchCalendario = async () => {
    setLoading(true);
    try {
      const response = await conductoresApi.getCalendario(parseInt(id!), año, mes);
      setCalendario(response.data.calendario);
      setResumen(response.data.resumen);
      setDescansosPendientes(response.data.descansosPendientes);
      setAlertasDescanso(response.data.alertasDescanso);
    } catch (error) {
      console.error('Error cargando calendario:', error);
    } finally {
      setLoading(false);
    }
  };

  const cambiarMes = (delta: number) => {
    let nuevoMes = mes + delta;
    let nuevoAño = año;

    if (nuevoMes > 12) {
      nuevoMes = 1;
      nuevoAño++;
    } else if (nuevoMes < 1) {
      nuevoMes = 12;
      nuevoAño--;
    }

    setMes(nuevoMes);
    setAño(nuevoAño);
  };

  const nombreMes = new Date(año, mes - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  if (!conductor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const canEditApodo = isAdmin || (isConductor && user?.conductorId === conductor.id);
  const apodoActual = conductor.apodo || '';
  const apodoNormalizado = apodoDraft.trim();
  const apodoSinCambios = apodoNormalizado === apodoActual;
  const contratoActivo = getContratoActivo(contratos);
  const porcentajeActual = contratoActivo?.porcentaje_jornada ?? conductor.porcentaje_jornada ?? 100;
  const porcentajeSinCambios = porcentajeDraft === porcentajeActual;

  const handleSaveApodo = async () => {
    if (apodoSaving || apodoSinCambios) return;
    setApodoError('');
    setApodoSaving(true);
    try {
      const response = await conductoresApi.updateApodo(conductor.id, apodoNormalizado);
      setConductor(response.data);
      setApodoDraft(response.data.apodo || '');
    } catch (error: any) {
      setApodoError(error.response?.data?.error || 'No se pudo guardar el apodo');
    } finally {
      setApodoSaving(false);
    }
  };

  const handleSavePorcentaje = async () => {
    if (porcentajeSaving || porcentajeSinCambios) return;
    setPorcentajeError('');
    setPorcentajeSaving(true);
    try {
      if (contratoActivo) {
        const response = await contratosApi.update(contratoActivo.id, { porcentaje_jornada: porcentajeDraft });
        const updated = contratos.map(c => c.id === contratoActivo.id ? response.data : c);
        setContratos(updated);
        setPorcentajeDraft(response.data.porcentaje_jornada ?? porcentajeDraft);
      } else {
        const response = await conductoresApi.update(conductor.id, { porcentaje_jornada: porcentajeDraft });
        setConductor(response.data);
        setPorcentajeDraft(response.data.porcentaje_jornada ?? 100);
      }
    } catch (error: any) {
      setPorcentajeError(error.response?.data?.error || 'No se pudo guardar el porcentaje');
    } finally {
      setPorcentajeSaving(false);
    }
  };

  const nombreMostrado = conductor.apodo || `${conductor.nombre} ${conductor.apellidos}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/conductores" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {nombreMostrado}
          </h1>
          <p className="text-gray-500">
            DNI: {conductor.dni} | Licencia: {conductor.licencia || 'N/A'}
          </p>
          {porcentajeActual < 100 && (
            <p className="text-gray-500">
              Jornada: {porcentajeActual}% ({((porcentajeActual || 0) * 8 / 100).toFixed(2)} h/dia)
            </p>
          )}
          {canEditApodo && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={apodoDraft}
                  onChange={(e) => setApodoDraft(e.target.value)}
                  className="input h-9 max-w-xs"
                  placeholder="Apodo"
                />
                <button
                  type="button"
                  onClick={handleSaveApodo}
                  disabled={apodoSaving || apodoSinCambios}
                  className="btn-secondary h-9"
                >
                  {apodoSaving ? 'Guardando...' : 'Guardar apodo'}
                </button>
              </div>
              {apodoError && (
                <p className="text-sm text-red-600 mt-2">{apodoError}</p>
              )}
            </div>
          )}
          {isAdmin && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={porcentajeDraft}
                  onChange={(e) => setPorcentajeDraft(Number(e.target.value))}
                  className="input h-9 w-24"
                />
                <span className="text-sm text-gray-500">
                  {((porcentajeDraft || 0) * 8 / 100).toFixed(2)} h/dia
                </span>
                <button
                  type="button"
                  onClick={handleSavePorcentaje}
                  disabled={porcentajeSaving || porcentajeSinCambios}
                  className="btn-secondary h-9"
                >
                  {porcentajeSaving ? 'Guardando...' : 'Guardar jornada'}
                </button>
              </div>
              {porcentajeError && (
                <p className="text-sm text-red-600 mt-2">{porcentajeError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contratos */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Contratos
          </h3>
          {isAdmin && (
            <button
              onClick={() => { setEditingContrato(null); setShowContratoForm(true); }}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Nuevo contrato
            </button>
          )}
        </div>

        {contratos.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay contratos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Inicio</th>
                  <th className="pb-2 font-medium">Fin</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Horas/Sem</th>
                  <th className="pb-2 font-medium">Disponib.</th>
                  <th className="pb-2 font-medium">Notas</th>
                  {isAdmin && <th className="pb-2 font-medium w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {contratos.map(contrato => {
                  const hoy = new Date().toISOString().split('T')[0];
                  const esActivo = contrato.fecha_inicio <= hoy && (!contrato.fecha_fin || contrato.fecha_fin >= hoy);
                  return (
                    <tr key={contrato.id} className={esActivo ? 'bg-green-50' : ''}>
                      <td className="py-2">{contrato.fecha_inicio}</td>
                      <td className="py-2">{contrato.fecha_fin || <span className="text-gray-400">Indefinido</span>}</td>
                      <td className="py-2">{TIPOS_CONTRATO.find(t => t.value === contrato.tipo_contrato)?.label || contrato.tipo_contrato}</td>
                      <td className="py-2">
                        {contrato.horas_semanales}h
                        {contrato.por_horas ? (
                          <span className="text-xs text-blue-600 ml-1">(Por horas)</span>
                        ) : (contrato.porcentaje_jornada ?? 100) < 100 ? (
                          <span className="text-xs text-gray-500 ml-1">({contrato.porcentaje_jornada}%)</span>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <span className={contrato.cobra_disponibilidad ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {contrato.cobra_disponibilidad ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 truncate max-w-[150px]">{contrato.notas || '-'}</td>
                      {isAdmin && (
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingContrato(contrato); setShowContratoForm(true); }}
                              className="p-1 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContrato(contrato.id)}
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
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

      {/* Modal Form Contrato */}
      {showContratoForm && (
        <ContratoForm
          contrato={editingContrato}
          conductorId={parseInt(id!)}
          onClose={() => setShowContratoForm(false)}
          onSave={() => {
            setShowContratoForm(false);
            fetchContratos();
          }}
        />
      )}

      {/* Stats CE 561 */}
      {conductor.estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-500">Conducción semanal</p>
            <p className="text-2xl font-bold text-gray-900">
              {conductor.estadisticas.conduccionSemana.toFixed(1)}h
            </p>
            <p className="text-xs text-gray-500">de 56h máx</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Conducción bisemanal</p>
            <p className="text-2xl font-bold text-gray-900">
              {conductor.estadisticas.conduccionBisemanal.toFixed(1)}h
            </p>
            <p className="text-xs text-gray-500">de 90h máx</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Días trabajados</p>
            <p className="text-2xl font-bold text-gray-900">
              {conductor.estadisticas.diasTrabajadosSemana}
            </p>
            <p className="text-xs text-gray-500">de 5 máx/semana</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Horas disponibles</p>
            <p className="text-2xl font-bold text-gray-900">
              {conductor.estadisticas.horasHastaLimiteSemanal.toFixed(1)}h
            </p>
            <p className="text-xs text-gray-500">esta semana</p>
          </div>
        </div>
      )}

      {/* Alertas de días consecutivos trabajados */}
      {alertasDescanso && (
        <div className="mb-6 space-y-3">
          {/* Mostrar alertas */}
          {alertasDescanso.alertas.map((alerta, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg flex items-center gap-3 ${
                alerta.tipo === 'error'
                  ? 'bg-red-50 border border-red-200'
                  : alerta.tipo === 'warning'
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <AlertTriangle
                className={`w-6 h-6 flex-shrink-0 ${
                  alerta.tipo === 'error'
                    ? 'text-red-500'
                    : alerta.tipo === 'warning'
                    ? 'text-amber-500'
                    : 'text-blue-500'
                }`}
              />
              <p
                className={`font-medium ${
                  alerta.tipo === 'error'
                    ? 'text-red-800'
                    : alerta.tipo === 'warning'
                    ? 'text-amber-800'
                    : 'text-blue-800'
                }`}
              >
                {alerta.mensaje}
              </p>
            </div>
          ))}

          {/* Resumen de días consecutivos */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Días consecutivos trabajados</p>
                <p className={`text-2xl font-bold ${
                  alertasDescanso.diasConsecutivosTrabajados >= 6 ? 'text-red-600' :
                  alertasDescanso.diasConsecutivosTrabajados >= 5 ? 'text-amber-600' : 'text-gray-900'
                }`}>
                  {alertasDescanso.diasConsecutivosTrabajados}/6
                </p>
              </div>
              <div>
                <p className="text-gray-500">Días hasta descanso obligatorio</p>
                <p className={`text-2xl font-bold ${
                  alertasDescanso.diasHastaDescansoObligatorio <= 1 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {alertasDescanso.diasHastaDescansoObligatorio}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Próximo descanso requerido</p>
                <p className={`text-2xl font-bold ${
                  alertasDescanso.proximoDescansoRequerido === '45h' ? 'text-amber-600' : 'text-gray-900'
                }`}>
                  {alertasDescanso.proximoDescansoRequerido}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Último descanso semanal</p>
                <p className="text-lg font-medium text-gray-900">
                  {alertasDescanso.ultimoDescansoSemanal
                    ? `${alertasDescanso.ultimoDescansoSemanal.fecha} (${alertasDescanso.ultimoDescansoSemanal.tipo})`
                    : 'Sin registro'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta próximo descanso (antigua) */}
      {conductor.estadisticas?.proximoDescansoObligatorio.includes('URGENTE') && !alertasDescanso?.alertas.length && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <div>
            <p className="font-medium text-red-800">Descanso semanal requerido</p>
            <p className="text-sm text-red-600">El conductor necesita un descanso semanal obligatorio</p>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => cambiarMes(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 capitalize">{nombreMes}</h2>
          <button onClick={() => cambiarMes(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <Calendar
            calendario={calendario}
            conductorId={parseInt(id!)}
            onUpdate={fetchCalendario}
          />
        )}
      </div>

      {/* Resumen mensual */}
      {resumen && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen del mes</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Días trabajados</p>
              <p className="text-xl font-bold text-gray-900">{resumen.diasTrabajados}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Días descanso</p>
              <p className="text-xl font-bold text-gray-900">{resumen.diasDescanso}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Horas conducción</p>
              <p className="text-xl font-bold text-gray-900">{resumen.horasConduccion.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Horas trabajo</p>
              <p className="text-xl font-bold text-gray-900">{resumen.horasTrabajo.toFixed(1)}h</p>
            </div>
          </div>
        </div>
      )}

      {/* Días de descanso pendientes */}
      {descansosPendientes && (
        <div className="card mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Días de descanso pendientes (acumulado año)</h3>

          {/* Resumen principal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${descansosPendientes.diasPendientes > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="text-sm text-gray-600">Días pendientes</p>
              <p className={`text-3xl font-bold ${descansosPendientes.diasPendientes > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {descansosPendientes.diasPendientes}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600">Descansos correspondientes</p>
              <p className="text-2xl font-bold text-gray-900">{descansosPendientes.descansosCorrespondientes}</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600">Descansos tomados</p>
              <p className="text-2xl font-bold text-gray-900">{descansosPendientes.diasDescansoTomados}</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600">% Descanso</p>
              <p className="text-2xl font-bold text-gray-900">{descansosPendientes.porcentajeDescanso}%</p>
            </div>
          </div>

          {/* Detalle del cálculo */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Detalle del cálculo</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Días trabajados (convenio)</p>
                <p className="font-medium">{descansosPendientes.diasTrabajadosConvenio}</p>
              </div>
              <div>
                <p className="text-gray-500">Días trabajados (tacógrafo)</p>
                <p className="font-medium">{descansosPendientes.diasTrabajadosTacografo}</p>
              </div>
              <div>
                <p className="text-gray-500">Días formación</p>
                <p className="font-medium">{descansosPendientes.diasFormacion}</p>
              </div>
              <div>
                <p className="text-gray-500">Domingos trabajados</p>
                <p className="font-medium">{descansosPendientes.domingosTrabajados}</p>
              </div>
              <div>
                <p className="text-gray-500">Festivos nacionales trabajados</p>
                <p className="font-medium">{descansosPendientes.festivosNacionalesTrabajados}</p>
              </div>
              <div>
                <p className="text-gray-500">Días vacaciones</p>
                <p className="font-medium text-blue-600">{descansosPendientes.diasVacaciones} (no cuentan)</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <strong>Cálculo:</strong> {descansosPendientes.detalle.porDiasTrabajados} (por días trabajados: {descansosPendientes.diasTrabajadosConvenio}/7×2) + {descansosPendientes.detalle.porDomingos} (domingos) + {descansosPendientes.detalle.porFestivos} (festivos) = {descansosPendientes.descansosCorrespondientes} correspondientes - {descansosPendientes.diasDescansoTomados} tomados = <strong>{descansosPendientes.diasPendientes} pendientes</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario de contrato
interface ContratoFormProps {
  contrato: Contrato | null;
  conductorId: number;
  onClose: () => void;
  onSave: () => void;
}

function ContratoForm({ contrato, conductorId, onClose, onSave }: ContratoFormProps) {
  const [formData, setFormData] = useState({
    fecha_inicio: contrato?.fecha_inicio || new Date().toISOString().split('T')[0],
    fecha_fin: contrato?.fecha_fin || '',
    tipo_contrato: contrato?.tipo_contrato || 'indefinido',
    horas_semanales: contrato?.horas_semanales || 40,
    porcentaje_jornada: contrato?.porcentaje_jornada ?? 100,
    por_horas: contrato?.por_horas ? 1 : 0,
    cobra_disponibilidad: contrato?.cobra_disponibilidad || 0,
    notas: contrato?.notas || '',
  });
  const isPorHoras = formData.por_horas === 1;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (contrato) {
        await contratosApi.update(contrato.id, formData);
      } else {
        await contratosApi.create(conductorId, formData);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error guardando contrato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {contrato ? 'Editar contrato' : 'Nuevo contrato'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={formData.fecha_inicio}
                onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input
                type="date"
                value={formData.fecha_fin}
                onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Vacío = indefinido</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de contrato</label>
              <select
                value={formData.tipo_contrato}
                onChange={(e) => setFormData({ ...formData, tipo_contrato: e.target.value })}
                className="input"
              >
                {TIPOS_CONTRATO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horas semanales</label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.horas_semanales}
                onChange={(e) => setFormData({ ...formData, horas_semanales: parseInt(e.target.value) })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de jornada</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={formData.porcentaje_jornada}
                onChange={(e) => setFormData({ ...formData, porcentaje_jornada: Number(e.target.value) })}
                className="input w-24"
              />
              <span className="text-sm text-gray-500">
                {((formData.porcentaje_jornada || 0) * 8 / 100).toFixed(2)} h/dia
              </span>
            </div>
            <label className="mt-2 flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.por_horas === 1}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData({
                    ...formData,
                    por_horas: checked ? 1 : 0,
                    porcentaje_jornada: checked ? (formData.porcentaje_jornada === 100 ? 50 : formData.porcentaje_jornada) : 100
                  });
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Por horas
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.cobra_disponibilidad === 1}
                onChange={(e) => setFormData({ ...formData, cobra_disponibilidad: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Cobra disponibilidad</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="input"
              rows={2}
              placeholder="Observaciones del contrato..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
