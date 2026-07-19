// 设置页文案（Providers / Models / Safety / Sites / Advanced / Diagnostics / common / 语言开关）
// 由 options 迁移代理填充：key 用 "opt.<panel>.<name>"，每条含 zh + en。
export const optionsDict = {
  // 语言开关
  'opt.lang.label': { zh: '界面语言', en: 'Interface language' },
  'opt.lang.auto': { zh: '跟随浏览器', en: 'Follow browser' },
  'opt.lang.zh': { zh: '简体中文', en: '简体中文' },
  'opt.lang.en': { zh: 'English', en: 'English' },

  // 外壳（侧栏 / 标题 / 保存 / 恢复默认）
  'opt.shell.settings': { zh: '设置', en: 'Settings' },
  'opt.shell.loading': { zh: '加载中…', en: 'Loading…' },
  'opt.shell.saved': { zh: '✓ 已自动保存', en: '✓ Auto-saved' },
  'opt.shell.reset': { zh: '恢复默认', en: 'Reset to defaults' },
  'opt.shell.resetConfirm': {
    zh: '恢复所有设置为默认值？（不会清除已填写的 API Key 之外的对话）',
    en: "Reset all settings to their defaults? (Your saved conversations won't be cleared.)",
  },

  // 通用
  'opt.common.delete': { zh: '删除', en: 'Delete' },

  // 服务商 / API Key
  'opt.providers.title': { zh: '服务商 / API Key', en: 'Providers / API Key' },
  'opt.providers.leadA': {
    zh: '任何 OpenAI 兼容的接口都能接入。Base URL 需包含 ',
    en: 'Any OpenAI-compatible endpoint works. The Base URL must include ',
  },
  'opt.providers.leadB': {
    zh: '。密钥仅保存在本机浏览器 ',
    en: ". Your API key is stored only in this browser's ",
  },
  'opt.providers.leadC': {
    zh: ' 中，不会上传到任何服务器。',
    en: ' and is never uploaded to any server.',
  },
  'opt.providers.name': { zh: '名称', en: 'Name' },
  'opt.providers.baseUrl': { zh: 'Base URL', en: 'Base URL' },
  'opt.providers.baseUrlHint': { zh: '例如 https://api.openai.com/v1', en: 'e.g. https://api.openai.com/v1' },
  'opt.providers.apiKey': { zh: 'API Key', en: 'API Key' },
  'opt.providers.apiKeyHint': {
    zh: '本地 Ollama 等无需鉴权可随意填写（如 ollama）',
    en: 'For local backends like Ollama that need no auth, enter anything (e.g. ollama)',
  },
  'opt.providers.test': { zh: '测试连接', en: 'Test connection' },
  'opt.providers.testing': { zh: '测试中…', en: 'Testing…' },
  'opt.providers.testOkN': { zh: '✓ 连接成功（{0} 个模型）', en: '✓ Connected ({0} models)' },
  'opt.providers.testInvalidResponse': {
    zh: '✗ 接口返回的不是 OpenAI /models 格式，请检查 Base URL 是否包含 /v1',
    en: '✗ The endpoint did not return the OpenAI /models format. Check whether Base URL includes /v1',
  },
  'opt.providers.testMissingModels': {
    zh: '✗ 连接成功，但以下已配置模型不可用：{0}',
    en: '✗ Connected, but these configured models are unavailable: {0}',
  },
  'opt.providers.testFail': { zh: '连接失败', en: 'Connection failed' },
  'opt.providers.hasModels': {
    zh: '该服务商下还有模型，请先在「模型」页删除它们。',
    en: 'This provider still has models. Delete them on the Models tab first.',
  },
  'opt.providers.newName': { zh: '新服务商', en: 'New provider' },
  'opt.providers.add': { zh: '+ 添加服务商', en: '+ Add provider' },

  // 模型
  'opt.models.title': { zh: '模型', en: 'Models' },
  'opt.models.lead': {
    zh: '为每个模型选择所属服务商，并填写传给接口的模型名。视觉开关关闭时，该模型不会收到截图，改用文本方式感知页面（适合 DeepSeek 等纯文本模型）。',
    en: 'Choose a provider for each model and enter the model name sent to the API. When Vision is off, the model receives no screenshots and perceives the page as text instead (good for text-only models like DeepSeek).',
  },
  'opt.models.addProviderFirst': { zh: '请先在「服务商」页添加一个服务商。', en: 'Add a provider on the Providers tab first.' },
  'opt.models.keepOne': { zh: '至少保留一个模型。', en: 'Keep at least one model.' },
  'opt.models.newLabel': { zh: '新模型', en: 'New model' },
  'opt.models.label': { zh: '显示名称', en: 'Display name' },
  'opt.models.provider': { zh: '服务商', en: 'Provider' },
  'opt.models.modelName': { zh: '模型名（传给 API）', en: 'Model name (sent to API)' },
  'opt.models.modelNameHint': { zh: '例如 gpt-5.6-sol、deepseek-v4-flash', en: 'e.g. gpt-5.6-sol, deepseek-v4-flash' },
  'opt.models.vision': { zh: '支持视觉（截图）', en: 'Vision (screenshots)' },
  'opt.models.contextWindow': { zh: '上下文窗口 (token)', en: 'Context window (tokens)' },
  'opt.models.contextWindowHint': {
    zh: '留空则用「高级」页的兜底预算裁剪历史',
    en: 'Leave empty to trim history with the fallback budget on the Advanced tab',
  },
  'opt.models.contextPlaceholder': { zh: '兜底', en: 'Fallback' },
  'opt.models.pricing': { zh: '计费（$ / 100 万 token）', en: 'Pricing ($ / 1M tokens)' },
  'opt.models.pricingHint': {
    zh: '填输入价 / 输出价后，侧边栏显示累计成本；留空不计费',
    en: 'Enter input / output prices to show total cost in the sidebar; leave empty to disable',
  },
  'opt.models.priceInput': { zh: '输入', en: 'Input' },
  'opt.models.priceOutput': { zh: '输出', en: 'Output' },
  'opt.models.setDefault': { zh: '设为默认', en: 'Set as default' },
  'opt.models.add': { zh: '+ 添加模型', en: '+ Add model' },

  // 安全与确认
  'opt.safety.title': { zh: '安全与确认', en: 'Safety & Confirmations' },
  'opt.safety.lead': {
    zh: '这些开关决定智能体在哪些情况下需要先征得你的同意。默认设置最安全，建议保留。',
    en: 'These switches decide when the agent must get your consent first. The defaults are the safest and we recommend keeping them.',
  },
  'opt.safety.newSite': { zh: '首次操作新网站前请求授权', en: 'Ask for approval before acting on a new site' },
  'opt.safety.newSiteHint': {
    zh: '每个域名第一次被操作时，在侧边栏弹出允许 / 拒绝卡片',
    en: 'The first time each domain is used, an allow / deny card appears in the sidebar',
  },
  'opt.safety.password': { zh: '向密码框输入前确认', en: 'Confirm before typing into a password field' },
  'opt.safety.passwordHint': {
    zh: '检测到目标是 password 输入框时要求确认',
    en: 'Requires confirmation when the target is detected as a password input',
  },
  'opt.safety.upload': { zh: '上传文件前确认', en: 'Confirm before uploading files' },
  'opt.safety.javascript': { zh: '执行页面 JavaScript 前确认', en: 'Confirm before running JavaScript on the page' },
  'opt.safety.javascriptHint': {
    zh: 'javascript_tool 可运行任意脚本，建议保持开启',
    en: 'javascript_tool can run arbitrary scripts — keeping this on is recommended',
  },
  'opt.safety.allowAllConfirm': {
    zh: '这会让智能体无需逐站授权即可操作任何网站（黑名单除外）。确定开启？',
    en: 'This lets the agent act on any site without per-site approval (except the blocklist). Turn it on?',
  },
  'opt.safety.allowAll': { zh: '允许所有网站（不推荐）', en: 'Allow all sites (not recommended)' },
  'opt.safety.allowAllHint': {
    zh: '跳过逐站授权。黑名单中的网站仍然被阻止。',
    en: 'Skips per-site approval. Sites on the blocklist are still blocked.',
  },

  // 站点权限
  'opt.sites.title': { zh: '站点权限', en: 'Site Permissions' },
  'opt.sites.leadA': {
    zh: '允许列表中的网站无需每次确认即可操作；黑名单中的网站会被完全阻止（银行、支付、交易所等已预置）。支持精确域名或 ',
    en: 'Sites on the allowlist can be operated without confirming each time; sites on the blocklist are fully blocked (banks, payments, exchanges are preloaded). Use an exact domain or the ',
  },
  'opt.sites.leadB': { zh: ' 形式，匹配其所有子域名。', en: ' form to match all of its subdomains.' },
  'opt.sites.allowTitle': { zh: '始终允许（白名单）', en: 'Always allow (allowlist)' },
  'opt.sites.allowEmpty': {
    zh: '还没有始终允许的网站。你在侧边栏点「始终允许此站点」时会自动加入这里。',
    en: 'No always-allowed sites yet. They appear here when you click "Always allow this site" in the sidebar.',
  },
  'opt.sites.blockTitle': { zh: '始终阻止（黑名单）', en: 'Always block (blocklist)' },
  'opt.sites.blockEmpty': { zh: '黑名单为空。', en: 'The blocklist is empty.' },
  'opt.sites.add': { zh: '添加', en: 'Add' },

  // 高级
  'opt.advanced.title': { zh: '高级', en: 'Advanced' },
  'opt.advanced.lead': {
    zh: '影响智能体循环、上下文占用和请求行为的参数。默认值适用于大多数场景。',
    en: 'Parameters that affect the agent loop, context usage, and request behavior. The defaults work for most cases.',
  },
  'opt.advanced.maxIterations': { zh: '单轮最大迭代次数', en: 'Max iterations per turn' },
  'opt.advanced.maxIterationsHint': {
    zh: '一次消息内模型↔工具往返上限（防失控）',
    en: 'Upper bound on model↔tool round-trips within one message (prevents runaway loops)',
  },
  'opt.advanced.maxImagesKept': { zh: '保留截图数量', en: 'Screenshots to keep' },
  'opt.advanced.maxImagesKeptHint': {
    zh: '历史中保留的最近截图数，越大越占 token',
    en: 'How many recent screenshots to keep in history — more uses more tokens',
  },
  'opt.advanced.maxContextTokens': { zh: '上下文兜底预算 (token)', en: 'Fallback context budget (tokens)' },
  'opt.advanced.maxContextTokensHint': {
    zh: '模型未填「上下文窗口」时，历史超过此值即从最旧消息开始裁剪',
    en: 'When a model has no context window set, history is trimmed from the oldest messages once it exceeds this',
  },
  'opt.advanced.screenshotMaxWidth': { zh: '截图最大宽度 (px)', en: 'Max screenshot width (px)' },
  'opt.advanced.screenshotMaxWidthHint': {
    zh: '越小越省 token，但过小会看不清细节',
    en: 'Smaller saves tokens, but too small loses detail',
  },
  'opt.advanced.jpegQuality': { zh: 'JPEG 质量 (1-100)', en: 'JPEG quality (1-100)' },
  'opt.advanced.maxTokens': { zh: 'max_tokens（单次回复上限）', en: 'max_tokens (per-reply limit)' },
  'opt.advanced.temperature': { zh: 'temperature', en: 'temperature' },
  'opt.advanced.temperatureHint': {
    zh: '留空表示使用模型默认（gpt-5 系列会忽略该参数）',
    en: 'Leave empty to use the model default (the gpt-5 family ignores this)',
  },
  'opt.advanced.temperaturePlaceholder': { zh: '默认', en: 'Default' },
  'opt.advanced.requestTimeout': { zh: '请求超时 (秒)', en: 'Request timeout (seconds)' },
  'opt.advanced.maxRetries': { zh: '失败重试次数', en: 'Retry attempts' },
  'opt.advanced.maxRetriesHint': {
    zh: '遇到 5xx / 429 / 网络错误时的指数退避重试上限',
    en: 'Max exponential-backoff retries on 5xx / 429 / network errors',
  },
  'opt.advanced.autoScreenshot': { zh: '每次操作后自动截图', en: 'Auto-screenshot after each action' },
  'opt.advanced.autoScreenshotHint': {
    zh: '关闭后模型需主动调用 screenshot 才能看到结果，更省 token 但更易出错',
    en: 'When off, the model must call screenshot itself to see results — saves tokens but is more error-prone',
  },
  'opt.advanced.setOfMarks': { zh: 'set-of-marks 编号框标注', en: 'Set-of-marks numbered overlays' },
  'opt.advanced.setOfMarksHint': {
    zh: '在截图上给可交互元素叠加编号框，模型按编号点击，大幅提升视觉准确率（仅视觉模型生效）',
    en: 'Overlays numbered boxes on interactive elements so the model clicks by number, greatly improving visual accuracy (vision models only)',
  },
  'opt.advanced.planning': { zh: 'Planner + Validator（规划与自检）', en: 'Planner + Validator (planning & self-check)' },
  'opt.advanced.planningHint': {
    zh: '任务开始先拆解步骤+定成功判据，模型停手时自检是否真正达成，未达成会继续。更可靠但更耗 token',
    en: 'Breaks the task into steps with success criteria up front, then self-checks whether they were met when the model stops and continues if not. More reliable but uses more tokens',
  },
  'opt.advanced.enableJs': { zh: '启用 javascript_tool（在页面执行任意 JS）', en: 'Enable javascript_tool (run arbitrary JS on the page)' },
  'opt.advanced.enableJsHint': {
    zh: '⚠️ 强能力也是攻击面：开启后模型可在页面执行任意 JavaScript（仍需逐次确认）。出于安全默认关闭；不需要时保持关闭',
    en: '⚠️ Power is also attack surface: once on, the model can run arbitrary JavaScript on the page (still confirmed each time). Off by default for safety; keep it off unless you need it',
  },

  // 诊断
  'opt.diagnostics.title': { zh: '诊断', en: 'Diagnostics' },
  'opt.diagnostics.lead': {
    zh: '对你当前正在看的**真实网页**一键体检感知层与 CDP 全链路——CDP 附加、截图、元素收集（含 Shadow DOM / iframe 穿透分布）、帧结构、网络状态。无需对话、不花 API 费用。想验证某个具体页面的兼容性时，先在浏览器里打开它、切到该标签页，再回来点下面的按钮。',
    en: "One-click health check of the perception layer and the full CDP pipeline against the real page you're viewing — CDP attach, screenshots, element collection (including Shadow DOM / iframe penetration), frame structure, and network state. No conversation, no API cost. To verify a specific page's compatibility, open it in the browser, switch to that tab, then come back and click the button below.",
  },
  'opt.diagnostics.running': { zh: '诊断中…', en: 'Diagnosing…' },
  'opt.diagnostics.run': { zh: '▶ 诊断当前标签页', en: '▶ Diagnose current tab' },
  'opt.diagnostics.checkName': { zh: '诊断', en: 'Diagnostics' },
  'opt.diagnostics.noResponse': {
    zh: '后台无响应，请重新加载扩展。',
    en: 'No response from the background. Try reloading the extension.',
  },
  'opt.diagnostics.allOk': { zh: '✓ 全链路正常', en: '✓ Full pipeline OK' },
  'opt.diagnostics.hasIssues': { zh: '存在需要关注的项', en: 'Some items need attention' },
  'opt.diagnostics.note': {
    zh: '提示：诊断会用 CDP 附加到目标标签页并短暂显示 Chrome 的调试横幅，属正常现象。若「Shadow DOM 穿透 / 同源 iframe 穿透」显示未发现，可能只是该页面本就没有对应结构——换个已知用 web components 的站点（如 youtube.com）再试。',
    en: 'Note: diagnostics attach via CDP to the target tab and briefly show Chrome\'s debugging banner — this is normal. If "Shadow DOM penetration / same-origin iframe penetration" shows none found, the page may simply have no such structure — try a site known to use web components (such as youtube.com).',
  },
} as const;
