import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const assetPairs = [
  [
    path.resolve(root, '../project_assets/exported_glb/20260603scene.glb'),
    path.resolve(root, 'public/assets/scene/scene.glb'),
  ],
  [
    path.resolve(root, '../project_assets/exported_glb/20260603walkable.glb'),
    path.resolve(root, 'public/assets/collision/walkable.glb'),
  ],
  [
    path.resolve(root, '../project_assets/exported_glb/20260603blockers.glb'),
    path.resolve(root, 'public/assets/collision/blockers.glb'),
  ],
];

for (const [source, destination] of assetPairs) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`synced ${path.basename(source)} -> ${path.relative(root, destination)}`);
}
