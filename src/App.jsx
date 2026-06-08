import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Tldraw, useEditor } from 'tldraw'
import 'tldraw/tldraw.css'
import { FlowNodeShapeUtil } from './shapes/FlowNodeShapeUtil'
import NodeEditor from './components/NodeEditor'
import CustomMainMenu from './components/CustomMainMenu'
import CustomPageSelector from './components/CustomPageSelector'
import UndoRedo from './components/UndoRedo'
import SaveExportMenu from './components/SaveExportMenu'
import ActionsBridge from './components/ActionsBridge'
import DialogBridge from './components/DialogBridge'

let globalEditor = null

export function getEditor() {
  return globalEditor
}

const customShapeUtils = [FlowNodeShapeUtil]

const PORT_SIZE = 12

// ---- Alignment engine (12 modes) ----
function alignNodes(editor, mode) {
  const selectedIds = editor.getSelectedShapeIds()
  if (selectedIds.length < 2) return

  // Get selected flow-node shapes
  const nodes = selectedIds.map(id => editor.getShape(id)).filter(s => s && s.type === 'flow-node' && !s.props?.isPort)
  if (nodes.length < 2) return

  // Compute bounding box of selection
  const bounds = nodes.map(n => {
    const b = editor.getShapePageBounds(n.id)
    return b ? { id: n.id, x: b.x, y: b.y, w: b.w, h: b.h, props: n.props } : null
  }).filter(Boolean)

  if (bounds.length < 2) return

  const minX = Math.min(...bounds.map(b => b.x))
  const minY = Math.min(...bounds.map(b => b.y))
  const maxX = Math.max(...bounds.map(b => b.x + b.w))
  const maxY = Math.max(...bounds.map(b => b.y + b.h))
  const totalW = maxX - minX
  const totalH = maxY - minY

  // Sort by current position for distribute
  const byX = [...bounds].sort((a, b) => a.x - b.x)
  const byY = [...bounds].sort((a, b) => a.y - b.y)

  const updates = []

  for (const b of bounds) {
    const upd = { id: b.id, type: 'flow-node' }

    switch (mode) {
      // ---- Horizontal align ----
      case 'align-left':
        upd.x = minX
        break
      case 'align-center-h':
        upd.x = minX + (totalW - b.w) / 2
        break
      case 'align-right':
        upd.x = maxX - b.w
        break

      // ---- Vertical align ----
      case 'align-top':
        upd.y = minY
        break
      case 'align-center-v':
        upd.y = minY + (totalH - b.h) / 2
        break
      case 'align-bottom':
        upd.y = maxY - b.h
        break

      // ---- Distribute ----
      case 'distribute-h': {
        // Already sorted by x; space evenly
        const firstX = byX[0].x
        const lastX = byX[byX.length - 1].x + byX[byX.length - 1].w
        const totalNodesW = byX.reduce((sum, n) => sum + n.w, 0)
        const gap = (lastX - firstX - totalNodesW) / (byX.length - 1)
        let cx = firstX
        for (const n of byX) {
          if (n.id === b.id) { upd.x = cx; break }
          cx += n.w + gap
        }
        break
      }
      case 'distribute-v': {
        const firstY = byY[0].y
        const lastY = byY[byY.length - 1].y + byY[byY.length - 1].h
        const totalNodesH = byY.reduce((sum, n) => sum + n.h, 0)
        const gap = (lastY - firstY - totalNodesH) / (byY.length - 1)
        let cy = firstY
        for (const n of byY) {
          if (n.id === b.id) { upd.y = cy; break }
          cy += n.h + gap
        }
        break
      }

      // ---- Size match ----
      case 'same-width': {
        const maxW = Math.max(...bounds.map(n => n.w))
        upd.props = { ...b.props, w: maxW }
        break
      }
      case 'same-height': {
        const maxH = Math.max(...bounds.map(n => n.h))
        upd.props = { ...b.props, h: maxH }
        break
      }
      case 'same-size': {
        const maxW = Math.max(...bounds.map(n => n.w))
        const maxH = Math.max(...bounds.map(n => n.h))
        upd.props = { ...b.props, w: maxW, h: maxH }
        break
      }

      // ---- Center to page ----
      case 'center-page': {
        const vp = editor.getViewportPageBounds()
        const selCenterX = minX + totalW / 2
        const selCenterY = minY + totalH / 2
        upd.x = b.x + (vp.center.x - selCenterX)
        upd.y = b.y + (vp.center.y - selCenterY)
        break
      }
    }

    updates.push(upd)
  }

  editor.batch(() => updates.forEach(u => editor.updateShape(u)))
}

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

function dotIdToAnchor(dotId) {
  switch (dotId) {
    case 'top': return { x: 0.5, y: 0 }
    case 'right': return { x: 1, y: 0.5 }
    case 'bottom': return { x: 0.5, y: 1 }
    case 'left': return { x: 0, y: 0.5 }
    default: return { x: 0.5, y: 0.5 }
  }
}

// Get the page-space point for a node's edge midpoint
function getEdgePoint(bounds, dotId) {
  switch (dotId) {
    case 'top': return { x: bounds.x + bounds.w / 2, y: bounds.y }
    case 'right': return { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 }
    case 'bottom': return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h }
    case 'left': return { x: bounds.x, y: bounds.y + bounds.h / 2 }
    default: return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
  }
}

// Check if a shape belongs to the current page (handles nested shapes like ports)
function isOnCurrentPage(editor, shapeId, currentPageId) {
  const shape = typeof shapeId === 'object' ? shapeId : editor.getShape(shapeId)
  if (!shape) return false
  if (shape.parentId === currentPageId) return true
  const parent = editor.getShape(shape.parentId)
  if (parent) return isOnCurrentPage(editor, parent, currentPageId)
  return false
}

function ConnectorOverlay({ editor }) {
  const [dots, setDots] = useState([])
  const [hoveredShapeId, setHoveredShapeId] = useState(null)
  const [preview, setPreview] = useState(null)
  const previewRef = useRef(null)
  const dotsRef = useRef([])
  const updateRef = useRef(null)
  const mouseScreenRef = useRef(null) // track cursor screen position during drag preview
  const connectionsRef = useRef({}) // { [pageId]: [{ sourceNodeId, sourceDotId, targetNodeId, targetDotId }] }
  const currentPageRef = useRef(null) // track current page ID for page-switch detection
  const [arrowVisuals, setArrowVisuals] = useState([]) // screen-space arrow paths for rendering
  const overlayRef = useRef(null) // ref to the overlay div for coordinate calculation
  const [scrollbarInfo, setScrollbarInfo] = useState(null) // { shapeId, sx, sy, sw, sh, maxScroll, scrollTop }

  // Compute dot positions from parent node bounds (NOT port shapes)
  // This guarantees dots are always at exact edge midpoints
  useEffect(() => {
    if (!editor) return

    // Register global scroll setter (called from shape wheel handler)
    window.__setNodeScrollTop = (shapeId, newScrollTop) => {
      const shape = editor.getShape(shapeId)
      if (!shape) return
      const maxScroll = (window.__nodeContentHeights || {})[shapeId] || 0
      const clamped = Math.max(0, Math.min(newScrollTop, maxScroll))
      editor.updateShape({
        id: shapeId,
        type: 'flow-node',
        props: { scrollTop: clamped },
      })
    }

    // Expose connections for layout functions
    window.__getPageConnections = () => {
      const pageId = editor.getCurrentPageId()
      return (connectionsRef.current[pageId] || [])
    }

    const update = () => {
      const cam = editor.getCamera()
      const toScreen = (px, py) => ({ x: (px + cam.x) * cam.z, y: (py + cam.y) * cam.z })
      
      // ---- Page isolation: scope shapes and connections to current page ----
      const currentPageId = editor.getCurrentPageId()
      
      // Detect page switch — save active connections for old page, load for new
      if (currentPageId !== currentPageRef.current) {
        currentPageRef.current = currentPageId
        if (!connectionsRef.current[currentPageId]) {
          connectionsRef.current[currentPageId] = []
        }
      }
      const pageConnections = connectionsRef.current[currentPageId] || []
      
      const allShapes = editor.store.allRecords().filter(r => r.typeName === 'shape')
      // Only process shapes on the current page
      const shapesOnPage = allShapes.filter(s => isOnCurrentPage(editor, s, currentPageId))
      const mainNodes = shapesOnPage.filter(s => s.type === 'flow-node' && !s.props?.isPort && !s.props?.locked)
      const ports = shapesOnPage.filter(s => s.type === 'flow-node' && s.props?.isPort)
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
        // Continue to compute dots below — dots use parent bounds, not port positions,
        // so they're correct even before the port-fix batch triggers a re-entry.
        // Previously we returned early here, which caused flicker during resize:
        // every other frame skipped dot rendering.
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
      // Direct DOM sync for smooth drag tracking
      for (const dot of result) {
        const el = document.querySelector(`[data-cod="${dot.portShapeId}"]`) 
        if (el) {
          el.style.left = (dot.sx - 7) + 'px'
          el.style.top = (dot.sy - 7) + 'px'
        }
      }
      // Compute arrow visuals from stored connections (page-scoped)
      const vis = []
      for (const conn of pageConnections) {
        const sBounds = editor.getShapePageBounds(conn.sourceNodeId)
        const tBounds = editor.getShapePageBounds(conn.targetNodeId)
        if (!sBounds || !tBounds) continue
        const sPt = getEdgePoint(sBounds, conn.sourceDotId)
        const tPt = getEdgePoint(tBounds, conn.targetDotId)
        const sScr = toScreen(sPt.x, sPt.y)
        const tScr = toScreen(tPt.x, tPt.y)
        vis.push({ key: conn.sourceNodeId + '-' + conn.sourceDotId + '-' + conn.targetNodeId + '-' + conn.targetDotId, x1: sScr.x, y1: sScr.y, x2: tScr.x, y2: tScr.y })
      }
      setArrowVisuals(vis)

      // ---- Compute scrollbar for selected node ----
      let sbInfo = null
      const selFlowNode = selectedIds.length > 0
        ? mainNodes.find(n => n.id === selectedIds[0])
        : null
      if (selFlowNode) {
        const b = editor.getShapePageBounds(selFlowNode.id)
        if (b) {
          const contentH = (window.__nodeContentHeights || {})[selFlowNode.id] || 0
          const containerH = b.h - 32
          const maxScroll = Math.max(0, contentH - containerH)
          if (maxScroll > 0) {
            const scrollTop = selFlowNode.props.scrollTop || 0
            const sRight = toScreen(b.x + b.w, 0).x
            const sTop = toScreen(0, b.y).y
            const sBot = toScreen(0, b.y + b.h).y
            const trackH = sBot - sTop - 32
            const thumbH = Math.max(16, trackH * trackH / (trackH + maxScroll))
            const thumbTop = (scrollTop / maxScroll) * (trackH - thumbH)
            sbInfo = {
              shapeId: selFlowNode.id,
              sx: sRight - 14, sy: sTop + 16,
              sw: 10, sh: trackH,
              maxScroll, scrollTop,
              thumbH, thumbTop, trackH,
            }
          }
        }
      }
      setScrollbarInfo(sbInfo)
    }

    updateRef.current = update
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
        if (updateRef.current) updateRef.current()
        return
      }
      const currentPageId = editor.getCurrentPageId()
      const allShapes = editor.store.allRecords().filter(r => r.typeName === 'shape' && r.type === 'flow-node' && !r.props?.isPort && !r.props?.locked)
      const shapesOnPage = allShapes.filter(s => isOnCurrentPage(editor, s, currentPageId))
      const pt = editor.inputs.currentPagePoint
      if (!pt) return
      let nearest = null
      for (const s of shapesOnPage) {
        const b = editor.getShapePageBounds(s.id)
        if (!b) continue
        if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { nearest = s.id; break }
      }
      setHoveredShapeId(nearest)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [editor, hoveredShapeId, preview])

  // Arrow creation: record the source dot for custom SVG preview
  const startArrow = useCallback((dot) => {
    if (!editor) return
    // No tldraw arrow shape created — we draw a custom SVG preview line.
    // The connection is saved to connectionsRef on mouseup if a target is hit.
    previewRef.current = dot
    setPreview(dot)
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

    const onMove = (ev) => {
      const rect = overlayRef.current?.getBoundingClientRect()
      const x = ev.clientX - (rect?.left || 0)
      const y = ev.clientY - (rect?.top || 0)
      mouseScreenRef.current = { x, y }
      // Check if cursor is over a target dot for cursor change
      const hoverDot = findDot(x, y)
      document.body.style.cursor = hoverDot ? 'copy' : 'crosshair'
    }

    const onUp = (ev) => {
      document.body.style.cursor = ''
      const sourceDot = previewRef.current
      if (!sourceDot) { setPreview(null); return }

      const rect = overlayRef.current?.getBoundingClientRect()
      const cx = ev.clientX - (rect?.left || 0)
      const cy = ev.clientY - (rect?.top || 0)

      // Find target dot — use page-space proximity
      let target = null
      try {
        const pt = editor.screenToPage({ x: ev.clientX, y: ev.clientY })
        if (pt) {
          target = dotsRef.current.find(d => {
            if (d.shapeId === sourceDot.shapeId && d.dotId === sourceDot.dotId) return false
            const dx = pt.x - d.px, dy = pt.y - d.py
            return dx * dx + dy * dy < 400 // within 20px
          })
        }
      } catch (e) {}

      // Fallback: check screen-space proximity
      if (!target) {
        target = findDot(cx, cy)
        if (target && target.shapeId === sourceDot.shapeId && target.dotId === sourceDot.dotId) target = null
      }

      if (target) {
        // Save connection to current page
        const currentPageId = editor.getCurrentPageId()
        if (!connectionsRef.current[currentPageId]) connectionsRef.current[currentPageId] = []
        connectionsRef.current[currentPageId] = [...connectionsRef.current[currentPageId], {
          sourceNodeId: sourceDot.shapeId,
          sourceDotId: sourceDot.dotId,
          targetNodeId: target.shapeId,
          targetDotId: target.dotId,
        }]
        // Trigger arrow visual refresh
        if (updateRef.current) updateRef.current()
      }

      mouseScreenRef.current = null
      previewRef.current = null
      setPreview(null)
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
    <div ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
      {/* Saved arrows — custom SVG */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <polygon points="4 2.5, 0 0, 0 5" fill="#6c63ff" />
          </marker>
        </defs>
        {arrowVisuals.map(a => (
          <line key={a.key} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#6c63ff" strokeWidth={2.5} markerEnd="url(#arrowhead)" />
        ))}
        {/* Preview line during drag */}
        {preview && mouseScreenRef.current && (
          <line x1={preview.sx} y1={preview.sy} x2={mouseScreenRef.current.x} y2={mouseScreenRef.current.y}
            stroke="#6c63ff" strokeWidth={2} strokeDasharray="6,3" markerEnd="url(#arrowhead)" opacity={0.7} />
        )}
      </svg>
      {dots.map((dot, i) => (
        <div key={dot.portShapeId}
          data-cod={dot.portShapeId}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startArrow(dot) }}
          style={{
            position: 'absolute', left: dot.sx - 7, top: dot.sy - 7, width: 14, height: 14, borderRadius: '50%',
            background: preview && preview.portShapeId === dot.portShapeId ? '#aaa' : '#6c63ff',
            border: '2px solid #fff', cursor: 'crosshair', pointerEvents: 'auto', zIndex: 10000,
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: 'transform 0.1s, background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        />
      ))}
      {/* Scrollbar overlay for selected node */}
      {scrollbarInfo && (
        <ScrollbarOverlay info={scrollbarInfo} editor={editor} />
      )}
    </div>
  )
}

// ---- Scrollbar overlay (rendered above tldraw canvas, events are independent) ----

function ScrollbarOverlay({ info, editor }) {
  const draggingRef = useRef(false)
  const thumbRef = useRef(null)

  const updateScroll = useCallback((newScrollTop) => {
    const shape = editor.getShape(info.shapeId)
    if (!shape) return
    const clamped = Math.max(0, Math.min(newScrollTop, info.maxScroll))
    editor.updateShape({
      id: info.shapeId,
      type: 'flow-node',
      props: { scrollTop: clamped },
    })
  }, [editor, info.shapeId, info.maxScroll])

  const handleThumbDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    draggingRef.current = true
    const startY = e.clientY
    const startScroll = info.scrollTop
    const handleMove = (ev) => {
      if (!draggingRef.current) return
      const ratio = info.trackH / (info.trackH - info.thumbH)
      const newScroll = Math.max(0, Math.min(
        startScroll + (ev.clientY - startY) * ratio,
        info.maxScroll
      ))
      updateScroll(newScroll)
      ev.preventDefault()
    }
    const handleUp = () => { draggingRef.current = false; window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [info, updateScroll])

  const handleTrackDown = useCallback((e) => {
    if (e.target === thumbRef.current || thumbRef.current?.contains(e.target)) return
    e.stopPropagation()
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const pageSize = info.trackH
    const direction = clickY < (info.thumbTop + info.thumbH / 2) ? -1 : 1
    const newScroll = Math.max(0, Math.min(info.scrollTop + direction * pageSize, info.maxScroll))
    updateScroll(newScroll)
  }, [info, updateScroll])

  return (
    <div style={{
      position: 'absolute',
      left: info.sx, top: info.sy,
      width: info.sw, height: info.sh,
      pointerEvents: 'auto', zIndex: 10001,
      borderRadius: 5, background: 'rgba(255,255,255,0.12)',
      cursor: 'pointer',
    }} onPointerDown={handleTrackDown}>
      <div ref={thumbRef} style={{
        position: 'absolute',
        top: info.thumbTop, left: 0,
        width: info.sw, height: info.thumbH,
        borderRadius: 5, background: 'rgba(255,255,255,0.45)',
        cursor: 'grab',
      }} onPointerDown={handleThumbDown} />
    </div>
  )
}

// ---- Alignment popover (12 modes) ----
const ALIGN_GROUPS = [
  { label: '水平对齐', modes: [
    { id: 'align-left', label: '左对齐', icon: '⬅' },
    { id: 'align-center-h', label: '水平居中', icon: '⇔' },
    { id: 'align-right', label: '右对齐', icon: '➡' },
  ]},
  { label: '垂直对齐', modes: [
    { id: 'align-top', label: '顶部对齐', icon: '⬆' },
    { id: 'align-center-v', label: '垂直居中', icon: '⇕' },
    { id: 'align-bottom', label: '底部对齐', icon: '⬇' },
  ]},
  { label: '分布', modes: [
    { id: 'distribute-h', label: '水平分布', icon: '⇌' },
    { id: 'distribute-v', label: '垂直分布', icon: '⇋' },
  ]},
  { label: '等尺寸', modes: [
    { id: 'same-width', label: '等宽', icon: '⬛' },
    { id: 'same-height', label: '等高', icon: '▬' },
    { id: 'same-size', label: '等大小', icon: '🔲' },
  ]},
  { label: '画布', modes: [
    { id: 'center-page', label: '居中到画布', icon: '⊞' },
  ]},
]

function AlignmentButtons({ editorRef, ready }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="align-wrapper" ref={panelRef}>
      <button onClick={() => setOpen(!open)} disabled={!ready} title="对齐工具" className="align-trigger">
        ▦ 对齐
      </button>
      {open && (
        <div className="align-panel">
          {ALIGN_GROUPS.map(group => (
            <div key={group.label} className="align-group">
              <div className="align-group-label">{group.label}</div>
              <div className="align-grid">
                {group.modes.map(m => (
                  <button key={m.id} className="align-btn"
                    title={m.label}
                    onClick={() => { alignNodes(editorRef.current, m.id); setOpen(false) }}>
                    <span className="align-icon">{m.icon}</span>
                    <span className="align-label">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Custom bottom toolbar ----
const TOOLS = [
  { id: 'select', label: '选择', icon: '⬡' },
  { id: 'hand', label: '手型', icon: '✋' },
  { id: 'note', label: '便签', icon: '📝' },
  { id: 'image', label: '图片', icon: '🖼' },
  { id: 'laser', label: '激光笔', icon: '🔦' },
]

function CustomToolbar({ editor }) {
  const [activeTool, setActiveTool] = useState('select')
  const fileInputRef = useRef(null)

  const handleToolClick = useCallback((toolId) => {
    if (toolId === 'image') {
      // Open file picker for images
      fileInputRef.current?.click()
      return
    }
    editor.setCurrentTool(toolId)
    setActiveTool(toolId)
  }, [editor])

  // Track active tool changes from tldraw (e.g., shortcuts)
  useEffect(() => {
    if (!editor) return
    const unlisten = editor.store.listen(() => {
      const current = editor.getCurrentToolId()
      setActiveTool(current)
    })
    return unlisten
  }, [editor])

  const handleImageFile = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    const url = URL.createObjectURL(file)
    // Create an image asset
    const assetId = `asset:img-${Date.now()}`
    const img = new Image()
    img.onload = () => {
      const center = editor.getViewportPageBounds().center
      editor.createAssets([{
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: file.name,
          src: url,
          w: img.width,
          h: img.height,
          mimeType: file.type,
          isAnimated: false,
        },
      }])
      editor.createShape({
        type: 'image',
        x: center.x - img.width / 4,
        y: center.y - img.height / 4,
        props: {
          w: img.width / 2,
          h: img.height / 2,
          assetId,
        },
      })
      URL.revokeObjectURL(url)
    }
    img.src = url
    e.target.value = ''
  }, [editor])

  const editorReady = !!editor

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
      <div className="custom-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn ${activeTool === t.id ? 'active' : ''}`}
            disabled={!editorReady}
            onClick={() => handleToolClick(t.id)}
            title={t.label}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>
    </>
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

  // Watch focus mode → toggle CSS class for minimal UI
  useEffect(() => {
    if (!editor) return
    const applyFocusClass = () => {
      const app = document.querySelector('.app')
      if (!app) return
      const isFocus = editor.getInstanceState().isFocusMode
      app.classList.toggle('focus-mode', isFocus)
    }
    applyFocusClass()
    return editor.store.listen(applyFocusClass)
  }, [editor])

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
          <CustomMainMenu />
          <UndoRedo ready={ready} />
          <CustomPageSelector ready={ready} />
          <h1>Everything Flow</h1>
          <span className="toolbar-tagline">协作流程图工具</span>
        </div>
        <div className="toolbar-actions">
          <button onClick={addFlowNode} disabled={!ready}>➕ 添加节点</button>
          <span className="toolbar-divider" />
          <AlignmentButtons editorRef={editorRef} ready={ready} />
          <span className="toolbar-divider" />
          <button onClick={handleLoad} disabled={!ready}>📂 加载</button>
          <SaveExportMenu ready={ready} />
        </div>
      </header>
      <div className="canvas-container">
        <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} theme="dark"
          components={{ Toolbar: null, MainMenu: null, PageMenu: null, MenuPanel: null }}>
          <ActionsBridge />
          <DialogBridge />
        </Tldraw>
        {editor && <ConnectorOverlay editor={editor} />}
        {editor && <CustomToolbar editor={editor} />}
      </div>
      {editingShape && editor && (
        <NodeEditor shape={editingShape} editor={editor} onClose={() => setEditingShape(null)} />
      )}
    </div>
  )
}
