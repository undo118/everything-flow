import { useEffect } from 'react'
import { useDialogs } from 'tldraw'

/**
 * Bridges tldraw dialog system to globals for components
 * rendered outside <Tldraw>.
 */
export default function DialogBridge() {
  const { addDialog } = useDialogs()

  useEffect(() => {
    window.__TLDRAW_ADD_DIALOG = addDialog
  }, [addDialog])

  return null
}
