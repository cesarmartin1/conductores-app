import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { conductoresApi } from '../services/api';
import { Plus, Search, Edit2, Trash2, Eye, Upload } from 'lucide-react';

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
  contrato_activo_tipo?: string | null;
  porcentaje_jornada?: number | null;
  contrato_activo_porcentaje?: number | null;
  contrato_activo_por_horas?: number | null;
}

export default function Conductores() {
  const { isAdmin } = useAuth();
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingConductor, setEditingConductor] = useState<Conductor | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; importados: number; actualizados: number; errores: string[] } | null>(null);

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
    `${c.nombre} ${c.apellidos} ${c.apodo || ''} ${c.dni}`.toLowerCase().includes(search.toLowerCase())
  );
  const getPorcentajeActivo = (c: Conductor) => c.contrato_activo_porcentaje ?? c.porcentaje_jornada ?? 100;
  const esPorHoras = (c: Conductor) => c.contrato_activo_por_horas === 1;
  const porHoras = filteredConductores.filter(c => esPorHoras(c));
  const temporalesActivos = filteredConductores.filter(c => !esPorHoras(c) && c.contrato_activo_tipo === 'temporal');
  const restoConductores = filteredConductores.filter(c => !esPorHoras(c) && c.contrato_activo_tipo !== 'temporal');

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Importar Excel
            </button>
            <button
              onClick={() => { setEditingConductor(null); setShowForm(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nuevo conductor
            </button>
          </div>
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
      <div className="card space-y-6">
        {porHoras.length > 0 && (
          <div className="border border-sky-200 bg-sky-50/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-sky-800">Por horas</h2>
              <span className="text-xs font-semibold text-sky-700 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-full">
                {porHoras.length}
              </span>
            </div>
            <ConductoresTable
              conductores={porHoras}
              isAdmin={isAdmin}
              onEdit={(c) => { setEditingConductor(c); setShowForm(true); }}
              onDelete={handleDelete}
              esPorHoras={esPorHoras}
              getPorcentajeActivo={getPorcentajeActivo}
              groupLabel="Por horas"
            />
          </div>
        )}

        {temporalesActivos.length > 0 && (
          <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-amber-800">Temporales con contrato activo</h2>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                {temporalesActivos.length}
              </span>
            </div>
            <ConductoresTable
              conductores={temporalesActivos}
              isAdmin={isAdmin}
              onEdit={(c) => { setEditingConductor(c); setShowForm(true); }}
              onDelete={handleDelete}
              esPorHoras={esPorHoras}
              getPorcentajeActivo={getPorcentajeActivo}
              groupLabel="Temporales con contrato activo"
            />
          </div>
        )}

        <div>
          <div className="border border-gray-200 bg-white rounded-lg p-4">
            {(porHoras.length > 0 || temporalesActivos.length > 0) && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Resto de conductores</h2>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  {restoConductores.length}
                </span>
              </div>
            )}
          <ConductoresTable
            conductores={restoConductores}
            isAdmin={isAdmin}
            onEdit={(c) => { setEditingConductor(c); setShowForm(true); }}
            onDelete={handleDelete}
            esPorHoras={esPorHoras}
            getPorcentajeActivo={getPorcentajeActivo}
            groupLabel={porHoras.length > 0 || temporalesActivos.length > 0 ? 'Resto de conductores' : undefined}
          />
          </div>
        </div>

        {filteredConductores.length === 0 && (
          <p className="text-center text-gray-500 py-2">No se encontraron conductores</p>
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

      {/* Modal Import */}
      {showImport && (
        <ImportModal
          onClose={() => { setShowImport(false); setImportResult(null); }}
          onImport={async (filePath) => {
            try {
              const response = await conductoresApi.importarExcel(filePath);
              setImportResult(response.data);
              fetchConductores();
            } catch (err: any) {
              setImportResult({
                message: 'Error',
                importados: 0,
                actualizados: 0,
                errores: [err.response?.data?.error || 'Error importando archivo']
              });
            }
          }}
          result={importResult}
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
    apodo: conductor?.apodo || '',
    dni: conductor?.dni || '',
    licencia: conductor?.licencia || '',
    telefono: conductor?.telefono || '',
    fechaAlta: conductor?.fecha_alta || new Date().toISOString().split('T')[0],
    porcentaje_jornada: conductor?.porcentaje_jornada ?? 100,
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Apodo (opcional)</label>
            <input
              type="text"
              value={formData.apodo}
              onChange={(e) => setFormData({ ...formData, apodo: e.target.value })}
              className="input"
            />
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

function ConductoresTable({
  conductores,
  isAdmin,
  onEdit,
  onDelete,
  esPorHoras,
  getPorcentajeActivo,
  groupLabel
}: {
  conductores: Conductor[];
  isAdmin: boolean;
  onEdit: (conductor: Conductor) => void;
  onDelete: (id: number) => void;
  esPorHoras: (conductor: Conductor) => boolean;
  getPorcentajeActivo: (conductor: Conductor) => number;
  groupLabel?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          {groupLabel && (
            <tr className="text-left text-xs text-gray-600 bg-gray-50">
              <th className="py-2 px-2 font-semibold border-b" colSpan={7}>
                {groupLabel}
              </th>
            </tr>
          )}
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
          {conductores.map((conductor) => (
            <tr key={conductor.id} className="hover:bg-gray-50">
              <td className="py-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {conductor.apodo || `${conductor.nombre} ${conductor.apellidos}`}
                  </span>
                  {esPorHoras(conductor) ? (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      Por horas
                    </span>
                  ) : getPorcentajeActivo(conductor) < 100 ? (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      {getPorcentajeActivo(conductor)}% jornada
                    </span>
                  ) : null}
                </div>
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
                        onClick={() => onEdit(conductor)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(conductor.id)}
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

      {conductores.length === 0 && (
        <p className="text-center text-gray-500 py-4">No hay conductores en este grupo</p>
      )}
    </div>
  );
}

interface ImportModalProps {
  onClose: () => void;
  onImport: (filePath: string) => void;
  result: { message: string; importados: number; actualizados: number; errores: string[] } | null;
}

function ImportModal({ onClose, onImport, result }: ImportModalProps) {
  const [filePath, setFilePath] = useState('/Users/cesarmartin/Library/CloudStorage/OneDrive-AutocaresDavid/supercarpeta/Conductores.xlsx');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    await onImport(filePath);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Importar conductores desde Excel</h2>
        </div>

        <div className="p-6 space-y-4">
          {!result ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruta del archivo Excel
                </label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="input"
                  placeholder="/ruta/al/archivo.xlsx"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Introduce la ruta completa del archivo Excel en tu sistema
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                <p className="font-medium mb-1">Formato esperado:</p>
                <p>El Excel debe tener las columnas: NIF, Nombre, Teléfono, Clase de permiso, Alta Empresa, Estado</p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${result.errores.length > 0 && result.importados === 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className={`font-medium ${result.errores.length > 0 && result.importados === 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {result.message}
                </p>
                <div className="mt-2 text-sm">
                  <p>Importados: {result.importados}</p>
                  <p>Actualizados: {result.actualizados}</p>
                </div>
              </div>

              {result.errores.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="font-medium text-yellow-700 mb-2">Errores ({result.errores.length}):</p>
                  <ul className="text-sm text-yellow-600 list-disc list-inside max-h-32 overflow-y-auto">
                    {result.errores.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              {result ? 'Cerrar' : 'Cancelar'}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={loading || !filePath}
                className="btn-primary flex-1"
              >
                {loading ? 'Importando...' : 'Importar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
