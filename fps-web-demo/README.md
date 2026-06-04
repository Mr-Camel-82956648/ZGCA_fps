# ZGCA Prototype

This project is a from-scratch browser prototype for a third-person exploration scene.
It does not modify the packed `summer-afternoon` website files directly.

## Run locally

Open a terminal in `d:\projects\ZGCA_fps\fps-web-demo` and run:

```bash
npm install
npm run dev
```

Vite will print a local URL such as `http://127.0.0.1:5173/`.

## Stop the local server

If you started the app in a terminal, press `Ctrl + C` in that same terminal window.
Do not close the browser tab only. The terminal process is the server.

## Build

```bash
npm run build
```

## Asset locations

- Source asset drop: `../project_assets/exported_glb/`
- Development scene URL: `/project-assets/exported_glb/20260603scene.glb`
- Development walkable URL: `/project-assets/exported_glb/20260603walkable.glb`
- Development blockers URL: `/project-assets/exported_glb/20260603blockers.glb`
- Production scene copy: `public/assets/scene/scene.glb`
- Production walkable copy: `public/assets/collision/walkable.glb`
- Production blockers copy: `public/assets/collision/blockers.glb`

During `npm run dev`, Vite serves GLB files directly from `../project_assets/exported_glb/`
with `Cache-Control: no-store`, so replacing a source GLB and refreshing the browser is
enough for local development. During `npm run build`, `npm run sync-assets` runs first
and copies the current source GLBs into `public/assets/...` for production output.

To update runtime assets manually:

```bash
npm run sync-assets
```

## Asset notes

- `scene.glb` should contain the visible environment.
- `walkable.glb` should contain only the surfaces the player is allowed to stand on.
- `blockers.glb` should use simple collision volumes or shell surfaces that block the player at edges, walls, building masses, and level drops.
- If a building is enterable, leave door openings in `blockers.glb` and include its interior floor in `walkable.glb`.
- The runtime treats blockers as mesh surfaces with BVH collision, so closed blocks and well-formed shell boundaries are both valid.
- For new SketchUp work, keep source `.skp` files and exported `.glb` files under `../project_assets/` first.

## Current controls

- `W A S D`: move
- `Shift`: run
- `Space`: jump
- `R`: reset to spawn
- Hold right mouse: orbit camera
- Mouse wheel: zoom
- `` ` ``: toggle collision debug
