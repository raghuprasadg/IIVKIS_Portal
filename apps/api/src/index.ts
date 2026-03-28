/**
 * IIVKIS API — Entry point placeholder.
 * Full implementation is deferred to subsequent development steps.
 */
import express from 'express';

const app = express();
const PORT = process.env['PORT'] ?? 4000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@iivkis/api' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] Listening on port ${PORT}`);
});

export default app;
