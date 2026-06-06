# 连接点默认隐藏实现计划

## 目标
连接点圆点 (connection dots) 默认全隐藏，只在以下三种情况显示：
1. **Hover** — 鼠标悬停在某个节点上，仅显示该节点的 4 个圆点
2. **Select** — 节点被选中，显示该节点的 4 个圆点
3. **Drag preview** — 拖拽创建箭头时，所有节点的圆点都显示

## 改动文件
`~/hermes_workspace/projects/everything-flow/src/App.jsx` — `ConnectorOverlay` 组件

## 具体改动

### 1. 重构 dots 可见性逻辑（第 52-90 行）
- 把 `update()` 拆成纯计算函数，不依赖 React 闭包
- 用 `editor.store.listen` 监听所有变化（包括选中态）
- 用 `editor.on('change')` 监听 hover 和选中事件
- 新增 `computeVisibleDots()`，每次 store/listener 触发时实时读取：
  - `editor.getSelectedShapeIds()` 
  - `hoveredShapeId`（来自独立的 hover effect）
  - `preview`（来自独立的 preview effect）

### 2. 简化 hover 检测（第 92-109 行）
- 缩小 hover margin 从 30px 到 10px，避免误触
- 只对非 port 的 flow-node 做 hit test

### 3. Render 层（第 194-210 行）
- 渲染逻辑不变，但 dots 数组为空时自然就不显示了
- 给圆点加 opacity 动画过渡，显示/隐藏时平滑

## 验证方法
1. 创建 2-3 个节点 → 所有圆点隐藏
2. 鼠标悬停某节点 → 仅该节点 4 个圆点显示
3. 点击选中某节点 → 该节点圆点显示
4. 从某圆点拖拽 → 所有节点圆点显示（预览模式）
5. 松手完成/取消箭头 → 回到默认隐藏状态
