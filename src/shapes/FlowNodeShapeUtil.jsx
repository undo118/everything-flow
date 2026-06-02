import React from 'react'
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

function PortDot() {
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%',
      background: '#6c63ff', border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    }} />
  )
}

export class FlowNodeShapeUtil extends ShapeUtil {
  static type = 'flow-node'

  static props = {
    w: T.number,
    h: T.number,
    markdown: T.string,
    fields: T.string,
    isPort: T.string, // '' for normal nodes, 'top'/'right'/'bottom'/'left' for ports
  }

  getDefaultProps() {
    return { w: 300, h: 240, markdown: '# 新节点\n\n双击编辑内容', fields: JSON.stringify(DEFAULT_FIELDS), isPort: '' }
  }

  getGeometry(shape) {
    const { w, h } = shape.props
    return new Rectangle2d({ width: w, height: h, isFilled: true })
  }

  canEdit = () => false
  canResize = () => false
  hideResizeHandles = () => true
  isAspectRatioLocked = () => false

  // Ports are invisible to selection
  canBind = () => true

  onDoubleClick = (shape) => {
    if (shape.props.isPort) return
    const handler = window.__openFlowNodeEditor
    if (handler) handler(shape.id)
  }

  component(shape) {
    const { w, h, markdown, fields: fieldsJson, isPort } = shape.props

    // Port shape: tiny circle
    if (isPort) {
      return (
        <HTMLContainer style={{ width: w, height: h, overflow: 'visible' }}>
          <PortDot />
        </HTMLContainer>
      )
    }

    // Normal node: card content
    let html = ''
    try { html = marked.parse(markdown) } catch { html = `<pre style="white-space:pre-wrap;color:#f87171">${markdown}</pre>` }

    let fields = []
    try { fields = JSON.parse(fieldsJson || '[]') } catch { fields = [] }
    const visibleFields = fields.filter(f => f.value)

    return (
      <HTMLContainer style={{ width: w, height: h }}>
        <div style={{
          width: w, height: h, padding: '16px 18px',
          background: '#1e1e3a', borderRadius: 8, border: '1px solid #444',
          color: '#e0e0e0', fontSize: 13, lineHeight: 1.7,
          overflow: 'auto', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box',
        }}>
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
      </HTMLContainer>
    )
  }

  indicator(shape) {
    if (shape.props.isPort) return null
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} rx={8} fill="none" stroke="#6c63ff" strokeWidth={2} />
  }
}
