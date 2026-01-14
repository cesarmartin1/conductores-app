import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { conductoresApi, informesApi } from '../services/api';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Coffee,
  Truck,
  ChevronRight
} from 'lucide-react';

interface EstadoConductor {
  conductorId: number;
  nombre: string;
  estado: 'ok' | 'warning' | 'error';
  alertas: number;
  diasTrabajadosSemana: number;
  diasDescansoSemana: number;
  horasConduccionSemana: number;
  horasConduccionHoy: number;
  ultimoDescanso: string | null;
  proximoDescansoObligatorio: string;
}

export default function Dashboard() {
  const { user, isConductor } = useAuth();
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoConductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumenMes, setResumenMes] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isConductor && user?.conductorId) {
          const hoy = new Date();
          const response = await informesApi.getMensual(
            user.conductorId,
            hoy.getFullYear(),
            hoy.getMonth() + 1
          );
          setResumenMes(response.data);
        } else {
          const response = await conductoresApi.getEstadoGeneral();
          setEstadoGeneral(response.data);
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isConductor, user?.conductorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Vista para conductores
  if (isConductor && resumenMes) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Panel</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Horas conduccion"
            value={`${resumenMes.resumen.horasConduccion.toFixed(1)}h`}
            subtitle="Este mes"
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="Dias trabajados"
            value={resumenMes.resumen.diasTrabajados}
            subtitle="Este mes"
            icon={Calendar}
            color="green"
          />
          <StatCard
            title="Dias descanso"
            value={resumenMes.resumen.diasDescanso}
            subtitle="Este mes"
            icon={CheckCircle}
            color="purple"
          />
          <StatCard
            title="Alertas"
            value={resumenMes.alertas.length}
            subtitle="Pendientes"
            icon={AlertTriangle}
            color={resumenMes.alertas.length > 0 ? 'red' : 'gray'}
          />
        </div>

        {resumenMes.alertas.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertas recientes</h2>
            <div className="space-y-3">
              {resumenMes.alertas.slice(0, 5).map((alerta: any) => (
                <div key={alerta.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800">{alerta.mensaje}</p>
                    <p className="text-xs text-red-600 mt-1">{alerta.fecha}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vista para admin/supervisor - Cuadrante de conductores
  const conductoresOk = estadoGeneral.filter(c => c.estado === 'ok').length;
  const conductoresWarning = estadoGeneral.filter(c => c.estado === 'warning').length;
  const conductoresError = estadoGeneral.filter(c => c.estado === 'error').length;

  // Obtener la fecha de hoy formateada
  const hoy = new Date();
  const opcionesFecha: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  const fechaHoy = hoy.toLocaleDateString('es-ES', opcionesFecha);

  // Obtener inicio y fin de semana
  const inicioSemana = new Date(hoy);
  const diaSemana = hoy.getDay();
  inicioSemana.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);

  const formatFechaCorta = (fecha: Date) =>
    fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuadrante de Conductores</h1>
          <p className="text-gray-500 capitalize">{fechaHoy}</p>
        </div>
        <div className="text-sm text-gray-500">
          Semana: {formatFechaCorta(inicioSemana)} - {formatFechaCorta(finSemana)}
        </div>
      </div>

      {/* Resumen rapido */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{estadoGeneral.length}</p>
            <p className="text-xs text-gray-500">Total conductores</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{conductoresOk}</p>
            <p className="text-xs text-gray-500">Sin alertas</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{conductoresWarning}</p>
            <p className="text-xs text-gray-500">Con avisos</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{conductoresError}</p>
            <p className="text-xs text-gray-500">Con errores</p>
          </div>
        </div>
      </div>

      {/* Cuadrante de conductores */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Estado de Descansos - Semana Actual</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Conductor</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Truck className="w-4 h-4" />
                    <span>Dias Trabajo</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Coffee className="w-4 h-4" />
                    <span>Dias Descanso</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Horas Semana</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Horas Hoy</th>
                <th className="px-4 py-3">Proximo Descanso</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {estadoGeneral.map((conductor) => (
                <ConductorRow key={conductor.conductorId} conductor={conductor} />
              ))}
            </tbody>
          </table>
        </div>

        {estadoGeneral.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay conductores registrados</p>
            <Link to="/conductores" className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">
              Añadir conductores
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para cada fila de conductor
function ConductorRow({ conductor }: { conductor: EstadoConductor }) {
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'ok':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            OK
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3" />
            Aviso
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const getDiasTrabajoBadge = (dias: number) => {
    const maxDias = 5;
    const porcentaje = (dias / maxDias) * 100;
    let colorClass = 'bg-green-500';
    if (porcentaje >= 100) colorClass = 'bg-red-500';
    else if (porcentaje >= 80) colorClass = 'bg-yellow-500';

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorClass} rounded-full`}
            style={{ width: `${Math.min(porcentaje, 100)}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${dias >= maxDias ? 'text-red-600' : 'text-gray-700'}`}>
          {dias}/{maxDias}
        </span>
      </div>
    );
  };

  const getHorasSemanaBadge = (horas: number) => {
    const maxHoras = 56;
    const porcentaje = (horas / maxHoras) * 100;
    let colorClass = 'bg-green-500';
    if (porcentaje >= 100) colorClass = 'bg-red-500';
    else if (porcentaje >= 80) colorClass = 'bg-yellow-500';

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorClass} rounded-full`}
            style={{ width: `${Math.min(porcentaje, 100)}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">
          {horas.toFixed(1)}h
        </span>
      </div>
    );
  };

  const getProximoDescansoBadge = (fecha: string) => {
    if (fecha.includes('URGENTE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
          <AlertTriangle className="w-3 h-3" />
          Urgente
        </span>
      );
    }

    const fechaDescanso = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diffDias = Math.ceil((fechaDescanso.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias <= 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          <Calendar className="w-3 h-3" />
          {diffDias === 0 ? 'Hoy' : 'Mañana'}
        </span>
      );
    }

    return (
      <span className="text-sm text-gray-600">
        {fechaDescanso.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        <span className="text-gray-400 ml-1">({diffDias}d)</span>
      </span>
    );
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-medium text-sm">
              {conductor.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{conductor.nombre}</p>
            {conductor.alertas > 0 && (
              <p className="text-xs text-gray-500">{conductor.alertas} alerta(s)</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        {getEstadoBadge(conductor.estado)}
      </td>
      <td className="px-4 py-4">
        {getDiasTrabajoBadge(conductor.diasTrabajadosSemana)}
      </td>
      <td className="px-4 py-4 text-center">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-blue-50 text-blue-700">
          <Coffee className="w-3 h-3" />
          {conductor.diasDescansoSemana}
        </span>
      </td>
      <td className="px-4 py-4">
        {getHorasSemanaBadge(conductor.horasConduccionSemana)}
      </td>
      <td className="px-4 py-4 text-center">
        <span className={`text-sm font-medium ${conductor.horasConduccionHoy > 9 ? 'text-red-600' : 'text-gray-700'}`}>
          {conductor.horasConduccionHoy > 0 ? `${conductor.horasConduccionHoy}h` : '-'}
        </span>
      </td>
      <td className="px-4 py-4">
        {getProximoDescansoBadge(conductor.proximoDescansoObligatorio)}
      </td>
      <td className="px-4 py-4">
        <Link
          to={`/conductores/${conductor.conductorId}`}
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </td>
    </tr>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
