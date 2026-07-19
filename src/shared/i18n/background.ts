// 后台面向用户的文案（agent 状态/错误、权限授权卡片、释放控制提示）。
// 只翻译“展示给用户”的字符串；发给模型的英文（工具描述、tool_result、系统提示）保持不变。
export const backgroundDict = {
  // agent 状态 / 错误
  'bg.noModel': { zh: '未找到所选模型，请到设置页配置模型后重试。', en: 'Selected model not found. Configure a model in Settings and retry.' },
  'bg.providerMissing': { zh: '模型 {0} 引用的服务商不存在，请检查设置。', en: 'The provider referenced by model {0} does not exist. Check Settings.' },
  'bg.noApiKey': { zh: '「{0}」还没有配置 API Key。点击右上角 ⚙ 打开设置页填写。', en: '"{0}" has no API key configured. Click ⚙ (top-right) to open Settings.' },
  'bg.validatorFail': { zh: '🔎 自检未通过：{0}{1}', en: '🔎 Self-check failed: {0}{1}' },
  'bg.validatorFailReason': { zh: '任务尚未达成', en: 'task not yet complete' },
  'bg.validatorNext': { zh: '｜下一步：{0}', en: ' | Next: {0}' },
  'bg.validatorPass': { zh: '✅ 自检通过：任务达成。', en: '✅ Self-check passed: task complete.' },
  'bg.maxTokens': { zh: '输出达到 max_tokens 上限被截断，可在设置中调大。', en: 'Output hit the max_tokens limit and was truncated; increase it in Settings.' },
  'bg.maxIter': { zh: '已达到单轮最大迭代次数（{0}）。任务可能尚未完成。', en: 'Reached the max iterations per turn ({0}). The task may be incomplete.' },
  'bg.stopped': { zh: '已停止。', en: 'Stopped.' },
  'bg.timeout': { zh: '请求超时（{0}s）。可在设置中调整超时时间。', en: 'Request timed out ({0}s). Adjust the timeout in Settings.' },
  'bg.planSkipped': { zh: '（规划步骤跳过：{0}）', en: '(Planning step skipped: {0})' },
  'bg.validateSkipped': { zh: '（自检步骤跳过：{0}）', en: '(Self-check step skipped: {0})' },
  'bg.detach': { zh: '已释放浏览器控制（断开 {0} 个标签页的调试连接，撤销 {1} 个标签的 Agent 分组）。', en: 'Released browser control (detached debugger from {0} tab(s), ungrouped {1} tab(s) from the Agent group).' },
  // 授权卡片
  'bg.siteAllowTitle': { zh: '允许在 {0} 上操作？', en: 'Allow operating on {0}?' },
  'bg.siteAllowDesc': { zh: '智能体请求{0}。「始终允许」会把它加入允许列表；「仅本次」在本对话内有效。', en: 'The agent wants to {0}. "Always allow" adds it to your allowlist; "Allow once" applies to this conversation only.' },
  'bg.purposeExec': { zh: '在当前页面执行 {0}', en: 'run {0} on this page' },
  'bg.purposeOpen': { zh: '打开新标签页访问 {0}', en: 'open a new tab at {0}' },
  'bg.purposeNavigate': { zh: '跳转到 {0}', en: 'navigate to {0}' },
  'bg.confirmPasswordTitle': { zh: '允许向密码框输入内容？', en: 'Allow typing into the password field?' },
  'bg.confirmJsTitle': { zh: '允许在页面中执行 JavaScript？', en: 'Allow running JavaScript on the page?' },
  'bg.confirmUploadTitle': { zh: '允许上传文件？', en: 'Allow uploading a file?' },
  'bg.confirmPasswordDesc': { zh: '智能体想向密码输入框写入内容（{0} 个字符）。', en: 'The agent wants to type into a password field ({0} chars).' },
  'bg.confirmUploadDesc': { zh: '智能体想把文件 {0} 上传到当前页面。', en: 'The agent wants to upload the file {0} to this page.' },
  'bg.confirmJsDesc': { zh: '代码预览：', en: 'Code preview:' },
} as const;
