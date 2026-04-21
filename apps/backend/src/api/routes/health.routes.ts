import { Router, Request, Response } from 'express';
import { ENV } from '../../config/env';
import { AppDataSource } from '../../config/database';
import redisInfra from '@infrastructure/redis';
import { getIO } from '../../engines/socket.server';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

router.get('/ready', async (req: Request, res: Response) => {
  // Readiness probe with service checks
  const services: Record<string, string> = {
    database: 'unknown',
    supabase: 'unknown',
    redis: 'unknown',
    websocket: 'unknown',
    openai: 'unknown',
  };

  // Check database (Supabase)
  try {
    const db = AppDataSource.getRepository({ name: 'users' } as any);
    await db.findOne({ id: '00000000-0000-0000-0000-000000000001' } as any);
    services.database = 'connected';
    services.supabase = 'connected';
  } catch (e) {
    services.database = 'disconnected';
    services.supabase = 'disconnected';
  }

  // Check Redis
  if (redisInfra.isRedisAvailable()) {
    services.redis = 'connected';
  } else {
    // Check if Redis was enabled in env
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    services.redis = redisEnabled ? 'disconnected' : 'disabled';
  }

  // Check WebSocket
  try {
    const io = getIO();
    if (io) {
      services.websocket = 'running';
    } else {
      services.websocket = 'not_initialized';
    }
  } catch (e) {
    services.websocket = 'not_initialized';
  }

  // Check OpenAI
  if (ENV.OPENAI_API_KEY) {
    services.openai = 'connected';
  } else {
    services.openai = 'not_configured';
  }

  const validStatuses = ['connected', 'running', 'disabled', 'not_configured', 'not_initialized'];
  const allConnected = Object.values(services).every((status: string) => 
    validStatuses.includes(status)
  );

  res.status(allConnected ? 200 : 503).json({
    status: allConnected ? 'ok' : 'degraded',
    services,
  });
});

router.get('/healthz', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
