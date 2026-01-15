import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { guardiasApi } from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Euro
} from 'lucide-react';

type TipoJornada = 'trabajo' | 'vacaciones' | 'baja' | 'inactivo' | null;

interface ContratoGuardia {
  id: number;
  guardia_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_contrato: string;
  notas: string | null;
}

interface Guardia {
  id: number;
  nombre: string;
  apellidos: string;
  dni: string;
  fecha_alta: string;
  conductor_id: number | null;
  contratos: ContratoGuardia[];
}

interface CuadranteData {
  guardias: Guardia[];
  jornadas: { [key: string]: { tipo: string; turno: string | null; horas: number } };
  conductorJornadas: { [key: string]: string };
}

interface ResumenGuardia {
  diasTrabajados: number;
  totalEuros: number;
}

const PRECIO_DIA_GUARDIA = 36.67;

// Configuracion de tipos
const TIPOS_CONFIG: { [key: string]: { label: string; short: string; color: string; bgColor: string } } = {
  trabajo: { label: 'Guardia', short: 'G', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  vacaciones: { label: 'Vacaciones', short: 'V', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  baja: { label: 'Baja', short: 'B', color: 'text-red-700', bgColor: 'bg-red-100' },
  inactivo: { label: 'Inactivo', short: 'I', color: 'text-gray-700', bgColor: 'bg-gray-200' },
};

export default function CuadranteGuardias() {
  const navigate = useNavigate();
  const hoy = new Date();
  const [mesReferencia, setMesReferencia] = useState(hoy.getMonth() + 1);
  const [añoReferencia, setAñoReferencia] = useState(hoy.getFullYear());

  const [data, setData] = useState<CuadranteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ guardiaId: number; fecha: string } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calcular fechas del periodo (26 del mes anterior al 25 del mes actual)
  const calcularPeriodo = () => {
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
        const response = await guardiasApi.getCuadrante(desde, hasta);
        setData(response.data);
      } catch (error) {
        console.error('Error cargando cuadrante de guardias:', error);
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
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeMenu = () => {
    setSelectedCell(null);
    setMenuPosition(null);
  };

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
  const handleCellClick = (guardiaId: number, fecha: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setSelectedCell({ guardiaId, fecha });
    setMenuPosition({
      x: Math.min(rect.left, window.innerWidth - 220),
      y: Math.min(rect.bottom + 5, window.innerHeight - 300)
    });
  };

  // Guardar jornada
  const saveJornada = async (tipo: TipoJornada) => {
    if (!selectedCell) return;
    try {
      await guardiasApi.updateCelda(
        selectedCell.guardiaId,
        selectedCell.fecha,
        tipo,
        undefined,
        tipo === 'trabajo' ? 8 : undefined
      );

      setData(prev => {
        if (!prev) return prev;
        const newJornadas = { ...prev.jornadas };
        const key = `${selectedCell.guardiaId}-${selectedCell.fecha}`;
        if (tipo) {
          newJornadas[key] = { tipo, turno: null, horas: 8 };
        } else {
          delete newJornadas[key];
        }
        return { ...prev, jornadas: newJornadas };
      });
    } catch (error) {
      console.error('Error actualizando celda:', error);
    }
    closeMenu();
  };

  // Obtener jornada para una celda
  const getJornada = (guardiaId: number, fecha: string) => {
    if (!data) return null;
    return data.jornadas[`${guardiaId}-${fecha}`] || null;
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

  // Verificar si tiene contrato activo en la fecha
  const estaActivo = (guardia: Guardia, fecha: string): boolean => {
    // Si no tiene contratos, usar fecha_alta como fallback
    if (!guardia.contratos || guardia.contratos.length === 0) {
      return fecha >= guardia.fecha_alta;
    }
    // Verificar si algún contrato cubre la fecha
    return guardia.contratos.some(c =>
      c.fecha_inicio <= fecha && (!c.fecha_fin || c.fecha_fin >= fecha)
    );
  };

  // Calcular resumen para un guardia
  const calcularResumen = (guardia: Guardia): ResumenGuardia => {
    if (!data) return {
      diasTrabajados: 0,
      totalEuros: 0
    };

    let diasTrabajados = 0;

    dias.forEach(dia => {
      const fecha = formatFecha(dia);
      if (!estaActivo(guardia, fecha)) return;

      const jornada = getJornada(guardia.id, fecha);
      if (jornada?.tipo === 'trabajo') {
        if (guardia.conductor_id) {
          const key = `${guardia.conductor_id}-${fecha}`;
          const jornadaConductor = data.conductorJornadas[key];
          if (jornadaConductor === 'trabajo') {
            return;
          }
        }
        diasTrabajados++;
      }
    });

    return {
      diasTrabajados,
      totalEuros: diasTrabajados * PRECIO_DIA_GUARDIA
    };
  };

  // Calcular total general
  const calcularTotalGeneral = (): number => {
    if (!data) return 0;
    return data.guardias.reduce((total, guardia) => {
      return total + calcularResumen(guardia).totalEuros;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totalGeneral = calcularTotalGeneral();

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cuadrante</h1>
          <select
            value="guardias"
            onChange={(e) => {
              if (e.target.value === 'conductores') navigate('/cuadrante');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white"
          >
            <option value="conductores">Conductores</option>
            <option value="guardias">Guardias</option>
          </select>
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
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold">
            Total: {totalGeneral.toFixed(2)} EUR
          </div>
        </div>
        <Link
          to="/guardias"
          className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
        >
          Gestionar guardias
        </Link>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
        {Object.entries(TIPOS_CONFIG).map(([key, config]) => (
          <div key={key} className={`px-2 py-1 rounded ${config.bgColor} ${config.color}`}>
            {config.short} = {config.label}
          </div>
        ))}
        <span className="text-gray-400 mx-2">|</span>
        <div className="flex items-center gap-4 text-gray-600">
          <span><Euro className="w-3 h-3 inline mr-1" />Total ({PRECIO_DIA_GUARDIA} EUR/dia)</span>
        </div>
      </div>

      {/* Tabla del cuadrante */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-1 py-1 text-left text-[10px] font-medium text-gray-700 border-b border-r min-w-[120px]">
                Guardia
              </th>
              {dias.map(dia => {
                const fecha = formatFecha(dia);
                const finDeSemana = esFinDeSemana(dia);
                const domingo = esDomingo(dia);

                return (
                  <th
                    key={fecha}
                    className={`px-0 py-0.5 text-center text-[9px] font-medium border-b min-w-[22px] ${
                      domingo ? 'bg-red-50 text-red-600' :
                      finDeSemana ? 'bg-gray-100 text-gray-600' : 'text-gray-700'
                    }`}
                  >
                    <div>{getDiaSemana(dia)}</div>
                    <div className="font-bold">{dia.getDate()}</div>
                  </th>
                );
              })}
              {/* Columna de resumen */}
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b border-l bg-green-50 text-green-700 min-w-[60px]" title="Total euros">
                <Euro className="w-3 h-3 mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.guardias.map(guardia => {
              const resumen = calcularResumen(guardia);

              return (
                <tr key={guardia.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-1 py-0.5 text-[10px] font-medium border-b border-r whitespace-nowrap">
                    {guardia.conductor_id ? (
                      <Link
                        to={`/conductores/${guardia.conductor_id}`}
                        className="text-primary-600 hover:text-primary-700 hover:underline"
                        title="Ver ficha de conductor"
                      >
                        {guardia.nombre} {guardia.apellidos.split(' ')[0]}
                      </Link>
                    ) : (
                      <Link
                        to={`/guardias/${guardia.id}`}
                        className="text-gray-900 hover:text-primary-600 hover:underline"
                        title="Ver ficha de guardia"
                      >
                        {guardia.nombre} {guardia.apellidos.split(' ')[0]}
                      </Link>
                    )}
                  </td>
                  {dias.map(dia => {
                    const fecha = formatFecha(dia);
                    const activo = estaActivo(guardia, fecha);
                    const jornada = getJornada(guardia.id, fecha);
                    const tipo = activo ? jornada?.tipo : 'inactivo';
                    const finDeSemana = esFinDeSemana(dia);
                    const domingo = esDomingo(dia);
                    const config = tipo ? TIPOS_CONFIG[tipo] : null;
                    const conductorTrabaja = Boolean(
                      guardia.conductor_id &&
                      data?.conductorJornadas[`${guardia.conductor_id}-${fecha}`] === 'trabajo'
                    );
                    const noAcumula = tipo === 'trabajo' && conductorTrabaja;

                    return (
                      <td
                        key={fecha}
                        onClick={activo ? (e) => handleCellClick(guardia.id, fecha, e) : undefined}
                        className={`px-0 py-0.5 text-center border-b transition-colors ${
                          activo ? 'cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-inset' : 'cursor-not-allowed opacity-60'
                        } ${
                          config ? `${config.bgColor} ${config.color}` :
                          domingo ? 'bg-red-50' :
                          finDeSemana ? 'bg-gray-50' : ''
                        } ${noAcumula ? 'opacity-50 ring-1 ring-gray-300' : ''}`}
                        title={!activo ? 'No dado de alta' : noAcumula ? 'No acumula: trabaja como conductor' : undefined}
                      >
                        <span className="text-[9px] font-bold">
                          {config?.short || ''}
                        </span>
                      </td>
                    );
                  })}
                  {/* Celda de resumen */}
                  <td className="px-1 py-0.5 text-center border-b border-l bg-green-50 text-green-700 font-bold text-[9px]">
                    {resumen.totalEuros.toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {(!data?.guardias || data.guardias.length === 0) && (
              <tr>
                <td colSpan={dias.length + 3} className="px-4 py-8 text-center text-gray-500">
                  No hay guardias registrados.{' '}
                  <Link to="/guardias" className="text-primary-600 hover:underline">
                    Crear guardias
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Menu de seleccion */}
      {selectedCell && menuPosition && (
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
          style={{ left: menuPosition.x, top: menuPosition.y, minWidth: '200px' }}
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
              onClick={closeMenu}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {Object.entries(TIPOS_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => saveJornada(key as TipoJornada)}
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
              onClick={() => saveJornada(null)}
              className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-[10px]">
                -
              </span>
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
