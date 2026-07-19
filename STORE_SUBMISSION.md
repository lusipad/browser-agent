# Chrome Web Store 提交对照单（复制即用）

> 你在开发者控制台逐字段照抄。上传 / 填表 / 提交都由你本人完成（涉及接受开发者协议与数据安全法律申报，必须本人确认）。
> 字段清单已按官方文档（cws-dashboard-listing / cws-dashboard-privacy）核对，覆盖 Store listing / Privacy practices / Distribution 三个标签页。

## 需要上传的文件

| 用途 | 尺寸 | 文件 |
|---|---|---|
| 扩展包 | — | [browser-agent-0.2.0.zip](https://github.com/lusipad/browser-agent/releases/download/v0.2.0/browser-agent-0.2.0.zip) |
| 商店图标 128×128 | 128×128 | 已在 manifest（`icons/icon128.png`），无需单独传 |
| 截图（≥1，最多 5） | 1280×800 | `docs/screenshots/store-hero.png`、`docs/screenshots/options.png` |
| 小宣传图（列表卡片用） | 440×280 | `docs/screenshots/promo-tile-440x280.png` |
| 大横幅宣传图（可选） | 1400×560 | 暂无（可选，想要我再生成） |
| 宣传视频（可选） | YouTube | 无 |

> `sidepanel-convo.png` 是竖图 800×1624，**不符合商店尺寸，不要传**。

---

## 1. 上传
Add new item → 上传 `browser-agent-0.2.0.zip`。名称/描述会自动读 manifest 的 `_locales`（中英）。

## 2. 商店发布信息（Store listing）

**类别（Category）**
```
Productivity（工作效率）
```

**语言（Languages）**：勾选 `简体中文` + `English`

**简短说明 / Summary（≤132 字符）**
```
侧边栏 AI 浏览器助手：用自然语言驱动浏览器完成网页操作，接任意 OpenAI 兼容模型，密钥只存本机，逐站授权。
```
```
Side-panel AI browser agent: control your browser in natural language with any OpenAI-compatible model. Keys stay local.
```

**详细说明 / Description**
```
Browser Agent 让你在侧边栏用自然语言指挥浏览器：它会打开标签页、点击、填表、读取页面、调试网页并汇报结果。

• 接任意 OpenAI 兼容端点（OpenAI / DeepSeek / OpenRouter / Ollama / vLLM / LM Studio…），API Key 只存本机，不经任何中间服务器。
• 安全优先：逐站授权（每个站点首次操作需你批准）、预置金融/支付/交易所黑名单、密码输入 / 执行脚本 / 上传文件均需逐次确认、反 prompt-injection 防护。
• 可靠感知：截图叠加编号框（set-of-marks）、穿透 Shadow DOM 与同源 iframe、结构化数据抽取、网络静默等待。
• 透明可控：实时展示每一步动作与成本，agent 操作过的标签归入蓝色「🤖 Agent」标签组，多会话历史可切换/导出，随时中止。

你需要自备一个大模型服务的 API Key。扩展不提供模型，也没有开发者后端——你的数据只按你的配置发往你选择的模型接口。
```

**截图**：上传 `store-hero.png`（首图）、`options.png`

**隐私政策 URL**
```
https://github.com/lusipad/browser-agent/blob/main/PRIVACY.md
```

## 3. 隐私权规范（Privacy practices）——过审关键

**单一用途（Single purpose）**
```
一个在浏览器侧边栏运行的 AI 助手：用户用自然语言下达任务，扩展代表用户在用户已授权的网页上执行浏览操作（打开标签页、点击、填表、读取内容、调试网页）并汇报结果。所有大模型推理由用户自行配置的 OpenAI 兼容接口完成。
```

**各权限用途（逐条粘贴）**

`debugger`（**最关键，务必贴完整**）
```
通过 Chrome DevTools Protocol 生成可信的输入事件（鼠标点击、键盘输入）与截图，这是可靠代表用户操作网页所必需的——普通合成事件会被许多站点的框架/防护忽略。附加调试器时 Chrome 会在页面顶部显示调试横幅，用户始终可见扩展正在操作哪个标签页。仅在用户下达任务且站点被授权后使用，绝不用于监视用户。
```
`scripting`
```
向用户已授权的页面注入自包含的 DOM 感知函数，收集可交互元素（含 Shadow DOM / iframe）供模型定位与操作。
```
`tabs` / `tabGroups`
```
列出/新建/关闭标签页，并把智能体新建的标签页归入独立标签组，便于用户识别与隔离。
```
`webNavigation`
```
感知页面导航与帧结构，在动作后等待页面真正加载完成（network-idle）。
```
`storage`
```
在本机保存服务商配置、对话历史、站点授权。不含任何远程存储。
```
`downloads`
```
用户主动导出对话（Markdown/JSON）或生成 GIF 时保存到下载目录。
```
`sidePanel`
```
扩展的主界面运行在侧边栏。
```
主机权限 `<all_urls>`
```
用户可能要求在任意网站上执行任务，故需广泛主机权限；但实际操作前每个站点都要经用户逐站授权，未授权站点不会被读取或操作，且金融/支付类站点预置为完全禁止。
```

**远程代码（Remote code）**
- 选 **「No, I am not using remote code」**。
- 理由：扩展所有代码都打包在扩展内，**不加载任何远程托管的脚本/Wasm 文件**（MV3 也禁止）。
- ⚠️ 需你知情的细节：`javascript_tool` 会把模型生成的 JS 在**页面主世界**执行——但它**默认关闭**、每次执行都要你确认、且不是「加载远程托管代码文件」。若审核追问，如实说明这点即可（默认关闭 + 逐次确认 + 运行于页面上下文而非扩展上下文）。

**数据用途申报（勾选）**
- 是否收集/使用用户数据？→ **是**
- 数据类型：**网站内容（页面内容/截图，作为上下文）**、**用户输入的文本（指令）**
- 谁收集：**仅发往用户自行配置的大模型端点；开发者无后端、不收集**
- 是否出售给第三方？→ **否**
- 是否用于与核心功能无关的用途？→ **否**
- 是否用于信用评估 / 贷款？→ **否**

**底部认证（勾选）**
- ☑ 不出售用户数据给第三方
- ☑ 仅为单一用途使用/传输数据
- ☑ 传输经加密（HTTPS 到模型端点）

## 4. 分发设置（Distribution 标签页）
- **可见性 Visibility**：`Public`（公开，任何人可搜到安装）——如只想先小范围测试，可选 `Unlisted`（有链接才能装）
- **地区 Regions**：`All regions`（全部）
- **定价 Pricing**：`Free`（免费）

## 5. 其他字段（Additional fields，可选但建议填）
- **主页 URL（Homepage）**：`https://github.com/lusipad/browser-agent`
- **支持 URL（Support）**：`https://github.com/lusipad/browser-agent/issues`
- **内容分级（Content rating）**：如实填问卷——本扩展是效率工具，无暴力/成人/赌博等内容，结果应为「适合所有人 / Everyone」

## 6. 提交
Submit for review。带 `debugger` 的扩展审核更久（数天到数周），可能被要求补充权限说明——把上面 `debugger` 那段回复过去即可。

---

> 卡在任何一步，或收到审核方的问题，把原文贴回来，我帮你写答复。
