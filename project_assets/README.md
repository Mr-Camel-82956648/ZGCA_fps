# 项目资产说明

`project_assets` 是本项目的源资产目录，以后需要随仓库一起提交。`fps-web-demo/public/assets` 只是构建时生成的拷贝，不再手动维护。

## 目录结构

- `exported_glb/`：从建模软件导出的运行时 GLB，当前 demo 直接读取这里的文件。
- `source_skp/`：SketchUp 源文件和临时参考文件，用来继续修改和重新导出 GLB。
- `characters/`：角色、动画角色或后续可复用人物资产。

## 当前运行资产

- `exported_glb/20260603scene.glb`：视觉场景模型。
- `exported_glb/20260603walkable.glb`：可行走地面。
- `exported_glb/20260603blockers.glb`：碰撞体、边界和不可进入区域。
- `characters/Soldier.glb`：当前第三人称角色模型。

## SketchUp 源文件

- `source_skp/20260603scene.skp`：视觉场景源文件。
- `source_skp/20260603walkable.skp`：可行走面源文件。
- `source_skp/20260603blockers.skp`：碰撞体源文件。
- `source_skp/20260603scene.skb`：SketchUp 备份文件。
- `source_skp/中海油园区规划20240424渲染.skp`：临时参考文件，后续可由人工删除。

## 更新流程

1. 在 `source_skp/` 中修改模型。
2. 导出新的 GLB 到 `exported_glb/`，保持当前文件名不变。
3. 运行 `fps-web-demo` 的 `npm run dev`，刷新浏览器查看效果。
4. 需要构建时运行 `npm run build`，脚本会自动同步资产到 `fps-web-demo/public/assets`。

## 建模建议

- 场景模型尽量使用纯色材质，浏览器端会保留主要颜色并加上扁平化光影。
- `walkable.glb` 只放可以站立的面，不要把建筑墙面或装饰面放进去。
- 高差边缘、下沉广场边、不可进入的建筑体块，应在 `blockers.glb` 中加碰撞边界。
- 玻璃、草地、道路、C03 等常用材质可以保留清晰材质名，方便前端按材质名做颜色校准。

## 颜色管理建议

- SketchUp/GLB 中的纯色材质是颜色源头，例如 `00-Y = #c2846a`。
- 前端默认尊重 GLB 的 base color，不再按 `00-Y`、`C03` 等材质名强制改成另一套颜色。
- 如果材质带有贴图，例如国旗 `guoqi`，前端会保留贴图；如果希望改为纯色，需要在建模软件中移除贴图并重新赋予纯色材质。
- 浏览器里看到的颜色会受到光照、阴影、雾和透明度影响，因此“材质原色”和“屏幕截图取样色”不会完全相同。
- 如果希望某些材质在屏幕上接近指定插画色，建议整理一张材质色表：材质名、模型原色、期望受光面截图色、期望暗部截图色。
- 后续前端可以把这张表做成集中配置，而不是散落在渲染代码里逐个写正则。
