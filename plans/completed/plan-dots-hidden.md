# 连接点默认隐藏实现计划

## 目标
连接点圆点 (connection dots) 默认全隐藏，只在以下三种情况显示：
1. **Hover** — 鼠标悬停在某个节点上，仅显示该节点的 4 个圆点
2. **Select** — 节点被选中，显示该节点的 4 个圆点
3. **Drag preview** — 拖拽创建箭头时，所有节点的圆点都显示

## 改动文件
`~/hermes_workspace/projects/everything-flow/src/App.jsx` — `ConnectorOverlay` 组件

## 具体改动

### 1. 重构 dots 可见性逻辑
- 把 `update()` 拆成纯计算函数，不受 React 闭包影响
- 用 `editor.store.listen` 监听所有变更（包括选中态）
- 每次 listener 触发时实时读取：
  - `editor.getSelectedShapeIds()`
  - `hoveredShapeId` 状态
  - `preview` 状态
- 核心过滤条件：`if (!visibleIds.has(parentId)) continue`

### 2. 简化 hover 检测
- 缩小 hover margin 从 30px → 10px，减少误触
- 只对非 port 的 flow-node 做 hit test
- 用 requestAnimationFrame 节流避免频繁 setState

### 3. Render 层
- 渲染逻辑不变，dots 为空数组时自然不渲染
- 圆点加 opacity 动画过渡（transition），显示/隐藏时平滑出现

## 自纠错/调试
- **Fallback**: 若 update 漏触发，用 `editor.on('change')` 事件补充
- **验证**: 手动检查 5 种场景（无操作、hover、select、拖拽预览、拖拽完成）
- **Edge case**: 多选时所有选中节点显示圆点
- **Edge case**: 从选中节点拖拽时，以 preview 为准（全部显示）
