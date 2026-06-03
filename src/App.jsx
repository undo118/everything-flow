import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { FlowNodeShapeUtil } from './shapes/FlowNodeShapeUtil'
import NodeEditor from './components/NodeEditor'

let globalEditor = null

export function getEditor() {
  return globalEditor
}

const customShapeUtils = [FlowNodeShapeUtil]

const PORT_SIZE = 12

// Create a flow-node with 4 port children
function createFlowNodeWithPorts(editor, x, y, w, h) {
  const nodeId = `shape:fnode-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  editor.createShape({
    id: nodeId,
    type: 'flow-node',
    x, y,
    props: { w, h, markdown: '# 新节点\n\n双击编辑内容', fields: JSON.stringify([
      { key: '责任人', value: '' }, { key: '任务', value: '' }, { key: '输入', value: '' },
      { key: '输出', value: '' }, { key: '版本', value: '' }, { key: '状态', value: '待开始' },
    ])},
  })

  // Create 4 port shapes as children at edge midpoints
  for (const [dotId, lx, ly] of [['top', 0.5, 0], ['right', 1, 0.5], ['bottom', 0.5, 1], ['left', 0, 0.5]]) {
    editor.createShape({
      type: 'flow-node',
      parentId: nodeId,
      x: w * lx - PORT_SIZE / 2,
      y: h * ly - PORT_SIZE / 2,
      props: { w: PORT_SIZE, h: PORT_SIZE, markdown: '', fields: '[]', isPort: dotId },
    })
  }
}

// ---- Connector overlay (simplified: only visual dots) ----

function ConnectorOverlay({ editor }) {
  const [dots, setDots] = useState([])
  const [hoveredShapeId, setHoveredShapeId] = useState(null)
  const [preview, setPreview] = useState(null)
  const previewRef = useRef(null)
  const dotsRef = useRef([])

  // Compute dot positions from parent node bounds (NOT port shapes)
  // This guarantees dots are always at exact edge midpoints
  useEffect(() => {
    if (!editor) return

    const update = () => {
      const cam = editor.getCamera()
      const toScreen = (px, py) => ({ x: (px + cam.x) * cam.z, y: (py + cam.y) * cam.z })
      const allShapes = editor.store.allRecords().filter(r => r.typeName === 'shape')
      const mainNodes = allShapes.filter(s => s.type === 'flow-node' && !s.props?.isPort)
      const ports = allShapes.filter(s => s.type === 'flow-node' && s.props?.isPort)
      const selectedIds = editor.getSelectedShapeIds()
      const allNodeIds = mainNodes.map(s => s.id)

      const visibleIds = new Set(selectedIds)
      if (hoveredShapeId) visibleIds.add(hoveredShapeId)
      if (preview) { for (const id of allNodeIds) visibleIds.add(id) }

      // Fix port child positions to edge midpoints (batch to avoid recursive listener)
      const portFixes = []
      for (const port of ports) {
        const parent = mainNodes.find(n => n.id === port.parentId)
        if (!parent) continue
        const [lx, ly] = { top: [0.5, 0], right: [1, 0.5], bottom: [0.5, 1], left: [0, 0.5] }[port.props.isPort] || [0.5, 0.5]
        const expX = Math.round(parent.props.w * lx - 6)
        const expY = Math.round(parent.props.h * ly - 6)
        if (Math.abs(port.x - expX) > 1 || Math.abs(port.y - expY) > 1) {
          portFixes.push({ id: port.id, type: 'flow-node', x: expX, y: expY })
        }
      }
      if (portFixes.length > 0) {
        editor.batch(() => portFixes.forEach(p => editor.updateShape(p)))
        return // will re-enter with correct port positions
      }
      const result = []
      for (const node of mainNodes) {
        if (!visibleIds.has(node.id)) continue
        const b = editor.getShapePageBounds(node.id)
        if (!b) continue
        const edges = [
          { dotId: 'top', px: b.x + b.w / 2, py: b.y },
          { dotId: 'right', px: b.x + b.w, py: b.y + b.h / 2 },
          { dotId: 'bottom', px: b.x + b.w / 2, py: b.y + b.h },
          { dotId: 'left', px: b.x, py: b.y + b.h / 2 },
        ]
        for (const e of edges) {
          const port = ports.find(p => p.parentId === node.id && p.props?.isPort === e.dotId)
          const scr = toScreen(e.px, e.py)
          result.push({
            shapeId: node.id,
            portShapeId: port ? port.id : `vport-${node.id}-${e.dotId}`,
            dotId: e.dotId,
            sx: scr.x, sy: scr.y,
            px: e.px, py: e.py,
          })
        }
      }
      dotsRef.current = result
      setDots(result)
    }

    update()
    return editor.store.listen(update)
  }, [editor, hoveredShapeId, preview])

  // Hover detection — only updates hoveredShapeId, dots are handled by store listener
  useEffect(() => {
    if (!editor) return
    const onMove = (e) => {
      // Mouse button is held (drag/resize) → don't update hover
      if (e.buttons > 0) {
        if (hoveredShapeId) setHoveredShapeId(null)
        return
      }
      const allShapes = editor.store.allRecords().filter(r => r.typeName === 'shape' && r.type === 'flow-node' && !r.props?.isPort)
      const pt = editor.inputs.currentPagePoint
      if (!pt) return
      let nearest = null
      for (const s of allShapes) {
        const b = editor.getShapePageBounds(s.id)
        if (!b) continue
        if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { nearest = s.id; break }
      }
      setHoveredShapeId(nearest)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [editor, hoveredShapeId, preview])

  // Arrow creation: from port shape to port shape
  const startArrow = useCallback((portShapeId, dotId) => {
    if (!editor) return
    const portBounds = editor.getShapePageBounds(portShapeId)
    if (!portBounds) return
    const sx = portBounds.x + portBounds.w / 2
    const sy = portBounds.y + portBounds.h / 2

    const arrowId = `shape:arr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    editor.createShape({
      id: arrowId, type: 'arrow', x: sx, y: sy,
      props: { start: { x: 0, y: 0 }, end: { x: 50, y: 50 }, text: '', color: 'grey', dash: 'dashed', size: 'm' },
    })
    // Bind to source port
    editor.createBinding({
      type: 'arrow', fromId: arrowId, toId: portShapeId,
      props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: true, isPrecise: true },
    })

    setPreview({ arrowId, sourcePortId: portShapeId })
    previewRef.current = { arrowId, startPos: { x: sx, y: sy } }
  }, [editor])

  const findDot = useCallback((sx, sy, r = 15) => {
    for (const d of dotsRef.current) {
      const dx = d.sx - sx, dy = d.sy - sy
      if (dx * dx + dy * dy < r * r) return d
    }
    return null
  }, [])

  useEffect(() => {
    if (!preview) return
    let hoverDot = null

    const onMove = (ev) => {
      const pt = editor.inputs.currentPagePoint
      if (pt) {
        const { arrowId, startPos } = previewRef.current || {}
        if (arrowId) editor.updateShape({ id: arrowId, type: 'arrow', props: { end: { x: pt.x - startPos.x, y: pt.y - startPos.y } } })
        hoverDot = findDot(ev.clientX, ev.clientY)
        document.body.style.cursor = hoverDot ? 'copy' : 'crosshair'
      }
    }
    const onUp = (ev) => {
      document.body.style.cursor = ''
      const { arrowId, startPos } = previewRef.current || {}
      let target = null
      try {
        const page = editor.screenToPage({ x: ev.clientX, y: ev.clientY })
        if (page) {
          target = dotsRef.current.find(d => {
            if (d.portShapeId === preview.sourcePortId) return false
            const dx = page.x - d.px, dy = page.y - d.py
            return dx * dx + dy * dy < 400
          })
        }
      } catch (e) {}
      if (!target) {
        target = findDot(ev.clientX, ev.clientY)
        if (target && target.portShapeId === preview.sourcePortId) target = null
      }
      if (target && arrowId) {
        editor.updateShape({ id: arrowId, type: 'arrow', props: { end: { x: target.px - startPos.x, y: target.py - startPos.y }, color: 'black', dash: 'draw', text: '' } })
        editor.createBinding({
          type: 'arrow', fromId: arrowId, toId: target.portShapeId,
          props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: true, isPrecise: true },
        })
      } else if (arrowId) {
        try { editor.deleteShape(arrowId) } catch (e) {}
      }
      setPreview(null)
      previewRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [preview, editor, findDot])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
      {dots.map((dot, i) => (
        <div key={dot.portShapeId}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startArrow(dot.portShapeId, dot.dotId) }}
          style={{
            position: 'absolute', left: dot.sx - 7, top: dot.sy - 7, width: 14, height: 14, borderRadius: '50%',
            background: preview && preview.sourcePortId === dot.portShapeId ? '#aaa' : '#6c63ff',
            border: '2px solid #fff', cursor: 'crosshair', pointerEvents: 'auto', zIndex: 10000,
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: 'transform 0.1s, background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        />
      ))}
    </div>
  )
}

// ---- Main App ----

export default function App() {
  const [editor, setEditor] = useState(null)
  const [ready, setReady] = useState(false)
  const [editingShape, setEditingShape] = useState(null)
  const editorRef = useRef(null)

  const handleMount = useCallback((editorInstance) => {
    globalEditor = editorInstance
    editorRef.current = editorInstance
    setEditor(editorInstance)
    setReady(true)
  }, [])

  useEffect(() => {
    window.__openFlowNodeEditor = (shapeId) => {
      const ed = editorRef.current
      if (!ed) return
      const shape = ed.getShape(shapeId)
      if (shape) setEditingShape(shape)
    }
    return () => { delete window.__openFlowNodeEditor }
  }, [])

  // Right-click pan
  useEffect(() => {
    const container = document.querySelector('.canvas-container')
    if (!container) return
    let panning = false, lx = 0, ly = 0
    const onContext = (e) => e.preventDefault()
    const onDown = (e) => { if (e.button === 2) { panning = true; lx = e.clientX; ly = e.clientY; e.preventDefault() } }
    const onMove = (e) => {
      if (!panning) return
      const ed = editorRef.current
      if (!ed) return
      const cam = ed.getCamera()
      ed.setCamera({ x: cam.x + (e.clientX - lx) / cam.z, y: cam.y + (e.clientY - ly) / cam.z, z: cam.z })
      lx = e.clientX; ly = e.clientY
    }
    const onUp = () => { panning = false }
    container.addEventListener('contextmenu', onContext)
    container.addEventListener('mousedown', onDown)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      container.removeEventListener('contextmenu', onContext)
      container.removeEventListener('mousedown', onDown)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [ready])

  // NO MANUAL TRACKING NEEDED - tldraw parent-child handles it natively

  const addFlowNode = () => {
    const ed = editorRef.current
    if (!ed) return
    const center = ed.getViewportPageBounds().center
    createFlowNodeWithPorts(ed, center.x - 150, center.y - 100, 300, 240)
  }

  const handleSave = () => {
    if (!editorRef.current) return
    try {
      const json = JSON.stringify(editorRef.current.store.serialize(), null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `everything-flow-${Date.now()}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { alert('保存失败：' + err.message) }
  }

  const handleLoad = () => {
    if (!editorRef.current) return
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        if (!text) throw new Error('空文件')
        const data = JSON.parse(text)
        if (!data || typeof data !== 'object') throw new Error('JSON 格式无效')
        editorRef.current.store.load(data)
      } catch (err) { alert('加载失败：' + err.message) }
    }
    input.click()
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <h1>Everything Flow</h1>
          <span className="toolbar-tagline">协作流程图工具</span>
        </div>
        <div className="toolbar-actions">
          <button onClick={addFlowNode} disabled={!ready}>➕ 添加节点</button>
          <button onClick={handleLoad} disabled={!ready}>📂 加载</button>
          <button onClick={handleSave} disabled={!ready}>💾 保存</button>
        </div>
      </header>
      <div className="canvas-container">
        <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} theme="dark" />
        {editor && <ConnectorOverlay editor={editor} />}
      </div>
      {editingShape && editor && (
        <NodeEditor shape={editingShape} editor={editor} onClose={() => setEditingShape(null)} />
      )}
    </div>
  )
}
