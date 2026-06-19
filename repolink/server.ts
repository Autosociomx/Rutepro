import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.REPOLINK_PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'RepoLink Online', version: '1.0.0-mvp' });
});

/**
 * Endpoint para que la IA lea archivos del repositorio
 */
app.post('/api/read-file', (req, res) => {
  const { path } = req.body;
  // Simulación de lectura segura
  res.json({ 
    path, 
    content: "// Contenido del repositorio recuperado vía RepoLink AI\nconsole.log('Hello from RepoLink');" 
  });
});

/**
 * Endpoint para que la IA haga commits (Push directo)
 */
app.post('/api/push-file', (req, res) => {
  const { path, content, message } = req.body;
  console.log(`RepoLink: Recibido commit para ${path} con mensaje: ${message}`);
  res.json({ 
    success: true, 
    commit_sha: 'repolink_' + Math.random().toString(36).substring(7) 
  });
});

app.listen(PORT, () => {
  console.log(`RepoLink AI corriendo en puerto ${PORT}`);
});
