import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

router.get('/ready', (req: Request, res: Response) => {
  // Simple readiness probe. Could be extended to DB/Redis checks.
  res.json({ ready: true });
});

router.get('/healthz', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
