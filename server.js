const path = require('path');
const express = require('express');
const app = require('./backend/app');

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'frontend/dist');

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, host: HOST },
        appType: 'spa',
        root: path.resolve(__dirname, 'frontend')
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite middleware initialization failed, falling back to static files:', err);
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Nova Cart Trust Engine running at http://${HOST}:${PORT}`);
  });
}

startServer();
