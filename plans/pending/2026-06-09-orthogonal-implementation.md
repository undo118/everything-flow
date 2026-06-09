# 箭头正交路由实现计划

**目标：** 将已验证的正交路由算法接入项目，替代当前直连箭头

**技术栈：** React 18 + SVG（当前箭头渲染方式不变，只改路径计算）

**范围：** 实现四种标准连接的正交路由：
- `bottom → top`（A.bottom → B.top）
- `top → bottom`（A.top → B.bottom）
- `left → right`（A.left → B.right）
- `right → left`（A.right → B.left）

非标准对角连接（如 bottom→left、top→right 等）保持直连，后续再做。

**关联验证文件：** `temp/orthogonal-all-dirs.html`（四个方向均已验证通过）

---

## 设计概要

### 当前状态

箭头是 `App.jsx` 中 `ConnectorOverlay` 组件内的 SVG `<line>` 元素：

```jsx
{arrowVisuals.map(a => (
  <line key={a.key} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
    stroke="#6c63ff" strokeWidth={2.5} markerEnd="url(#arrowhead)" />
))}
```

### 改动范围

1. **新建** `src/utils/orthogonalRouting.js` — 纯函数路由算法
2. **修改** `src/App.jsx` — 箭头渲染从 `<line>` 改为 `<path>` + 路由模式切换
3. **修改** `src/App.css` — 偏好面板样式（如需）

不需要动 `package.json`、`vite.config.js`、`index.html`。

---

## Task 1：路由算法模块

**文件：** 新建 `src/utils/orthogonalRouting.js`

**核心函数：**

```js
/**
 * 计算 A 到 B 的正交路径
 * @param {string} connType - 连接类型 'bottom-top'|'top-bottom'|'right-left'|'left-right'
 * @param {object} aBounds - 节点 A 的 pageBounds {x, y, w, h}
 * @param {object} bBounds - 节点 B 的 pageBounds {x, y, w, h}
 * @param {string} aDot - 'bottom'|'top'|'right'|'left'
 * @param {string} bDot - 'bottom'|'top'|'right'|'left'
 * @returns {string} SVG path d 属性
 */
function computeOrthogonalPath(connType, aBounds, bBounds, aDot, bDot) { ... }
```

或者更简洁的接口：

```js
/**
 * @param {object} aBounds - {x, y, w, h} 节点 A
 * @param {object} bBounds - {x, y, w, h} 节点 B
 * @param {string} aDot - A 的连接点 'top'|'bottom'|'left'|'right'
 * @param {string} bDot - B 的连接点 'top'|'bottom'|'left'|'right'
 * @returns {{ path: string, segs: number }} path=d 属性, segs=段数
 */
export function orthogonalRoute(aBounds, bBounds, aDot, bDot) { ... }
```

基于已验证的算法：

```js
const EXT = 30

// 根据 dot 确定连接类型
function getConnType(aDot, bDot) {
  if (aDot === 'bottom' && bDot === 'top') return 'bt'
  if (aDot === 'top' && bDot === 'bottom') return 'tb'
  if (aDot === 'right' && bDot === 'left') return 'rl'
  if (aDot === 'left' && bDot === 'right') return 'lr'
}

// 核心算法
function btRoute(aB, bB) {
  const aBotY = aB.y + aB.h
  const aMidX = aB.x + aB.w / 2
  const bTopY = bB.y
  const bMidX = bB.x + bB.w / 2

  const aR = aB.x + aB.w, bR = bB.x + bB.w
  const aL = aB.x, bL = bB.x

  const isBelow = bTopY >= aBotY

  if (isBelow) {
    // 1段或3段
    if (Math.abs(aMidX - bMidX) < 5) {
      return `M ${aMidX} ${aBotY} L ${bMidX} ${bTopY}`
    }
    const midY = (aBotY + bTopY) / 2
    return `M ${aMidX} ${aBotY} L ${aMidX} ${midY} L ${bMidX} ${midY} L ${bMidX} ${bTopY}`
  }

  // 5段
  const overlapX = !(aR < bL || bR < aL)
  const G = 25
  let vertX
  if (overlapX) {
    const goRight = bMidX >= aMidX
    vertX = goRight ? Math.max(aR, bR) + G : Math.min(aL, bL) - G
  } else {
    vertX = (Math.min(aR, bR) + Math.max(aL, bL)) / 2
  }

  const lowY = aBotY + EXT
  const highY = Math.min(bTopY - EXT, aBotY - 10)

  return `M ${aMidX} ${aBotY}
          L ${aMidX} ${lowY}
          L ${vertX} ${lowY}
          L ${vertX} ${highY}
          L ${bMidX} ${highY}
          L ${bMidX} ${bTopY}`
}
```

四个方向（bt/tb/rl/lr）各自独立实现，不共享函数。每个方向实现自己的 1段/3段/5段路径。

**Self-check：** 写完后跑 `node -e "import('./src/utils/orthogonalRouting.js').then(m => console.log(m.orthogonalRoute(...)))"` 无报错

---

## Task 2：箭头渲染改为 <path>

**文件：** 修改 `src/App.jsx`

**改动位置：** `ConnectorOverlay` 组件内箭头渲染（约 491-493 行）

**改前：**
```jsx
{arrowVisuals.map(a => (
  <line key={a.key} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
    stroke="#6c63ff" strokeWidth={2.5} markerEnd="url(#arrowhead)" />
))}
```

**改后：**
```jsx
{arrowVisuals.map(a => (
  <path key={a.key} d={a.d}
    stroke={a.selected ? '#ff6b6b' : '#6c63ff'}
    strokeWidth={a.selected ? 3.5 : 2.5}
    fill="none" markerEnd="url(#arrowhead)" />
))}
```

`arrowVisuals` 中的每个对象从 `{x1, y1, x2, y2}` 改为 `{d}`。

**计算逻辑改动（约 319-329 行）：**

改前（直连）：
```js
const sScr = toScreen(sPt.x, sPt.y)
const tScr = toScreen(tPt.x, tPt.y)
vis.push({ key: ..., x1: sScr.x, y1: sScr.y, x2: tScr.x, y2: tScr.y })
```

改后（正交）：
```js
const pathD = orthogonalRoute(
  sBounds, tBounds, conn.sourceDotId, conn.targetDotId
)
vis.push({ key: ..., d: pathD })
```

注意路径坐标要用 page-space（不是 screen-space），因为 SVG 的 viewBox 跟 tldraw 的 page 坐标一致。检查当前 SVG 是否用了 viewBox 还是 screen 坐标。如果用 screen 坐标，需要转换。

**当前代码分析：** 当前箭头渲染在 `ConnectorOverlay` 的 SVG 中，位置是 `position: absolute, top:0, left:0, width:100%, height:100%`。坐标是 screen-space（通过 `toScreen` 转换）。

如果要改 page-space，需要改 SVG 的 transform 来匹配 camera。**更简单的方案：** 保留 screen-space 坐标，在渲染时用 screen 坐标计算正交路径。

或者：改 SVG 为使用 page-space + transform。这个需要评估。

**建议方案：** 在 `update()` 中计算箭头时，直接用 page-space 坐标构建 path，然后用 SVG 的 transform 匹配 camera。

改成：
```js
// 在 SVG 上设置 transform 匹配 camera
const cam = editor.getCamera()
svgTransform = `translate(${cam.x * cam.z}, ${cam.y * cam.z}) scale(${cam.z})`
```

然后箭头坐标直接用 page-space。

---

## Task 3：路由模式 + 偏好按钮

**文件：** 修改 `src/App.jsx` + `src/App.css`

### 3a. 路由模式状态

在 `ConnectorOverlay` 或 `App` 级别添加状态：

```js
const [routeMode, setRouteMode] = useState('orthogonal') // 'straight' | 'orthogonal'
```

保存在 `localStorage` 中持久化。

### 3b. 偏好面板按钮

在设置/偏好菜单中添加两个按钮：

```
┌─ 偏好 ─────────────────────┐
│  🔀 箭头正交化     [应用]    │
│  ➖ 箭头直线化     [应用]    │
│                             │
│  默认模式：正交 ✓           │
└─────────────────────────────┘
```

- 「箭头正交化」→ 将所有现有箭头转为正交，设置默认模式为「正交」
- 「箭头直线化」→ 将所有现有箭头转为直线，设置默认模式为「直线」
- 新创建的箭头沿用当前默认模式

### 3c. 按钮逻辑

```js
function convertAllArrows(mode) {
  // 遍历所有连接
  // 标记每个连接的路由模式
  // 重新渲染
}
```

连接数据中增加 `routeMode` 字段：

```js
connectionsRef.current[currentPageId] = [{
  sourceNodeId, sourceDotId, targetNodeId, targetDotId,
  routeMode: 'orthogonal' // 或 'straight'
}]
```

---

## 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `src/utils/orthogonalRouting.js` | 正交路由纯函数（4个方向） |
| 修改 | `src/App.jsx` | 箭头渲染 + 路由模式 + 偏好按钮 |
| 修改 | `src/App.css` | 偏好面板样式 |

---

## 验证清单

- [ ] 新画箭头 → 正交折线，不贴边、不穿节点
- [ ] 拖 B 转一圈 → 1段/3段/5段自动切换
- [ ] 点「箭头直线化」→ 所有箭头变直连
- [ ] 点「箭头正交化」→ 所有箭头恢复正交
- [ ] 新建箭头 → 沿用当前默认模式
- [ ] `npx vite build` 通过
