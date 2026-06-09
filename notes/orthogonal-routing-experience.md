# 正交路由实现经验总结

> 用于后续实现 l→r / r→l / t→b 方向时的参考

---

## 1. 核心算法架构

### 四个方向各自独立实现

每个方向（bt/tb/lr/rl）有独立的 route 函数，**不共享逻辑**。每个函数内部处理：
- 1段直连（对齐且在前方）
- 3段L型（在前方但不对齐）
- 5段U型（在后方或侧方）

### 关键判断

```js
// bt: 前方 = B 在 A 下方（bDotY >= aDotY）
// tb: 前方 = B 在 A 上方（bDotY <= aDotY）
// lr: 前方 = B 在 A 左侧（bDotX <= aDotX）
// rl: 前方 = B 在 A 右侧（bDotX >= aDotX）
```

注意：对于 lr/rl，`bDotX` 和 `aDotX` 不是节点的 x 坐标，而是 **dot 的坐标**：
- lr: aDotX = A.x（左边缘）, bDotX = B.x + B.w（右边缘）
- rl: aDotX = A.x + A.w（右边缘）, bDotX = B.x（左边缘）

### 5段 U 型的节点重叠检测

```js
// bt/tb: X 方向重叠检测
const overlapX = !(aR < bL || bR < aL)

// lr/rl: Y 方向重叠检测  
const overlapY = !(aBtm < bT || bBtm < aT)
```

重叠时推到外侧 25px，不重叠时走中间缝隙。

---

## 2. 手柄（胶囊）系统

### 手柄数据结构

路由函数返回 `{ d, segs, handles }`，其中：
```js
handles = [
  { type: 'h'|'v', x, y, cls: 'h2'|'h3'|'h4' }
]
```

- `type: 'h'` = 水平药丸 → cursor: ns-resize → 拖拽用 dy
- `type: 'v'` = 竖立药丸 → cursor: ew-resize → 拖拽用 dx
- `cls` 标识是哪一段的手柄（h2=下水平段, h3=竖段, h4=上水平段）

### 手柄偏移存储

用 `arrowOffsetsRef.current[arrowKey]` 存储每个箭头的手柄偏移：
```js
{ h2: 0, h3: 0, h4: 0 }
```

同时存储 **源/目标节点的基准坐标**，用于检测节点移动：
```js
{ h2, h3, h4, _v: true, _sx, _sy, _tx, _ty }
```

### 拖拽实现关键点

⚠️ **不要使用 `setPointerCapture`** — 它会阻止 document 级 pointermove 监听器接收到事件。

正确的做法：
1. onPointerDown: 记录 `dragHandleRef.current = { key, cls, type }` + `dragLastRef.current = { x, y }`
2. onPointerMove（document级）: 读取 `dragHandleRef.current`，计算 `clientX/Y` 差值（手动 delta，不用 `movementX/Y`）
3. onPointerUp（document级）: 清空 ref

**delta 需要除以相机缩放倍数**：`delta / camRef.current.z`，因为 clientX/Y 是屏幕坐标，而路径是 page 坐标。

### 偏移方向映射

```js
const isV = dh.type === 'v'
if (dh.cls === 'h2') offs.h2 += (isV ? dx : dy) * 1
if (dh.cls === 'h3') offs.h3 += (isV ? dx : dy) * 1
if (dh.cls === 'h4') offs.h4 += (isV ? dx : dy) * 1
```

- 水平手柄（type='h'）→ dy（上下拖）
- 竖立手柄（type='v'）→ dx（左右拖）

### 节点移动时重置偏移

每次 `update` 运行时，对比当前节点 bounds 与存储的基准坐标，不一致则清空该箭头的 `h2/h3/h4`：

```js
const cached = arrowOffsetsRef.current[key]
if (cached && cached._v && (
  cached._sx !== sBounds.x || cached._sy !== sBounds.y ||
  cached._tx !== tBounds.x || cached._ty !== tBounds.y)) {
  // 清空偏移，保留基准
  arrowOffsetsRef.current[key] = { _v: true, _sx, _sy, _tx, _ty }
}
```

---

## 3. 箭头渲染

### 从 <line> 改为 <path>

使用 page-space 坐标 + SVG transform 匹配相机：
```jsx
<g transform={`translate(${cam.x * cam.z}, ${cam.y * cam.z}) scale(${cam.z})`}>
  <path d={a.d} ... />
</g>
```

### 点击/悬停检测

用透明宽 stroke（16px）覆盖在可见路径上做点击区域：
```jsx
<path d={a.d} stroke="transparent" strokeWidth={16} fill="none"
  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
  onClick={...} onMouseEnter={...} onMouseLeave={...} />
<path d={a.d} stroke={color} strokeWidth={width} ... style={{ pointerEvents: 'none' }} />
```

### 选中/悬停状态

| 状态 | 颜色 | 线宽 | 手柄 |
|------|------|------|------|
| 默认 | `#6c63ff` | 2.5 | 不显示 |
| 悬停 | `#ff8844` | 3 | 显示 |
| 选中 | `#ff6b6b` | 3.5 | 显示 |

---

## 4. 工具栏模式切换

两个按钮：「🔀 正交」「➖ 直线」

```js
const [routeMode, setRouteMode] = useState(
  () => localStorage.getItem('routeMode') || 'orthogonal'
)
```

- 切换后立即重绘所有箭头
- 新创建的箭头沿用当前模式
- 用 `localStorage` 持久化
- `routeMode` 需要加入 useEffect 依赖数组，否则切换不生效

---

## 5. 已知注意事项

1. **非标准连接（如 b→l、t→r）保持直连** — `isStandard()` 函数检查 dot 对，不匹配返回 `null`
2. **手柄的 `cls` 必须赋值的** — 3段和5段都要有，否则拖拽代码中的 `if (dh.cls === 'h2')` 不会命中
3. **App.jsx 中用 `updateRef.current()` 触发重绘** — 手柄拖拽修改偏移后调用， store listener 不会自动触发
4. **lr/rl 的 handles 类型与 bt/tb 相反** — bt/tb 的 h2 是水平段，lr/rl 的 h2 是竖段。拖拽方向因此不同
