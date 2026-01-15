import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conductores from './pages/Conductores';
import ConductorDetalle from './pages/ConductorDetalle';
import Jornadas from './pages/Jornadas';
import Festivos from './pages/Festivos';
import Informes from './pages/Informes';
import Usuarios from './pages/Usuarios';
import Cuadrante from './pages/Cuadrante';
import Configuracion from './pages/Configuracion';
import Contratos from './pages/Contratos';
import Guardias from './pages/Guardias';
import GuardiaDetalle from './pages/GuardiaDetalle';
import CuadranteGuardias from './pages/CuadranteGuardias';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function SupervisorRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user || (user.rol !== 'admin' && user.rol !== 'supervisor')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="cuadrante"
          element={
            <SupervisorRoute>
              <Cuadrante />
            </SupervisorRoute>
          }
        />
        <Route path="conductores" element={<Conductores />} />
        <Route path="conductores/:id" element={<ConductorDetalle />} />
        <Route
          path="contratos"
          element={
            <SupervisorRoute>
              <Contratos />
            </SupervisorRoute>
          }
        />
        <Route
          path="cuadrante-guardias"
          element={
            <SupervisorRoute>
              <CuadranteGuardias />
            </SupervisorRoute>
          }
        />
        <Route
          path="guardias"
          element={
            <SupervisorRoute>
              <Guardias />
            </SupervisorRoute>
          }
        />
        <Route
          path="guardias/:id"
          element={
            <SupervisorRoute>
              <GuardiaDetalle />
            </SupervisorRoute>
          }
        />
        <Route path="jornadas" element={<Jornadas />} />
        <Route path="festivos" element={<Festivos />} />
        <Route path="informes" element={<Informes />} />
        <Route
          path="usuarios"
          element={
            <AdminRoute>
              <Usuarios />
            </AdminRoute>
          }
        />
        <Route
          path="configuracion"
          element={
            <AdminRoute>
              <Configuracion />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
