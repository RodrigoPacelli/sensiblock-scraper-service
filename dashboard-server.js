/**
 * Dashboard Static Server
 * Serve o front-end do dashboard na porta 3006
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3006;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log(`🎨 Dashboard Server`);
  console.log('='.repeat(80));
  console.log(`📡 Dashboard running on: http://localhost:${PORT}`);
  console.log(`🌐 Access from anywhere: http://31.97.131.161:${PORT}`);
  console.log(`🔗 API Backend: http://31.97.131.161:3005`);
  console.log('\n' + '='.repeat(80) + '\n');
});
