# everything-flow 重构计划

## 问题
1. `vport-` 虚拟端口ID —— 代码中有不存在的端口回退，掩盖问题
2. `PORT_SIZE` 在 FlowNodeShapeUtil 未使用
3. hover 检测和 store listener 分开两个 effect，通过 hoveredShapeId state 联动，效率低且容易出时差 bug
4. 端口修正用 `editor.batch` 后递归一次，但可以进一步简化

## 改动

### 1. 删 `vport-` fallback (App.jsx)
- `ports.find()` 应该永远能找到端口。如果找不到，说明有 bug，应该直接暴露而不是用虚拟 ID。
- 改为：找不到端口时跳过该圆点（不渲染）

### 2. 删未用代码 (FlowNodeShapeUtil.jsx)
- 删除 `PORT_SIZE` 常量

### 3. 合并 hover → store listener (App.jsx)
- 移除 `hoveredShapeId` state
- 用 `hoveredRef` useRef 替代
- 把 mousemove 监听放到 store listener 的 useEffect 中
- `update()` 直接读 `hoveredRef.current`
- store listener 只依赖 `[editor]`，不再依赖 `hoveredShapeId`
- 移除独立的 hover effect

## 验证
- hover 显示/隐藏圆点
- 选中节点显示圆点
- 拖拽箭头时显示全部圆点
- 拖拽节点时不多余显示圆点
- 端口位置修正
- 箭头绑定到正确端口
