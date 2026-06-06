# 替换 tldraw 箭头为自定义 SVG 箭头

## 背景
tldraw 内置箭头太丑，且带来选中态蓝色指示器、闪烁等问题。

## 方案
完全自己画箭头，不创建任何 tldraw arrow shape。

### 数据模型
```
connections = [
  { sourceNodeId, sourceDotId, targetNodeId, targetDotId }
]
```
存在 ConnectorOverlay 的 useState 或 ref 中。

### 渲染
- 在 update() 里从 page bounds 算每根箭头的起终点坐标
- SVG `<path>` + `<marker>` 画出箭头
- 样式统一控制（颜色、线宽、虚线、箭头形状）

### 连接流程
1. 用户从圆点 mousedown → 记录 sourceDot，进入预览模式
2. 预览 SVG 线跟随鼠标
3. 在目标圆点 mouseup → 创建 connection
4. 在半空 mouseup → 取消

### 箭头更新
- connections 存在 state 中 → 跟随 store listener 自动刷新
- 节点移动/resize 时，箭头位置自动从 page bounds 重算

### 清理
- 删除 `startArrow` 中的 `editor.createShape()` 和 `editor.createBinding()`
- 删除 `findDot`（不再需要检测拖拽时的目标 dot — 直接在 onUp 里用 page 坐标匹配）
- 删除 `previewRef.current.arrowId` / `startPos` 逻辑

### 涉及文件
- `src/App.jsx` — ConnectorOverlay 组件
