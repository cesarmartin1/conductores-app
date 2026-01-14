import { useState, useEffect } from 'react';
import { usuariosApi, conductoresApi } from '../services/api';
import { Plus, Edit2, UserCheck, UserX } from 'lucide-react';

interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: 'admin' | 'supervisor' | 'conductor';
  conductor_id: number | null;
  activo: number;
  conductor_nombre?: string;
  conductor_apellidos?: string;
}

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usuariosRes, conductoresRes] = await Promise.all([
        usuariosApi.list(),
        conductoresApi.list(true),
      ]);
      setUsuarios(usuariosRes.data);
      setConductores(conductoresRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (user: Usuario) => {
    try {
      await usuariosApi.update(user.id, { activo: !user.activo });
      fetchData();
    } catch (error) {
      console.error('Error actualizando usuario:', error);
    }
  };

  const getRolColor = (rol: string) => {
    switch (rol) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'supervisor': return 'bg-blue-100 text-blue-800';
      case 'conductor': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <button
          onClick={() => { setEditingUser(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuevo usuario
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Usuario</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Rol</th>
                <th className="pb-3 font-medium">Conductor asociado</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="py-4">
                    <span className="font-medium text-gray-900">{user.nombre}</span>
                  </td>
                  <td className="py-4 text-gray-600">{user.email}</td>
                  <td className="py-4">
                    <span className={`badge ${getRolColor(user.rol)}`}>{user.rol}</span>
                  </td>
                  <td className="py-4 text-gray-600">
                    {user.conductor_nombre
                      ? `${user.conductor_nombre} ${user.conductor_apellidos}`
                      : '-'}
                  </td>
                  <td className="py-4">
                    <span className={`badge ${user.activo ? 'badge-success' : 'badge-error'}`}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEditingUser(user); setShowForm(true); }}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActivo(user)}
                        className={`p-2 rounded-lg ${
                          user.activo
                            ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={user.activo ? 'Desactivar' : 'Activar'}
                      >
                        {user.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {usuarios.length === 0 && (
          <p className="text-center text-gray-500 py-8">No hay usuarios registrados</p>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <UsuarioForm
          usuario={editingUser}
          conductores={conductores}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

interface UsuarioFormProps {
  usuario: Usuario | null;
  conductores: Conductor[];
  onClose: () => void;
  onSave: () => void;
}

function UsuarioForm({ usuario, conductores, onClose, onSave }: UsuarioFormProps) {
  const [formData, setFormData] = useState({
    email: usuario?.email || '',
    password: '',
    nombre: usuario?.nombre || '',
    rol: usuario?.rol || 'conductor',
    conductorId: usuario?.conductor_id?.toString() || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data: any = {
        email: formData.email,
        nombre: formData.nombre,
        rol: formData.rol,
        conductorId: formData.conductorId ? parseInt(formData.conductorId) : null,
      };

      if (formData.password) {
        data.password = formData.password;
      }

      if (usuario) {
        await usuariosApi.update(usuario.id, data);
      } else {
        if (!formData.password) {
          setError('La contraseña es requerida para nuevos usuarios');
          setLoading(false);
          return;
        }
        data.password = formData.password;
        await usuariosApi.create(data);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error guardando usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {usuario ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña {usuario && '(dejar vacío para no cambiar)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              required={!usuario}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
              className="input"
            >
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="conductor">Conductor</option>
            </select>
          </div>

          {formData.rol === 'conductor' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conductor asociado
              </label>
              <select
                value={formData.conductorId}
                onChange={(e) => setFormData({ ...formData, conductorId: e.target.value })}
                className="input"
              >
                <option value="">Sin asociar</option>
                {conductores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellidos}
                  </option>
                ))}
              </select>
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
