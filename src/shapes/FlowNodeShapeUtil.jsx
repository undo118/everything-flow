import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ShapeUtil, HTMLContainer, Rectangle2d, T } from 'tldraw'
import { marked } from 'marked'

const DEFAULT_FIELDS = [
  { key: '责任人', value: '' },
  { key: '任务', value: '' },
  { key: '输入', value: '' },
  { key: '输出', value: '' },
  { key: '版本', value: '' },
  { key: '状态', value: '待开始' },
]

function ScrollableNodeContent({ w, h, html, visibleFields, scrollTop, shapeId }) {
  const contentRef = useRef(null)
  const [contentH, setContentH] = useState(0)

  // Measure content natural height for scrollbar overlay
  useEffect(() => {
    if (!contentRef.current) return
    const h = contentRef.current.scrollHeight
    setContentH(h)
    window.__nodeContentHeights = window.__nodeContentHeights || {}
    window.__nodeContentHeights[shapeId] = h
  }, [shapeId, html, visibleFields.length])

  const maxScroll = Math.max(0, contentH - (h - 32))
  const clampedScroll = Math.min(scrollTop || 0, maxScroll)

  return (
    <div style={{
      width: w, height: h, padding: '16px 18px',
      background: '#1e1e3a', borderRadius: 8, border: '1px solid #444',
      color: '#e0e0e0', fontSize: 13, lineHeight: 1.7,
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box', position: 'relative',
    }}
      onWheel={(e) => {
        // Handle wheel for this node
        const delta = e.deltaY
        const nodeMax = Math.max(0, contentH - (h - 32))
        const newScroll = Math.max(0, Math.min((scrollTop || 0) + delta, nodeMax))
        if (window.__setNodeScrollTop) window.__setNodeScrollTop(shapeId, newScroll)
        e.stopPropagation()
      }}
    >
      <div ref={contentRef} style={{ transform: `translateY(${-clampedScroll}px)` }}>
        <div className="flow-node-content" dangerouslySetInnerHTML={{ __html: html }}
          style={{ marginBottom: visibleFields.length > 0 ? 12 : 0 }} />
        {visibleFields.length > 0 && (
          <div style={{ borderTop: '1px solid #333', paddingTop: 10, marginTop: 4 }}>
            {visibleFields.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
                <span style={{ color: '#888', marginRight: 4 }}>{f.key}</span>
                <span style={{ color: '#ccc' }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export class FlowNodeShapeUtil extends ShapeUtil {
  static type = 'flow-node'

  static props = {
    w: T.number,
    h: T.number,
    markdown: T.string,
    fields: T.string,
    isPort: T.string,
    scrollTop: T.number,
    locked: T.number,
  }

  getDefaultProps() {
    return { w: 300, h: 240, markdown: '# 新节点\n\n双击编辑内容', fields: JSON.stringify(DEFAULT_FIELDS), isPort: '', scrollTop: 0, locked: 0 }
  }

  getGeometry(shape) {
    const { w, h } = shape.props
    return new Rectangle2d({ width: w, height: h, isFilled: true })
  }

  canEdit = () => false
  canResize = (shape) => !shape.props.isPort && !shape.props.locked
  hideResizeHandles = (shape) => !!shape.props.isPort || !!shape.props.locked
  canSelect = (shape) => !shape.props.isPort
  isAspectRatioLocked = () => false

  // Ports are invisible to selection
  canBind = () => true

  onDoubleClick = (shape) => {
    if (shape.props.isPort) return
    const handler = window.__openFlowNodeEditor
    if (handler) handler(shape.id)
  }

  onResize = (shape, info) => {
    if (shape.props.isPort) return shape
    if (shape.props.locked) return shape
    const { initialShape, scaleX, scaleY, handle } = info
    const newW = Math.max(120, Math.round(initialShape.props.w * scaleX))
    const newH = Math.max(60, Math.round(initialShape.props.h * scaleY))

    // tldraw does NOT update shape.y for top/left handles on custom shapes
    // We must fix position to keep opposite edges anchored
    let newY = shape.y
    let newX = shape.x
    if (handle.includes('top')) {
      const bottom = initialShape.y + initialShape.props.h
      newY = bottom - newH
    }
    if (handle.includes('left')) {
      const right = initialShape.x + initialShape.props.w
      newX = right - newW
    }

    return {
      ...shape,
      x: newX,
      y: newY,
      props: { ...shape.props, w: newW, h: newH },
    }
  }

  onTranslate = (initial, current) => {
    if (initial.props.locked) {
      // Locked shape: keep original position
      return { ...current, x: initial.x, y: initial.y }
    }
  }

  component(shape) {
    const { w, h, markdown, fields: fieldsJson, isPort, scrollTop } = shape.props

    // Port shape: invisible — only exists for arrow binding
    if (isPort) {
      return <HTMLContainer style={{ width: w, height: h }} />
    }

    // Normal node: card content
    let html = ''
    try { html = marked.parse(markdown) } catch { html = '<pre style="white-space:pre-wrap;color:#f87171">' + markdown + '</pre>' }

    let fields = []
    try { fields = JSON.parse(fieldsJson || '[]') } catch { fields = [] }
    const visibleFields = fields.filter(f => f.value)

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        {!!shape.props.locked && (
          <div style={{
            position: 'absolute', top: 6, right: 8, zIndex: 10,
            fontSize: 13, lineHeight: 1, color: '#888',
            pointerEvents: 'none', userSelect: 'none',
          }}>🔒</div>
        )}
        <ScrollableNodeContent w={w} h={h} html={html} visibleFields={visibleFields} scrollTop={scrollTop} shapeId={shape.id} />
      </HTMLContainer>
    )
  }

  indicator(shape) {
    if (shape.props.isPort) return null
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} rx={8} fill="none" stroke="#6c63ff" strokeWidth={2} />
  }
}
