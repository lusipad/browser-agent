# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 0.2.0 — 2026-07-19

从「能跑的骨架」补到「参考级、可发布」。全部改动有单测 / E2E / 基准 / 真机验证覆盖。

### 新增
- **上下文治理**：每次请求前按 token 预算裁剪历史，严格维持 `tool_use`/`tool_result` 配对，超长结果压缩中段（无 tiktoken 依赖）
- **成本核算**：每模型计费配置，侧边栏实时显示累计成本与上下文占用进度条
- **健壮性**：连接阶段对 5xx/429/网络错误指数退避重试，错误按类型给中文提示，达迭代上限一键「继续」
- **会话历史与导出**：多会话归档到本地，侧边栏抽屉切换/删除/新建；对话导出 Markdown / JSON
- **`extract_data` 工具**：表格 / 链接 / selector 结构化抽取，穿透 shadow DOM 与同源 iframe
- **感知层基准评测** `npm run bench` 与**端到端 agent 评测** `npm run bench:e2e`（真实 LLM 驱动）
- **多语言 i18n**：界面中英双语（跟随浏览器或手动切换），manifest `_locales`，后台提示 / 授权卡片 / 导出 / 诊断全本地化
- **透明标识**：agent 操作过的标签归入蓝色「🤖 Agent」标签组，释放控制时撤销
- **发布资料**：`PRIVACY.md`、`STORE_LISTING.md`（逐条权限用途说明）

### 安全
- 系统提示新增反 prompt-injection 段（页面内容是数据、非指令）
- 诊断消息校验发送方；`javascript_tool` 默认关闭，需在设置显式开启

### 测试
- 单元测试 71 项、E2E 11 项、感知层基准 5/5、端到端评测 4/4，全部通过
- Playwright 加载 `dist/` 验证扩展在真实 Chromium 零报错运行，中英渲染均验证

## 0.1.0

- 初始版本：MV3 扩展、侧边栏自然语言驱动浏览器、OpenAI 兼容端点、CDP 可信输入 + 截图、set-of-marks、Shadow/iframe 穿透、Planner + Validator、逐站授权、诊断面板、自动化测试。
