import { getIndices } from '@tldraw/utils'
import React, { useState, useRef, useEffect, useCallback } from 'react'

function getEditor() {
  return window.__TLDRAW_EDITOR || null
}

export default function CustomPageSelector({ ready }) {
  const [open, setOpen] = useState(false)
  const [pages, setPages] = useState([])
  const [currentPageId, setCurrentPageId] = useState(null)
  const [editingPageId, setEditingPageId] = useState(null)
  const [editName, setEditName] = useState('')
  const [hoveredPageId, setHoveredPageId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const draggedIdRef = useRef(null)
  const [totalShapesByPage, setTotalShapesByPage] = useState({})
  const [maxPages, setMaxPages] = useState(20)
  const [isReadonly, setIsReadonly] = useState(false)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  const refresh = useCallback(() => {
    const editor = getEditor()
    if (!editor) { setPages([]); return }
    const allPages = editor.getPages()
    setPages(allPages.sort((a, b) => a.index.localeCompare(b.index)))
    setCurrentPageId(editor.getCurrentPageId())
    setMaxPages(editor.options.maxPages)
    setIsReadonly(editor.getInstanceState().isReadonly)

    // Count flow-nodes per page (not ports or tldraw default shapes)
    const allRecords = editor.store.allRecords()
    const pageNodeCounts = {}
    for (const r of allRecords) {
      if (r.typeName === 'shape' && r.type === 'flow-node' && !r.props?.isPort) {
        // Find the actual page this shape lives on
        let pid = r.parentId
        const visited = new Set()
        while (pid && !pid.startsWith('page:') && !visited.has(pid)) {
          visited.add(pid)
          const parent = editor.getShape(pid)
          pid = parent ? parent.parentId : null
        }
        if (pid && pid.startsWith('page:')) {
          pageNodeCounts[pid] = (pageNodeCounts[pid] || 0) + 1
        }
      }
    }
    setTotalShapesByPage(pageNodeCounts)
  }, [])

  // Listen to editor store changes for live page list refresh
  useEffect(() => {
    if (!ready) return
    const editor = getEditor()
    if (!editor) return
    refresh()
    return editor.store.listen(refresh)
  }, [refresh, ready])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
        setEditingPageId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Auto-focus rename input when it appears
  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingPageId])

  const handleSwitchPage = useCallback((pageId) => {
    const editor = getEditor()
    if (!editor) return
    editor.setCurrentPage(pageId)
    setOpen(false)
    setEditingPageId(null)
  }, [])

  const handleAddPage = useCallback(() => {
    const editor = getEditor()
    if (!editor) return
    if (pages.length >= maxPages) {
      alert('已达到最大页面数限制')
      return
    }
    editor.createPage({ name: '新页面' })
    refresh()
  }, [pages.length, maxPages, refresh])

  const handleDeletePage = useCallback((pageId, pageName) => {
    const editor = getEditor()
    if (!editor) return
    const count = totalShapesByPage[pageId] || 0
    const msg = count > 0
      ? `页面「${pageName}」上有 ${count} 个节点，确定要删除吗？`
      : `确定要删除页面「${pageName}」吗？`
    if (!confirm(msg)) return
    if (pages.length <= 1) { alert('至少保留一个页面'); return }
    editor.deletePage(pageId)
    refresh()
    setOpen(false)
  }, [pages.length, totalShapesByPage, refresh])

  const handleRenameStart = useCallback((pageId, currentName) => {
    setEditingPageId(pageId)
    setEditName(currentName)
  }, [])

  const handleDuplicatePage = useCallback(async (pageId) => {
    const editor = getEditor()
    if (!editor) return
    // Build position-based ID map for source page flow-nodes
    const allRecords = editor.store.allRecords()
    const oldFlowNodes = allRecords.filter(
      r => r.typeName === 'shape' && r.type === 'flow-node' && !r.props?.isPort && r.parentId === pageId
    )
    const posToOldId = {}
    for (const s of oldFlowNodes) {
      posToOldId[`${Math.round(s.x)},${Math.round(s.y)}`] = s.id
    }
    const sourceConns = window.__getAllConnections?.()?.[pageId]
    const oldPageIds = new Set(editor.getPages().map(p => p.id))

    editor.duplicatePage(pageId)
    refresh()

    // Wait for store to settle
    await new Promise(r => setTimeout(r, 50))

    const newPage = editor.getPages().find(p => !oldPageIds.has(p.id))
    if (newPage && sourceConns && sourceConns.length > 0 && window.__restoreConnections) {
      const newRecords = editor.store.allRecords()
      const newFlowNodes = newRecords.filter(
        r => r.typeName === 'shape' && r.type === 'flow-node' && !r.props?.isPort && r.parentId === newPage.id
      )
      const idMap = {}
      for (const s of newFlowNodes) {
        const key = `${Math.round(s.x)},${Math.round(s.y)}`
        if (posToOldId[key]) idMap[posToOldId[key]] = s.id
      }
      const newConns = sourceConns.map(c => ({
        sourceNodeId: idMap[c.sourceNodeId] || c.sourceNodeId,
        sourceDotId: c.sourceDotId,
        targetNodeId: idMap[c.targetNodeId] || c.targetNodeId,
        targetDotId: c.targetDotId,
        mode: c.mode || 'orthogonal',
      }))
      const allConns = window.__getAllConnections?.() || {}
      allConns[newPage.id] = newConns
      window.__restoreConnections(allConns)
    }
  }, [refresh])

  const handleRenameSubmit = useCallback((pageId) => {
    const editor = getEditor()
    if (!editor) return
    const name = editName.trim()
    if (!name) { setEditingPageId(null); return }
    editor.updatePage({ id: pageId, name })
    setEditingPageId(null)
    refresh()
  }, [editName, refresh])

  const handleRenameKeyDown = useCallback((e, pageId) => {
    if (e.key === 'Enter') handleRenameSubmit(pageId)
    if (e.key === 'Escape') setEditingPageId(null)
  }, [handleRenameSubmit])

  const currentPage = pages.find(p => p.id === currentPageId)

  // ---- Drag & drop reorder handlers ----
  const handleDragStart = useCallback((e, pageId) => {
    draggedIdRef.current = pageId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', pageId)
  }, [])

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault()
    setDragOverIndex(null)
    const draggedId = draggedIdRef.current
    draggedIdRef.current = null
    if (!draggedId) return

    const editor = getEditor()
    if (!editor) return

    const fromIndex = pages.findIndex(p => p.id === draggedId)
    if (fromIndex === -1 || fromIndex === dropIndex) return

    // Reorder: build new order, reassign sequential indices
    const reordered = [...pages]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(dropIndex, 0, moved)

    // Batch update all page indices using tldraw's index key system
    editor.batch(() => {
      const newIndices = getIndices(reordered.length)
      reordered.forEach((page, i) => {
        editor.updatePage({ id: page.id, index: newIndices[i] })
      })
    })
    refresh()
  }, [pages, refresh])

  const handleDragEnd = useCallback(() => {
    draggedIdRef.current = null
    setDragOverIndex(null)
  }, [])

  return (
    <div className="page-selector-wrapper" ref={panelRef}>
      <button
        className={`page-selector-btn ${open ? 'active' : ''}`}
        onClick={() => { setOpen(o => !o); setEditingPageId(null) }}
        title="页面管理"
      >
        <span className="page-icon">📄</span>
        <span className="page-current-name">{currentPage?.name || '页面'}</span>
        <span className="page-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="page-selector-panel">
          {pages.map((page, index) => {
            const isCurrent = page.id === currentPageId
            const isHovered = hoveredPageId === page.id
            const isEditing = editingPageId === page.id
            const shapeCount = totalShapesByPage[page.id] || 0

            return (
              <div
                key={page.id}
                className={`page-item ${isCurrent ? 'current' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                onMouseEnter={() => setHoveredPageId(page.id)}
                onMouseLeave={() => { setHoveredPageId(null); handleDragLeave() }}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* Drag handle */}
                <span
                  className="page-drag-handle"
                  draggable={!isReadonly}
                  onDragStart={(e) => handleDragStart(e, page.id)}
                  title="拖拽排序"
                >⠿</span>
                <div
                  className="page-item-name"
                  onClick={() => { if (!isEditing) handleSwitchPage(page.id) }}
                >
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      className="page-rename-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRenameSubmit(page.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, page.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="page-name-label">
                      {page.name}
                      {isCurrent && <span className="page-current-badge">当前</span>}
                    </span>
                  )}
                </div>

                {/* Hover actions */}
                {isHovered && !isReadonly && !isEditing && (
                  <div className="page-actions">
                    <button
                      className="page-action-btn"
                      title="重命名"
                      onClick={(e) => { e.stopPropagation(); handleRenameStart(page.id, page.name) }}
                    >✏️</button>
                    <button
                      className="page-action-btn"
                      title="复制页面"
                      onClick={(e) => { e.stopPropagation(); handleDuplicatePage(page.id) }}
                    >📋</button>
                    <button
                      className="page-action-btn page-action-delete"
                      title="删除页面"
                      disabled={pages.length <= 1}
                      onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id, page.name) }}
                    >🗑</button>
                  </div>
                )}

                {/* Show shape count on right when not hovered */}
                {!isHovered && shapeCount > 0 && (
                  <span className="page-shape-count">{shapeCount}</span>
                )}
              </div>
            )
          })}

          {/* Add page button */}
          {!isReadonly && pages.length < maxPages && (
            <div className="page-add-btn" onClick={handleAddPage}>
              <span>＋ 添加页面</span>
            </div>
          )}
          {pages.length >= maxPages && !isReadonly && (
            <div className="page-add-btn disabled">
              <span>已达到上限 ({maxPages})</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
