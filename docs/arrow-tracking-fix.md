# Arrow Endpoint Tracking — 弃用记录

> 本方案已弃用。最终采用 **tldraw parent-child port shape** 方案替代，
> tldraw 原生处理子 shape 的跟随，不需要手动更新箭头绑定。
>
> 留档以备后续参考。

## 旧方案：手动箭头端点跟踪

当 flow-node 移动时，手动更新已连接箭头的端点坐标。

```javascript
// Manual arrow endpoint tracking: when flow-nodes move, update connected arrows
useEffect(() => {
  if (!editor) return
  let updating = false

  const updateArrows = (history) => {
    if (updating) return
    updating = true

    // Check if any flow-node shape was updated
    const changed = history?.changes
    const hasNodeChange = changed && (
      Object.values(changed).some(records =>
        records && records.some(r => r.typeName === 'shape' && r.type === 'flow-node')
      )
    )
    if (!hasNodeChange) {
      updating = false
      return
    }

    const allRecords = editor.store.allRecords()
    for (const record of allRecords) {
      if (record.typeName !== 'shape' || record.type !== 'arrow') continue
      const meta = record.meta
      if (!meta || !meta.sourceShapeId) continue

      const sourceShape = editor.getShape(meta.sourceShapeId)
      const targetShape = meta.targetShapeId ? editor.getShape(meta.targetShapeId) : null
      if (!sourceShape) continue

      const sourcePos = getDotPosition(sourceShape, meta.sourceDotId)
      if (!sourcePos) continue

      let endX = sourcePos.x + 50, endY = sourcePos.y + 50
      if (targetShape && meta.targetDotId) {
        const targetPos = getDotPosition(targetShape, meta.targetDotId)
        if (targetPos) { endX = targetPos.x; endY = targetPos.y }
      }

      editor.updateShape({
        id: record.id,
        type: 'arrow',
        props: { start: { x: 0, y: 0 }, end: { x: endX - sourcePos.x, y: endY - sourcePos.y } },
      })
    }

    updating = false
  }

  const cleanup = editor.store.listen(updateArrows, { scope: 'document' })
  return () => cleanup()
}, [editor])
```

## 弃用原因

tldraw 的 `normalizedAnchor` 绑定 + `isPrecise: true` 在 shape 移动时**不跟踪**（已知限制）。
改用 parent-child port shapes 后，tldraw 原生处理子 shape 的位置跟随，无需手动计算。
