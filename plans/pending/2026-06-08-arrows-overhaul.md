# 节点连接线改造方案

**两阶段：**
- **Phase 0：** 箭头可选择/删除/重连（先做）
- **Phase 1：** 正交/直线路由（后做）

---

## Phase 0：箭头选择与编辑

### 目标

让箭头变成可交互元素：
1. **箭头可选中** — 点击箭头高亮选中
2. **箭头可删** — 选中后按 Delete 删除
3. **箭头可改** — 选中后端点变成可操作，点击端点→再点另一个节点的连接点，完成重连
4. **不能单独复制** — 箭头不是独立元素
5. 复制节点的同时箭头是否能跟随，先不实现，设计上不排斥以后加

### 重连交互流程

> 选中箭头 → 端点变橘色 → 点端点（进入重连模式）→ 所有 dot 提示可点击 → 点另一个节点的 dot → 箭头重连到新 dot
> 
> 重连**只能**对准节点的 4 个连接点（top/right/bottom/left），不能拖到任意位置。

### 当前架构

连接存在 `connectionsRef` 里：
```js
connectionsRef.current[pageId] = [{ sourceNodeId, sourceDotId, targetNodeId, targetDotId }]
```

箭头渲染为 SVG `<line>`，没有点击事件，没有选中态。

### 结构改动

| 概念 | 改动 |
|------|------|
| 连接数据 | 加 `id` 字段 |
| 选中态 | `selectedArrowId` 状态 |
| 重连态 | `reconnectingSide`（'source'｜'target'｜null） |
| 渲染 | 箭头 `<g>` 包裹，可见线 + 透明宽点击区域 |
| 端点 dot | 选中箭头时端点变橘色 + 放大；重连模式下所有 dot 可点 |
| 删除 | keydown 监听 Delete/Backspace |

---

### Task 0.1：连接数据加唯一 ID + 箭头渲染结构调整

**目的：** 每条连接有 ID，箭头渲染用 `<g>` 包裹。

**文件：** `src/App.jsx`

**改动：**

**0.1a. 创建连接时加 ID：**
```js
const connId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
connectionsRef.current[currentPageId] = [...connectionsRef.current[currentPageId], {
  id: connId,
  sourceNodeId: sourceDot.shapeId,
  sourceDotId: sourceDot.dotId,
  targetNodeId: target.shapeId,
  targetDotId: target.dotId,
}]
```

**0.1b. 箭头视觉数据加 id：**
```js
vis.push({
  id: conn.id,
  key: ...,
  type: 'straight',
  x1: ..., y1: ..., x2: ..., y2: ...,
})
```

**0.1c. 箭头渲染改为 `<g>` + 透明点击区域：**
```jsx
{arrowVisuals.map(a => (
  <g key={a.key}>
    <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
      stroke="#6c63ff" strokeWidth={2.5} markerEnd="url(#arrowhead)" />
    <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
      stroke="transparent" strokeWidth={12}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={(e) => { e.stopPropagation(); setSelectedArrowId(a.id) }} />
  </g>
))}
```

**自检：** 创建连接，点箭头 → 无报错（先还没加选中态逻辑）。

**提交：** `git add src/App.jsx && git commit -m "feat(arrows): 连接加 ID + 渲染结构调整"`

---

### Task 0.2：点击选中 + 高亮 + 取消选中

**目的：** 点箭头选中（变红色加粗），点空白取消。

**文件：** `src/App.jsx`

**改动：**

**0.2a. ConnectorOverlay 内加状态：**
```js
const [selectedArrowId, setSelectedArrowId] = useState(null)
```

**0.2b. 箭头渲染区分选中/未选中：**
```jsx
{arrowVisuals.map(a => {
  const isSel = selectedArrowId === a.id
  const color = isSel ? '#ff6b6b' : '#6c63ff'
  const width = isSel ? 3.5 : 2.5
  return (
    <g key={a.key}>
      <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
        stroke={color} strokeWidth={width} markerEnd="url(#arrowhead)" />
      <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
        stroke="transparent" strokeWidth={12}
        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        onClick={(e) => { e.stopPropagation(); setSelectedArrowId(a.id) }} />
    </g>
  )
})}
```

**0.2c. 点击空白取消（overlay 容器上）：**
```jsx
<div ref={overlayRef} onClick={() => setSelectedArrowId(null)} ...>
```

**自检：** 点箭头 → 变红色加粗。点空白 → 恢复紫色。

**提交：** `git add src/App.jsx && git commit -m "feat(arrows): 箭头选中高亮 + 取消"`

---

### Task 0.3：Delete 键删除选中箭头

**目的：** 选中箭头后 Delete/Backspace 删除。

**文件：** `src/App.jsx`

**改动：**

加 useEffect：
```jsx
useEffect(() => {
  const onKeyDown = (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedArrowId) {
      const pageId = editor.getCurrentPageId()
      const conns = (connectionsRef.current[pageId] || []).filter(c => c.id !== selectedArrowId)
      connectionsRef.current[pageId] = conns
      setSelectedArrowId(null)
      if (updateRef.current) updateRef.current()
      e.preventDefault()
    }
  }
  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}, [editor, selectedArrowId])
```

**自检：** 选中箭头 → Delete → 箭头消失。选中节点 → Delete → 节点被删（tldraw 原生行为）。

**提交：** `git add src/App.jsx && git commit -m "feat(arrows): Delete 键删除选中箭头"`

---

### Task 0.4：端点重连

**目的：** 选中箭头 → 端点变橘色可操作 → 点端点进入重连模式 → 点另一个节点上的 dot → 完成重连。

**限制：** 重连只能对准节点的连接点（top/right/bottom/left 四个 dot），不能拖到任意位置。

**文件：** `src/App.jsx`

**改动：**

**0.4a. 加重连状态：**
```js
const [reconnectingSide, setReconnectingSide] = useState(null)
```

**0.4b. 在箭头更新时找到选中连接：**
在 update 函数里传给 dot 的信息里加标记：
```js
// 在箭头计算之后，找当前选中的连接
const selectedConn = selectedArrowId
  ? pageConnections.find(c => c.id === selectedArrowId)
  : null
```

**0.4c. dot 渲染逻辑修改（约 497-512 行）：**

对每个 dot，判断它是否是选中箭头的端点：
```js
const isEndpoint = selectedConn && !reconnectingSide && (
  (dot.shapeId === selectedConn.sourceNodeId && dot.dotId === selectedConn.sourceDotId) ||
  (dot.shapeId === selectedConn.targetNodeId && dot.dotId === selectedConn.targetDotId)
)

const isReconnectTarget = reconnectingSide && !isEndpoint
```

dot 的 style 根据状态变化：
- 普通：紫色 14px ✅
- **端点：橘色 20px + 发光** ← 新增
- **重连目标：紫色 + 橙色边框 + `cursor: copy`** ← 新增

dot 的 onMouseDown 逻辑：
```js
onMouseDown={(e) => {
  e.stopPropagation()
  e.preventDefault()

  // 重连模式：点 dot 完成重连
  if (reconnectingSide) {
    if (!isEndpoint) {
      const pageId = editor.getCurrentPageId()
      const conns = [...(connectionsRef.current[pageId] || [])]
      const idx = conns.findIndex(c => c.id === selectedArrowId)
      if (idx !== -1) {
        if (reconnectingSide === 'source') {
          conns[idx] = { ...conns[idx], sourceNodeId: dot.shapeId, sourceDotId: dot.dotId }
        } else {
          conns[idx] = { ...conns[idx], targetNodeId: dot.shapeId, targetDotId: dot.dotId }
        }
        connectionsRef.current[pageId] = conns
        if (updateRef.current) updateRef.current()
      }
    }
    setReconnectingSide(null)
    return
  }

  // 选中箭头时点端点 → 进入重连模式
  if (isEndpoint) {
    setReconnectingSide(
      dot.shapeId === selectedConn.sourceNodeId ? 'source' : 'target'
    )
    return
  }

  // 正常创建箭头
  startArrow(dot)
}}
```

**0.4e. 点击空白退出重连模式：**
```jsx
<div ref={overlayRef} onClick={() => { setSelectedArrowId(null); setReconnectingSide(null) }} ...>
```

**自检：**
1. 画两个节点，连箭头
2. 点箭头选中（变红）
3. 两个端点的 dot 变橘色放大
4. 点其中一个端点 → 进入重连模式（所有 dot 变可点击提示）
5. 点另一个节点上的 dot → 箭头重连过去
6. 点空白 → 取消重连

**提交：** `git add src/App.jsx && git commit -m "feat(arrows): 点击端点重连到其他 dot"`

---

### Task 0.5：npx vite build 验证

```bash
npx vite build
```

exit code 0 即为通过。

---

## Phase 1：正交/直线路由

（Phase 0 验收通过后再做，内容见原 plan）

---

## 文件清单（Phase 0）

| 操作 | 文件 | 用途 |
|------|------|------|
| 修改 | `src/App.jsx` | 全部改动：连接 ID、选中、高亮、删除、重连 |

## 验收清单

- [ ] 画两个节点 → 拖拽连接点连线 → 箭头正常显示
- [ ] 点箭头 → 变红色加粗（选中态）
- [ ] 点空白处 → 取消选中
- [ ] 选中箭头 → 按 Delete → 箭头消失
- [ ] 选中箭头 → 端点变橘色 → 点端点进入重连 → 点另一个节点 dot → 重连成功
- [ ] 重连只能对准连接点（不能拖到空白位置）
- [ ] 不选中箭头时，dot 行为不变（正常拖拽创建新连接）
- [ ] `npx vite build` 通过
