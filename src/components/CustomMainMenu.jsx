import React, { useState, useRef, useEffect, useCallback } from 'react'

const MENU_ENTRIES = [
  {
    label: '编辑',
    submenu: [
      // 剪贴板组
      { label: '剪切', shortcut: '⌘X', actionId: 'cut' },
      { label: '复制', shortcut: '⌘C', actionId: 'copy' },
      { label: '粘贴', shortcut: '⌘V', actionId: 'paste' },
      { type: 'separator' },
      // 编组组
      { label: '编组', shortcut: '⌘G', actionId: 'group' },
      { label: '取消编组', shortcut: '⇧⌘G', actionId: 'ungroup' },
      { type: 'separator' },
      // 锁定组
      { label: '锁定', actionId: 'lock' },
      { label: '解锁', actionId: 'unlock' },
      { label: '全部解锁', actionId: 'unlock-all' },
      { type: 'separator' },
      // 全选
      { label: '全选', shortcut: '⌘A', actionId: 'select-all' },
    ],
  },
  {
    label: '偏好设置',
    submenu: [
      { label: '参考线', type: 'toggle', actionId: 'toggle-snap-mode' },
      { label: '网格', type: 'toggle', actionId: 'toggle-grid' },
      { label: '隐藏菜单', type: 'toggle', actionId: 'toggle-focus-mode' },
      { label: '边缘滚动', type: 'toggle', actionId: 'toggle-edge-scrolling' },
      { label: '粘贴到光标', type: 'toggle', actionId: 'toggle-paste-at-cursor' },
      { label: '调试模式', type: 'toggle', actionId: 'toggle-debug-mode' },
      { type: 'separator' },
      { label: '默认正交', type: 'toggle', actionId: 'toggle-default-orthogonal' },
      { label: '手柄灵敏度', submenu: [
        { label: '灵敏度调节', type: 'slider', min: 0.1, max: 1, step: 0.05 },
      ]},
      { type: 'separator' },
      { label: '主题', submenu: [
        { label: '浅色', themeAction: 'light' },
        { label: '深色', themeAction: 'dark' },
        { label: '跟随系统', themeAction: 'system' },
      ]},
      { label: '语言', submenu: [
        { label: '中文', langAction: 'zh' },
        { label: 'English', langAction: 'en' },
      ]},
    ],
  },
  {
    label: '帮助',
    submenu: [
      { label: '快捷键', actionId: 'open-keyboard-shortcuts' },
      { label: '使用文档', actionId: 'open-docs' },
    ],
  },
]

export default function CustomMainMenu() {
  const [open, setOpen] = useState(false)
  const [activeSub, setActiveSub] = useState(null)
  const [activeSubSub, setActiveSubSub] = useState(null)
  const [tick, setTick] = useState(0) // forces re-render for toggle states
  const panelRef = useRef(null)
  const hoverTimerRef = useRef(null)

  // Click outside closes all
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
        setActiveSub(null)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [open])

  const toggle = useCallback(() => {
    setOpen((o) => {
      if (o) setActiveSub(null)
      return !o
    })
  }, [])

  const handleEntryEnter = useCallback((label) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setActiveSub(label), 80)
  }, [])

  const handleEntryLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setActiveSub(null), 150)
  }, [])

  const handleSubEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }, [])

  const handleSubLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      setActiveSub(null)
      setActiveSubSub(null)
    }, 150)
  }, [])

  const handleSubSubEnter = useCallback((label) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setActiveSubSub(label), 80)
  }, [])

  const handleSubSubLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setActiveSubSub(null), 150)
  }, [])

  const handleAction = useCallback(async (actionId) => {
    const actions = window.__TLDRAW_ACTIONS
    const editor = window.__TLDRAW_EDITOR
    if (!actions) return

    if (actionId === 'paste') {
      await handlePaste()
      return
    }

    if (actionId === 'lock') {
      setOpen(false)
      setActiveSub(null)
      if (!editor) return
      editor.batch(() => {
        editor.getSelectedShapeIds().forEach((id) => {
          const s = editor.getShape(id)
          if (s && !s.props.locked) {
            editor.updateShape({ ...s, props: { ...s.props, locked: 1 } })
          }
        })
      })
      return
    }

    if (actionId === 'unlock') {
      setOpen(false)
      setActiveSub(null)
      if (!editor) return
      editor.batch(() => {
        editor.getSelectedShapeIds().forEach((id) => {
          const s = editor.getShape(id)
          if (s && s.props.locked) {
            editor.updateShape({ ...s, props: { ...s.props, locked: 0 } })
          }
        })
      })
      return
    }

    if (actionId === 'unlock-all') {
      setOpen(false)
      setActiveSub(null)
      if (!editor) return
      editor.batch(() => {
        // Clear locked prop on all flow-node shapes
        const allShapes = editor.store.allRecords().filter(
          (r) => r.typeName === 'shape' && r.type === 'flow-node' && !r.props?.isPort && r.props?.locked
        )
        allShapes.forEach((s) => {
          editor.updateShape({ ...s, props: { ...s.props, locked: 0 } })
        })
      })
      return
    }

    // Theme/language actions
    if (actionId === 'set-theme') {
      setOpen(false)
      setActiveSub(null)
      return
    }
    if (actionId === 'set-lang') {
      setOpen(false)
      setActiveSub(null)
      return
    }

    // Help actions
    if (actionId === 'open-keyboard-shortcuts') {
      setOpen(false)
      setActiveSub(null)
      const addDialog = window.__TLDRAW_ADD_DIALOG
      if (addDialog) {
        // Dynamically import the dialog component
        import('tldraw').then(({ DefaultKeyboardShortcutsDialog }) => {
          addDialog({ component: DefaultKeyboardShortcutsDialog })
        })
      }
      return
    }

    if (actionId === 'open-docs') {
      setOpen(false)
      setActiveSub(null)
      window.open('https://github.com/undo118/everything-flow', '_blank')
      return
    }

    // Custom toggle: default arrow mode
    if (actionId === 'toggle-default-orthogonal') {
      const newMode = (window.__DEFAULT_ARROW_MODE || 'orthogonal') === 'orthogonal' ? 'straight' : 'orthogonal'
      window.__DEFAULT_ARROW_MODE = newMode
      localStorage.setItem('eflow-default-arrow-mode', newMode)
      setTick((t) => t + 1)
      return
    }

    const action = actions[actionId]
    if (action?.onSelect) {
      action.onSelect('menu')
      if (action.checkbox) {
        setTick((t) => t + 1) // force re-render to show updated toggle state
      } else {
        setOpen(false)
        setActiveSub(null)
      }
    }
  }, [])

  const handlePaste = useCallback(async () => {
    const editor = window.__TLDRAW_EDITOR
    const actions = window.__TLDRAW_ACTIONS
    if (!editor || !actions) return

    setOpen(false)
    setActiveSub(null)

    const pasteAtCursor = editor.user.getIsPasteAtCursorMode()

    if (pasteAtCursor) {
      // "粘贴到光标" ON → paste at mouse position
      actions['paste'].onSelect('context-menu')
    } else {
      // "粘贴到光标" OFF → place at bottom-right of selection
      const prevBounds = editor.getSelectionPageBounds()
      actions['paste'].onSelect('menu')

      if (prevBounds) {
        // Wait for paste to complete
        await new Promise((r) => setTimeout(r, 50))
        const newIds = editor.getSelectedShapeIds()
        if (newIds.length > 0) {
          // Find where paste placed the group
          const newBounds = editor.getSelectionPageBounds()
          if (newBounds) {
            // Move entire group so its top-left is at (prevBounds.x+30, prevBounds.y+30)
            const deltaX = (prevBounds.x + 30) - newBounds.x
            const deltaY = (prevBounds.y + 30) - newBounds.y
            editor.batch(() => {
              newIds.forEach((id) => {
                const s = editor.getShape(id)
                if (s) editor.updateShape({ ...s, x: s.x + deltaX, y: s.y + deltaY })
              })
            })
          }
        }
      }
    }
  }, [])

  const isEnabled = useCallback((item) => {
    return !!(item.actionId && window.__TLDRAW_ACTIONS)
  }, [])

  const getToggleState = useCallback((actionId) => {
    const e = window.__TLDRAW_EDITOR
    if (!e) return false
    switch (actionId) {
      case 'toggle-snap-mode': return e.user.getIsSnapMode()
      case 'toggle-tool-lock': return e.getInstanceState().isToolLocked
      case 'toggle-grid': return e.getInstanceState().isGridMode
      case 'toggle-wrap-mode': return e.user.getIsWrapMode()
      case 'toggle-focus-mode': return e.getInstanceState().isFocusMode
      case 'toggle-edge-scrolling': return e.user.getEdgeScrollSpeed() !== 0
      case 'toggle-reduce-motion': return e.user.getAnimationSpeed() === 0
      case 'toggle-dynamic-size-mode': return e.user.getIsDynamicResizeMode()
      case 'toggle-paste-at-cursor': return e.user.getIsPasteAtCursorMode()
      case 'toggle-debug-mode': return e.getInstanceState().isDebugMode
      case 'toggle-default-orthogonal': return (window.__DEFAULT_ARROW_MODE || 'orthogonal') === 'orthogonal'
      default: return false
    }
  }, [])

  return (
    <div className="main-menu-wrapper" ref={panelRef}>
      <button
        className={`hamburger-btn ${open ? 'active' : ''}`}
        onClick={toggle}
        title="菜单"
      >
        ☰
      </button>
      {open && (
        <div className="main-menu-panel">
          {MENU_ENTRIES.map((entry) => {
            const isActive = activeSub === entry.label
            return (
              <div
                key={entry.label}
                className={`menu-entry ${isActive ? 'active' : ''}`}
                onMouseEnter={() => handleEntryEnter(entry.label)}
                onMouseLeave={handleEntryLeave}
              >
                <span className="menu-entry-label">{entry.label}</span>
                <span className="menu-entry-arrow">▶</span>

                {isActive && (
                  <div
                    className="menu-submenu"
                    onMouseEnter={handleSubEnter}
                    onMouseLeave={handleSubLeave}
                  >
                    {entry.submenu.map((item, i) => {
                      if (item.type === 'separator') {
                        return <div key={i} className="menu-separator" />
                      }
                      const enabled = isEnabled(item) || item.type === 'toggle'
                      const checked = item.type === 'toggle' ? getToggleState(item.actionId) : false
                      const hasSub = !!item.submenu
                      const subActive = activeSubSub === item.label
                      return (
                        <div
                          key={item.label}
                          className={`menu-item ${!enabled && !hasSub ? 'disabled' : ''} ${hasSub ? 'menu-sub-item' : ''}`}
                          onClick={!hasSub && enabled ? () => handleAction(item.actionId) : undefined}
                          onMouseEnter={hasSub ? () => handleSubSubEnter(item.label) : undefined}
                          onMouseLeave={hasSub ? handleSubSubLeave : undefined}
                        >
                          {item.type === 'toggle' ? (
                            <>
                              <span>{item.label}</span>
                              <span className="menu-check">{checked ? '✓' : ''}</span>
                            </>
                          ) : item.type === 'slider' ? (
                            <div className="menu-slider-row"
                              onMouseEnter={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}>
                              <span className="menu-slider-label">{item.label}</span>
                              <div className="menu-slider-control">
                                <input type="range" className="menu-slider-input"
                                  min={item.min} max={item.max} step={item.step}
                                  defaultValue={window.__HANDLE_SENSITIVITY || 0.4}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value)
                                    window.__HANDLE_SENSITIVITY = v
                                    // Force re-render of the menu to show updated value
                                    e.target.nextSibling.textContent = v.toFixed(2)
                                  }}
                                />
                                <span className="menu-slider-value">{(window.__HANDLE_SENSITIVITY || 0.4).toFixed(2)}</span>
                              </div>
                            </div>
                          ) : (
                            <span>{item.label}</span>
                          )}
                          {hasSub && <span className="submenu-arrow">▶</span>}
                          {item.shortcut && (
                            <span className="menu-shortcut">{item.shortcut}</span>
                          )}
                          {hasSub && subActive && (
                            <div
                              className="menu-submenu menu-subsubmenu"
                              onMouseEnter={handleSubEnter}
                              onMouseLeave={handleSubSubLeave}
                            >
                              {item.submenu.map((sub, j) => {
                                const e = window.__TLDRAW_EDITOR
                                let isThemeActive = false
                                if (e && sub.themeAction) {
                                  const scheme = e.user.getUserPreferences().colorScheme
                                  isThemeActive = scheme === sub.themeAction
                                }
                                const isLangActive = sub.langAction && e && e.user.getLocale() === sub.langAction
                                if (sub.type === 'slider') {
                                  return (
                                    <div key={j} className="menu-slider-row"
                                      onMouseEnter={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}>
                                      <span className="menu-slider-label">{sub.label}</span>
                                      <div className="menu-slider-control">
                                        <input type="range" className="menu-slider-input"
                                          min={sub.min} max={sub.max} step={sub.step}
                                          defaultValue={window.__HANDLE_SENSITIVITY || 0.4}
                                          onChange={(e) => {
                                            const v = parseFloat(e.target.value)
                                            window.__HANDLE_SENSITIVITY = v
                                            e.target.nextSibling.textContent = v.toFixed(2)
                                          }}
                                        />
                                        <span className="menu-slider-value">{(window.__HANDLE_SENSITIVITY || 0.4).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )
                                }
                                return (
                                <div key={j} className="menu-item"
                                  onClick={() => {
                                    if (sub.themeAction) {
                                      if (e) e.user.updateUserPreferences({ colorScheme: sub.themeAction })
                                      setOpen(false); setActiveSub(null); setActiveSubSub(null)
                                    }
                                    if (sub.langAction) {
                                      if (e) e.user.updateUserPreferences({ locale: sub.langAction })
                                      setOpen(false); setActiveSub(null); setActiveSubSub(null)
                                    }
                                  }}
                                >
                                  <span>{sub.label}</span>
                                  {(isThemeActive || isLangActive) && <span className="menu-check">✓</span>}
                                </div>
                              )})}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
