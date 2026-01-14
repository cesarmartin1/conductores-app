import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { conductoresApi, jornadasApi } from '../services/api';
import { Calendar, Download, Plus } from 'lucide-react';

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
}

interface Jornada {
  id: number;
  conductor_id: number;
  fecha: string;
  tipo: string;
  horas_conduccion: number;
  horas_trabajo: number;
  nombre?: string;
  apellidos?: string;
}

export default function Jornadas() {
  const { user, isConductor, isAdmin, isSupervisor } = useAuth();
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [conductorId, setConductorId] = useState<number | null>(
    isConductor ? user?.conductorId || null : null
  );
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMasivoForm, setShowMasivoForm] = useState(false);

  const hoy = new Date();
  const [desde, setDesde] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]);

  useEffect(() => {
    if (!isConductor) {
      fetchConductores();
    }
  }, [isConductor]);

  useEffect(() => {
    if (conductorId) {
      fetchJornadas();
    }
  }, [conductorId, desde, hasta]);

  const fetchConductores = async () => {
    try {
      const response = await conductoresApi.list(true);
      setConductores(response.data);
    } catch (error) {
      console.error('Error cargando conductores:', error);
    }
  };

  const fetchJornadas = async () => {
    if (!conductorId) return;
    setLoading(true);
    try {
      const response = await jornadasApi.list(conductorId, desde, hasta);
      setJornadas(response.data);
    } catch (error) {
      console.error('Error cargando jornadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'trabajo': return 'badge-info';
      case 'descanso': return 'badge-success';
      case 'festivo': return 'bg-purple-100 text-purple-800';
      case 'vacaciones': return 'badge-warning';
      case 'baja': return 'badge-error';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jornadas</h1>
        {(isAdmin || isSupervisor) && (
          <button
            onClick={() => setShowMasivoForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Registro masivo
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Tabla de jornadas */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : !conductorId ? (
          <p className="text-center text-gray-500 py-8">Selecciona un conductor para ver sus jornadas</p>
        ) : jornadas.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay jornadas en el período seleccionado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">H. Conducción</th>
                  <th className="pb-3 font-medium">H. Trabajo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jornadas.map((jornada) => {
                  const fecha = new Date(jornada.fecha);
                  return (
                    <tr key={jornada.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <span className="font-medium text-gray-900">
                          {fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`badge ${getTipoColor(jornada.tipo)}`}>
                          {jornada.tipo}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">
                        {jornada.tipo === 'trabajo' ? `${jornada.horas_conduccion}h` : '-'}
                      </td>
                      <td className="py-3 text-gray-600">
                        {jornada.tipo === 'trabajo' ? `${jornada.horas_trabajo}h` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen */}
        {jornadas.length > 0 && (
          <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Días trabajo</p>
              <p className="text-xl font-bold text-gray-900">
                {jornadas.filter(j => j.tipo === 'trabajo').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total conducción</p>
              <p className="text-xl font-bold text-gray-900">
                {jornadas.reduce((sum, j) => sum + (j.horas_conduccion || 0), 0).toFixed(1)}h
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Días descanso</p>
              <p className="text-xl font-bold text-gray-900">
                {jornadas.filter(j => j.tipo === 'descanso').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Días festivo/vac</p>
              <p className="text-xl font-bold text-gray-900">
                {jornadas.filter(j => ['festivo', 'vacaciones'].includes(j.tipo)).length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal registro masivo */}
      {showMasivoForm && (
        <RegistroMasivoModal
          conductores={conductores}
          onClose={() => setShowMasivoForm(false)}
          onSave={() => {
            setShowMasivoForm(false);
            fetchJornadas();
          }}
        />
      )}
    </div>
  );
}

interface RegistroMasivoModalProps {
  conductores: Conductor[];
  onClose: () => void;
  onSave: () => void;
}

function RegistroMasivoModal({ conductores, onClose, onSave }: RegistroMasivoModalProps) {
  const [formData, setFormData] = useState({
    conductorId: '',
    desde: '',
    hasta: '',
    tipo: 'vacaciones',
    notas: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await jornadasApi.registrarMasivo({
        conductorId: parseInt(formData.conductorId),
        desde: formData.desde,
        hasta: formData.hasta,
        tipo: formData.tipo,
        notas: formData.notas,
      });
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error registrando jornadas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Registro masivo</h2>
          <p className="text-sm text-gray-500">Registrar varios días de vacaciones, baja, etc.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conductor</label>
            <select
              value={formData.conductorId}
              onChange={(e) => setFormData({ ...formData, conductorId: e.target.value })}
              className="input"
              required
            >
              <option value="">Seleccionar conductor</option>
              {conductores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellidos}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={formData.desde}
                onChange={(e) => setFormData({ ...formData, desde: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={formData.hasta}
                onChange={(e) => setFormData({ ...formData, hasta: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="input"
            >
              <option value="vacaciones">Vacaciones</option>
              <option value="baja">Baja</option>
              <option value="descanso">Descanso</option>
              <option value="festivo">Festivo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="input"
              rows={2}
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
