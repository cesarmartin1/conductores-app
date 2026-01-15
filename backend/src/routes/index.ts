import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { conductorController } from '../controllers/conductor.controller';
import { jornadaController } from '../controllers/jornada.controller';
import { festivoController } from '../controllers/festivo.controller';
import { configController } from '../controllers/config.controller';
import { contratoController } from '../controllers/contrato.controller';
import { guardiaController } from '../controllers/guardia.controller';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

const router = Router();

// ==================== RUTAS PÚBLICAS ====================

// Auth
router.post('/auth/login', authController.login);
router.post('/auth/microsoft', authController.microsoftLogin);

// ==================== RUTAS PROTEGIDAS ====================

// Auth (requiere autenticación)
router.get('/auth/me', authMiddleware, authController.me);
router.post('/auth/change-password', authMiddleware, authController.changePassword);

// Gestión de usuarios (solo admin)
router.get('/users', authMiddleware, requireRole('admin'), authController.listUsers);
router.post('/users', authMiddleware, requireRole('admin'), authController.createUser);
router.put('/users/:id', authMiddleware, requireRole('admin'), authController.updateUser);

// ==================== CONDUCTORES ====================

// Listar conductores (admin, supervisor)
router.get('/conductores', authMiddleware, requireRole('admin', 'supervisor'), conductorController.list);

// Estado general de cumplimiento (admin, supervisor)
router.get('/conductores/estado', authMiddleware, requireRole('admin', 'supervisor'), conductorController.getEstadoGeneral);

// Obtener conductor (todos pueden ver el suyo, admin/supervisor todos)
router.get('/conductores/:id', authMiddleware, conductorController.get);

// Crear conductor (solo admin)
router.post('/conductores', authMiddleware, requireRole('admin'), conductorController.create);

// Actualizar conductor (solo admin)
router.put('/conductores/:id', authMiddleware, requireRole('admin'), conductorController.update);

// Actualizar apodo (admin/supervisor o el propio conductor)
router.patch('/conductores/:id/apodo', authMiddleware, conductorController.updateApodo);

// Eliminar conductor (solo admin)
router.delete('/conductores/:id', authMiddleware, requireRole('admin'), conductorController.delete);

// Importar conductores desde Excel (solo admin)
router.post('/conductores/importar', authMiddleware, requireRole('admin'), conductorController.importarExcel);

// Calendario de conductor
router.get('/conductores/:id/calendario', authMiddleware, conductorController.getCalendario);

// Contratos de conductor
router.get('/conductores/:conductorId/contratos', authMiddleware, contratoController.list);
router.post('/conductores/:conductorId/contratos', authMiddleware, requireRole('admin'), contratoController.create);

// ==================== CONTRATOS ====================

// Verificar si fecha está en contrato
router.get('/contratos/verificar', authMiddleware, contratoController.verificarFecha);

// Obtener contrato
router.get('/contratos/:id', authMiddleware, contratoController.get);

// Actualizar contrato
router.put('/contratos/:id', authMiddleware, requireRole('admin'), contratoController.update);

// Eliminar contrato
router.delete('/contratos/:id', authMiddleware, requireRole('admin'), contratoController.delete);

// ==================== JORNADAS ====================

// Listar jornadas
router.get('/jornadas', authMiddleware, jornadaController.list);

// Cuadrante: todas las jornadas de todos los conductores
router.get('/jornadas/cuadrante', authMiddleware, requireRole('admin', 'supervisor'), jornadaController.getCuadrante);

// Validar jornada (sin guardar)
router.post('/jornadas/validar', authMiddleware, jornadaController.validar);

// Registro masivo (vacaciones, etc.)
router.post('/jornadas/masivo', authMiddleware, requireRole('admin', 'supervisor'), jornadaController.registrarMasivo);

// Actualizar celda del cuadrante
router.post('/jornadas/celda', authMiddleware, requireRole('admin', 'supervisor'), jornadaController.updateCelda);

// Obtener jornada
router.get('/jornadas/:id', authMiddleware, jornadaController.get);

// Crear/Actualizar jornada
router.post('/jornadas', authMiddleware, jornadaController.upsert);

// Eliminar jornada
router.delete('/jornadas/:id', authMiddleware, jornadaController.delete);

// ==================== FESTIVOS ====================

// Listar festivos
router.get('/festivos', authMiddleware, festivoController.list);

// Festivos por mes
router.get('/festivos/mes', authMiddleware, festivoController.getByMonth);

// Verificar si fecha es festivo
router.get('/festivos/verificar', authMiddleware, festivoController.verificar);

// Inicializar festivos nacionales (admin)
router.post('/festivos/inicializar', authMiddleware, requireRole('admin'), festivoController.inicializar);

// Crear festivo (admin, supervisor)
router.post('/festivos', authMiddleware, requireRole('admin', 'supervisor'), festivoController.create);

// Actualizar festivo
router.put('/festivos/:id', authMiddleware, requireRole('admin', 'supervisor'), festivoController.update);

// Eliminar festivo
router.delete('/festivos/:id', authMiddleware, requireRole('admin'), festivoController.delete);

// ==================== INFORMES ====================

router.get('/informes/mensual/:conductorId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conductorId } = req.params;
    const { año, mes } = req.query;

    if (!año || !mes) {
      return res.status(400).json({ error: 'Parámetros requeridos: año, mes' });
    }

    // Si es conductor, solo puede ver su propio informe
    if (req.user!.rol === 'conductor' && req.user!.conductorId !== parseInt(conductorId)) {
      return res.status(403).json({ error: 'No tienes permiso para ver este informe' });
    }

    const { calendarioService } = await import('../services/calendario.service');
    const { ce561Service } = await import('../services/ce561.service');
    const db = (await import('../models/database')).default;

    const conductor = db.prepare('SELECT * FROM conductores WHERE id = ?').get(conductorId);
    if (!conductor) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }

    const calendario = calendarioService.getCalendarioMensual(
      parseInt(conductorId),
      parseInt(año as string),
      parseInt(mes as string)
    );

    const resumen = calendarioService.getResumenMensual(
      parseInt(conductorId),
      parseInt(año as string),
      parseInt(mes as string)
    );

    // Obtener alertas del mes
    const mesStr = String(mes).padStart(2, '0');
    const alertas = db.prepare(`
      SELECT * FROM alertas
      WHERE conductor_id = ? AND fecha LIKE ?
      ORDER BY fecha ASC
    `).all(conductorId, `${año}-${mesStr}%`);

    res.json({
      conductor,
      periodo: { año, mes },
      calendario,
      resumen,
      alertas
    });
  } catch (error) {
    console.error('Error generando informe:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== CONFIGURACIÓN ====================

// Obtener toda la configuración
router.get('/config', authMiddleware, requireRole('admin'), configController.getAll);

// Obtener un valor de configuración
router.get('/config/:clave', authMiddleware, requireRole('admin'), configController.get);

// Actualizar un valor de configuración
router.put('/config/:clave', authMiddleware, requireRole('admin'), configController.update);

// Actualizar múltiples configuraciones
router.post('/config', authMiddleware, requireRole('admin'), configController.updateBatch);

// ==================== GUARDIAS DE TRÁFICO ====================

// Listar guardias
router.get('/guardias', authMiddleware, requireRole('admin', 'supervisor'), guardiaController.list);

// Cuadrante de guardias
router.get('/guardias/cuadrante', authMiddleware, requireRole('admin', 'supervisor'), guardiaController.getCuadrante);

// Actualizar celda del cuadrante de guardias
router.post('/guardias/cuadrante/celda', authMiddleware, requireRole('admin', 'supervisor'), guardiaController.updateCelda);

// Obtener guardia
router.get('/guardias/:id', authMiddleware, requireRole('admin', 'supervisor'), guardiaController.get);

// Crear guardia
router.post('/guardias', authMiddleware, requireRole('admin'), guardiaController.create);

// Actualizar guardia
router.put('/guardias/:id', authMiddleware, requireRole('admin'), guardiaController.update);

// Eliminar guardia
router.delete('/guardias/:id', authMiddleware, requireRole('admin'), guardiaController.delete);

// Contratos de guardia
router.get('/guardias/:id/contratos', authMiddleware, requireRole('admin', 'supervisor'), guardiaController.listContratos);
router.post('/guardias/:id/contratos', authMiddleware, requireRole('admin'), guardiaController.createContrato);
router.put('/guardias/contratos/:contratoId', authMiddleware, requireRole('admin'), guardiaController.updateContrato);
router.delete('/guardias/contratos/:contratoId', authMiddleware, requireRole('admin'), guardiaController.deleteContrato);

export default router;
