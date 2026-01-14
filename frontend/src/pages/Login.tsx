import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Truck, AlertCircle } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();

  // Si ya está autenticado, redirigir al dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleMicrosoftLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await login();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Microsoft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Conductores</h1>
            <p className="text-gray-500 mt-1">Reglamento CE 561/2006</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Botón Microsoft */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Logo Microsoft */}
            <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="10" height="10" fill="#F25022"/>
              <rect x="11" width="10" height="10" fill="#7FBA00"/>
              <rect y="11" width="10" height="10" fill="#00A4EF"/>
              <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
            </svg>
            <span className="font-medium">
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión con Microsoft'}
            </span>
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            Usa tu cuenta de Autocares David para acceder
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-100 text-sm mt-6">
          Control de tiempos de conducción y descanso
        </p>
      </div>
    </div>
  );
}
