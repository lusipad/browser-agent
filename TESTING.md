# 验证协议

由于开发环境无法加载解压扩展并驱动 CDP，以下改动需要你在真实 Chrome 里跑一遍确认。整套约 5–10 分钟，覆盖每一项硬化功能。翻车的 case 把「侧边栏那条工具的报错详情」或「扩展 Service Worker 控制台日志」贴回来即可定位。

## 0. 加载

```bash
npm install && npm run build
```

`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `dist` → 在设置页填 API Key、点「测试连接」通过 → 工具栏图标打开侧边栏、选一个**视觉**模型（如 GPT-5.6）。

> 调试面板：`chrome://extensions` 里本扩展的「Service Worker」链接可打开后台控制台，看报错和 `console.error('[browser-agent]…')`。

## 0.5 一键诊断（最快的第一步，不花 API 钱）

先在浏览器里打开任意普通网页（想验证兼容性的话就打开那个页面），再到扩展**设置页 → 诊断**标签，点「▶ 诊断当前标签页」。它会对该页体检：CDP 附加、截图、元素收集（含 top / shadow / iframe 分布）、帧结构、网络状态。

- 全绿 = 感知层 + CDP 全链路在这个页面上通了，可以放心进入下面的对话测试。
- 想专门验证 Shadow DOM 穿透：打开 youtube.com 再诊断，「Shadow DOM 穿透」应显示发现若干元素。
- 任何一项 `✕` 把该行文字贴回来即可定位。

---

## 1. 冒烟（基础链路 + 逐站授权）

> 提示词：**打开 news.ycombinator.com，把首页前 5 条标题和链接整理成列表给我**

预期：弹出 `news.ycombinator.com` 的授权卡片 → 允许后新建标签页归入「Agent」标签组 → 截图 → 汇报 5 条。
验证点：授权卡片、标签组、截图、结构化汇报都正常。

## 2. set-of-marks（编号框 + 按编号点击）

> 提示词：**打开 https://httpbin.org/forms/post，填写 Customer name = 张三、选 Pizza size = Large、勾选 Bacon，然后截图给我看填好的样子**

预期：截图上可交互元素带**彩色编号框**；工具时间线里 `form_input` 的参数是 `ref=<数字>`（而非坐标）；表单被正确填充（受控 input 也生效）。
验证点：截图确有编号框；点击/填写走的是 ref 编号；勾选框、下拉、文本框都对。

## 3. Shadow DOM 穿透

> 提示词：**打开 youtube.com，用 read_page 告诉我首页最上面 3 个视频的标题**

（YouTube 基于 Polymer/Lit，界面大量在 Shadow DOM 里。）
预期：`read_page` 能列出 shadow root 内部的视频链接元素并给出标题。
验证点：若返回的可交互元素里有真实视频标题/链接 → 穿透成功；若只有极少数外壳元素 → 说明没穿透，反馈给我。

## 4. network-idle 等待 + wait_for

> 提示词：**打开 duckduckgo.com，搜索「browser automation」，等结果加载出来后把前 3 条结果标题给我**

预期：导航/搜索后不会在 loading 中途截图；模型可能调用 `wait_for(condition:appear, query:"result")`；拿到的是加载完成后的结果。
验证点：截图是结果已出现的状态，而非空白/骨架屏。

## 5. Planner + Validator（规划 + 自检）

> 提示词：**在维基百科查一下「图灵机」是谁提出的，给我一句话答案**

预期：任务开始有一段**计划**输出（末尾 `SUCCESS: …` 判据）；结束前时间线出现「✅ 自检通过」或「🔎 自检未通过 → 继续」的信息条。
验证点：能看到规划气泡和自检信息条；若第一次答不到位，自检应驱动它再查一次。
（想对比效果可到设置 → 高级，关掉「Planner + Validator」再跑一次。）

## 6. 安全确认

> 提示词：**在任意登录页的密码框里输入 test123**（找个有密码框的页面）

预期：向密码框输入前弹出确认卡片。
验证点：`confirmPassword` 生效；拒绝后模型停手并说明。

---

## 已知需要留意的点

- **跨域 iframe 内部元素**目前只作为整块可点区域，read_page 不会列出其内部细粒度元素（`get_page_text` 能读到其文字）。这是已知边界，不是 bug。
- 某些强依赖逐键 keydown 的富文本编辑器，`computer type` 可能无反应 → 改用 `form_input`。
- YouTube/DuckDuckGo 等站点结构会变；若某条 case 结果异常，先用 `read_page` 看看模型到底拿到了什么，再判断是穿透问题还是站点改版。
