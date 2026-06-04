import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

const appRoot = __dirname;
const projectAssetsRoot = path.resolve(__dirname, '../project_assets');

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.glb') return 'model/gltf-binary';
  if (ext === '.gltf') return 'model/gltf+json';
  if (ext === '.bin') return 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

function projectAssetsDevPlugin() {
  return {
    name: 'project-assets-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ? req.url.split('?')[0] : '';
        if (!requestUrl.startsWith('/project-assets/')) {
          next();
          return;
        }

        const relativePath = decodeURIComponent(requestUrl.replace('/project-assets/', ''));
        const filePath = path.resolve(projectAssetsRoot, relativePath);
        if (!filePath.startsWith(projectAssetsRoot)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        try {
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }

          res.setHeader('Cache-Control', 'no-store, must-revalidate');
          res.setHeader('Content-Type', contentTypeFor(filePath));
          res.setHeader('Content-Length', String(fileStat.size));

          if (req.method === 'HEAD') {
            res.statusCode = 200;
            res.end();
            return;
          }

          const bytes = await readFile(filePath);
          res.statusCode = 200;
          res.end(bytes);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}

export default defineConfig(async () => {
  for (const requiredPath of [
    path.resolve(projectAssetsRoot, 'exported_glb/20260603scene.glb'),
    path.resolve(projectAssetsRoot, 'exported_glb/20260603walkable.glb'),
    path.resolve(projectAssetsRoot, 'exported_glb/20260603blockers.glb'),
    path.resolve(projectAssetsRoot, 'characters/Soldier.glb'),
  ]) {
    await access(requiredPath);
  }

  return {
    server: {
      fs: {
        allow: [appRoot, projectAssetsRoot],
      },
    },
    plugins: [projectAssetsDevPlugin()],
  };
});
