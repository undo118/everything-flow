import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Tldraw, useEditor } from 'tldraw'
import 'tldraw/tldraw.css'
import { loadSnapshot } from '@tldraw/editor'
import { FlowNodeShapeUtil } from './shapes/FlowNodeShapeUtil'
import NodeEditor from './components/NodeEditor'
import CustomMainMenu from './components/CustomMainMenu'
import CustomPageSelector from './components/CustomPageSelector'
import UndoRedo from './components/UndoRedo'
import SaveExportMenu from './components/SaveExportMenu'
import ActionsBridge from './components/ActionsBridge'
import DialogBridge from './components/DialogBridge'
import { orthogonalRoute } from './utils/orthogonalRouting'

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
  const handleOffsetsRef = useRef({})      // { [connKey]: { h2, h3, h4 } }
  const cameraRef = useRef({ x: 0, y: 0, z: 1 })
  const draggingHandleRef = useRef(null)    // { connKey, offKey } during drag
  const [selectedArrowKey, setSelectedArrowKey] = useState(null)
  const nodePositionsRef = useRef({}) // { [nodeId]: { x, y } } for detecting node movement
  const [snapGuides, setSnapGuides] = useState([]) // { axis: 'x'|'y', value: number }[]
  const snapStateRef = useRef({ snapped: false, value: 0 }) // hysteresis tracking
  const snapHandlePositionsRef = useRef([]) // [{ axis: 'x'|'y', value: number }] for handle-to-handle snap

  // Compute dot positions from parent node bounds (NOT port shapes)
  // This guarantees dots are always at exact edge midpoints
  useEffect(() => {
    if (!editor) return

    // Register global scroll setter (called from shape wheel handler)
    window.__HANDLE_SENSITIVITY = 0.4
    const savedMode = localStorage.getItem('eflow-default-arrow-mode')
    window.__DEFAULT_ARROW_MODE = savedMode || 'orthogonal'
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
      cameraRef.current = cam
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
      // Compute orthogonal arrow paths from stored connections (page-scoped)
      const vis = []
      for (const conn of pageConnections) {
        const sBounds = editor.getShapePageBounds(conn.sourceNodeId)
        const tBounds = editor.getShapePageBounds(conn.targetNodeId)
        if (!sBounds || !tBounds) continue
        const connKey = conn.sourceNodeId + '-' + conn.sourceDotId + '-' + conn.targetNodeId + '-' + conn.targetDotId
        // Detect node movement → reset handle offsets
        for (const nid of [conn.sourceNodeId, conn.targetNodeId]) {
          const prev = nodePositionsRef.current[nid]
          const cur = editor.getShape(nid)
          if (cur && prev && (prev.x !== cur.x || prev.y !== cur.y)) {
            delete handleOffsetsRef.current[connKey]
          }
          if (cur) nodePositionsRef.current[nid] = { x: cur.x, y: cur.y }
        }
        let route, screenD, screenHandles
        if (conn.mode === 'straight') {
          // Straight line
          const sPt = getEdgePoint(sBounds, conn.sourceDotId)
          const tPt = getEdgePoint(tBounds, conn.targetDotId)
          const sScr = toScreen(sPt.x, sPt.y)
          const tScr = toScreen(tPt.x, tPt.y)
          screenD = `M ${sScr.x} ${sScr.y} L ${tScr.x} ${tScr.y}`
          screenHandles = []
          route = { pts: [sPt, tPt], handles: [] }
        } else {
          // Orthogonal routing
          const off = handleOffsetsRef.current[connKey] || { h2: 0, h3: 0, h4: 0 }
          route = orthogonalRoute(sBounds, tBounds, conn.sourceDotId, conn.targetDotId, off)
          const ptsScreen = route.pts.map(p => toScreen(p.x, p.y))
          screenD = ptsScreen.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ')
          screenHandles = route.handles.map(h => ({
            ...h,
            sx: (h.x + cam.x) * cam.z,
            sy: (h.y + cam.y) * cam.z,
          }))
        }
        vis.push({ key: connKey, d: screenD, handles: screenHandles, route, hitSegments: [], mode: conn.mode })
      }
      // Compute hit segments for all arrows (page-space → screen-space)
      for (const a of vis) {
        if (a.route && a.route.pts) {
          const pts = a.route.pts.map(p => toScreen(p.x, p.y))
          const segs = []
          if (pts.length === 2) {
            // Straight line: thin band along the line
            const dx = pts[1].x - pts[0].x
            const dy = pts[1].y - pts[0].y
            const len = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx) * (180 / Math.PI)
            segs.push({
              x: (pts[0].x + pts[1].x) / 2,
              y: (pts[0].y + pts[1].y) / 2,
              w: Math.max(len, 12),
              h: 24,
              angle,
            })
          } else {
            // Orthogonal: per-segment thin bands
            for (let j = 0; j < pts.length - 1; j++) {
              const p1 = pts[j], p2 = pts[j + 1]
              const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y)
              if (dx > 3 || dy > 3) {
                segs.push({
                  x: (p1.x + p2.x) / 2,
                  y: (p1.y + p2.y) / 2,
                  w: Math.max(dx, 12),
                  h: Math.max(dy, 12),
                })
              }
            }
          }
          a.hitSegments = segs
        }
      }
      setArrowVisuals(vis)

      // Collect all handle page-positions for handle-to-handle snap
      const allHandlePos = []
      for (const a of vis) {
        if (a.route && a.route.handles) {
          for (const h of a.route.handles) {
            const axis = h.type === 'h' ? 'y' : 'x'
            allHandlePos.push({ axis, value: h[axis], key: a.key })
          }
        }
      }
      snapHandlePositionsRef.current = allHandlePos

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
    if (typeof window.__triggerArrowUpdate === 'undefined') {
      window.__triggerArrowUpdate = () => updateRef.current?.()
      window.__resetArrowOffsets = (key) => { delete handleOffsetsRef.current[key] }
      window.__getAllConnections = () => JSON.parse(JSON.stringify(connectionsRef.current))
      window.__restoreConnections = (data) => { connectionsRef.current = data; if (updateRef.current) updateRef.current() }
    }
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
          mode: window.__DEFAULT_ARROW_MODE || 'orthogonal',
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

  // Handle drag for arrow capsules
  useEffect(() => {
    let lastClientY = 0
    let lastClientX = 0
    const onHandleMove = (e) => {
      const drag = draggingHandleRef.current
      if (!drag) return
      // Reset tracking on first move after drag starts
      if (lastClientY === 0) { lastClientY = e.clientY; lastClientX = e.clientX; return }
      const dy = e.clientY - lastClientY
      const dx = e.clientX - lastClientX
      lastClientY = e.clientY
      lastClientX = e.clientX
      const cam = cameraRef.current
      const scale = 1 / cam.z // screen pixels → page pixels
      const sensitivity = window.__HANDLE_SENSITIVITY || 0.4
      const delta = (drag.handleType === 'h' ? dy : dx) * scale * sensitivity
      if (!handleOffsetsRef.current[drag.connKey]) {
        handleOffsetsRef.current[drag.connKey] = { h2: 0, h3: 0, h4: 0 }
      }
      const offs = handleOffsetsRef.current[drag.connKey]
      offs[drag.offKey] = (offs[drag.offKey] || 0) + delta
      if (updateRef.current) updateRef.current()

      // ---- Snap to node edges/midlines when snap mode is on ----
      const ed = window.__TLDRAW_EDITOR
      if (ed && ed.user?.getIsSnapMode?.()) {
        const pageId = ed.getCurrentPageId()
        const conns = (connectionsRef.current[pageId] || [])
        const conn = conns.find(c =>
          c.sourceNodeId + '-' + c.sourceDotId + '-' + c.targetNodeId + '-' + c.targetDotId === drag.connKey
        )
        if (conn) {
          const sBounds = ed.getShapePageBounds(conn.sourceNodeId)
          const tBounds = ed.getShapePageBounds(conn.targetNodeId)
          if (sBounds && tBounds) {
            const curOffs = handleOffsetsRef.current[drag.connKey] || { h2: 0, h3: 0, h4: 0 }
            const route = orthogonalRoute(sBounds, tBounds, conn.sourceDotId, conn.targetDotId, curOffs)
            const snappedHandle = route.handles.find(h => h.offKey === drag.offKey)
              if (snappedHandle) {
                const axis = drag.handleType === 'h' ? 'y' : 'x'
                const handleVal = snappedHandle[axis]
                const targets = []
                // Collect snap targets from all main flow-nodes on the page
                const allShapes = ed.store.allRecords().filter(r => r.typeName === 'shape')
                const flowNodes = allShapes.filter(s => s.type === 'flow-node' && !s.props?.isPort)
                for (const node of flowNodes) {
                  const nb = ed.getShapePageBounds(node.id)
                  if (!nb) continue
                  if (axis === 'y') {
                    targets.push(nb.y, nb.y + nb.h / 2, nb.y + nb.h)
                  } else {
                    targets.push(nb.x, nb.x + nb.w / 2, nb.x + nb.w)
                  }
                }
                // Add other handle positions as snap targets
                for (const hp of snapHandlePositionsRef.current) {
                  if (hp.axis === axis && hp.key !== drag.connKey) {
                    targets.push(hp.value)
                  }
                }
                // During drag: only show guide lines, no offset snapping
                let closest = null, minDist = Infinity
                for (const tVal of targets) {
                  const dist = Math.abs(tVal - handleVal)
                  if (dist < minDist && dist < 6) {
                    minDist = dist; closest = tVal
                  }
                }
                if (closest !== null) {
                  // Store snap target for release-time snapping
                  drag.snapTarget = closest
                  setSnapGuides([{ axis, value: closest }])
                } else {
                  drag.snapTarget = null
                  setSnapGuides([])
                }
            } else {
              setSnapGuides([])
            }
          } else {
            setSnapGuides([])
          }
        } else {
          setSnapGuides([])
        }
      } else {
        setSnapGuides([])
      }
      e.preventDefault()
    }
    const onHandleUp = () => {
      const drag = draggingHandleRef.current
      if (drag) {
        // Snap on release: if there's a pending snap target, apply it
        if (drag.snapTarget != null && drag.connKey) {
          const connKey = drag.connKey
          const offs = handleOffsetsRef.current[connKey]
          if (offs) {
            const ed = window.__TLDRAW_EDITOR
            const pageId = ed?.getCurrentPageId()
            const conns = connectionsRef.current[pageId] || []
            const conn = conns.find(c =>
              c.sourceNodeId + '-' + c.sourceDotId + '-' + c.targetNodeId + '-' + c.targetDotId === connKey
            )
            if (conn && ed) {
              const sBounds = ed.getShapePageBounds(conn.sourceNodeId)
              const tBounds = ed.getShapePageBounds(conn.targetNodeId)
              if (sBounds && tBounds) {
                const curOffs = handleOffsetsRef.current[connKey] || { h2: 0, h3: 0, h4: 0 }
                const route = orthogonalRoute(sBounds, tBounds, conn.sourceDotId, conn.targetDotId, curOffs)
                const snappedHandle = route.handles.find(h => h.offKey === drag.offKey)
                if (snappedHandle) {
                  const axis = drag.handleType === 'h' ? 'y' : 'x'
                  const snapDelta = drag.snapTarget - snappedHandle[axis]
                  offs[drag.offKey] = (offs[drag.offKey] || 0) + snapDelta
                }
              }
            }
          }
          if (updateRef.current) updateRef.current()
        }
        draggingHandleRef.current = null
        document.body.style.cursor = ''
      }
      setSnapGuides([])
      snapStateRef.current = { snapped: false, value: 0 }
      lastClientY = 0
      lastClientX = 0
    }
    document.addEventListener('pointermove', onHandleMove)
    document.addEventListener('pointerup', onHandleUp)
    return () => {
      document.removeEventListener('pointermove', onHandleMove)
      document.removeEventListener('pointerup', onHandleUp)
    }
  }, [])

  // Force arrow update during drag — fallback to store listener
  useEffect(() => {
    let isDown = false
    let raf = null
    const onDown = () => { isDown = true }
    const onMove = () => {
      if (isDown && updateRef.current && !raf) {
        raf = requestAnimationFrame(() => {
          raf = null
          updateRef.current()
        })
      }
    }
    const onUp = () => { isDown = false; if (raf) { cancelAnimationFrame(raf); raf = null } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Click outside arrow → deselect
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!selectedArrowKey) return
      // If the click target is not an arrow hit area and not a handle, deselect
      if (!e.target.closest('[data-arrow-key]') && !e.target.closest('[data-handle]')) {
        setSelectedArrowKey(null)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [selectedArrowKey])

  // Delete key → remove selected arrow
  useEffect(() => {
    if (!selectedArrowKey) return
    const onKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Deselect tldraw shapes first to prevent tldraw from deleting nodes
        editor.selectNone()
        const pageId = editor.getCurrentPageId()
        const conns = connectionsRef.current[pageId]
        if (conns) {
          const idx = conns.findIndex(c =>
            c.sourceNodeId + '-' + c.sourceDotId + '-' + c.targetNodeId + '-' + c.targetDotId === selectedArrowKey
          )
          if (idx !== -1) conns.splice(idx, 1)
          if (updateRef.current) updateRef.current()
        }
        setSelectedArrowKey(null)
        e.stopPropagation()
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [selectedArrowKey, editor])

  return (
    <div ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 150 }}>
      {/* Saved arrows — custom SVG */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <polygon points="4 2.5, 0 0, 0 5" fill="#6c63ff" />
          </marker>
          <marker id="arrowhead-sel" markerWidth="4" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <polygon points="4 2.5, 0 0, 0 5" fill="#ff8844" />
          </marker>
        </defs>
        {arrowVisuals.map(a => (
          <path key={a.key} d={a.d}
            stroke={selectedArrowKey === a.key ? '#ff8844' : '#6c63ff'}
            strokeWidth={selectedArrowKey === a.key ? 3.5 : 2.5}
            fill="none"
            markerEnd={selectedArrowKey === a.key ? 'url(#arrowhead-sel)' : 'url(#arrowhead)'}
            style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
          />
        ))}
        {/* Preview line during drag */}
        {preview && mouseScreenRef.current && (
          <line x1={preview.sx} y1={preview.sy} x2={mouseScreenRef.current.x} y2={mouseScreenRef.current.y}
            stroke="#6c63ff" strokeWidth={2} strokeDasharray="6,3" markerEnd="url(#arrowhead)" opacity={0.7} />
        )}
        {/* Snap guide lines */}
        {snapGuides.map((g, i) => {
          const cam = cameraRef.current
          if (g.axis === 'y') {
            const sy = (g.value + cam.y) * cam.z
            return <line key={'sg' + i} x1={0} y1={sy} x2={20000} y2={sy}
              stroke="#ff8844" strokeWidth={1} strokeDasharray="4,4" opacity={0.7} pointerEvents="none" />
          }
          const sx = (g.value + cam.x) * cam.z
          return <line key={'sg' + i} x1={sx} y1={0} x2={sx} y2={20000}
            stroke="#ff8844" strokeWidth={1} strokeDasharray="4,4" opacity={0.7} pointerEvents="none" />
        })}
      </svg>
      {dots.map((dot, i) => (
        <div key={dot.portShapeId}
          data-cod={dot.portShapeId}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startArrow(dot) }}
          style={{
            position: 'absolute', left: dot.sx - 7, top: dot.sy - 7, width: 14, height: 14, borderRadius: '50%',
            background: preview && preview.portShapeId === dot.portShapeId ? '#aaa' : '#6c63ff',
            border: '2px solid #fff', cursor: 'crosshair', pointerEvents: 'auto', zIndex: 155,
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: 'transform 0.1s, background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        />
      ))}
      {/* Arrow hit areas — invisible divs for click-to-select */}
      {arrowVisuals.flatMap(a =>
        a.hitSegments.map((s, si) => (
          <div key={a.key + '-h' + si}
            data-arrow-key={a.key}
            onClick={(e) => { e.stopPropagation(); setSelectedArrowKey(a.key) }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // Toggle arrow mode
              const pageId = editor.getCurrentPageId()
              const conns = connectionsRef.current[pageId]
              if (conns) {
                const conn = conns.find(c =>
                  c.sourceNodeId + '-' + c.sourceDotId + '-' + c.targetNodeId + '-' + c.targetDotId === a.key
                )
                if (conn) {
                  conn.mode = conn.mode === 'straight' ? 'orthogonal' : 'straight'
                  // Reset handle offsets when toggling
                  delete handleOffsetsRef.current[a.key]
                  if (updateRef.current) updateRef.current()
                }
              }
              setSelectedArrowKey(a.key)
            }}
            style={{
              position: 'absolute', left: s.x - s.w / 2, top: s.y - s.h / 2,
              width: s.w, height: s.h, pointerEvents: 'auto', cursor: 'pointer', zIndex: 151,
              transform: s.angle ? `rotate(${s.angle}deg)` : undefined,
              transformOrigin: 'center center',
            }}
          />
        ))
      )}
      {/* Arrow handle capsules — only on selected arrow */}
      {arrowVisuals.flatMap(a =>
        (selectedArrowKey === a.key ? a.handles : []).map(h => (
        <div key={a.key + '-' + h.offKey}
          data-handle={a.key + '-' + h.offKey}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            draggingHandleRef.current = { connKey: a.key, offKey: h.offKey, handleType: h.type }
            document.body.style.cursor = h.type === 'h' ? 'ns-resize' : 'ew-resize'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.5)'; e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '0.85' }}
          style={{
            position: 'absolute',
            left: h.sx - (h.type === 'h' ? 10 : 4),
            top: h.sy - (h.type === 'h' ? 4 : 10),
            width: h.type === 'h' ? 20 : 8,
            height: h.type === 'h' ? 8 : 20,
            borderRadius: h.type === 'h' ? '4px' : '4px',
            background: '#ff8844',
            border: '1.5px solid #fff',
            pointerEvents: 'auto',
            zIndex: 152,
            opacity: 0.85,
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            transition: 'transform 0.12s, opacity 0.12s',
          }}
        />
      )))}
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
      pointerEvents: 'auto', zIndex: 156,
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
  const [tick, setTick] = useState(0)
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

  const handleSave = (format = 'eflow') => {
    if (!editorRef.current) return
    try {
      const snapshot = editorRef.current.getSnapshot()
      const conns = window.__getAllConnections?.() || {}
      const eflow = {
        app: 'everything-flow',
        version: '0.5',
        timestamp: Date.now(),
        snapshot: snapshot,
        connections: conns,
      }
      const json = JSON.stringify(eflow, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const ext = format === 'eflow' ? 'eflow' : 'json'
      // Use current page name as filename
      const page = editorRef.current.getCurrentPageId()
      const pages = editorRef.current.getPages()
      const currentPage = pages.find(p => p.id === page)
      const pageName = currentPage?.name || 'untitled'
      const safeName = pageName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
      const a = document.createElement('a')
      a.href = url; a.download = `${safeName}.${ext}`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { alert('保存失败：' + err.message) }
  }

  const handleLoad = () => {
    if (!editorRef.current) return
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.eflow,.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        if (!text) throw new Error('空文件')
        const data = JSON.parse(text)
        if (!data || typeof data !== 'object') throw new Error('格式无效')

        if (data.app === 'everything-flow' && data.snapshot && data.connections) {
          // .eflow format — full load, rename first page
          const editor = editorRef.current
          const fileName = file.name.replace(/\.(eflow|json)$/i, '')
          loadSnapshot(editor.store, data.snapshot)

          // Rename the first page to the filename
          const pages = editor.getPages()
          if (pages.length > 0) {
            editor.updatePage({ id: pages[0].id, name: fileName })
          }

          // Restore connections
          if (window.__restoreConnections) {
            window.__restoreConnections(data.connections)
          }
        } else {
          // Legacy: try loading as raw store data or snapshot
          try {
            editorRef.current.loadSnapshot(data)
          } catch {
            editorRef.current.store.load(data)
          }
        }
      } catch (err) { alert('加载失败：' + err.message) }
    }
    input.click()
  }

  const handleExportPng = async () => {
    if (!editorRef.current) return
    try {
      const editor = editorRef.current
      const shapeIds = Array.from(editor.getCurrentPageShapeIds())
      const svg = await editor.getSvg(shapeIds)
      if (!svg) throw new Error('SVG 生成失败')

      // Add overlay arrows as SVG paths
      const conns = window.__getPageConnections?.() || []

      for (const conn of conns) {
        const sBounds = editor.getShapePageBounds(conn.sourceNodeId)
        const tBounds = editor.getShapePageBounds(conn.targetNodeId)
        if (!sBounds || !tBounds) continue

        const off = { h2: 0, h3: 0, h4: 0 }
        const route = orthogonalRoute(sBounds, tBounds, conn.sourceDotId, conn.targetDotId, off)
        if (!route || !route.d) continue

        // Create arrow path in SVG
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', route.d)
        path.setAttribute('stroke', '#6c63ff')
        path.setAttribute('stroke-width', '2.5')
        path.setAttribute('fill', 'none')
        path.setAttribute('marker-end', 'url(#arrowhead-export)')

        // Add arrowhead marker
        let defs = svg.querySelector('defs')
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
          svg.prepend(defs)
        }
        if (!svg.querySelector('#arrowhead-export')) {
          const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
          marker.setAttribute('id', 'arrowhead-export')
          marker.setAttribute('markerWidth', '4')
          marker.setAttribute('markerHeight', '5')
          marker.setAttribute('refX', '4')
          marker.setAttribute('refY', '2.5')
          marker.setAttribute('orient', 'auto')
          const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
          poly.setAttribute('points', '4 2.5, 0 0, 0 5')
          poly.setAttribute('fill', '#6c63ff')
          marker.appendChild(poly)
          defs.appendChild(marker)
        }

        // Find the right insertion point (after existing shapes)
        const g = svg.querySelector('g') || svg
        g.appendChild(path)
      }

      // Convert SVG to PNG
      const svgStr = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        const padding = 20
        const canvas = document.createElement('canvas')
        const vb = svg.getAttribute('viewBox')
        let vw = 1200, vh = 800
        if (vb) {
          const parts = vb.split(/\s+/).map(Number)
          vw = parts[2] || 1200
          vh = parts[3] || 800
        }
        canvas.width = vw + padding * 2
        canvas.height = vh + padding * 2

        const ctx = canvas.getContext('2d')
        // Dark background matching the theme
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, padding, padding, vw, vh)

        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob)
            const a = document.createElement('a')
            a.href = pngUrl
            a.download = `everything-flow-${Date.now()}.png`
            a.click()
            URL.revokeObjectURL(pngUrl)
          }
          URL.revokeObjectURL(url)
        }, 'image/png')
      }
      img.onerror = () => { alert('PNG 转换失败'); URL.revokeObjectURL(url) }
      img.src = url
    } catch (err) { alert('PNG 导出失败：' + err.message) }
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
          <button onClick={() => {
            const pageId = editorRef.current?.getCurrentPageId()
            const conns = window.__getPageConnections?.() || []
            conns.forEach(c => {
              if (c.mode !== 'orthogonal') {
                c.mode = 'orthogonal'
                window.__resetArrowOffsets?.(c.sourceNodeId + '-' + c.sourceDotId + '-' + c.targetNodeId + '-' + c.targetDotId)
              }
            })
            window.__triggerArrowUpdate?.()
          }} disabled={!ready} title="全部箭头改为正交">全部正交</button>
          <button onClick={() => {
            const conns = window.__getPageConnections?.() || []
            conns.forEach(c => { if (c.mode !== 'straight') c.mode = 'straight' })
            window.__triggerArrowUpdate?.()
          }} disabled={!ready} title="全部箭头改为直线">全部直线</button>
          <span className="toolbar-divider" />
          <AlignmentButtons editorRef={editorRef} ready={ready} />
          <span className="toolbar-divider" />
          <SaveExportMenu ready={ready} onSave={handleSave} onLoad={handleLoad} onExportPng={handleExportPng} />
        </div>
      </header>
      <div className="canvas-container">
        <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} theme="dark"
          components={{ Toolbar: null, MainMenu: null, PageMenu: null, MenuPanel: null, StylePanel: null }}>
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
