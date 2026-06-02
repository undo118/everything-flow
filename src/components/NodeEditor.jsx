import React, { useState, useEffect } from 'react'
import { marked } from 'marked'

const FIELD_TEMPLATES = ['责任人', '任务', '输入', '输出', '版本', '状态']
const STATUS_OPTIONS = ['待开始', '进行中', '已完成', '阻塞']

export default function NodeEditor({ shape, editor, onClose }) {
  const [markdown, setMarkdown] = useState(shape.props.markdown || '')
  const [fields, setFields] = useState(() => {
    try {
      return JSON.parse(shape.props.fields || '[]')
    } catch {
      return []
    }
  })
  const [activeTab, setActiveTab] = useState('content')

  const handleSave = () => {
    editor.updateShape({
      id: shape.id,
      type: 'flow-node',
      props: {
        ...shape.props,
        markdown,
        fields: JSON.stringify(fields),
      },
    })
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const addField = () => {
    setFields([...fields, { key: '', value: '' }])
  }

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const updateField = (index, key, value) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], key, value }
    setFields(updated)
  }

  let previewHtml = ''
  try {
    previewHtml = marked.parse(markdown)
  } catch {
    previewHtml = markdown
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel()
      }}
    >
      <div
        style={{
          background: '#1e1e3a',
          borderRadius: 12,
          border: '1px solid #444',
          width: 640,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #333',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, color: '#e0e0e0' }}>
            编辑节点
          </h3>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: 18,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #333',
            padding: '0 16px',
          }}
        >
          {[
            { key: 'content', label: '内容' },
            { key: 'fields', label: '模板字段' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom:
                  activeTab === tab.key ? '2px solid #6c63ff' : '2px solid transparent',
                color: activeTab === tab.key ? '#e0e0e0' : '#888',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {activeTab === 'content' && (
            <div style={{ display: 'flex', gap: 12, minHeight: 300 }}>
              {/* Editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label
                  style={{
                    fontSize: 11,
                    color: '#888',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Markdown
                </label>
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0f0f23',
                    border: '1px solid #444',
                    borderRadius: 6,
                    color: '#e0e0e0',
                    padding: 10,
                    fontFamily: 'monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'none',
                    outline: 'none',
                    minHeight: 250,
                  }}
                  placeholder="# 标题&#10;&#10;描述内容..."
                />
              </div>
              {/* Preview */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label
                  style={{
                    fontSize: 11,
                    color: '#888',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  预览
                </label>
                <div
                  style={{
                    flex: 1,
                    background: '#0f0f23',
                    border: '1px solid #444',
                    borderRadius: 6,
                    padding: 10,
                    overflow: 'auto',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#e0e0e0',
                    minHeight: 250,
                  }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

          {activeTab === 'fields' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, color: '#888' }}>
                  字段列表（留空的字段不显示）
                </span>
                <button
                  onClick={addField}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #6c63ff',
                    borderRadius: 4,
                    background: 'transparent',
                    color: '#6c63ff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  + 添加字段
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 11, color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', borderBottom: '1px solid #333' }}>
                      字段名
                    </th>
                    <th style={{ padding: '6px 8px', borderBottom: '1px solid #333' }}>
                      值
                    </th>
                    <th
                      style={{
                        padding: '6px 8px',
                        borderBottom: '1px solid #333',
                        width: 40,
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px' }}>
                        <select
                          value={field.key}
                          onChange={(e) =>
                            updateField(i, e.target.value, field.value)
                          }
                          style={{
                            width: '100%',
                            background: '#0f0f23',
                            border: '1px solid #444',
                            borderRadius: 4,
                            color: '#e0e0e0',
                            padding: '4px 8px',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        >
                          <option value="">自定义...</option>
                          {FIELD_TEMPLATES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        {field.key === '状态' ? (
                          <select
                            value={field.value}
                            onChange={(e) =>
                              updateField(i, field.key, e.target.value)
                            }
                            style={{
                              width: '100%',
                              background: '#0f0f23',
                              border: '1px solid #444',
                              borderRadius: 4,
                              color: '#e0e0e0',
                              padding: '4px 8px',
                              fontSize: 13,
                              outline: 'none',
                            }}
                          >
                            <option value="">--</option>
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) =>
                              updateField(i, field.key, e.target.value)
                            }
                            placeholder="值"
                            style={{
                              width: '100%',
                              background: '#0f0f23',
                              border: '1px solid #444',
                              borderRadius: 4,
                              color: '#e0e0e0',
                              padding: '4px 8px',
                              fontSize: 13,
                              outline: 'none',
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeField(i)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: 2,
                          }}
                          title="删除字段"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid #333',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: '6px 16px',
              border: '1px solid #555',
              borderRadius: 6,
              background: 'transparent',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              background: '#6c63ff',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
