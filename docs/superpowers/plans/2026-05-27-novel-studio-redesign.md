# Novel Studio 全面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Novel Studio 从单体 SPA 重构为路由式模块化应用，新增书架首页、三栏工作台、角色管理、卷纲管理、主线/支线/隐藏线、记忆系统、封面/简介生成、导入向导、AI 配置。

**Architecture:** Flask 后端 REST API + SQLite 每项目独立 DB；前端 Hash 路由 SPA，JS/CSS 模块化拆分；HTML 使用多视图容器切换。

**Tech Stack:** Flask + SQLite + Vanilla JS (ES5兼容) + CSS Custom Properties + Canvas API

---

## 补充设计：角色板块 + 情节线

### 角色管理完整视图
- 工作台左栏"角色管理"点击 → 右栏区域切换为角色面板
- 角色列表（彩色头像占位 + 姓名 + 标签）+ 点击展开详情编辑
- 详情：性别/年龄/性格 + 背景故事 + 目标动机 + 外貌描述 + 关联关系

### 情节线（主线🔴/支线🟡/隐藏线🔵）
- 记忆系统第四 Tab
- 按类型分组展示，每条线：名称 + 描述 + 关联章节 + 状态

---

## Phase 1: 后端基础设施

### Task 1: DB 迁移 — 新增6张表 + chapters扩展

**Files:** Modify `app.py:271-490`, Create `migrate_db.py`

- [ ] **Step 1:** 在 `init_project_db()` 的 chapters 表定义后插入 volumes/foreshadowing/character_relations/plot_lines/plot_line_chapters/user_config 6张表（见 spec 第2段补充设计）

- [ ] **Step 2:** chapters 表增加 `status TEXT DEFAULT 'draft'` 和 `volume_id TEXT` 两列

- [ ] **Step 3:** 创建 `migrate_db.py` 迁移脚本，遍历现有项目 DB 执行 ALTER TABLE 添加新列和新表

- [ ] **Step 4:** `get_db()` 中调用 `_migrate_if_needed()` 自动检测并迁移旧DB

- [ ] **Step 5:** `git add app.py migrate_db.py && git commit -m "feat: DB迁移 — volumes/foreshadowing/relations/plot_lines/user_config + chapters扩展"`

### Task 2: 卷管理 CRUD API

**Files:** Modify `app.py`

- [ ] **Step 1:** 添加 `GET/POST /api/projects/<id>/volumes` — 列表/创建卷
- [ ] **Step 2:** 添加 `PUT/DELETE /api/projects/<id>/volumes/<vid>` — 更新/删除卷
- [ ] **Step 3:** DELETE 时自动将关联章节的 volume_id 置空
- [ ] **Step 4:** `git add app.py && git commit -m "feat: 卷管理 CRUD API"`

### Task 3: 章节排序 + 状态 API

**Files:** Modify `app.py`

- [ ] **Step 1:** `POST /api/projects/<id>/chapters/reorder` — 批量更新 sort_order + volume_id
- [ ] **Step 2:** `PUT /api/projects/<id>/chapters/<cid>/status` — 更新章节状态(draft/polishing/done)
- [ ] **Step 3:** `git add app.py && git commit -m "feat: 章节排序+状态更新 API"`

### Task 4: 记忆系统 API（关系+伏笔+情节线）

**Files:** Modify `app.py`

- [ ] **Step 1:** 角色关系 CRUD：`GET/POST /api/projects/<id>/memory/relations`, `DELETE .../<rid>`
- [ ] **Step 2:** 伏笔 CRUD：`GET/POST /api/projects/<id>/memory/foreshadowing`, `PUT/DELETE .../<fid>`
- [ ] **Step 3:** 情节线 CRUD：`GET/POST /api/projects/<id>/memory/plot-lines`, `DELETE .../<pid>`（含关联章节）
- [ ] **Step 4:** `git add app.py && git commit -m "feat: 记忆系统 API — 关系+伏笔+情节线(主线/支线/隐藏线)"`

### Task 5: 导入解析 + 导出 + 用户配置 API

**Files:** Modify `app.py`, `requirements.txt`

- [ ] **Step 1:** `POST /api/ai/parse-structure` — 正则+AI解析文档卷章结构
- [ ] **Step 2:** `POST /api/projects/<id>/import` — 批量导入章节数据
- [ ] **Step 3:** `GET /api/projects/<id>/export/<fmt>` — 导出TXT/HTML
- [ ] **Step 4:** `GET/PUT /api/user/config` — 用户配置存取
- [ ] **Step 5:** `echo "python-docx" >> requirements.txt`
- [ ] **Step 6:** `git add app.py requirements.txt && git commit -m "feat: 导入解析+导出+用户配置 API"`

---

## Phase 2: 前端基础架构

### Task 6: 创建 core.js（路由+API+状态管理）

**Files:** Create `static/js/core.js`, Modify `static/index.html`

- [ ] **Step 1:** 创建 `NS` 命名空间模块：Hash 路由分发（#bookshelf/#workspace/<id>/#publish/<id>/#import/#ai-config）、fetch 封装（apiGet/apiPost/apiPut/apiDelete）、全局状态管理、toast 通知
- [ ] **Step 2:** 路由根据 hash 显示/隐藏对应 `.ns-view` 容器，调用对应模块的 render/open 方法
- [ ] **Step 3:** `init()` 监听 `hashchange` 事件，首次加载执行路由
- [ ] **Step 4:** 创建 `escHtml()` 工具函数
- [ ] **Step 5:** `git add static/js/core.js && git commit -m "feat: 前端路由系统 core.js"`

### Task 7: 重构 index.html 为多视图容器

**Files:** Modify `static/index.html`

- [ ] **Step 1:** 删除现有三栏布局（`panel-left/panel-center` 等），替换为6个视图容器：
  - `#view-bookshelf` — 书架首页（header + tabs + grid）
  - `#view-workspace` — 三栏工作台（左栏卷树 + 中栏编辑器 + 右栏AI面板）
  - `#view-publish` — 发布模块占位
  - `#view-import` — 导入向导占位
  - `#view-ai-config` — AI配置占位
- [ ] **Step 2:** 保留全局 Modal/Slideout/Toast 容器
- [ ] **Step 3:** 更新 script/css 引用为新模块文件列表
- [ ] **Step 4:** `git add static/index.html && git commit -m "refactor: index.html 多视图容器重构"`

### Task 8: CSS 模块拆分

**Files:** Create 8 CSS files, Remove old style.css from index.html

- [ ] **Step 1:** 创建 `static/css/base.css`（CSS变量 + 重置 + 滚动条 + Toast + Modal + Empty state）— 从原 style.css 提取公共样式
- [ ] **Step 2:** 创建 `static/css/bookshelf.css`（书架 header/tabs/grid/card/状态标签）
- [ ] **Step 3:** 创建 `static/css/workspace.css`（三栏Grid布局 + 左栏卷树 + 中栏编辑器 + 右栏面板卡片）
- [ ] **Step 4:** 创建 `static/css/panels.css`（角色管理面板 + 记忆系统四Tab + 关系图 + 伏笔 + 情节线 + 时间线）
- [ ] **Step 5:** 创建剩余4个CSS文件（publish/import/config/responsive）— 占位含基础样式
- [ ] **Step 6:** `git add static/css/ && git commit -m "feat: CSS模块拆分 — base/bookshelf/workspace/panels + 4占位"`

---

## Phase 3: 书架页

### Task 9: bookshelf.js — 项目卡片网格

**Files:** Create `static/js/bookshelf.js`

- [ ] **Step 1:** `render()` — 调用 `/api/projects` 获取项目列表，渲染卡片网格
- [ ] **Step 2:** 每张卡片：渐变色封面（书名首字）+ 书名 + 章节/字数统计 + 进度条 + 状态标签（创作中🟢/已完结🏁/草稿📝）
- [ ] **Step 3:** 末尾固定两张卡片："+ 新建项目"和"📂 导入作品"
- [ ] **Step 4:** `setFilter(filter, btn)` — 顶部分类Tab切换（全部/创作中/已完结/草稿）
- [ ] **Step 5:** `filter()` — 搜索框输入实时筛选卡片
- [ ] **Step 6:** `createProject()` — prompt 输入书名/简介/分类，调用API创建后跳转工作台
- [ ] **Step 7:** `git add static/js/bookshelf.js && git commit -m "feat: 书架页 — 卡片网格+搜索+筛选+新建"`

---

## Phase 4: 三栏工作台

### Task 10: workspace.js — 工作台核心

**Files:** Create `static/js/workspace.js`

- [ ] **Step 1:** `open(projectId)` — 加载项目信息、卷列表、章节列表，渲染左栏树
- [ ] **Step 2:** `selectChapter(cid)` — 加载章节内容到编辑器，高亮当前章节点，更新URL但不刷新
- [ ] **Step 3:** `saveChapter()` — 保存当前章节标题+内容，更新保存状态指示
- [ ] **Step 4:** `onInput()` — 实时更新字数统计，debounce 800ms 自动保存
- [ ] **Step 5:** `navChapter(dir)` — 上一章/下一章导航
- [ ] **Step 6:** `deleteChapter()` — 确认后删除当前章节
- [ ] **Step 7:** `createChapter()` — 在当前卷末新建章节
- [ ] **Step 8:** `toggleFullscreen()` — 全屏写作模式
- [ ] **Step 9:** 粘贴事件：剥离富文本，仅保留纯文本
- [ ] **Step 10:** `git add static/js/workspace.js && git commit -m "feat: 三栏工作台 workspace.js — 编辑器+章节管理"`

### Task 11: tree.js — 卷纲树 + 状态追踪

**Files:** Create `static/js/tree.js`

- [ ] **Step 1:** `renderTree(volumes, chapters)` — 渲染卷→章二级树
- [ ] **Step 2:** 卷节点可折叠/展开（toggle CSS class）
- [ ] **Step 3:** `addVolume()` — prompt 输入卷名，调用API创建，自动创建第1章
- [ ] **Step 4:** `addChapter(volumeId)` — 在指定卷末新建章节
- [ ] **Step 5:** `cycleStatus(cid)` — 点击状态点循环切换（draft→polishing→done→draft），调用章节状态API
- [ ] **Step 6:** `updateProgress()` — 更新底部全书进度条（已完成/总章节 + 百分比）
- [ ] **Step 7:** 章节拖拽排序（HTML5 drag & drop），跨卷支持，排序后调用 reorder API
- [ ] **Step 8:** `git add static/js/tree.js && git commit -m "feat: 卷纲树 tree.js — 卷章二级树+状态追踪+拖拽排序"`

### Task 12: ai-panel.js — 右栏AI辅助面板

**Files:** Create `static/js/ai-panel.js`，复用现有 app.js 中 AI 调用逻辑

- [ ] **Step 1:** `continue()` / `polish()` / `writeChapter()` / `expand()` — 提取现有 AI 调用逻辑（从 app.js 迁移）
- [ ] **Step 2:** 面板卡片折叠/展开（点击 header toggle）
- [ ] **Step 3:** `renderActiveCharacters()` — 从角色列表渲染活跃角色
- [ ] **Step 4:** `renderWorldRules()` — 渲染世界观约束
- [ ] **Step 5:** POV 锁定控件（选择当前视角角色）
- [ ] **Step 6:** `git add static/js/ai-panel.js && git commit -m "feat: AI面板 ai-panel.js — 续写/润色/写本章/扩写"`

### Task 13: characters.js — 角色管理面板

**Files:** Create `static/js/characters.js`

- [ ] **Step 1:** `show()` — 在右栏显示角色管理面板（替代AI面板），`hide()` 恢复
- [ ] **Step 2:** `renderList()` — 角色列表（彩色圆形头像+姓名+性别/性格标签），搜索筛选
- [ ] **Step 3:** 点击角色 → 展开详情编辑视图：姓名/性别/年龄/性格/背景/目标/外貌（input+textarea）
- [ ] **Step 4:** `addCharacter()` — 新建角色，保存到API
- [ ] **Step 5:** `saveCharacter()` — 编辑保存，字段变更后 PUT API
- [ ] **Step 6:** `deleteCharacter()` — 确认删除
- [ ] **Step 7:** `git add static/js/characters.js && git commit -m "feat: 角色管理 characters.js — 列表+详情编辑+CRUD"`

---

## Phase 5: AI 配置页

### Task 14: ai-config.js

**Files:** Create `static/js/ai-config.js`, `static/css/config.css`

- [ ] **Step 1:** `render()` — 渲染配置页面：模型选择器、API Key输入、Base URL、参数滑块
- [ ] **Step 2:** Temperature (0-2, step 0.1)、Top P (0-1, step 0.05)、Max Tokens (512-16K) 三个 range 滑块
- [ ] **Step 3:** System Prompt textarea（3行高），默认值 + 恢复默认按钮
- [ ] **Step 4:** 场景专属配置表格：续写/润色/大纲/封面/简介各行独立参数覆盖
- [ ] **Step 5:** 用量统计面板（从 localStorage 累计或后端查询）
- [ ] **Step 6:** `save()` — 保存到 `/api/user/config` + localStorage
- [ ] **Step 7:** `testConnection()` — 发送测试请求验证API Key
- [ ] **Step 8:** `git add static/js/ai-config.js static/css/config.css && git commit -m "feat: AI配置页 — 模型参数+System Prompt+场景配置+用量统计"`

---

## Phase 6: 导入向导

### Task 15: import.js

**Files:** Create `static/js/import.js`, `static/css/import.css`

- [ ] **Step 1:** 三步向导UI：步骤指示器（1/2/3高亮当前步）+ 内容区
- [ ] **Step 2:** 步骤1 — 文件拖拽区 + 点击选择（.txt/.md/.docx），FileReader 读取文本
- [ ] **Step 3:** 步骤2 — 将文本发送到 `/api/ai/parse-structure` 解析，预览卷章结构树
- [ ] **Step 4:** 用户可手动调整：合并/拆分节点、重命名
- [ ] **Step 5:** 步骤3 — 书名输入 + 选择目标（新建项目/追加到已有），调用 `/api/projects/<id>/import`
- [ ] **Step 6:** `git add static/js/import.js static/css/import.css && git commit -m "feat: 导入向导 — 三步文件导入+AI解析+结构预览"`

---

## Phase 7: 发布模块

### Task 16: publish.js — 封面生成（Canvas）

**Files:** Create `static/js/publish.js`, `static/css/publish.css`

- [ ] **Step 1:** `open(projectId)` — 加载项目信息，渲染两栏布局（左预览+右配置）
- [ ] **Step 2:** `generateCover()` — Canvas 渲染封面（600x800, 3:4比例）：
  - 6种风格模板（玄幻金紫/都市蓝灰/科幻青蓝/古风水墨/轻小说粉白/暗黑红黑）
  - 渐变背景 + SVG装饰线条 + 书名居中排版 + 作者署名底部
- [ ] **Step 3:** `randomizeCover()` — 随机切换模板+配色组合，每次生成不同效果
- [ ] **Step 4:** 配置项：书名/作者输入、风格下拉、配色下拉、字号调节
- [ ] **Step 5:** Canvas 预览实时更新，支持下载PNG按钮
- [ ] **Step 6:** `generateBlurb()` — 调用AI生成简介（风格+字数选择），预览+重新生成
- [ ] **Step 7:** `exportBook(fmt)` — 调用 `/api/projects/<id>/export/<fmt>` 下载txt/html
- [ ] **Step 8:** `git add static/js/publish.js static/css/publish.css && git commit -m "feat: 发布模块 — Canvas封面生成+AI简介+导出"`

---

## Phase 8: 记忆系统

### Task 17: memory.js

**Files:** Create `static/js/memory.js`

- [ ] **Step 1:** `show()` — 在右栏显示记忆系统面板，`hide()` 恢复AI面板
- [ ] **Step 2:** 四Tab切换UI：关系图 / 伏笔 / 情节线 / 时间线
- [ ] **Step 3:** Tab1 角色关系图：Canvas 力导向图（简单力导向算法：斥力+引力迭代），节点=角色（颜色区分），连线=关系（粗细=强度，颜色=类型）
- [ ] **Step 4:** Tab2 伏笔：列表渲染，每项含描述+埋设章+揭示章+状态徽标，支持新增/编辑/删除
- [ ] **Step 5:** Tab3 情节线：按主线🔴/支线🟡/隐藏线🔵分组，每组下排序列表，支持新增/编辑/删除+关联章节
- [ ] **Step 6:** Tab4 时间线：纵向时间轴，从章节列表提取关键事件，点击跳转到对应章节
- [ ] **Step 7:** `git add static/js/memory.js && git commit -m "feat: 记忆系统 — 关系图+伏笔+情节线(主线/支线/隐藏线)+时间线"`

---

## Phase 9: 响应式适配 + 视觉打磨

### Task 18: responsive.css + 细节打磨

**Files:** Create `static/css/responsive.css`

- [ ] **Step 1:** ≤900px：workspace 三栏变单栏（左栏fixed滑出，右栏变底部抽屉），bookshelf 网格列宽缩小
- [ ] **Step 2:** ≤700px：卡片更紧凑，编辑器工具栏换行，面板全宽
- [ ] **Step 3:** ≤480px：极简手机端，单列卡片，编辑器全宽无边距
- [ ] **Step 4:** 过渡动画：视图切换 fadeIn，面板 slideIn
- [ ] **Step 5:** 暗色主题一致性检查：所有新组件使用CSS变量，无硬编码颜色
- [ ] **Step 6:** `git add static/css/responsive.css && git commit -m "feat: 响应式适配 900/700/480 + 过渡动画"`

---

## Phase 10: 清理 + 集成测试

### Task 19: 移除旧文件 + 端到端验证

- [ ] **Step 1:** 从 index.html 移除旧 style.css 引用，确认所有新CSS已加载
- [ ] **Step 2:** 验证路由跳转：书架→工作台→发布→AI配置→导入→返回书架 全流程无报错
- [ ] **Step 3:** 验证CRUD：创建项目→创建卷→创建章节→编辑保存→状态切换→删除
- [ ] **Step 4:** 验证记忆系统：添加角色关系→添加伏笔→添加情节线→查看时间线
- [ ] **Step 5:** 验证导入：上传测试文件→AI解析→导入到项目
- [ ] **Step 6:** 验证封面：生成封面→切换风格→下载PNG
- [ ] **Step 7:** 验证导出：TXT/HTML 导出并检查内容完整性
- [ ] **Step 8:** `git add -A && git commit -m "chore: 旧文件清理 + 集成验证通过"`
- [ ] **Step 9:** `git push`

---

## 文件清单汇总

| 操作 | 文件 | 说明 |
|------|------|------|
| **新建** | `migrate_db.py` | DB迁移脚本 |
| **新建** | `static/js/core.js` | 路由+API+状态管理 |
| **新建** | `static/js/bookshelf.js` | 书架首页 |
| **新建** | `static/js/workspace.js` | 三栏工作台核心 |
| **新建** | `static/js/tree.js` | 卷纲树+状态追踪 |
| **新建** | `static/js/ai-panel.js` | 右栏AI面板 |
| **新建** | `static/js/characters.js` | 角色管理面板 |
| **新建** | `static/js/memory.js` | 记忆系统(关系/伏笔/情节线/时间线) |
| **新建** | `static/js/publish.js` | 封面生成+简介+导出 |
| **新建** | `static/js/import.js` | 导入向导 |
| **新建** | `static/js/ai-config.js` | AI配置页 |
| **新建** | `static/css/base.css` | CSS变量+重置+通用组件 |
| **新建** | `static/css/bookshelf.css` | 书架样式 |
| **新建** | `static/css/workspace.css` | 工作台布局+编辑器 |
| **新建** | `static/css/panels.css` | 角色面板+记忆系统 |
| **新建** | `static/css/publish.css` | 发布模块 |
| **新建** | `static/css/import.css` | 导入向导 |
| **新建** | `static/css/config.css` | AI配置页 |
| **新建** | `static/css/responsive.css` | 响应式断点 |
| **修改** | `static/index.html` | 多视图容器重构 |
| **修改** | `app.py` | 新增15+ API端点 |
| **修改** | `requirements.txt` | 新增 python-docx |
| **保留** | `static/js/supabase-auth.js` | 认证模块不变 |
| **保留** | `static/js/app.js` | 作为参考，功能迁移后移除引用 |
| **保留** | `static/css/style.css` | 作为参考，样式提取后移除引用 |
