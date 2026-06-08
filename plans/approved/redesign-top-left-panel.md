# 重做左上角面板 — 1:1 复刻 + 逐项验收

> **开发节奏（用户要求的核心流程）：**
> 每一项完成后 → `npx vite build` 验证 → 通知用户刷新浏览器手动验收 → 用户说"过"才能继续下一项 → 全部验收通过后，隐藏 tldraw 默认的 MainMenu/PageMenu/MenuPanel

**Goal:** 用 everything-flow 统一暗色主题，1:1 完整复刻 tldraw 左上角所有功能（汉堡菜单、页面管理、撤销/重做），然后隐藏原来的。

**架构:** 自定义 React 组件替代 tldraw 默认 UI，通过 `components` prop 注入。功能依赖 tldraw 的 hooks（`useEditor`、`useActions`、`useValue`、`useCanUndo`、`useCanRedo` 等），不破坏画布核心。

---

## 标准复刻流程（每 Task 循环）

每项功能按以下 **7 步标准流程** 执行，确保 1:1 精确复刻：

```
① 看原版参考
   ─ 浏览器打开 tldraw 对应组件，观察外观、交互、禁用态、边界情况
   ↓
② 实现组件
   ─ 写自定义 React 组件，功能与原生一致，样式用 our dark theme
   ↓
③ 替换注入
   ─ 在 components prop 中将该原生组件设为 null，注入自定义版
   ─ 完成后页面上立刻能看到替换效果（渐进吃掉原生 UI）
   ↓
④ npx vite build 验证
   ─ 构建必须通过，否则不进入下一步
   ↓
⑤ 通知验收
   ─ "✅ Xxx 已完成，请刷新页面验收"
   ↓
⑥ 你说 "过"
   ─ 通过了继续下一项
   ─ 不通过 → 修到满意为止
   ↓
⑦ 下一项 / 全部完成
   ─ 所有 Phase 验收通过 → 最终收尾（隐藏剩余原生组件）
```

---

## 当前状态

tldraw 左上角目前还是完全默认的：

| 组件 | 位置 | 状态 |
|------|------|------|
| MainMenu（☰ 汉堡菜单） | 左上角 | 默认 tldraw |
| PageMenu（页面选择器） | 汉堡菜单旁边 | 默认 tldraw |
| MenuPanel（撤销/重做 + 快速操作） | 页面上方 | 默认 tldraw |

顶部工具栏 `<header className="toolbar">` 仅覆盖了中间和右侧，左侧还是原生 tldraw。

---

## 完整功能树状图

下面是汉堡菜单、页面菜单、快速操作的完整功能树，1:1 覆盖 tldraw 原生左上角所有功能：

```
☰ MainMenu (汉堡菜单)
├── ✏️ 编辑 (EditSubmenu)
│   ├── ✂ 剪切 / 📋 复制 / 📌 粘贴  ✅
│   ├── ⊞ 编组 / ⊟ 取消编组  ✅
│   ├── 🔒 锁定 / 🔓 全部解锁  ✅
│   └── ☐ 全选  ✅
│
├── ➕ 插入 (ExtrasGroup)
│   ├── 🌐 嵌入 (Embed)
│   └── 🖼 媒体 (Media)
│
├── ⚙ 偏好 (PreferencesGroup)
│   ├── ☐ 吸附模式 (Snap Mode)
│   ├── ☐ 工具锁定 (Tool Lock)
│   ├── ☐ 网格 (Grid)
│   ├── ☐ 换行模式 (Wrap Mode)
│   ├── ☐ 专注模式 (Focus Mode)
│   ├── ☐ 边缘滚动 (Edge Scrolling)
│   ├── ☐ 减少动画 (Reduce Motion)
│   ├── ☐ 动态尺寸 (Dynamic Size Mode)
│   ├── ☐ 粘贴到光标 (Paste at Cursor)
│   ├── ☐ 调试模式 (Debug Mode)
│   ├── 🎨 主题 (浅色/深色/系统)
│   └── 🌐 语言 (下拉列表)
│
└── ❓ 帮助 (HelpGroup)
    ├── ⌨ 快捷键面板
    └── 📖 文档 (tldraw.dev)
```

```
📄 PageMenu (页面菜单)
├── 📄 页面1 (当前页面)
├── 📄 页面2 (hover 出操作按钮)
│   ├── ✏️ 重命名
│   ├── 📋 复制页面
│   ├── ⬆ 上移 / ⬇ 下移
│   └── 🗑 删除 (有节点时弹警告)
├── 📄 页面3
├── ...
└── ➕ 添加页面
```

```
↩↪ QuickActions (快速操作 — 提取到顶部栏左侧)
├── ↩ Undo (禁用态：不可撤销时)
└── ↪ Redo (禁用态：不可重做时)
```

```
顶部栏右侧功能
├── ➕ 添加节点
├── ▦ 对齐 (弹出面板)
├── 📂 加载 (.json)
└── 💾 ▾ 保存/导出 (下拉菜单)
    ├── 💾 保存为 .json
    ├── 📤 SVG 导出
    ├── 📤 PNG 导出
    ├── 📤 JSON 导出
    └── ☐ 透明背景 (开关)
```

---

## 目标布局

```
┌──────────────────────────────────────────────────────────────┐
│ [☰] [↩] [↪] [📄页面1 ▾]   │  Everything Flow   │ ➕ ▦ 📂 💾▾ │
│  (菜单) (撤销/重做) (页面)   │  (标题)            │ (节点/对齐/保存+导出) │
├──────────────────────────────────────────────────────────────┤
```

---

## 完整功能清单（按验收粒度排序）

### Phase 0：准备

#### Task 0.1: 截取当前 UI 参考图
- 启动 dev server
- 截图 or 记录当前所有 tldraw 默认组件状态
- 供后续对比

---

### Phase 1：汉堡菜单 — 核心结构

#### ✅ Task 1.1: 汉堡菜单外壳
- 创建 `CustomMainMenu` 组件（暗色面板，position: fixed）
- 点击 ☰ 打开/关闭，点击外部关闭
- 替换 `MainMenu: null`（暂不隐藏）

**包含的功能：** 展开/收起动画，面板样式（`#1e1e3a` 背景、`#444` 边框、圆角 10px、阴影）

---

### Phase 2：编辑功能组（EditSubmenu — 子菜单）

#### Task 2.1: 剪贴板组（ClipboardMenuGroup）
- 剪切（`cut`）、复制（`copy`）、粘贴（`paste`）
- 使用 `useActions()` 获取 action

**验收：** 选中节点 → 复制 → 粘贴 → 出现副本

#### Task 2.2: 选择与编组（SelectAll + Group/Ungroup）
- 全选（`select-all`）
- 编组（`group`）
- 取消编组（`ungroup`）

**验收：** 全选 → 编组 → ungroup

#### Task 2.3: 锁定组（LockGroup）
- 锁定（`toggle-lock`）
- 全部解锁（`unlock-all`）

**验收：** 锁定节点 → 不可移动 → 全部解锁

---

### Phase 3：插入功能组（ExtrasGroup）

#### Task 3.1: 插入嵌入/媒体
- 插入嵌入（`insert-embed`）
- 插入媒体（`insert-media`）

**验收：** 插入嵌入 → 弹 URL 输入框

---

### Phase 4：偏好设置组（PreferencesGroup — 子菜单）

#### Task 4.1: 开关项
- 吸附模式（`toggle-snap-mode`）
- 工具锁定（`toggle-tool-lock`）
- 网格（`toggle-grid`）
- 换行模式（`toggle-wrap-mode`）
- 专注模式（`toggle-focus-mode`）
- 边缘滚动（`toggle-edge-scrolling`）
- 减少动画（`toggle-reduce-motion`）
- 动态尺寸（`toggle-dynamic-size-mode`）
- 粘贴到光标（`toggle-paste-at-cursor`）
- 调试模式（`toggle-debug-mode`）

**验收：** 逐个开关，观察状态变化

#### Task 4.2: 主题选择（ColorSchemeMenu）
- 浅色/深色/跟随系统

**验收：** 切换深色→浅色→深色

#### Task 4.3: 语言选择（LanguageMenu）
- 语言下拉列表

**验收：** 切换语言 → UI 文本变化

---

### Phase 5：帮助组（HelpGroup）

#### Task 5.1: 快捷键面板 + 文档链接
- 打开快捷键面板（`KeyboardShortcutsMenuItem`）
- 文档链接（打开 `https://tldraw.dev`）

**验收：** 快捷键面板弹出；文档链接新标签打开

---

### Phase 6：页面管理（PageMenu）

#### Task 6.1: 自定义页面选择器（CustomPageSelector）
- 显示当前页面名
- 点击展开下拉列表
- 列表项：hover 显示操作按钮（✅ 确认使用 hover 模式）
  - 重命名（点击进入编辑态 `PageItemInput`）
  - 复制页面（`editor.duplicatePage()`）
  - 上移/下移（`editor.updatePage({ id, index })`）
  - 删除页面 → 如果页面上有节点，弹确认警告（Q1 决定）
- 底部"添加页面"按钮
- 最大页面数限制（`editor.options.maxPages`）
- 只读模式隐藏编辑操作

**关键 API：**
- `editor.getPages()`、`editor.getCurrentPageId()`、`editor.setCurrentPageId()`
- `editor.createPage()`、`editor.deletePage()`、`editor.duplicatePage()`
- `editor.updatePage({ id, name })` 重命名
- `editor.getCurrentPageShapeIds()` — 用于判断页面是否有节点

**验收：** 新建页面 → 切换 → 删除（带警告）→ 重命名 → 复制 → 排序

---

### Phase 7：撤销/重做按钮（QuickActions — 提取到顶部栏）

#### Task 7.1: 顶部栏增加 Undo/Redo 按钮
- 放在工具栏左侧，汉堡菜单旁边
- Undo（`↩`）：使用 `useCanUndo()` 控制禁用态
- Redo（`↪`）：使用 `useCanRedo()` 控制禁用态
- 调用 `editor.undo()` / `editor.redo()`

**验收：** 操作后点 undo → 恢复；点 redo → 重做

---

### Phase 8：导出 + 保存合并为下拉按钮

#### Task 8.1: 💾 按钮改为导出下拉菜单
将现有的 "💾 保存" 按钮改为下拉弹出菜单，包含所有保存/导出选项：

```
┌─ 💾 ──────────────┐
│ 💾 保存为 .json     │
│ 📤 SVG 导出         │
│ 📤 PNG 导出         │
│ 📤 JSON 导出         │
│ ☐ 透明背景           │
└────────────────────┘
```

- **保存为 .json**：保留现有逻辑
- **SVG/PNG/JSON 导出**：使用 `export-all-as-svg` / `export-all-as-png` / `export-all-as-json` actions
- **透明背景**：ToggleTransparentBgMenuItem（开关状态持久化）
- **注意：** .eflow 格式不在此 plan 范围内

**验收：** 点 💾 → 下拉菜单出现 → 导出 PNG → 下载图片

---

### Phase 9：布局重排

#### Task 9.1: 重新组织顶部栏布局
将上述所有组件整合进 `<header className=\"toolbar\">`：

```
<header>
  <div class=\"toolbar-left\">
    [☰ CustomMainMenu] [↩ Undo] [↪ Redo] [📄 CustomPageSelector ▾]
  </div>
  <div class=\"toolbar-center\">
    <h1>Everything Flow</h1>
  </div>
  <div class=\"toolbar-right\">
    [➕ 添加节点] [▦ 对齐] [📂 加载] [💾 ▾ 保存+导出]
  </div>
</header>
```

**注意：** zoom（左下角原生控件）不动。不需要添加额外的 zoom。

---

### Phase 9：最终收尾

#### Task 9.1: 隐藏 tldraw 默认组件
在 `<Tldraw>` 的 `components` prop 中设置：
```jsx
components={{
  Toolbar: null,            // 已隐藏
  MainMenu: null,           // 改为隐藏
  PageMenu: null,           // 新增
  MenuPanel: null,          // 新增
}}
```

#### Task 9.2: 暗色主题统一验证
- 所有新组件使用 `#1e1e3a` 背景、`#444` 边框、圆角 10px、阴影
- 与现有底部工具栏、对齐面板风格一致

#### Task 9.3: 最终验收清单
- [ ] 汉堡菜单所有子菜单展开/收起正常
- [ ] 编辑组所有操作可执行
- [ ] 💾 下拉菜单可展开，保存/导出均正常
- [ ] 插入组可弹出
- [ ] 偏好组开关可切换、主题切换有效、语言切换有效
- [ ] 帮助组快捷键面板打开、文档链接打开
- [ ] 页面选择器：切换/新建/重命名/复制/排序/删除（带警告）
- [ ] Undo/Redo 禁用态正确
- [ ] 暗色主题统一，无白色闪烁
- [ ] `npx vite build` 通过
- [ ] 隐藏 tldraw 默认 MainMenu/PageMenu/MenuPanel 后无报错

---

## 样式约定

| 属性 | 值 |
|------|-----|
| 背景 | `#1e1e3a` |
| 边框 | `#444` |
| 圆角 | `10px` |
| 阴影 | `0 8px 24px rgba(0,0,0,0.5)` |
| 主文本 | `#e0e0e0` |
| 次要文本 | `#888` |
| 悬停背景 | `#2a2a4a` |
| 激活背景 | `#3a3a5a` |

---

## 未决问题（已解决）

- ~~**Q1: 页面删除警告** → 需要警告（当页面有关联节点时弹确认框）~~ ✅
- ~~**Q2: 导出 .eflow 格式** → 不在此 plan 范围内，推迟到后续导出优化~~ ✅
- ~~**Q3: Zoom 控件** → 不做，左下角原生 zoom 足够好~~ ✅
- ~~**Q4: PageMenu 交互** → hover 显示操作按钮（跟 tldraw 原版一致）~~ ✅
