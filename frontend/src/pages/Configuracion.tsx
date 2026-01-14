import { useState, useEffect } from 'react';
import { configApi } from '../services/api';
import { Settings, Save, Euro } from 'lucide-react';

interface ConfigItem {
  valor: string;
  descripcion: string;
}

interface ConfigState {
  [key: string]: ConfigItem;
}

const CONFIG_LABELS: { [key: string]: string } = {
  importe_domingo_festivo: 'Importe por domingo/festivo trabajado',
  importe_compensatorio_no_disfrutado: 'Importe por dia compensatorio no disfrutado',
  semanas_limite_compensatorio: 'Semanas limite para compensatorio',
};

export default function Configuracion() {
  const [config, setConfig] = useState<ConfigState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<{ [key: string]: string }>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await configApi.getAll();
        setConfig(response.data);
        // Inicializar valores editados
        const values: { [key: string]: string } = {};
        Object.entries(response.data).forEach(([key, item]) => {
          values[key] = (item as ConfigItem).valor;
        });
        setEditedValues(values);
      } catch (error) {
        console.error('Error cargando configuracion:', error);
        setMessage({ type: 'error', text: 'Error cargando la configuracion' });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleChange = (clave: string, valor: string) => {
    setEditedValues(prev => ({ ...prev, [clave]: valor }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await configApi.updateBatch(editedValues);
      setMessage({ type: 'success', text: 'Configuracion guardada correctamente' });

      // Actualizar estado local
      const newConfig = { ...config };
      Object.entries(editedValues).forEach(([key, valor]) => {
        if (newConfig[key]) {
          newConfig[key] = { ...newConfig[key], valor };
        }
      });
      setConfig(newConfig);
    } catch (error) {
      console.error('Error guardando configuracion:', error);
      setMessage({ type: 'error', text: 'Error guardando la configuracion' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    return Object.entries(editedValues).some(([key, valor]) => {
      return config[key]?.valor !== valor;
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
          <Settings className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Configuracion</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6">
        {/* Importes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-gray-500" />
            Importes
          </h2>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {CONFIG_LABELS.importe_domingo_festivo}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={editedValues.importe_domingo_festivo || ''}
                  onChange={(e) => handleChange('importe_domingo_festivo', e.target.value)}
                  className="input pr-8"
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">EUR</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Importe a pagar cuando un conductor trabaja en domingo o festivo nacional
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {CONFIG_LABELS.importe_compensatorio_no_disfrutado}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={editedValues.importe_compensatorio_no_disfrutado || ''}
                  onChange={(e) => handleChange('importe_compensatorio_no_disfrutado', e.target.value)}
                  className="input pr-8"
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">EUR</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Importe a pagar por cada dia de descanso compensatorio no disfrutado dentro del plazo
              </p>
            </div>
          </div>
        </div>

        {/* Reglas de descanso */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reglas de descanso compensatorio
          </h2>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {CONFIG_LABELS.semanas_limite_compensatorio}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={editedValues.semanas_limite_compensatorio || ''}
                  onChange={(e) => handleChange('semanas_limite_compensatorio', e.target.value)}
                  className="input pr-16"
                  min="1"
                  max="52"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">semanas</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Numero de semanas maximo para disfrutar el descanso compensatorio (por defecto 14 semanas segun normativa)
              </p>
            </div>
          </div>
        </div>

        {/* Info sobre periodos */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Informacion sobre periodos
          </h2>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>Los periodos de trabajo van del <strong>dia 26</strong> de un mes al <strong>dia 25</strong> del mes siguiente.</li>
            <li>Cada semana un conductor debe tener <strong>2 dias de descanso</strong>.</li>
            <li>Si no disfruta los 2 dias, tiene derecho a <strong>descanso compensatorio</strong> dentro de las semanas configuradas.</li>
            <li>El descanso compensatorio debe ir unido a un <strong>descanso de 45 horas</strong>.</li>
            <li>Si no se disfruta en plazo, se abonara el importe configurado por dia.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
