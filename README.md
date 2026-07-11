# Browser Agent — 多模型浏览器智能体

一个 **Claude in Chrome 风格**的 Chrome 扩展：在侧边栏用自然语言驱动浏览器，让 AI 自动打开标签页、点击、填表、读取页面、调试网页并汇报结果。后端接**任意 OpenAI 兼容 endpoint**（OpenAI / DeepSeek / OpenRouter / Ollama / vLLM / LM Studio…），API Key 只存在本机。

行为逻辑尽量复刻官方 Claude in Chrome：`tabs_context` 优先、动作后自动截图验证、可信 CDP 输入事件、逐站授权、敏感操作确认、防循环等。

---

## 快速开始

```bash
npm install
npm run build          # 产物输出到 dist/
```

1. 打开 `chrome://extensions`，右上角开启 **开发者模式**
2. 点 **加载已解压的扩展程序**，选择本项目的 `dist` 目录
3. 首次安装会自动打开**设置页**：在「服务商 / API Key」填入你的 endpoint 和 Key，点「测试连接」确认
4. 点击工具栏图标打开**侧边栏**，选好模型，开始对话

> 开发时用 `npm run watch` 监听 `src/`，改完在扩展页点一下刷新即可。修改 `public/` 下的文件需重新 `npm run build`。

---

## 能力（工具集）

| 工具 | 说明 |
|---|---|
| `tabs_context` / `tabs_create` / `tabs_close` | 列出 / 新建（归入 Agent 标签组）/ 关闭标签页 |
| `navigate` | 跳转 URL、后退 / 前进 / 刷新，等待加载并回传截图 |
| `computer` | 截图、点击、双击 / 右键、悬停、输入、按键组合、滚动、拖拽（基于 CDP 可信事件） |
| `read_page` / `find` | 提取可交互元素（带稳定 ref、角色、坐标）/ 按文字定位元素 |
| `form_input` | 按 ref 填表：input/textarea（正确触发 React/Vue 事件）、select、复选/单选、contenteditable |
| `get_page_text` | 提取全文（含 iframe），支持分页 |
| `scroll_to_ref` / `resize_window` / `screenshot` | 滚动到元素 / 调整窗口 / 主动截图 |
| `file_upload` | 从 URL 取文件并注入 file input 或模拟拖拽上传 |
| `javascript_tool` | 在页面执行 JS（需确认） |
| `read_console_messages` / `read_network_requests` | 读取控制台与网络日志（调试网页） |
| `gif_creator` | 把本次对话的截图帧导出为 GIF 到下载目录 |

## 安全模型

- **逐站授权**：每个域名首次被操作时在侧边栏弹「仅本次 / 始终允许 / 拒绝」
- **黑名单**：银行、支付、交易所等预置为完全禁止（可在设置中增删）
- **敏感确认**：向密码框输入、执行 JS、上传文件前需确认（可分别开关）
- 密钥与配置仅存于 `chrome.storage.local`，不上传任何服务器

无视觉模型（如 DeepSeek）会自动跳过截图，改用 `read_page` / `get_page_text` 的文本方式感知页面。

---

## 架构

```
src/
  shared/          类型、设置、系统提示词、工具函数（前后台共用）
  providers/       OpenAI 兼容适配器（SSE 流式解析 + 历史格式转换）
  background/      Service Worker：智能体主循环、会话、权限、标签页
    cdp.ts           chrome.debugger 会话、截图、控制台/网络缓冲
    reader.ts        注入页面的自包含 DOM 感知/操作函数（ref 注册表）
    tools/           工具定义与分发（含站点授权门控、动作后自动截图）
    agent.ts         模型 ↔ 工具 迭代循环、上下文裁剪（旧截图清理）
    session.ts       每窗口会话，持久化到 chrome.storage.session
  sidepanel/       React 侧边栏：对话时间线、审批卡片、模型切换
  options/         React 设置页：服务商、模型、安全、站点、高级
```

**关键设计**

- 内部消息用 Anthropic 风格的 content blocks，适配器负责与 OpenAI 格式互转（tool_use → tool_calls，截图从 tool 消息挪到随后的 user 消息）
- 截图经 CDP 捕获后缩放到 CSS 像素空间，模型给的坐标按最近一次截图换算，避免 DPR / 缩放错位
- 页面感知函数以 `func` 形式注入且**完全自包含**（不引用模块级标识符），ref 注册表挂在隔离世界，导航后自动失效
- Service Worker 运行期用定时扩展 API 调用保活；被回收后可从 `chrome.storage.session` 恢复会话

## 权限说明（manifest）

`debugger`（可信输入与截图）、`scripting`（注入感知函数）、`tabs`/`tabGroups`、`storage`、`sidePanel`、`downloads`、`<all_urls>`。`debugger` 会在被控标签页顶部显示 Chrome 的调试横幅，属正常现象。

## 已知限制

- 无法自动化 `chrome://`、Web Store 等浏览器内置页面
- 不会也不应绕过验证码 / 反爬
- `computer` 的输入用 `Input.insertText`，个别强依赖逐键 keydown 的富文本编辑器可能无反应，此时优先用 `form_input`
