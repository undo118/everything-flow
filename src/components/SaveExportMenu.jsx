import React, { useState, useRef, useEffect, useCallback } from 'react'

export default function SaveExportMenu({ ready, onSave, onLoad, onExportPng }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const ITEMS = [
    { label: '💾 保存 .eflow', action: 'save-eflow' },
    { type: 'separator' },
    { label: '📂 加载文件', action: 'load' },
    { type: 'separator' },
    { label: '🖼 导出 PNG', action: 'export-png' },
  ]

  const handleClick = useCallback((item) => {
    if (item.type === 'separator') return
    setOpen(false)
    switch (item.action) {
      case 'save-eflow': onSave('eflow'); break
      case 'load': onLoad(); break
      case 'export-png': onExportPng(); break
    }
  }, [onSave, onLoad, onExportPng])

  return (
    <div className="save-export-wrapper" ref={panelRef}>
      <button
        className={`save-export-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        disabled={!ready}
        title="保存/加载/导出"
      >
        📁 文件 ▾
      </button>
      {open && (
        <div className="save-export-panel">
          {ITEMS.map((item, i) => {
            if (item.type === 'separator') return <div key={i} className="save-export-separator" />
            return (
              <div key={item.action} className="save-export-item" onClick={() => handleClick(item)}>
                <span>{item.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
