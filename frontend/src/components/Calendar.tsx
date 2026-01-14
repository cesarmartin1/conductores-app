import { useState } from 'react';
import { jornadasApi } from '../services/api';
import { X, AlertCircle } from 'lucide-react';

interface CalendarioDia {
  fecha: string;
  diaSemana: number;
  esFinde: boolean;
  festivo: { nombre: string } | null;
  jornada: {
    id?: number;
    tipo: string;
    horas_conduccion: number;
    horas_trabajo: number;
    notas?: string;
  } | null;
  estado: string;
}

interface CalendarProps {
  calendario: CalendarioDia[];
  conductorId: number;
  onUpdate: () => void;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const ESTADO_COLORES: Record<string, string> = {
  trabajo: 'bg-blue-100 text-blue-800 border-blue-200',
  descanso: 'bg-green-100 text-green-800 border-green-200',
  vacaciones: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  baja: 'bg-red-100 text-red-800 border-red-200',
  finde: 'bg-gray-100 text-gray-500 border-gray-200',
  pendiente: 'bg-white text-gray-400 border-gray-200',
};

export default function Calendar({ calendario, conductorId, onUpdate }: CalendarProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarioDia | null>(null);

  // Calcular el offset del primer día del mes
  const primerDia = calendario[0];
  const offset = primerDia ? (primerDia.diaSemana === 0 ? 6 : primerDia.diaSemana - 1) : 0;

  return (
    <div className="max-w-md">
      {/* Header días de la semana */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DIAS_SEMANA.map((dia, i) => (
          <div
            key={dia}
            className={`text-center text-xs font-medium py-1 ${i >= 5 ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {dia}
          </div>
        ))}
      </div>

      {/* Grid del calendario */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Espacios vacíos antes del primer día */}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}

        {/* Días del mes */}
        {calendario.map((dia) => {
          const diaNum = parseInt(dia.fecha.split('-')[2]);

          return (
            <button
              key={dia.fecha}
              onClick={() => setSelectedDay(dia)}
              className={`h-10 p-0.5 rounded border transition-all hover:ring-2 hover:ring-primary-300 ${ESTADO_COLORES[dia.estado]}`}
            >
              <div className="h-full flex flex-col items-center justify-center">
                <span className="text-xs font-medium leading-none">{diaNum}</span>
                {dia.jornada && dia.jornada.tipo === 'trabajo' && (
                  <span className="text-[9px] text-gray-500">{dia.jornada.horas_conduccion}h</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t text-xs">
        <LeyendaItem color="bg-blue-100" label="Trabajo" />
        <LeyendaItem color="bg-green-100" label="Descanso" />
        <LeyendaItem color="bg-yellow-100" label="Vacaciones" />
        <LeyendaItem color="bg-red-100" label="Baja" />
        <LeyendaItem color="bg-gray-100" label="Finde" />
      </div>

      {/* Modal de edición */}
      {selectedDay && (
        <JornadaModal
          dia={selectedDay}
          conductorId={conductorId}
          onClose={() => setSelectedDay(null)}
          onSave={() => {
            setSelectedDay(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

function LeyendaItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-3 h-3 rounded ${color}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

interface JornadaModalProps {
  dia: CalendarioDia;
  conductorId: number;
  onClose: () => void;
  onSave: () => void;
}

function JornadaModal({ dia, conductorId, onClose, onSave }: JornadaModalProps) {
  const [formData, setFormData] = useState({
    tipo: dia.jornada?.tipo || 'trabajo',
    horasConduccion: dia.jornada?.horas_conduccion || 0,
    horasTrabajo: dia.jornada?.horas_trabajo || 0,
    pausasMinutos: 45,
    descansoNocturno: 11,
    notas: dia.jornada?.notas || '',
  });
  const [validacion, setValidacion] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validarJornada = async () => {
    if (formData.tipo !== 'trabajo') return;

    try {
      const response = await jornadasApi.validar({
        conductorId,
        fecha: dia.fecha,
        horasConduccion: formData.horasConduccion,
        horasTrabajo: formData.horasTrabajo,
      });
      setValidacion(response.data);
    } catch (error) {
      console.error('Error validando:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await jornadasApi.upsert({
        conductorId,
        fecha: dia.fecha,
        ...formData,
      });
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error guardando jornada');
      if (err.response?.data?.alertas) {
        setValidacion({ alertas: err.response.data.alertas });
      }
    } finally {
      setLoading(false);
    }
  };

  const fechaFormateada = new Date(dia.fecha).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Registrar jornada</h2>
            <p className="text-sm text-gray-500 capitalize">{fechaFormateada}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Alertas de validación */}
          {validacion?.alertas?.length > 0 && (
            <div className="space-y-2">
              {validacion.alertas.map((alerta: any, i: number) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    alerta.tipo === 'error' ? 'bg-red-50 text-red-700' :
                    alerta.tipo === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-blue-50 text-blue-700'
                  }`}
                >
                  {alerta.mensaje}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de jornada</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="input"
            >
              <option value="trabajo">Trabajo</option>
              <option value="descanso">Descanso</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {formData.tipo === 'trabajo' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas conducción
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={formData.horasConduccion}
                    onChange={(e) => setFormData({ ...formData, horasConduccion: parseFloat(e.target.value) || 0 })}
                    onBlur={validarJornada}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas trabajo
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="15"
                    value={formData.horasTrabajo}
                    onChange={(e) => setFormData({ ...formData, horasTrabajo: parseFloat(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pausas (minutos)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.pausasMinutos}
                    onChange={(e) => setFormData({ ...formData, pausasMinutos: parseInt(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descanso nocturno (h)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.descansoNocturno}
                    onChange={(e) => setFormData({ ...formData, descansoNocturno: parseFloat(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
              </div>
            </>
          )}

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
