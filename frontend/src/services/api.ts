import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token a las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API de Conductores
export const conductoresApi = {
  list: (activo?: boolean) => api.get('/conductores', { params: { activo } }),
  get: (id: number) => api.get(`/conductores/${id}`),
  create: (data: any) => api.post('/conductores', data),
  update: (id: number, data: any) => api.put(`/conductores/${id}`, data),
  delete: (id: number) => api.delete(`/conductores/${id}`),
  getCalendario: (id: number, año: number, mes: number) =>
    api.get(`/conductores/${id}/calendario`, { params: { año, mes } }),
  getEstadoGeneral: () => api.get('/conductores/estado'),
};

// API de Jornadas
export const jornadasApi = {
  list: (conductorId: number, desde: string, hasta: string) =>
    api.get('/jornadas', { params: { conductorId, desde, hasta } }),
  get: (id: number) => api.get(`/jornadas/${id}`),
  upsert: (data: any) => api.post('/jornadas', data),
  delete: (id: number) => api.delete(`/jornadas/${id}`),
  validar: (data: any) => api.post('/jornadas/validar', data),
  registrarMasivo: (data: any) => api.post('/jornadas/masivo', data),
  getCuadrante: (desde: string, hasta: string) =>
    api.get('/jornadas/cuadrante', { params: { desde, hasta } }),
  updateCelda: (conductorId: number, fecha: string, tipo: string | null) =>
    api.post('/jornadas/celda', { conductorId, fecha, tipo }),
};

// API de Festivos
export const festivosApi = {
  list: (año: number, ambito?: string) => api.get('/festivos', { params: { año, ambito } }),
  getByMonth: (año: number, mes: number) => api.get('/festivos/mes', { params: { año, mes } }),
  verificar: (fecha: string) => api.get('/festivos/verificar', { params: { fecha } }),
  create: (data: any) => api.post('/festivos', data),
  update: (id: number, data: any) => api.put(`/festivos/${id}`, data),
  delete: (id: number) => api.delete(`/festivos/${id}`),
  inicializar: (año: number) => api.post('/festivos/inicializar', { año }),
};

// API de Informes
export const informesApi = {
  getMensual: (conductorId: number, año: number, mes: number) =>
    api.get(`/informes/mensual/${conductorId}`, { params: { año, mes } }),
};

// API de Usuarios
export const usuariosApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// API de Configuración
export const configApi = {
  getAll: () => api.get('/config'),
  get: (clave: string) => api.get(`/config/${clave}`),
  update: (clave: string, valor: string) => api.put(`/config/${clave}`, { valor }),
  updateBatch: (configs: { [key: string]: string }) => api.post('/config', configs),
};
