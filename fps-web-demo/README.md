# ZGCA 第三人称漫游 Demo

这是一个基于 Three.js 的浏览器原型，用来加载 GLB 场景、第三人称角色、可行走面和碰撞体，并验证园区漫游的交互体验。

## 本地运行

在 `d:\projects\ZGCA_fps\fps-web-demo` 目录执行：

```bash
npm install
npm run dev
```

Vite 会输出本地访问地址，例如 `http://127.0.0.1:5173/`。

## 构建

```bash
npm run build
```

构建前会自动执行 `npm run sync-assets`，把 `../project_assets` 中的运行资产复制到 `public/assets`，再交给 Vite 打包。

## 资产流程

开发阶段直接读取 `../project_assets`，因此更新 GLB 后刷新浏览器即可看到新模型。`fps-web-demo/public/assets` 是自动生成的运行时拷贝，已经被 `.gitignore` 忽略，不再作为源资产维护。

当前开发期资源路径：

- 视觉场景：`../project_assets/exported_glb/20260603scene.glb`
- 可行走面：`../project_assets/exported_glb/20260603walkable.glb`
- 碰撞体：`../project_assets/exported_glb/20260603blockers.glb`
- 角色模型：`../project_assets/characters/Soldier.glb`

如需手动同步到 `public/assets`：

```bash
npm run sync-assets
```

## 建模约定

- `scene.glb` 只负责视觉表现，可以包含建筑、道路、景观、远景等可见内容。
- `walkable.glb` 只包含角色允许站立和行走的表面。
- `blockers.glb` 用简单体块或壳体表示不可进入区域、建筑实体、边界护栏、高差边缘等。
- 如果以后开放建筑内部，需要在 `blockers.glb` 留出入口，并把室内地面加入 `walkable.glb`。
- 当前代码按 BVH 网格碰撞处理 blockers，封闭体块和规整壳体都可以使用。

## 当前操作

- `W A S D`：移动
- `Shift`：奔跑
- `Space`：跳跃
- `R`：回到出生点
- 按住鼠标右键：旋转视角
- 鼠标滚轮：拉近/拉远
- `` ` ``：切换碰撞调试显示
