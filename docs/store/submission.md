# Chrome Web Store Submission Checklist / 提交对照单

> Step-by-step field-by-field guide for the CWS developer console. Copy-paste ready.
>
> 你在开发者控制台逐字段照抄。上传 / 填表 / 提交都由你本人完成（涉及接受开发者协议与数据安全法律申报，必须本人确认）。
> 字段清单已按官方文档（cws-dashboard-listing / cws-dashboard-privacy）核对，覆盖 Store listing / Privacy practices / Distribution 三个标签页。

## 第 0 步：账号先决条件（必须先做，否则点发布会报「无法发布」）

在控制台的**账号级「设置 / Account」页面**（不是某个商品的设置，通常在左侧导航底部「账号」或右上角头像 →「账号/设置」）：
1. 填写**联系邮箱（Contact email）** —— 会**公开显示在商店详情页**，选一个愿意公开的邮箱。
2. 点**「验证 / Verify」**，去邮箱点验证链接完成验证。

这是**一次性**设置，验证后所有扩展的发布/更新都不再被拦。未做会在发布时报：「您必须先提供并验证发布方的联系邮箱」。

## 需要上传的文件

| 用途 | 尺寸 | 文件 |
|---|---|---|
| 扩展包 | — | `browser-agent-0.4.2.zip` |
| 商店图标 128×128 | 128×128 | 已在 manifest（`icons/icon128.png`），无需单独传 |
| 截图（≥1，最多 5） | 1280×800 | `docs/screenshots/store-hero.png`、`docs/screenshots/options.png` |
| 小宣传图（列表卡片用） | 440×280 | `docs/screenshots/promo-tile-440x280.png` |

---

## 1. 上传
Add new item / Upload new package → 上传 `browser-agent-0.4.2.zip`。名称/描述会自动读 manifest 的 `_locales`（中英）。

## 2. 商店发布信息（Store listing）

**类别（Category）**
```
Productivity（工作效率）
```

**隐私政策 URL**
```
https://github.com/lusipad/browser-agent/blob/main/PRIVACY.md
```

## 3. 隐私权规范（Privacy practices）——过审关键

**单一用途（Single purpose）**
```
一个在浏览器侧边栏运行的新一代自主 AI 浏览器智能体：用户只需输入高层目标，智能体自主进行长程任务规划、感知与跨页探索，通过真实物理操控代表用户在已授权的网页上执行复杂多步骤任务（深度研读、多源信息比对、系统表单录入与验证）并交付闭环结果。所有大模型推理由用户自行配置的 OpenAI 兼容接口（如 DeepSeek 或本地 Ollama）完成，数据不出本地。
```

**各权限用途（逐条粘贴）**

`debugger`（**最关键，务必贴完整**）
```
通过 Chrome DevTools Protocol 生成可信的输入事件（鼠标点击、键盘输入）与截图，这是可靠代表用户操作网页所必需的——普通合成事件会被许多站点的框架/防护忽略。附加调试器时 Chrome 会在页面顶部显示调试横幅，用户始终可见扩展正在操作哪个标签页。仅在用户下达任务且站点被授权后使用，绝不用于监视用户。
```
`unlimitedStorage`（**0.4.1 新增存储权限**）
```
扩展在用户的本机（chrome.storage.local）保存智能体的任务执行历史、思维过程、多轮交互记录以及关键步骤的截图预览。随着用户使用次数和多会话历史的积累，默认的 10MB 配额容易溢出导致数据丢失。因此需要 unlimitedStorage 权限以确保用户的大量历史对话与本地操作记录可以可靠持久化保存。所有数据仅存本机，不上传任何远程服务器。
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
- **可见性 Visibility**：`Public`（公开，任何人可搜到安装）
- **地区 Regions**：`All regions`（全部）
- **定价 Pricing**：`Free`（免费）

## 5. 提交
点 **Submit for review / 提请审核**。
会弹「发布将被推迟」警告（`<all_urls>` + `debugger` → 深入审核）——这是预期，直接点确认提交即可。
