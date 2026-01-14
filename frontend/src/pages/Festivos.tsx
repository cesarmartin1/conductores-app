import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { festivosApi } from '../services/api';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

interface Festivo {
  id: number;
  fecha: string;
  nombre: string;
  ambito: 'nacional' | 'autonomico' | 'local';
  comunidad: string | null;
}

export default function Festivos() {
  const { isAdmin } = useAuth();
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [año, setAño] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchFestivos();
  }, [año]);

  const fetchFestivos = async () => {
    setLoading(true);
    try {
      const response = await festivosApi.list(año);
      setFestivos(response.data);
    } catch (error) {
      console.error('Error cargando festivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInicializar = async () => {
    if (!confirm(`¿Inicializar festivos nacionales para ${año}?`)) return;

    try {
      await festivosApi.inicializar(año);
      fetchFestivos();
    } catch (error) {
      console.error('Error inicializando festivos:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este festivo?')) return;

    try {
      await festivosApi.delete(id);
      fetchFestivos();
    } catch (error) {
      console.error('Error eliminando festivo:', error);
    }
  };

  const getAmbitoColor = (ambito: string) => {
    switch (ambito) {
      case 'nacional': return 'badge-info';
      case 'autonomico': return 'badge-warning';
      case 'local': return 'badge-success';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const festivosNacionales = festivos.filter(f => f.ambito === 'nacional');
  const festivosOtros = festivos.filter(f => f.ambito !== 'nacional');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Festivos</h1>
        <div className="flex gap-3">
          {isAdmin && (
            <>
              <button onClick={handleInicializar} className="btn-secondary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Inicializar nacionales
              </button>
              <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Añadir festivo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selector de año */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Año:</label>
          <select
            value={año}
            onChange={(e) => setAño(parseInt(e.target.value))}
            className="input w-32"
          >
            {[2024, 2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {festivos.length} festivos
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Festivos nacionales */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Festivos nacionales</h2>
            {festivosNacionales.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No hay festivos nacionales. Usa "Inicializar nacionales" para cargarlos.
              </p>
            ) : (
              <div className="space-y-2">
                {festivosNacionales.map((festivo) => (
                  <div key={festivo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{festivo.nombre}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(festivo.fecha).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(festivo.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Festivos autonómicos/locales */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Festivos autonómicos/locales</h2>
            {festivosOtros.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No hay festivos autonómicos o locales añadidos.
              </p>
            ) : (
              <div className="space-y-2">
                {festivosOtros.map((festivo) => (
                  <div key={festivo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{festivo.nombre}</p>
                        <span className={`badge text-xs ${getAmbitoColor(festivo.ambito)}`}>
                          {festivo.ambito}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(festivo.fecha).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                        {festivo.comunidad && ` - ${festivo.comunidad}`}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(festivo.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal añadir festivo */}
      {showForm && (
        <FestivoForm
          año={año}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            fetchFestivos();
          }}
        />
      )}
    </div>
  );
}

interface FestivoFormProps {
  año: number;
  onClose: () => void;
  onSave: () => void;
}

function FestivoForm({ año, onClose, onSave }: FestivoFormProps) {
  const [formData, setFormData] = useState({
    fecha: `${año}-01-01`,
    nombre: '',
    ambito: 'autonomico' as 'nacional' | 'autonomico' | 'local',
    comunidad: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await festivosApi.create(formData);
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error creando festivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Añadir festivo</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="input"
              placeholder="Ej: Día de la Comunidad"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ámbito</label>
            <select
              value={formData.ambito}
              onChange={(e) => setFormData({ ...formData, ambito: e.target.value as any })}
              className="input"
            >
              <option value="autonomico">Autonómico</option>
              <option value="local">Local</option>
              <option value="nacional">Nacional</option>
            </select>
          </div>

          {formData.ambito !== 'nacional' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.ambito === 'autonomico' ? 'Comunidad Autónoma' : 'Localidad'}
              </label>
              <input
                type="text"
                value={formData.comunidad}
                onChange={(e) => setFormData({ ...formData, comunidad: e.target.value })}
                className="input"
                placeholder={formData.ambito === 'autonomico' ? 'Ej: Andalucía' : 'Ej: Sevilla'}
              />
            </div>
          )}

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
