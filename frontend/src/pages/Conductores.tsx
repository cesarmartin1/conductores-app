import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { conductoresApi } from '../services/api';
import { Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  licencia: string;
  telefono: string;
  fecha_alta: string;
  activo: number;
}

export default function Conductores() {
  const { isAdmin } = useAuth();
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingConductor, setEditingConductor] = useState<Conductor | null>(null);

  useEffect(() => {
    fetchConductores();
  }, []);

  const fetchConductores = async () => {
    try {
      const response = await conductoresApi.list();
      setConductores(response.data);
    } catch (error) {
      console.error('Error cargando conductores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de desactivar este conductor?')) return;

    try {
      await conductoresApi.delete(id);
      fetchConductores();
    } catch (error) {
      console.error('Error eliminando conductor:', error);
    }
  };

  const filteredConductores = conductores.filter(c =>
    `${c.nombre} ${c.apellidos} ${c.dni}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conductores</h1>
        {isAdmin && (
          <button
            onClick={() => { setEditingConductor(null); setShowForm(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo conductor
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">DNI</th>
                <th className="pb-3 font-medium">Licencia</th>
                <th className="pb-3 font-medium">Teléfono</th>
                <th className="pb-3 font-medium">Alta</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredConductores.map((conductor) => (
                <tr key={conductor.id} className="hover:bg-gray-50">
                  <td className="py-4">
                    <span className="font-medium text-gray-900">
                      {conductor.nombre} {conductor.apellidos}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">{conductor.dni}</td>
                  <td className="py-4 text-gray-600">{conductor.licencia || '-'}</td>
                  <td className="py-4 text-gray-600">{conductor.telefono || '-'}</td>
                  <td className="py-4 text-gray-600">{conductor.fecha_alta}</td>
                  <td className="py-4">
                    <span className={`badge ${conductor.activo ? 'badge-success' : 'badge-error'}`}>
                      {conductor.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        to={`/conductores/${conductor.id}`}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { setEditingConductor(conductor); setShowForm(true); }}
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(conductor.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Desactivar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredConductores.length === 0 && (
          <p className="text-center text-gray-500 py-8">No se encontraron conductores</p>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <ConductorForm
          conductor={editingConductor}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            fetchConductores();
          }}
        />
      )}
    </div>
  );
}

interface ConductorFormProps {
  conductor: Conductor | null;
  onClose: () => void;
  onSave: () => void;
}

function ConductorForm({ conductor, onClose, onSave }: ConductorFormProps) {
  const [formData, setFormData] = useState({
    nombre: conductor?.nombre || '',
    apellidos: conductor?.apellidos || '',
    dni: conductor?.dni || '',
    licencia: conductor?.licencia || '',
    telefono: conductor?.telefono || '',
    fechaAlta: conductor?.fecha_alta || new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (conductor) {
        await conductoresApi.update(conductor.id, formData);
      } else {
        await conductoresApi.create(formData);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error guardando conductor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {conductor ? 'Editar conductor' : 'Nuevo conductor'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
              <input
                type="text"
                value={formData.apellidos}
                onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
            <input
              type="text"
              value={formData.dni}
              onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Licencia</label>
              <input
                type="text"
                value={formData.licencia}
                onChange={(e) => setFormData({ ...formData, licencia: e.target.value })}
                className="input"
                placeholder="C+E"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de alta</label>
            <input
              type="date"
              value={formData.fechaAlta}
              onChange={(e) => setFormData({ ...formData, fechaAlta: e.target.value })}
              className="input"
              required
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
