# 修复：缩放闪烁 + 绑定方式重构

## 问题
1. resize 时箭头闪烁 — 箭头绑定端口子 shape，端口修正循环触发的
2. 蓝色箭头重叠 — 选中态指示器

## 方案
箭头改为绑定在主节点（flow-node）上，用 normalizedAnchor 定位到边中点。

## 改动

### startArrow(dot) — 不再传 portShapeId，传整个 dot 对象
- 取 dot.shapeId（主节点）+ dot.dotId（边标识）
- 创建箭头 → 绑定到主节点，anchor 由 dotId 换算
  - 'top' → { x: 0.5, y: 0 }
  - 'right' → { x: 1, y: 0.5 }
  - 'bottom' → { x: 0.5, y: 1 }
  - 'left' → { x: 0, y: 0.5 }

### onUp 绑定目标
- 找到目标 dot → 同样换算 anchor → 绑定到主节点

### 圆点 onClick
- 传入整个 dot 对象而非 portShapeId

### 不再需要的逻辑
- update() 中的端口位置修正可以移除（或保留仅作端口自身定位）
- 箭头不再依赖端口子 shape 位置

## 涉及文件
- src/App.jsx — ConnectorOverlay 组件
