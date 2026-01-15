import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { guardiasApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X, Check, Shield } from 'lucide-react';

interface Guardia {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  telefono: string | null;
  fecha_alta: string;
  activo: number;
}

export default function Guardias() {
  const { isAdmin } = useAuth();
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    dni: '',
    telefono: '',
    fecha_alta: new Date().toISOString().split('T')[0],
  });
  const [filtroActivo, setFiltroActivo] = useState<boolean | undefined>(true);

  useEffect(() => {
    fetchGuardias();
  }, [filtroActivo]);

  const fetchGuardias = async () => {
    setLoading(true);
    try {
      const response = await guardiasApi.list(filtroActivo);
      setGuardias(response.data);
    } catch (error) {
      console.error('Error cargando guardias:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await guardiasApi.update(editingId, formData);
      } else {
        await guardiasApi.create(formData);
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchGuardias();
    } catch (error: any) {
      console.error('Error guardando guardia:', error);
      alert(error.response?.data?.error || 'Error al guardar');
    }
  };

  const handleEdit = (guardia: Guardia) => {
    setFormData({
      nombre: guardia.nombre,
      apellidos: guardia.apellidos,
      dni: guardia.dni,
      telefono: guardia.telefono || '',
      fecha_alta: guardia.fecha_alta,
    });
    setEditingId(guardia.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Se desactivara este guardia. ¿Continuar?')) return;
    try {
      await guardiasApi.delete(id);
      fetchGuardias();
    } catch (error) {
      console.error('Error eliminando guardia:', error);
    }
  };

  const handleToggleActivo = async (guardia: Guardia) => {
    try {
      await guardiasApi.update(guardia.id, { activo: !guardia.activo });
      fetchGuardias();
    } catch (error) {
      console.error('Error actualizando guardia:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellidos: '',
      dni: '',
      telefono: '',
      fecha_alta: new Date().toISOString().split('T')[0],
    });
  };

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
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Guardias de Trafico</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filtroActivo === undefined ? 'todos' : filtroActivo ? 'activos' : 'inactivos'}
            onChange={(e) => {
              if (e.target.value === 'todos') setFiltroActivo(undefined);
              else setFiltroActivo(e.target.value === 'activos');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Guardia
            </button>
          )}
        </div>
      </div>

      {/* Tabla de guardias */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Alta</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              {isAdmin && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {guardias.map((guardia) => (
              <tr key={guardia.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/guardias/${guardia.id}`}
                    className="font-medium text-gray-900 hover:text-primary-600 hover:underline"
                  >
                    {guardia.nombre} {guardia.apellidos}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{guardia.dni}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{guardia.telefono || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(guardia.fecha_alta).toLocaleDateString('es-ES')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    guardia.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {guardia.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleActivo(guardia)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          guardia.activo
                            ? 'text-gray-500 hover:bg-gray-100'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={guardia.activo ? 'Desactivar' : 'Activar'}
                      >
                        {guardia.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(guardia)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(guardia.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {guardias.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                  No hay guardias registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Editar Guardia' : 'Nuevo Guardia'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={formData.apellidos}
                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI *</label>
                  <input
                    type="text"
                    required
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Alta *</label>
                <input
                  type="date"
                  required
                  value={formData.fecha_alta}
                  onChange={(e) => setFormData({ ...formData, fecha_alta: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingId ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
