import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jornadasApi } from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Coffee,
  Sun,
  AlertTriangle,
  Percent,
  Clock,
  Euro
} from 'lucide-react';

type TipoJornada = 'trabajo' | 'descanso_normal' | 'descanso_reducido' | 'compensatorio' | 'festivo' | 'vacaciones' | 'baja' | 'formacion' | 'inactivo' | null;

interface Conductor {
  id: number;
  nombre: string;
  apellidos: string;
  apodo?: string | null;
  porcentaje_jornada?: number | null;
  contrato_activo_porcentaje?: number | null;
  contrato_activo_por_horas?: number | null;
}

interface Contrato {
  id: number;
  conductor_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_contrato: string;
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
  horas: { [key: string]: number };
  festivos: { [key: string]: string };
  festivosNacionales: { [key: string]: boolean };
  alertas: { [key: number]: AlertaDescanso };
  contratos: { [key: number]: Contrato[] };
  importeDomingoFestivo: number;
}

interface ResumenConductor {
  diasTrabajados: number;
  diasDescanso: number;
  domingosTrabajados: number;
  festivosTrabajados: number;
  festivosNacionalesTrabajados: number;
  horasTrabajadas: number;
  importeDomingosFestivos: number;
  porcentajeTrabajado: number;
  diasPendientesDescanso: number;
}

// Configuracion de tipos
const TIPOS_CONFIG: { [key: string]: { label: string; short: string; color: string; bgColor: string } } = {
  trabajo: { label: 'Trabajo', short: 'T', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  descanso_normal: { label: 'Descanso Normal (45h)', short: '45', color: 'text-green-700', bgColor: 'bg-green-200' },
  descanso_reducido: { label: 'Descanso Reducido (24h)', short: '24', color: 'text-green-600', bgColor: 'bg-green-100' },
  compensatorio: { label: 'Compensatorio', short: 'COM', color: 'text-purple-700', bgColor: 'bg-purple-200' },
  vacaciones: { label: 'Vacaciones', short: 'V', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  baja: { label: 'Baja', short: 'B', color: 'text-red-700', bgColor: 'bg-red-100' },
  formacion: { label: 'Formacion', short: 'Fo', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  inactivo: { label: 'Inactivo', short: 'I', color: 'text-gray-700', bgColor: 'bg-gray-200' },
};

// Tipos que cuentan como descanso (vacaciones NO cuenta, se excluye del período)
const TIPOS_DESCANSO = ['descanso_normal', 'descanso_reducido', 'compensatorio'];

// Función para calcular color de gradiente según porcentaje (rojo → amarillo → verde)
const getGradientColor = (percentage: number): string => {
  // Normalizar entre 0 y 100
  const p = Math.max(0, Math.min(100, percentage));

  let r, g, b;

  if (p < 50) {
    // Rojo a Amarillo (0-50%)
    r = 255;
    g = Math.round((p / 50) * 200);
    b = 50;
  } else {
    // Amarillo a Verde (50-100%)
    r = Math.round(255 - ((p - 50) / 50) * 200);
    g = 200;
    b = 50;
  }

  return `rgb(${r}, ${g}, ${b})`;
};

export default function Cuadrante() {
  const navigate = useNavigate();

  // El periodo va del 26 del mes anterior al 25 del mes actual
  // Usamos el mes actual como referencia
  const hoy = new Date();
  const [mesReferencia, setMesReferencia] = useState(hoy.getMonth() + 1); // 1-12
  const [añoReferencia, setAñoReferencia] = useState(hoy.getFullYear());

  const [data, setData] = useState<CuadranteData | null>(null);
  const [prevData, setPrevData] = useState<CuadranteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ conductorId: number; fecha: string } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showHorasInput, setShowHorasInput] = useState(false);
  const [horasTrabajo, setHorasTrabajo] = useState(8);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calcular fechas del periodo (26 del mes anterior al 25 del mes actual)
  const calcularPeriodo = (mes = mesReferencia, año = añoReferencia) => {
    let mesInicio = mes - 1;
    let añoInicio = año;
    if (mesInicio < 1) {
      mesInicio = 12;
      añoInicio--;
    }

    const desde = `${añoInicio}-${String(mesInicio).padStart(2, '0')}-26`;
    const hasta = `${año}-${String(mes).padStart(2, '0')}-25`;

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
  const { desde: prevDesde, hasta: prevHasta } = calcularPeriodo(
    mesReferencia === 1 ? 12 : mesReferencia - 1,
    mesReferencia === 1 ? añoReferencia - 1 : añoReferencia
  );

  // Cargar datos
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await jornadasApi.getCuadrante(desde, hasta);
        setData(response.data);
        const prevResponse = await jornadasApi.getCuadrante(prevDesde, prevHasta);
        setPrevData(prevResponse.data);
      } catch (error) {
        console.error('Error cargando cuadrante:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [desde, hasta, prevDesde, prevHasta]);

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

  const esPorHorasId = (conductorId: number): boolean => {
    if (!data) return false;
    const conductor = data.conductores.find(c => c.id === conductorId);
    return conductor ? esPorHoras(conductor) : false;
  };

  // Actualizar celda
  const handleTipoSelect = async (tipo: TipoJornada, horas?: number) => {
    if (!selectedCell) return;

    // Si es trabajo y no tenemos las horas, mostrar input
    if (tipo === 'trabajo' && !showHorasInput) {
      if (esPorHorasId(selectedCell.conductorId)) {
        setShowHorasInput(true);
        setHorasTrabajo(8);
        return;
      }
    }

    try {
      const horasToSend = tipo === 'trabajo' ? (horas ?? horasTrabajo ?? 8) : undefined;
      const response = await jornadasApi.updateCelda(
        selectedCell.conductorId,
        selectedCell.fecha,
        tipo,
        horasToSend
      );
      const fechasActualizadas: string[] = response.data.fechas || [selectedCell.fecha];
      const tipoAplicado: TipoJornada = response.data.tipo ?? tipo;

      setData(prev => {
        if (!prev) return prev;
        const newJornadas = { ...prev.jornadas };

        fechasActualizadas.forEach(fecha => {
          const key = `${selectedCell.conductorId}-${fecha}`;
          if (tipoAplicado) {
            newJornadas[key] = tipoAplicado;
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

  // Verificar si una fecha está dentro de algún contrato del conductor
  const estaEnContrato = (conductorId: number, fecha: string): boolean => {
    if (!data) return true;

    const contratosDelConductor = data.contratos[conductorId] || [];

    // Si no tiene contratos registrados, asumimos que está en contrato (compatibilidad)
    if (contratosDelConductor.length === 0) {
      return true;
    }

    // Verificar si la fecha cae dentro de alguno de los contratos
    return contratosDelConductor.some(contrato => {
      const despuesDeInicio = fecha >= contrato.fecha_inicio;
      const antesOSinFin = !contrato.fecha_fin || fecha <= contrato.fecha_fin;
      return despuesDeInicio && antesOSinFin;
    });
  };

  const esTemporalActivoEnPeriodo = (conductorId: number): boolean => {
    if (!data) return false;
    const contratosDelConductor = data.contratos[conductorId] || [];
    if (contratosDelConductor.length === 0) return false;

    return contratosDelConductor.some(contrato => {
      if (contrato.tipo_contrato !== 'temporal') return false;
      const inicioContrato = contrato.fecha_inicio;
      const finContrato = contrato.fecha_fin || '9999-12-31';
      return inicioContrato <= hasta && finContrato >= desde;
    });
  };

  const getPorcentajeActivo = (conductor: Conductor): number => {
    return conductor.contrato_activo_porcentaje ?? conductor.porcentaje_jornada ?? 100;
  };

  const esPorHoras = (conductor: Conductor): boolean => {
    return conductor.contrato_activo_por_horas === 1;
  };

  // Calcular resumen para un conductor
  const calcularResumen = (conductor: Conductor): ResumenConductor => {
    if (!data) return {
      diasTrabajados: 0,
      diasDescanso: 0,
      domingosTrabajados: 0,
      festivosTrabajados: 0,
      festivosNacionalesTrabajados: 0,
      horasTrabajadas: 0,
      importeDomingosFestivos: 0,
      porcentajeTrabajado: 0,
      diasPendientesDescanso: 0
    };

    let diasTrabajados = 0;
    let diasDescanso = 0;
    let domingosTrabajados = 0;
    let festivosTrabajados = 0;
    let festivosNacionalesTrabajados = 0;
    let horasTrabajadas = 0;
    let diasNoDisponibles = 0; // vacaciones, baja, inactivo
    let diasLaborables = 0;

    dias.forEach(dia => {
      const fecha = formatFecha(dia);
      const enContrato = estaEnContrato(conductor.id, fecha);
      const tipoReal = getTipo(conductor.id, fecha);
      // Si no está en contrato, contar como inactivo
      const tipo = enContrato ? tipoReal : 'inactivo';
      const festivo = esFestivo(fecha);
      const festivoNacional = data.festivosNacionales[fecha] === true;
      const domingo = esDomingo(dia);
      const esLaborable = dia.getDay() >= 1 && dia.getDay() <= 5;

      if (tipo === 'trabajo' || tipo === 'formacion') {
        diasTrabajados++;
        const horasDia = data.horas[`${conductor.id}-${fecha}`] || (tipo === 'formacion' ? 8 : 0);
        horasTrabajadas += horasDia;

        if (domingo) {
          domingosTrabajados++;
        }
        if (festivo) {
          festivosTrabajados++;
        }
        if (festivoNacional) {
          festivosNacionalesTrabajados++;
        }
      } else if (tipo && TIPOS_DESCANSO.includes(tipo)) {
        diasDescanso++;
      } else if (tipo === 'vacaciones' || tipo === 'baja' || tipo === 'inactivo') {
        diasNoDisponibles++;
      }

      if (enContrato && esLaborable && !festivoNacional && tipo !== 'vacaciones' && tipo !== 'baja' && tipo !== 'inactivo') {
        diasLaborables++;
      }
    });

    // Calcular dias pendientes de descanso con decimales
    // Fórmula: (diasDisponibles / 7) * 2 + festivosNacionalesTrabajados - diasDescanso
    const diasDelPeriodo = dias.length;
    const diasDisponibles = diasDelPeriodo - diasNoDisponibles;
    const descansosCorrespondientes = (diasDisponibles / 7) * 2 + festivosNacionalesTrabajados;
    const diasPendientesDescanso = Math.max(0, descansosCorrespondientes - diasDescanso);

    const porcentajeTrabajado = esPorHoras(conductor)
      ? (diasLaborables > 0 ? Math.round((horasTrabajadas / (diasLaborables * 8)) * 100) : 0)
      : (diasDisponibles > 0 ? Math.round((diasTrabajados / diasDisponibles) * 100) : 0);
    const tarifaDomingosFestivos = Number.isFinite(data.importeDomingoFestivo) ? data.importeDomingoFestivo : 16.79;
    const importeDomingosFestivos = (domingosTrabajados + festivosNacionalesTrabajados) * tarifaDomingosFestivos;

    return {
      diasTrabajados,
      diasDescanso,
      domingosTrabajados,
      festivosTrabajados,
      festivosNacionalesTrabajados,
      horasTrabajadas,
      importeDomingosFestivos,
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

  const calcularHorasPeriodo = (source: CuadranteData | null): number => {
    if (!source) return 0;
    let total = 0;
    Object.entries(source.jornadas).forEach(([key, tipo]) => {
      if (tipo === 'trabajo' || tipo === 'formacion') {
        const horas = source.horas[key] ?? (tipo === 'formacion' ? 8 : 0);
        total += horas;
      }
    });
    return total;
  };

  const horasMes = calcularHorasPeriodo(data);
  const horasMesPrevio = calcularHorasPeriodo(prevData);
  const variacionHoras = horasMesPrevio > 0 ? ((horasMes - horasMesPrevio) / horasMesPrevio) * 100 : 0;
  const variacionLabel = horasMesPrevio > 0 ? `${variacionHoras >= 0 ? '+' : ''}${variacionHoras.toFixed(1)}%` : '—';

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cuadrante</h1>
          <select
            value="conductores"
            onChange={(e) => {
              if (e.target.value === 'guardias') navigate('/cuadrante-guardias');
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
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-semibold">{horasMes.toFixed(1)}h</span>
            <span className="text-gray-500 ml-2">vs mes anterior {variacionLabel}</span>
          </div>
          <Link
            to="/guardias"
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            Gestionar guardias
          </Link>
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
          <span><Clock className="w-3 h-3 inline mr-1" />Horas</span>
          <span><Euro className="w-3 h-3 inline mr-1" />Importe</span>
        </div>
      </div>

      {/* Tabla del cuadrante */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-1 py-1 text-left text-[10px] font-medium text-gray-700 border-b border-r min-w-[120px]">
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
                    className={`px-0 py-0.5 text-center text-[9px] font-medium border-b min-w-[22px] ${
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
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b border-l bg-blue-50 text-blue-700 min-w-[28px]" title="Dias de descanso disfrutados">
                <Coffee className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b bg-orange-50 text-orange-700 min-w-[28px]" title="Domingos y festivos trabajados">
                <Sun className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b bg-red-50 text-red-700 min-w-[32px]" title="Dias de descanso pendientes">
                <AlertTriangle className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b bg-gray-100 text-gray-700 min-w-[32px]" title="Porcentaje de dias trabajados">
                <Percent className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b bg-slate-50 text-slate-700 min-w-[36px]" title="Horas trabajadas en el periodo">
                <Clock className="w-3 h-3 mx-auto" />
              </th>
              <th className="px-1 py-1 text-center text-[9px] font-medium border-b bg-emerald-50 text-emerald-700 min-w-[44px]" title="Importe domingos y festivos nacionales">
                <Euro className="w-3 h-3 mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              if (!data) return null;
              const porHoras = data.conductores.filter(c => esPorHoras(c));
              const temporales = data.conductores.filter(c => !esPorHoras(c) && esTemporalActivoEnPeriodo(c.id));
              const resto = data.conductores.filter(c => !esPorHoras(c) && !esTemporalActivoEnPeriodo(c.id));
              const totalCols = dias.length + 7;
              const rows: JSX.Element[] = [];

              if (porHoras.length > 0) {
                rows.push(
                  <tr key="por-horas-header" className="bg-sky-50">
                    <td colSpan={totalCols} className="px-2 py-2 text-xs font-semibold text-sky-800">
                      Por horas
                    </td>
                  </tr>
                );
              }

              if (temporales.length > 0) {
                rows.push(
                  <tr key="temporales-header" className="bg-amber-50">
                    <td colSpan={totalCols} className="px-2 py-2 text-xs font-semibold text-amber-800">
                      Temporales con contrato activo
                    </td>
                  </tr>
                );
              }

              const renderConductorRow = (conductor: Conductor) => {
              const resumen = calcularResumen(conductor);

              return (
                <tr key={conductor.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-1 py-0.5 text-[10px] font-medium border-b border-r whitespace-nowrap">
                    <Link
                      to={`/conductores/${conductor.id}`}
                      className="text-gray-900 hover:text-primary-600 hover:underline"
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{conductor.apodo || `${conductor.nombre} ${conductor.apellidos.split(' ')[0]}`}</span>
                        {esPorHoras(conductor) ? (
                          <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1 rounded">
                            Por horas
                          </span>
                        ) : getPorcentajeActivo(conductor) < 100 ? (
                          <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1 rounded">
                            {getPorcentajeActivo(conductor)}%
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  {dias.map((dia, index) => {
                    const fecha = formatFecha(dia);
                    const enContrato = estaEnContrato(conductor.id, fecha);
                    // Si no está en contrato, mostrar como inactivo
                    const tipoReal = getTipo(conductor.id, fecha);
                    const tipo = enContrato ? tipoReal : 'inactivo';
                    const festivo = esFestivo(fecha);
                    const finDeSemana = esFinDeSemana(dia);
                    const domingo = esDomingo(dia);
                    const config = tipo ? TIPOS_CONFIG[tipo] : null;

                    // Detectar si es parte de un descanso de 45h (2 días consecutivos)
                    const prevFecha = index > 0 ? formatFecha(dias[index - 1]) : null;
                    const nextFecha = index < dias.length - 1 ? formatFecha(dias[index + 1]) : null;
                    const prevTipo = prevFecha ? getTipo(conductor.id, prevFecha) : null;
                    const nextTipo = nextFecha ? getTipo(conductor.id, nextFecha) : null;

                    // Es el primer día de un bloque 45h si es descanso_normal y el siguiente también
                    const esInicio45 = tipo === 'descanso_normal' && nextTipo === 'descanso_normal';
                    // Es el segundo día de un bloque 45h si es descanso_normal y el anterior también
                    const esFin45 = tipo === 'descanso_normal' && prevTipo === 'descanso_normal';

                    return (
                      <td
                        key={fecha}
                        onClick={enContrato ? (e) => handleCellClick(conductor.id, fecha, e) : undefined}
                        className={`px-0 py-0.5 text-center border-b transition-colors ${
                          enContrato ? 'cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-inset' : 'cursor-not-allowed opacity-60'
                        } ${
                          config ? `${config.bgColor} ${config.color}` :
                          festivo ? 'bg-purple-50' :
                          domingo ? 'bg-red-50' :
                          finDeSemana ? 'bg-gray-50' : ''
                        } ${
                          esInicio45 ? 'border-r-0 rounded-l' : ''
                        } ${
                          esFin45 ? 'border-l-0 rounded-r' : ''
                        }`}
                        title={!enContrato ? 'Fuera de contrato' : festivo || undefined}
                      >
                        <span className="text-[9px] font-bold">
                          {esFin45 ? '' : (config?.short || '')}
                        </span>
                      </td>
                    );
                  })}
                  {/* Celdas de resumen */}
                  <td className="px-1 py-0.5 text-center border-b border-l bg-blue-50 text-blue-700 font-bold text-[9px]">
                    {resumen.diasDescanso}
                  </td>
                  <td className="px-1 py-0.5 text-center border-b bg-orange-50 font-bold text-[9px]">
                    <span className={resumen.domingosTrabajados + resumen.festivosTrabajados > 0 ? 'text-orange-700' : 'text-gray-400'}>
                      {resumen.domingosTrabajados + resumen.festivosTrabajados}
                    </span>
                  </td>
                  <td className="px-1 py-0.5 text-center border-b bg-red-50 font-bold text-[9px]">
                    <span className={resumen.diasPendientesDescanso > 0 ? 'text-red-700' : 'text-gray-400'}>
                      {resumen.diasPendientesDescanso.toFixed(2)}
                    </span>
                  </td>
                  <td
                    className="px-1 py-0.5 text-center border-b font-bold text-[9px] text-white"
                    style={{ backgroundColor: getGradientColor(resumen.porcentajeTrabajado) }}
                  >
                    {resumen.porcentajeTrabajado}%
                  </td>
                  <td className="px-1 py-0.5 text-center border-b bg-slate-50 text-slate-700 font-bold text-[9px]">
                    {resumen.horasTrabajadas.toFixed(1)}
                  </td>
                  <td className="px-1 py-0.5 text-center border-b bg-emerald-50 text-emerald-700 font-bold text-[9px]">
                    {resumen.importeDomingosFestivos.toFixed(2)}
                  </td>
                </tr>
              );
              };

              porHoras.forEach(c => rows.push(renderConductorRow(c)));
              temporales.forEach(c => rows.push(renderConductorRow(c)));

              if ((porHoras.length > 0 || temporales.length > 0) && resto.length > 0) {
                rows.push(
                  <tr key="resto-header" className="bg-gray-50">
                    <td colSpan={totalCols} className="px-2 py-2 text-xs font-semibold text-gray-700">
                      Resto de conductores
                    </td>
                  </tr>
                );
              }

              resto.forEach(c => rows.push(renderConductorRow(c)));
              return rows;
            })()}
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
