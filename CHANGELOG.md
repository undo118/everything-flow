# Changelog

## [v0.2] — 2026-06-04

### Added
- 自定义 SVG 箭头，替换 tldraw 内置箭头（不再创建 tldraw arrow shape）
- 等边三角形箭头头，停在节点边中点，无重叠
- 拖拽预览线使用自定义 SVG 虚线
- 项目 TODO.md

### Changed
- 箭头从绑定端口子 shape 改为绑定主节点（normalizedAnchor），消除缩放闪烁
- SVG 坐标系对齐：overlay 使用 getBoundingClientRect() 偏移计算鼠标坐标

### Fixed
- 缩放节点时箭头频繁闪烁
- 拖拽箭头时出现蓝色选中指示器覆盖层
- 预览线箭头尖端与鼠标光标不重合（坐标偏移）
- 箭头头伸进节点内部

## [v0.1] — 2026-06-03

### Added
- 节点缩放（onResize），修复上下方向 handle 的位置计算
- 连接点在拖拽预览时显示在全部节点上

### Changed
- 连接点默认隐藏，仅在 hover / 选中 / 拖拽预览时亮起
- 端口子 shape 不可见，仅作箭头绑定锚点，圆点完全由 ConnectorOverlay 控制
- 圆点位置从父节点 page bounds 计算（不再依赖端口子 shape 存储坐标）
- 圆点拖拽跟手改为直接 DOM 操作（data-cod + querySelector），绕过 React 批量更新
- 端口位置修正逻辑合并到 store listener，用 editor.batch() 一次性更新

### Fixed
- 拖拽节点时圆点不跟手的问题
- 端口子 shape 常亮紫点干扰问题
- 拖拽时误显示其他节点的连接点

### Refactored
- 合并圆点计算 + 端口修正 + 悬停检测 + store listener 为单个 useEffect
- 删除未使用的 PORT_SIZE 常量
- 删除 vport- 虚拟 ID 回退逻辑

## [mvp_v0.0] — 2026-06-02

### Added
- tldraw 2.x 集成的可视化流程图编辑器
- 自定义 flow-node shape（可拖拽、缩放、双击编辑内容）
- 4 个端口子 shape（top / right / bottom / left）作为箭头绑定锚点
- ConnectorOverlay 组件渲染连接圆点
- 箭头拖拽创建与绑定流程
- 节点编辑器（Markdown + 结构化字段）
- 右键平移画布
- 添加 / 加载 / 保存节点功能
