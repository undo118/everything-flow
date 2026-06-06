# 工程整洁：CHANGELOG + README 同步

## 目标
给 everything-flow 添加工程规范文档，不涉及任何业务逻辑修改。

## 任务

### 1. CHANGELOG.md
- 格式：Keep a Changelog 风格
- 记录三个版本：
  - `mvp_v0.0` — 初始版：tldraw 集成 + 自定义 flow-node + 节点编辑器 + 箭头连接 + 右键平移
  - `v0.1` — 连接点重构：默认隐藏、hover/选中/拖拽预览显示、端口不可见、节点缩放修复、圆点DOM直连拖拽跟手
- 每个版本注明日期

### 2. README 同步（如需要）
- 检查 `~/hermes_workspace/README.md` 是否有 everything-flow 相关条目需要更新
- v0.1 新增的功能（端口隐藏、缩放修复等）无需写在 workspace 级 README，只处理已有的描述是否过时

### 3. 不做
- 不改任何 `src/` 业务代码
- 不改 `docs/`、`scripts/` 等目录结构
- 不涉及 git 操作（用户控制）
