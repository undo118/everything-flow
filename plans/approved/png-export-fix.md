# PNG 导出修复计划（已执行）

## 问题

当前 PNG 导出：
1. ~~节点内容空白~~ ✅ 修复：放弃 foreignObject，改用纯 SVG `<text>` 元素
2. ~~箭头路径坐标不匹配~~ ✅ 修复：统一 arrowRoutes 计算一次，同时用于 viewBox 和渲染
3. ~~缺少箭头头标记~~ ✅ 修复：已有 marker，确认路径渲染正确

## 已发现的 Bug

### Bug 1: `marked` 未导入 App.jsx
`marked.parse()` 在 App.jsx 的 `handleExportPng` 中使用，但文件顶部没有 `import { marked } from 'marked'`。运行时报 `ReferenceError`，catch 后只显示 raw markdown。

**修复**: 在 App.jsx 添加 `import { marked } from 'marked'`

### Bug 2: `foreignObject` 在 SVG→Image→Canvas 管道中不渲染
当 SVG 通过 `new Image().src = blobUrl` 加载时，浏览器将其视为"安全图像"上下文。`<foreignObject>` 内的 HTML 内容在大部分浏览器中不被渲染（或渲染不一致），导致节点显示为空白矩形。

**修复**: 放弃 foreignObject，改用纯 SVG `<text>` 元素渲染节点内容：
- 用 `marked.lexer()` 解析 markdown 提取标题文本
- 用 `<text>` 渲染标题，自动截断以适应节点宽度
- 用 `<text>` 逐行渲染字段 key-value 对（不同颜色）
- 用 `<line>` 渲染分隔线
- 保留 `<rect>` 渲染节点背景和边框

### Bug 3: SVG 元素缺少 `width`/`height`
SVG 只有 `viewBox` 没有物理尺寸，导致作为 `<img>` 加载时可能没有正确的内在尺寸。

**修复**: 添加 `width` 和 `height` 属性（值与 viewBox 的 vw/vh 一致）

### Bug 4: viewBox 填充背景通过 Canvas 二次绘制
之前的代码用 `ctx.fillRect()` 填充 Canvas 背景，再 `ctx.translate()` + `drawImage`。新代码在 SVG 内部添加全幅 `<rect>` 背景，Canvas 直接 `drawImage(img, minX, minY, vw, vh, 0, 0, vw, vh)` 更简洁可靠。

### Bug 5: 箭头计算重复
viewBox 计算和箭头渲染各调一次 `orthogonalRoute()`。改为统一计算 `arrowRoutes` 数组，一次性完成 bounds 计算和渲染。

## 具体改动

| 文件 | 改动 |
|------|------|
| `App.jsx` | 添加 `import { marked } from 'marked'` |
| `App.jsx` | 重写 `handleExportPng()`: 用纯 SVG `<text>` 元素渲染所有内容 |
| `App.jsx` | SVG 添加 `width`/`height`/`xmlns:xlink` 属性 |
| `App.jsx` | SVG 内嵌全覆背景 `<rect>` 填充 `#101011`（tldraw 暗色主题） |
| `App.jsx` | Canvas `drawImage(img, 0, 0, vw, vh)` 直接绘制（无偏移） |
| `App.jsx` | 箭头统一 `arrowRoutes` 数组，避免重复计算 |
| `App.jsx` | 箭头头 marker 改为 `4 2.5`（匹配 on-screen 纯三角） |
| `App.jsx` | 箭头支持 `conn.mode === 'straight'` 直线导出 |
| `App.jsx` | markdown 用 `marked.lexer()` 解析 tokens，分别渲染 heading（18px bold）和 paragraph（13px） |
| `App.jsx` | 字段用 CJK 感知的字符宽度计算（中文 1em，拉丁 0.6em） |
| `App.jsx` | **放弃 foreignObject**（导致 SecurityError: tainted canvas）|

## 验收

✅ 2026-06-10 用户验收通过。后续细节优化待跟进。

## 遗留问题（已加入 TODO）

- **复制页面不同步复制箭头** — `connectionsRef` 按 pageId 存储，tldraw 复制页面时不会触发自定义数据的复制
- **加载 eflow 覆盖当前页面** — `loadSnapshot()` 替换整个 store，应改为新页面导入方式
