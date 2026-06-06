# 修复：缩放闪烁 + 拖拽多余蓝色箭头

## Bug 1 — 缩放时箭头闪烁
**现象：** 拖拽节点缩放手柄时，绑定的箭头频繁闪烁。

**根因：** `ConnectorOverlay.update()` 在每次 resize 时都会修正端口子 shape 位置
（`editor.batch()` → `editor.updateShape()`），这触发新一轮 store listener，
导致端口修正 → 箭头重算 → 端口再修正的循环。每次修正都让箭头路径重绘。

**方案：** 在 `update()` 中判断当前是否在交互中（`editor.inputs.isPointing`），
如果是则跳过端口修正，等交互结束后自然修正。

## Bug 2 — 拖拽时多出蓝色细箭头
**现象：** 从圆点拖出箭头时，除了我们自己画的灰色虚线箭头，还有一个蓝色箭头。

**根因：** `editor.createShape()` 创建箭头后 tldraw 自动选中它，蓝色是选中态样式。
实际上箭头只有一条，选中的是同一个箭头。

**方案：** 要么忽略（选中态是 tldraw 默认行为），要么创建后立即取消选中。

## 涉及文件
- `src/App.jsx` — ConnectorOverlay 组件
