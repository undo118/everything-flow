import { useEffect } from 'react'
import { useActions, useEditor } from 'tldraw'

/**
 * Bridges tldraw UI context to globals for components
 * rendered outside <Tldraw>.
 */
export default function ActionsBridge() {
  const actions = useActions()
  const editor = useEditor()

  useEffect(() => {
    window.__TLDRAW_ACTIONS = actions
    window.__TLDRAW_EDITOR = editor
    // Default preferences
    if (editor.user.getEdgeScrollSpeed() === 0) {
      editor.user.updateUserPreferences({ edgeScrollSpeed: 1 })
    }
    if (editor.getInstanceState().isDebugMode) {
      editor.updateInstanceState({ isDebugMode: false })
    }
    if (editor.user.getLocale() !== 'zh') {
      editor.user.updateUserPreferences({ locale: 'zh' })
    }
    if (editor.user.getUserPreferences().colorScheme !== 'light') {
      editor.user.updateUserPreferences({ colorScheme: 'light' })
    }
  }, [actions, editor])

  return null
}
