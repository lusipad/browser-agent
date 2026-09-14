# Browser Agent 推广与冷启动增长实操手册 (Promotion Playbook)

> 本手册为你提供一套经过验证的、零广告预算的独立开源产品冷启动实操模板。涵盖国内极客社区、阮一峰周刊、短视频文案、海外 Product Hunt / Hacker News 以及 AI 导航站提交清单。
> 直接复制相应模板并根据你的最新版本微调即可发布。

---

## 目录
1. [产品定位与核心卖点提炼](#1-产品定位与核心卖点提炼)
2. [国内社区推广模板](#2-国内社区推广模板)
   - [V2EX [分享创造] 发帖模板](#v2ex-分享创造发帖模板)
   - [阮一峰《科技爱好者周刊》投稿模板](#阮一峰科技爱好者周刊投稿模板)
   - [知乎 / 掘金 / 微信公众号文章框架](#知乎--掘金--微信公众号文章框架)
   - [小红书 / B 站 30 秒实操短视频脚本](#小红书--b-站-30-秒实操短视频脚本)
3. [海外社区发布模板](#3-海外社区发布模板)
   - [Product Hunt Launch 资料](#product-hunt-launch-资料)
   - [Hacker News (Show HN) 模板](#hacker-news-show-hn-模板)
   - [Reddit (r/LocalLLaMA & r/chrome_extensions)](#reddit-发帖模板)
4. [国内外 AI 导航站收录清单](#4-国内外-ai-导航站收录清单)
5. [获取早期 100 个好评与 Star 的关键技巧](#5-获取早期-100-个好评与-star-的关键技巧)

---

## 1. 产品定位与核心卖点提炼

* **一句话 Slogan**：用大白话操控浏览器的开源智能体，自带 Key，数据只在本地。
* **差异化竞争优势 (Unique Selling Points)**：
  1. **真正的本地与自带 Key (BYOK)**：不设中心化收费服务器，直接连 DeepSeek、OpenAI、Claude 或本地 Ollama，私密安全。
  2. **可信原生输入 (CDP)**：通过 Chrome 调试协议模拟真实物理鼠标与键盘，而不是脆弱的合成 DOM 事件。
  3. **高精度视觉感知 (Set-of-Marks)**：截图自动打上红色/蓝色编号框，哪怕嵌套 Shadow DOM 和复杂 iframe 也能精准点击。
  4. **全自动模型库同步**：通过 GitHub Actions 每天从 LiteLLM 自动同步全球数百款模型的最新定价与参数，永远不过期。

---

## 2. 国内社区推广模板

### V2EX [分享创造] 发帖模板

* **建议节点**：`分享创造`
* **标题建议**：
  > [开源] 做了一个在 Chrome 侧边栏运行的浏览器智能体：支持 DeepSeek 原生视觉/本地 Ollama，自带 Key 零云端中转
* **正文模板**：
  ```markdown
  大家好！

  最近看到很多浏览器自动化或智能体扩展，要么需要按月付费订阅它们的中心化云端代理，要么网页浏览数据必须经过第三方服务器，对于重视隐私的同学总觉得不够踏实。

  于是我用原生 Chrome MV3 + CDP（Chrome DevTools Protocol）开发了一款完全运行在侧边栏的开源浏览器智能体 —— **Browser Agent**。

  ### 它能做什么？
  不用写爬虫，也不用写 Selenium 脚本，在侧边栏直接打字：
  - 📊 “把当前网页的所有表格提取出来，整理成 JSON 导出”
  - ✍️ “帮我填写这个多步骤的申请表单并截图确认”
  - 🔍 “去 GitHub 搜某个关键词，找出最近更新且 Star 最高的 3 个项目”
  - 📝 “精读这篇 5000 字长文，输出 3 个核心反直觉论点”

  ### 核心技术与隐私考量
  1. **纯本地与自带 Key (BYOK)**：零中间服务器，直接从浏览器端直连 API（支持 DeepSeek、OpenAI、Claude、OpenRouter），更支持一键直连本地 Ollama（数据 100% 不出本机）。
  2. **真实的输入模拟**：通过 CDP 发送系统级鼠标与键盘操作，穿透开放 Shadow DOM 与同源 iframe。
  3. **视觉 Set-of-marks**：自动在页面元素上叠加编号标记，视觉模型定位更精准。
  4. **逐站授权门控**：每个域名首次交互需手动授权，预置金融支付站点黑名单，密码输入强制二次确认。

  项目完全开源，欢迎大家体验、提 Issue 或拍砖交流！

  - GitHub：https://github.com/lusipad/browser-agent
  - Release 下载包：https://github.com/lusipad/browser-agent/releases
  ```

---

### 阮一峰《科技爱好者周刊》投稿模板

* **投稿地址**：在 [ruanyf/weekly/issues](https://github.com/ruanyf/weekly/issues) 提交 New Issue。
* **标题**：推荐开源项目：Browser Agent - 侧边栏 AI 浏览器智能体
* **正文**：
  ```markdown
  ## 项目推荐：Browser Agent

  - **项目地址**：https://github.com/lusipad/browser-agent
  - **项目类别**：开源 Chrome 扩展 / 开发者工具 / AI 工具
  - **项目简介**：
    Browser Agent 是一个遵循 Chrome MV3 标准的开源浏览器自动化智能体。用户在侧边栏通过自然语言下达任务，智能体自动执行标签页操作、点击、表单填写、结构化数据采集（表格导出 JSON/Markdown）与跨页面研读。

  - **核心特色**：
    1. 隐私第一：无任何中转后端，API Key 仅存放本机；支持 DeepSeek 原生视觉大模型及本地 Ollama 离线运行；
    2. CDP 原生事件驱动：支持 Shadow DOM / iframe 穿透，配合 Set-of-Marks 编号框高精度定位交互元素；
    3. 全自动热同步：通过 GitHub Actions 每天与 LiteLLM 数据库对齐模型参数与定价，开箱即用。
  ```

---

### 知乎 / 掘金 / 微信公众号文章框架

* **爆款选题标题**：
  - 《不用写一句 Python，如何让 AI 在浏览器里自动帮我干活？》
  - 《我们用 Chrome MV3 + DeepSeek 实现了一个属于自己的浏览器智能体（开源复盘）》
* **内容结构推荐**：
  1. **痛点切入**：日常工作中有大量机械重复的网页操作（报销填表、跨平台比价、抓表格导数据、定时刷新）；
  2. **为什么现有工具不顺手**：云端 Agent 太贵、怕泄露公司数据和 Cookie、传统 RPA 配置门槛极高；
  3. **我们的解法**：在 Chrome 侧边栏集成 CDP，配合视觉多模态大模型实现“真·人机交互”；
  4. **硬核技术点拆解**：
     - 为什么普通 DOM click 会被现代前端单页框架忽略，而 CDP 物理事件不会？
     - 如何利用 Set-of-Marks 让大模型看懂页面每个按钮的坐标？
     - 遇到 DeepSeek 思考模式 400 报错时，我们是如何排查并解决 reasoning_content 透传协议的？
  5. **文末指引**：附带开源 GitHub 链接，求 Star 与测试反馈。

---

### 小红书 / B 站 30 秒实操短视频脚本

* **视频风格**：快节奏、无废话、实操录屏 + 醒目字幕提示。
* **分镜脚本（总计 25 秒）**：
  - **0~4 秒【黄金前 3 秒吸引眼球】**：
    - 画面：手指在侧边栏输入：“把这个页面的所有产品价格整理成表格导出来”。
    - 字幕：还在傻傻手动复制粘贴网页数据？
  - **5~15 秒【视觉冲击与自动化展示】**：
    - 画面：网页上突然浮现红绿色的元素编号标记（Set-of-marks），页面自动翻滚、自动点击，侧边栏飞速打印出清洗好的 Markdown 表格。
    - 字幕：输入一句话，AI 自动点击翻页、智能识别表格、直接导出！
  - **16~22 秒【安全与免费背书】**：
    - 画面：切换到设置页面，展示直接勾选 DeepSeek 或本地 Ollama。
    - 字幕：完全开源！直连 DeepSeek 或本地大模型，数据绝对不泄露。
  - **23~25 秒【CTA 引导行动】**：
    - 字幕：支持 Chrome 侧边栏，评论区留言【助手】获取安装包与教程！

---

## 3. 海外社区发布模板

### Product Hunt Launch 资料

* **Name**: Browser Agent
* **Tagline**: Open-source autonomous AI web agent in your Chrome sidebar
* **Categories**: Artificial Intelligence, Chrome Extensions, Developer Tools, Productivity
* **Short Pitch**:
  > An open-source MV3 Chrome extension that controls your browser with natural language. Scrape complex tables, auto-fill forms, and do deep multi-tab research using your own model (DeepSeek, GPT-4o, Claude, or local Ollama). 100% private (BYOK).
* **Maker Comment**:
  > Hey hunters! 👋
  > Most browser agents lock you into expensive monthly subscriptions and route all your sensitive browsing data through their remote cloud proxies.
  > We built **Browser Agent** with a local-first, Bring-Your-Own-Key (BYOK) architecture. It uses Chrome DevTools Protocol (CDP) for authentic input simulation, set-of-marks visual bounding boxes, and pierces Shadow DOMs & iframes.
  > It’s completely open-source under MIT. We’d love your feedback! 🚀

---

### Hacker News (Show HN) 模板

* **Title**: `Show HN: Browser Agent – Open-source autonomous browser control for Chrome (BYOK, MV3)`
* **Text**:
  ```markdown
  Hey HN,

  I built Browser Agent (https://github.com/lusipad/browser-agent), a local-first Chrome extension that lets you automate web tasks directly from the side panel using natural language.

  Unlike cloud-hosted browser agents, this runs entirely in your browser:
  - Connects directly to any OpenAI-compatible endpoint (DeepSeek, OpenAI, Anthropic, OpenRouter) or local Ollama. No intermediary servers, keys stay in local storage.
  - Relies on Chrome DevTools Protocol (CDP) via `chrome.debugger` to emit trusted native input events (mouse, keyboard, scroll) rather than synthetic JS events.
  - Visual perception uses set-of-marks (numbered bounding boxes) and reaches inside open Shadow DOMs and same-origin iframes.
  - Per-site authorization gating with pre-blocked financial/banking domains and explicit confirmation for sensitive inputs (passwords, uploads).
  - Daily automated registry synchronization from LiteLLM's model database via GitHub Actions.

  Source code: https://github.com/lusipad/browser-agent
  Chrome Web Store / manual zip download available on GitHub releases.

  Would love to hear your thoughts on permissions, agent reliability, and prompt injection mitigations!
  ```

---

### Reddit 发帖模板
* **推荐 Subreddits**:
  - `r/LocalLLaMA`（极高热度，主打 **Ollama 本地大模型驱动浏览器**）
  - `r/selfhosted`
  - `r/chrome_extensions`
  - `r/ChatGPTCoding`
* **标题（针对 r/LocalLLaMA）**：
  > [Project] Open-source Chrome extension that controls your browser using local Ollama models (100% private, BYOK)

---

## 4. 国内外 AI 导航站收录清单

主动去以下高权重的 AI 导航站提交收录（通常 1~3 天内审核通过，长期带来高质量外链和自然搜索）：

| 平台 | 网址 | 提交类型 |
|---|---|---|
| **AI 工具集 (国内大站)** | https://ai-bot.cn/ | 浏览器插件 / AI 效率工具 |
| **Toolify.ai (海外流量巨头)** | https://www.toolify.ai/ | Browser Extension / AI Agent |
| **There's An AI For That** | https://theresanaiforthat.com/ | Web Automation |
| **Futurepedia** | https://www.futurepedia.io/ | Productivity / Browser Copilot |
| **AlternativeTo** | https://alternativeto.net/ | 设为 MultiOn / Operator 替代品 |
| **Product Hunt** | https://www.producthunt.com/ | Launch |

---

## 5. 获取早期 100 个好评与 Star 的关键技巧

1. **种子用户互动群**：在 README 和侧边栏设置页末尾放置交流群二维码或 Discord 邀请链接。早期用户遇到 Bug 时在群里能快速得到作者回复，他们会非常乐意在 Chrome 商店留下 5 星好评。
2. **主动索评时机 (Micro-Prompt)**：当用户成功执行完成了一次复杂的多步骤任务并导出结果时，弹出非阻塞的小提示：“觉得好用吗？欢迎在 Chrome Web Store 为我们留个好评支持开源开发 ✨”。
3. **高频更新展示活力**：保持 CHANGELOG 更新，每一次更新在 Releases 里清晰列出，让用户和社区看到作者在持续维护。
