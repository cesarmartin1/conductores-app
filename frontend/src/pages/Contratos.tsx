import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { conductoresApi, contratosApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, Search, Plus, Edit2, Trash2 } from 'lucide-react';

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  activo: number;
}

interface Contrato {
  id: number;
  conductor_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_contrato: string;
  horas_semanales: number;
  cobra_disponibilidad: number;
  notas: string | null;
}

interface ConductorConContratos {
  conductor: Conductor;
  contratoActivo: Contrato | null;
  contratos: Contrato[];
}

const TIPOS_CONTRATO = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'practicas', label: 'Practicas' },
  { value: 'formacion', label: 'Formacion' },
];

export default function Contratos() {
  const { isAdmin } = useAuth();
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [conductoresConContratos, setConductoresConContratos] = useState<ConductorConContratos[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [formData, setFormData] = useState({
    conductor_id: 0,
    fecha_inicio: '',
    fecha_fin: '',
    tipo_contrato: 'indefinido',
    horas_semanales: 40,
    cobra_disponibilidad: 0,
    notas: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Obtener todos los conductores
      const conductoresRes = await conductoresApi.list();
      const conductoresList: Conductor[] = conductoresRes.data;
      setConductores(conductoresList);

      // Obtener contratos de cada conductor
      const hoy = new Date().toISOString().split('T')[0];
      const conductoresConDatos: ConductorConContratos[] = [];

      for (const conductor of conductoresList) {
        if (!conductor.activo) continue; // Solo conductores activos

        try {
          const contratosRes = await contratosApi.list(conductor.id);
          const contratosDelConductor: Contrato[] = contratosRes.data;

          // Buscar contrato activo
          const contratoActivo = contratosDelConductor.find(c =>
            c.fecha_inicio <= hoy && (!c.fecha_fin || c.fecha_fin >= hoy)
          ) || null;

          conductoresConDatos.push({
            conductor,
            contratoActivo,
            contratos: contratosDelConductor
          });
        } catch (e) {
          // Si falla, igual añadir el conductor sin contratos
          conductoresConDatos.push({
            conductor,
            contratoActivo: null,
            contratos: []
          });
        }
      }

      // Ordenar por nombre de conductor
      conductoresConDatos.sort((a, b) =>
        `${a.conductor.apellidos} ${a.conductor.nombre}`.localeCompare(`${b.conductor.apellidos} ${b.conductor.nombre}`)
      );
      setConductoresConContratos(conductoresConDatos);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const openNewForm = () => {
    setEditingContrato(null);
    setFormData({
      conductor_id: conductores[0]?.id || 0,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      tipo_contrato: 'indefinido',
      horas_semanales: 40,
      cobra_disponibilidad: 0,
      notas: '',
    });
    setShowForm(true);
  };

  const openEditForm = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setFormData({
      conductor_id: contrato.conductor_id,
      fecha_inicio: contrato.fecha_inicio,
      fecha_fin: contrato.fecha_fin || '',
      tipo_contrato: contrato.tipo_contrato,
      horas_semanales: contrato.horas_semanales,
      cobra_disponibilidad: contrato.cobra_disponibilidad,
      notas: contrato.notas || '',
    });
    setShowForm(true);
  };

  const openNewFormForConductor = (conductorId: number) => {
    setEditingContrato(null);
    setFormData({
      conductor_id: conductorId,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      tipo_contrato: 'indefinido',
      horas_semanales: 40,
      cobra_disponibilidad: 0,
      notas: '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSend = {
        ...formData,
        fecha_fin: formData.fecha_fin || null,
        notas: formData.notas || null,
      };

      if (editingContrato) {
        await contratosApi.update(editingContrato.id, dataToSend);
      } else {
        await contratosApi.create(formData.conductor_id, dataToSend);
      }

      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error('Error guardando contrato:', error);
      alert('Error al guardar el contrato');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este contrato?')) return;
    try {
      await contratosApi.delete(id);
      fetchData();
    } catch (error) {
      console.error('Error eliminando contrato:', error);
    }
  };

  const filteredConductores = conductoresConContratos.filter(c =>
    `${c.conductor.nombre} ${c.conductor.apellidos} ${c.conductor.dni}`.toLowerCase().includes(search.toLowerCase())
  );

  const conductoresConContrato = filteredConductores.filter(c => c.contratoActivo);
  const conductoresSinContrato = filteredConductores.filter(c => !c.contratoActivo);

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
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {conductoresConContrato.length} con contrato / {conductoresSinContrato.length} sin contrato
          </span>
          {isAdmin && (
            <button
              onClick={openNewForm}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Contrato
            </button>
          )}
        </div>
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

      {/* Conductores CON contrato activo */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conductores con contrato activo</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-3 font-medium">Conductor</th>
                <th className="pb-3 font-medium">Inicio</th>
                <th className="pb-3 font-medium">Fin</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Horas/Sem</th>
                <th className="pb-3 font-medium">Disponib.</th>
                {isAdmin && <th className="pb-3 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {conductoresConContrato.map(({ conductor, contratoActivo }) => {
                const contrato = contratoActivo!;
                return (
                  <tr key={conductor.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <Link
                        to={`/conductores/${conductor.id}`}
                        className="font-medium text-primary-600 hover:text-primary-800 hover:underline"
                      >
                        {conductor.nombre} {conductor.apellidos}
                      </Link>
                      <p className="text-xs text-gray-500">{conductor.dni}</p>
                    </td>
                    <td className="py-3 text-gray-600">{contrato.fecha_inicio}</td>
                    <td className="py-3">
                      <span className={contrato.fecha_fin ? 'text-gray-600' : 'text-gray-400'}>
                        {contrato.fecha_fin || 'Indefinido'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {TIPOS_CONTRATO.find(t => t.value === contrato.tipo_contrato)?.label || contrato.tipo_contrato}
                    </td>
                    <td className="py-3 text-gray-600">{contrato.horas_semanales}h</td>
                    <td className="py-3">
                      <span className={contrato.cobra_disponibilidad ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {contrato.cobra_disponibilidad ? 'Si' : 'No'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditForm(contrato)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(contrato.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
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

        {conductoresConContrato.length === 0 && (
          <p className="text-center text-gray-500 py-8">No hay conductores con contrato activo</p>
        )}
      </div>

      {/* Conductores SIN contrato activo */}
      {conductoresSinContrato.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-red-700 mb-4">Conductores sin contrato activo</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-medium">Conductor</th>
                  <th className="pb-3 font-medium">Estado</th>
                  {isAdmin && <th className="pb-3 font-medium w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {conductoresSinContrato.map(({ conductor, contratos }) => {
                  const tieneContratosAnteriores = contratos.length > 0;
                  return (
                    <tr key={conductor.id} className="hover:bg-gray-50 bg-red-50/30">
                      <td className="py-3">
                        <Link
                          to={`/conductores/${conductor.id}`}
                          className="font-medium text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          {conductor.nombre} {conductor.apellidos}
                        </Link>
                        <p className="text-xs text-gray-500">{conductor.dni}</p>
                      </td>
                      <td className="py-3">
                        <span className="text-red-600 font-medium">
                          {tieneContratosAnteriores ? 'Contrato expirado' : 'Sin contrato'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3">
                          <button
                            onClick={() => openNewFormForConductor(conductor.id)}
                            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            Crear contrato
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingContrato ? 'Editar Contrato' : 'Nuevo Contrato'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Conductor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conductor *</label>
                <select
                  value={formData.conductor_id}
                  onChange={(e) => setFormData({ ...formData, conductor_id: parseInt(e.target.value) })}
                  className="input"
                  disabled={!!editingContrato}
                >
                  <option value={0}>Seleccionar conductor...</option>
                  {conductores.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellidos} ({c.dni})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                  <input
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={formData.fecha_fin}
                    onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Tipo y Horas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Contrato</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horas/Semana</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.horas_semanales}
                    onChange={(e) => setFormData({ ...formData, horas_semanales: parseInt(e.target.value) || 40 })}
                    className="input"
                  />
                </div>
              </div>

              {/* Disponibilidad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cobra Disponibilidad</label>
                <select
                  value={formData.cobra_disponibilidad}
                  onChange={(e) => setFormData({ ...formData, cobra_disponibilidad: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={0}>No</option>
                  <option value={1}>Si</option>
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.conductor_id || !formData.fecha_inicio}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
