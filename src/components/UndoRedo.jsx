import React, { useState, useEffect, useCallback } from 'react'

function getEditor() {
  return window.__TLDRAW_EDITOR || null
}

export default function UndoRedo({ ready }) {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const refresh = useCallback(() => {
    const editor = getEditor()
    if (!editor) { setCanUndo(false); setCanRedo(false); return }
    setCanUndo(editor.getCanUndo())
    setCanRedo(editor.getCanRedo())
  }, [])

  useEffect(() => {
    if (!ready) return
    const editor = getEditor()
    if (!editor) return
    refresh()
    return editor.store.listen(refresh)
  }, [refresh, ready])

  const handleUndo = useCallback(() => {
    const editor = getEditor()
    if (!editor) return
    editor.undo()
  }, [])

  const handleRedo = useCallback(() => {
    const editor = getEditor()
    if (!editor) return
    editor.redo()
  }, [])

  return (
    <div className="undo-redo-group">
      <button
        className="undo-redo-btn"
        disabled={!canUndo}
        onClick={handleUndo}
        title="撤销 (Ctrl+Z)"
      >↩</button>
      <button
        className="undo-redo-btn"
        disabled={!canRedo}
        onClick={handleRedo}
        title="重做 (Ctrl+Shift+Z)"
      >↪</button>
    </div>
  )
}
