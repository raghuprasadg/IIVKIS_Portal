/**
 * IIVKIS Orchestrator — Entry point placeholder.
 * Full implementation is deferred to subsequent development steps.
 */
import express, { type Request, type Response } from 'express';

import { orchestrate } from './orchestrator';

const app = express();
const PORT = process.env['PORT'] ?? 5000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '@iivkis/orchestrator' });
});

app.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const result = await orchestrate(req.body as Parameters<typeof orchestrate>[0]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Orchestration failed', detail: String(err) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[orchestrator] Listening on port ${PORT}`);
});

export default app;
