import React, { useState, useRef, useEffect, useCallback } from 'react'

function getEditor() {
  return window.__TLDRAW_EDITOR || null
}

function getActions() {
  return window.__TLDRAW_ACTIONS || null
}

const EXPORT_ITEMS = [
  { label: '保存为 .json', icon: '💾', action: 'save-json' },
  { type: 'separator' },
  { label: 'SVG 导出', icon: '📤', action: 'export-all-as-svg' },
  { label: 'PNG 导出', icon: '📤', action: 'export-all-as-png' },
  { label: 'JSON 导出', icon: '📤', action: 'export-all-as-json' },
  { type: 'separator' },
  { label: '透明背景', action: 'toggle-transparent', type: 'toggle' },
]

export default function SaveExportMenu({ ready }) {
  const [open, setOpen] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [tick, setTick] = useState(0)
  const panelRef = useRef(null)

  const refreshTransparent = useCallback(() => {
    const editor = getEditor()
    if (!editor) return
    setTransparent(editor.getInstanceState().exportBackground === false)
  }, [])

  // Listen for store changes
  useEffect(() => {
    if (!ready) return
    const editor = getEditor()
    if (!editor) return
    refreshTransparent()
    return editor.store.listen(() => {
      refreshTransparent()
      setTick(t => t + 1)
    })
  }, [ready, refreshTransparent])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSaveJson = useCallback(() => {
    const editor = getEditor()
    if (!editor) return
    setOpen(false)
    try {
      const json = JSON.stringify(editor.store.serialize(), null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `everything-flow-${Date.now()}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { alert('保存失败：' + err.message) }
  }, [])

  const handleAction = useCallback((actionId) => {
    const actions = getActions()
    if (!actions) return
    setOpen(false)
    const action = actions[actionId]
    if (action?.onSelect) {
      action.onSelect('menu')
    }
  }, [])

  const handleToggleTransparent = useCallback(() => {
    const actions = getActions()
    if (!actions) return
    const action = actions['toggle-transparent']
    if (action?.onSelect) {
      action.onSelect('menu')
    }
    // Toggle state will update via store listener
  }, [])

  const handleItemClick = useCallback((item) => {
    if (item.type === 'separator') return
    if (item.action === 'save-json') { handleSaveJson(); return }
    if (item.action === 'toggle-transparent') { handleToggleTransparent(); return }
    handleAction(item.action)
  }, [handleSaveJson, handleToggleTransparent, handleAction])

  const getToggleState = useCallback((actionId) => {
    if (actionId === 'toggle-transparent') return transparent
    const editor = getEditor()
    if (!editor) return false
    switch (actionId) {
      default: return false
    }
  }, [transparent])

  return (
    <div className="save-export-wrapper" ref={panelRef}>
      <button
        className={`save-export-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        disabled={!ready}
        title="保存/导出"
      >
        💾 导出 ▾
      </button>
      {open && (
        <div className="save-export-panel">
          {EXPORT_ITEMS.map((item, i) => {
            if (item.type === 'separator') {
              return <div key={i} className="save-export-separator" />
            }
            const checked = item.type === 'toggle' ? getToggleState(item.action) : false
            return (
              <div
                key={item.action || i}
                className={`save-export-item ${item.type === 'toggle' ? 'toggle-item' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                {item.icon && <span className="save-export-icon">{item.icon}</span>}
                <span className="save-export-label">{item.label}</span>
                {item.type === 'toggle' && (
                  <span className="save-export-check">{checked ? '✓' : ''}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
