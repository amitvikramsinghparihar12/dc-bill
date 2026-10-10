/**
 * GBA Corporation - DC Bill Management System
 * Production Express Server & Backend API
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health Check API
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'GBA Corporation DC-BMS API Gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    financialYear: '2025-26',
    invariants: {
      concurrencyIsolation: 'SERIALIZED_QUEUE',
      auditLedger: 'APPEND_ONLY',
      budgetMetric: 'GROSS_VALUE',
    },
  });
});

// Production Static Serving
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint Not Found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start Server if directly executed
if (process.env.NODE_ENV === 'production') {
  app.listen(PORT, () => {
    console.log(`[GBA DC-BMS] Production Server active on http://0.0.0.0:${PORT}`);
  });
}

export default app;
