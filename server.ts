import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

async function startServer() {
  const app = express();
  // Read port dynamically (Render/Vercel inject PORT), defaulting to 3000
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  // JSON body parser
  app.use(express.json());

  // API endpoint for dynamic runtime configuration
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback route
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VTV Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[VTV Server] Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
