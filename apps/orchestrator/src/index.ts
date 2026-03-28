/**
 * IIVKIS Orchestrator — Entry point placeholder.
 * Full implementation is deferred to subsequent development steps.
 */
import express from 'express';

import { orchestrate } from './orchestrator';

const app = express();
const PORT = process.env['PORT'] ?? 5000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@iivkis/orchestrator' });
});

app.post('/orchestrate', async (req, res) => {
  try {
    const result = await orchestrate(req.body);
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
