import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { jornadasApi } from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Coffee,
  Sun,
  AlertTriangle,
  Percent
} from 'lucide-react';

type TipoJornada = 'trabajo' | 'descanso_normal' | 'descanso_reducido' | 'festivo' | 'vacaciones' | 'baja' | 'formacion' | 'inactivo' | null;

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
}

interface AlertaDescanso {
  diasConsecutivosTrabajados: number;
  diasHastaDescansoObligatorio: number;
  proximoDescansoRequerido: '24h' | '45h';
  alertas: { tipo: 'error' | 'warning' | 'info'; mensaje: string }[];
}

interface CuadranteData {
  conductores: Conductor[];
  jornadas: { [key: string]: string };
  festivos: { [key: string]: string };
  alertas: { [key: number]: AlertaDescanso };
}

interface ResumenConductor {
  diasTrabajados: number;
  diasDescanso: number;
  domingosTrabajados: number;
  festivosTrabajados: number;
  porcentajeTrabajado: number;
  diasPendientesDescanso: number;
}

// Configuracion de tipos
const TIPOS_CONFIG: { [key: string]: { label: string; short: string; color: string; bgColor: string } } = {
  trabajo: { label: 'Trabajo', short: 'T', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  descanso_normal: { label: 'Descanso Normal (45h)', short: '45', color: 'text-green-700', bgColor: 'bg-green-200' },
  descanso_reducido: { label: 'Descanso Reducido (24h)', short: '24', color: 'text-green-600', bgColor: 'bg-green-100' },
  vacaciones: { label: 'Vacaciones', short: 'V', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  baja: { label: 'Baja', short: 'B', color: 'text-red-700', bgColor: 'bg-red-100' },
  formacion: { label: 'Formacion', short: 'Fo', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  inactivo: { label: 'Inactivo', short: 'I', color: 'text-gray-700', bgColor: 'bg-gray-200' },
};

// Tipos que cuentan como descanso
const TIPOS_DESCANSO = ['descanso_normal', 'descanso_reducido', 'vacaciones'];

export default function Cuadrante() {
  // El periodo va del 26 del mes anterior al 25 del mes actual
  // Usamos el mes actual como referencia
  const hoy = new Date();
  const [mesReferencia, setMesReferencia] = useState(hoy.getMonth() + 1); // 1-12
  const [añoReferencia, setAñoReferencia] = useState(hoy.getFullYear());

  const [data, setData] = useState<CuadranteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ conductorId: number; fecha: string } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showHorasInput, setShowHorasInput] = useState(false);
  const [horasTrabajo, setHorasTrabajo] = useState(8);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calcular fechas del periodo (26 del mes anterior al 25 del mes actual)
  const calcularPeriodo = () => {
    // Mes anterior
    let mesInicio = mesReferencia - 1;
    let añoInicio = añoReferencia;
    if (mesInicio < 1) {
      mesInicio = 12;
      añoInicio--;
    }

    const desde = `${añoInicio}-${String(mesInicio).padStart(2, '0')}-26`;
    const hasta = `${añoReferencia}-${String(mesReferencia).padStart(2, '0')}-25`;

    return { desde, hasta, mesInicio, añoInicio };
  };

  // Obtener dias del periodo
  const getDiasDelPeriodo = () => {
    const { desde, hasta } = calcularPeriodo();
    const inicio = new Date(desde);
    const fin = new Date(hasta);
    const dias: Date[] = [];

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      dias.push(new Date(d));
    }
    return dias;
  };

  const dias = getDiasDelPeriodo();
  const { desde, hasta, mesInicio, añoInicio } = calcularPeriodo();

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await jornadasApi.getCuadrante(desde, hasta);
        setData(response.data);
      } catch (error) {
        console.error('Error cargando cuadrante:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [desde, hasta]);

  // Cerrar menu al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setSelectedCell(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navegar periodo
  const cambiarPeriodo = (delta: number) => {
    let nuevoMes = mesReferencia + delta;
    let nuevoAño = añoReferencia;

    if (nuevoMes > 12) {
      nuevoMes = 1;
      nuevoAño++;
    } else if (nuevoMes < 1) {
      nuevoMes = 12;
      nuevoAño--;
    }

    setMesReferencia(nuevoMes);
    setAñoReferencia(nuevoAño);
  };

  // Manejar click en celda
  const handleCellClick = (conductorId: number, fecha: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setSelectedCell({ conductorId, fecha });
    setMenuPosition({
      x: Math.min(rect.left, window.innerWidth - 220),
      y: Math.min(rect.bottom + 5, window.innerHeight - 350)
    });
  };

  // Actualizar celda
  const handleTipoSelect = async (tipo: TipoJornada, horas?: number) => {
    if (!selectedCell) return;

    // Si es trabajo y no tenemos las horas, mostrar input
    if (tipo === 'trabajo' && !showHorasInput) {
      setShowHorasInput(true);
      setHorasTrabajo(8);
      return;
    }

    try {
      const response = await jornadasApi.updateCelda(
        selectedCell.conductorId,
        selectedCell.fecha,
        tipo,
        tipo === 'trabajo' ? (horas ?? horasTrabajo) : undefined
      );
      const fechasActualizadas: string[] = response.data.fechas || [selectedCell.fecha];

      setData(prev => {
        if (!prev) return prev;
        const newJornadas = { ...prev.jornadas };

        fechasActualizadas.forEach(fecha => {
          const key = `${selectedCell.conductorId}-${fecha}`;
          if (tipo) {
            newJornadas[key] = tipo;
          } else {
            delete newJornadas[key];
          }
        });

        return { ...prev, jornadas: newJornadas };
      });
    } catch (error) {
      console.error('Error actualizando celda:', error);
    }

    setSelectedCell(null);
    setMenuPosition(null);
    setShowHorasInput(false);
  };

  // Obtener tipo de jornada para una celda
  const getTipo = (conductorId: number, fecha: string): string | null => {
    if (!data) return null;
    return data.jornadas[`${conductorId}-${fecha}`] || null;
  };

  // Verificar si es festivo nacional
  const esFestivo = (fecha: string): string | null => {
    if (!data) return null;
    return data.festivos[fecha] || null;
  };

  // Formatear fecha
  const formatFecha = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Obtener nombre del periodo
  const getNombrePeriodo = () => {
    const mesInicioNombre = new Date(añoInicio, mesInicio - 1).toLocaleDateString('es-ES', { month: 'short' });
    const mesFinNombre = new Date(añoReferencia, mesReferencia - 1).toLocaleDateString('es-ES', { month: 'short' });
    return `26 ${mesInicioNombre} - 25 ${mesFinNombre} ${añoReferencia}`;
  };

  // Obtener dia de la semana
  const getDiaSemana = (date: Date): string => {
    return date.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase();
  };

  // Verificar si es domingo
  const esDomingo = (date: Date): boolean => {
    return date.getDay() === 0;
  };

  // Verificar si es fin de semana
  const esFinDeSemana = (date: Date): boolean => {
    const dia = date.getDay();
    return dia === 0 || dia === 6;
  };

  // Calcular resumen para un conductor
  const calcularResumen = (conductorId: number): ResumenConductor => {
    if (!data) return {
      diasTrabajados: 0,
      diasDescanso: 0,
      domingosTrabajados: 0,
      festivosTrabajados: 0,
      porcentajeTrabajado: 0,
      diasPendientesDescanso: 0
    };

    let diasTrabajados = 0;
    let diasDescanso = 0;
    let domingosTrabajados = 0;
    let festivosTrabajados = 0;

    // Contar por semanas para calcular descansos pendientes
    const semanas: { [key: string]: { trabajo: number; descanso: number } } = {};

    dias.forEach(dia => {
      const fecha = formatFecha(dia);
      const tipo = getTipo(conductorId, fecha);
      const festivo = esFestivo(fecha);
      const domingo = esDomingo(dia);

      // Calcular semana ISO
      const semanaKey = getWeekKey(dia);
      if (!semanas[semanaKey]) {
        semanas[semanaKey] = { trabajo: 0, descanso: 0 };
      }

      if (tipo === 'trabajo') {
        diasTrabajados++;
        semanas[semanaKey].trabajo++;

        if (domingo) {
          domingosTrabajados++;
        }
        if (festivo) {
          festivosTrabajados++;
        }
      } else if (tipo && TIPOS_DESCANSO.includes(tipo)) {
        diasDescanso++;
        semanas[semanaKey].descanso++;
      }
    });

    // Calcular dias pendientes de descanso (2 por semana - disfrutados)
    let diasPendientesDescanso = 0;
    Object.values(semanas).forEach(semana => {
      if (semana.trabajo > 0) { // Solo si trabajo esa semana
        const descansoEsperado = 2;
        const diferencia = descansoEsperado - semana.descanso;
        if (diferencia > 0) {
          diasPendientesDescanso += diferencia;
        }
      }
    });

    const totalDias = dias.length;
    const porcentajeTrabajado = totalDias > 0 ? Math.round((diasTrabajados / totalDias) * 100) : 0;

    return {
      diasTrabajados,
      diasDescanso,
      domingosTrabajados,
      festivosTrabajados,
      porcentajeTrabajado,
      diasPendientesDescanso
    };
  };

  // Obtener clave de semana ISO
  const getWeekKey = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${weekNum}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cuadrante de Descansos</h1>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2">
            <button
              onClick={() => cambiarPeriodo(-1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {getNombrePeriodo()}
            </span>
            <button
              onClick={() => cambiarPeriodo(1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
        {Object.entries(TIPOS_CONFIG).map(([key, config]) => (
          <div key={key} className={`px-2 py-1 rounded ${config.bgColor} ${config.color}`}>
            {config.short}
          </div>
        ))}
        <span className="text-gray-400 mx-2">|</span>
        <div className="flex items-center gap-4 text-gray-600">
          <span><Coffee className="w-3 h-3 inline mr-1" />Descansos</span>
          <span><Sun className="w-3 h-3 inline mr-1" />Dom/Fest trabajados</span>
          <span><AlertTriangle className="w-3 h-3 inline mr-1" />Pendientes</span>
          <span><Percent className="w-3 h-3 inline mr-1" />% Trabajado</span>
        </div>
      </div>

      {/* Tabla del cuadrante */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-2 py-2 text-left text-xs font-medium text-gray-700 border-b border-r min-w-[150px]">
                Conductor
              </th>
              {dias.map(dia => {
                const fecha = formatFecha(dia);
                const festivo = esFestivo(fecha);
                const finDeSemana = esFinDeSemana(dia);
                const domingo = esDomingo(dia);

                return (
                  <th
                    key={fecha}
                    className={`px-0.5 py-1 text-center text-[10px] font-medium border-b min-w-[28px] ${
                      festivo ? 'bg-purple-100 text-purple-700' :
                      domingo ? 'bg-red-50 text-red-600' :
                      finDeSemana ? 'bg-gray-100 text-gray-600' : 'text-gray-700'
                    }`}
                    title={festivo || undefined}
                  >
                    <div>{getDiaSemana(dia)}</div>
                    <div className="font-bold">{dia.getDate()}</div>
                  </th>
                );
              })}
              {/* Columnas de resumen */}
              <th className="px-2 py-2 text-center text-[10px] font-medium border-b border-l bg-blue-50 text-blue-700 min-w-[40px]" title="Dias de descanso disfrutados">
                <Coffee className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium border-b bg-orange-50 text-orange-700 min-w-[40px]" title="Domingos y festivos trabajados">
                <Sun className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium border-b bg-red-50 text-red-700 min-w-[40px]" title="Dias de descanso pendientes">
                <AlertTriangle className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium border-b bg-gray-100 text-gray-700 min-w-[40px]" title="Porcentaje de dias trabajados">
                <Percent className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium border-b bg-yellow-50 text-yellow-700 min-w-[50px]" title="Dias consecutivos trabajados">
                <Calendar className="w-3 h-3 mx-auto" />
                <span className="text-[8px]">Consec</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.conductores.map(conductor => {
              const resumen = calcularResumen(conductor.id);

              return (
                <tr key={conductor.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-2 py-1.5 text-xs font-medium border-b border-r whitespace-nowrap">
                    <Link
                      to={`/conductores/${conductor.id}`}
                      className="text-gray-900 hover:text-primary-600 hover:underline"
                    >
                      {conductor.nombre} {conductor.apellidos.split(' ')[0]}
                    </Link>
                  </td>
                  {dias.map(dia => {
                    const fecha = formatFecha(dia);
                    const tipo = getTipo(conductor.id, fecha);
                    const festivo = esFestivo(fecha);
                    const finDeSemana = esFinDeSemana(dia);
                    const domingo = esDomingo(dia);
                    const config = tipo ? TIPOS_CONFIG[tipo] : null;

                    return (
                      <td
                        key={fecha}
                        onClick={(e) => handleCellClick(conductor.id, fecha, e)}
                        className={`px-0.5 py-1 text-center border-b cursor-pointer transition-colors ${
                          config ? `${config.bgColor} ${config.color}` :
                          festivo ? 'bg-purple-50' :
                          domingo ? 'bg-red-50' :
                          finDeSemana ? 'bg-gray-50' : ''
                        } hover:ring-2 hover:ring-primary-400 hover:ring-inset`}
                        title={festivo || undefined}
                      >
                        <span className="text-[10px] font-bold">
                          {config?.short || ''}
                        </span>
                      </td>
                    );
                  })}
                  {/* Celdas de resumen */}
                  <td className="px-2 py-1 text-center border-b border-l bg-blue-50 text-blue-700 font-bold">
                    {resumen.diasDescanso}
                  </td>
                  <td className="px-2 py-1 text-center border-b bg-orange-50 font-bold">
                    <span className={resumen.domingosTrabajados + resumen.festivosTrabajados > 0 ? 'text-orange-700' : 'text-gray-400'}>
                      {resumen.domingosTrabajados + resumen.festivosTrabajados}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center border-b bg-red-50 font-bold">
                    <span className={resumen.diasPendientesDescanso > 0 ? 'text-red-700' : 'text-gray-400'}>
                      {resumen.diasPendientesDescanso}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center border-b bg-gray-100 text-gray-700 font-bold">
                    {resumen.porcentajeTrabajado}%
                  </td>
                  <td className={`px-2 py-1 text-center border-b font-bold text-[10px] ${
                    data?.alertas?.[conductor.id]?.diasConsecutivosTrabajados >= 7 ? 'bg-red-200 text-red-800' :
                    data?.alertas?.[conductor.id]?.diasConsecutivosTrabajados >= 6 ? 'bg-red-100 text-red-700' :
                    data?.alertas?.[conductor.id]?.diasConsecutivosTrabajados >= 5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-yellow-50 text-gray-600'
                  }`} title={data?.alertas?.[conductor.id]?.alertas?.[0]?.mensaje || `${data?.alertas?.[conductor.id]?.diasConsecutivosTrabajados || 0} días consecutivos`}>
                    {data?.alertas?.[conductor.id]?.diasConsecutivosTrabajados >= 6 && (
                      <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                    )}
                    {data?.alertas?.[conductor.id]?.diasConsecutivosTrabajados || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Menu de seleccion */}
      {selectedCell && menuPosition && (
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
          style={{ left: menuPosition.x, top: menuPosition.y, minWidth: '220px' }}
        >
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {new Date(selectedCell.fecha).toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
            </span>
            <button
              onClick={() => { setSelectedCell(null); setMenuPosition(null); setShowHorasInput(false); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {showHorasInput ? (
            <div className="px-3 py-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Horas trabajadas</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={horasTrabajo}
                  onChange={(e) => setHorasTrabajo(parseInt(e.target.value) || 8)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  autoFocus
                />
                <button
                  onClick={() => handleTipoSelect('trabajo', horasTrabajo)}
                  className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              {Object.entries(TIPOS_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleTipoSelect(key as TipoJornada)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${config.color}`}
                >
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${config.bgColor}`}>
                    {config.short}
                  </span>
                  {config.label}
                </button>
              ))}

              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => handleTipoSelect(null)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-[10px]">
                    -
                  </span>
                  Borrar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
