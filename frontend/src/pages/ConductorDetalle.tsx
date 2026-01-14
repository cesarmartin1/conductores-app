import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { conductoresApi } from '../services/api';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import Calendar from '../components/Calendar';

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  licencia: string;
  telefono: string;
  fecha_alta: string;
  activo: number;
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

export default function ConductorDetalle() {
  const { id } = useParams<{ id: string }>();
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [calendario, setCalendario] = useState<CalendarioDia[]>([]);
  const [resumen, setResumen] = useState<ResumenMensual | null>(null);
  const [descansosPendientes, setDescansosPendientes] = useState<DescansosPendientes | null>(null);
  const [alertasDescanso, setAlertasDescanso] = useState<AlertasDescansoSemanal | null>(null);
  const [loading, setLoading] = useState(true);
  const [año, setAño] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchConductor();
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
    } catch (error) {
      console.error('Error cargando conductor:', error);
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/conductores" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {conductor.nombre} {conductor.apellidos}
          </h1>
          <p className="text-gray-500">DNI: {conductor.dni} | Licencia: {conductor.licencia || 'N/A'}</p>
        </div>
      </div>

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
