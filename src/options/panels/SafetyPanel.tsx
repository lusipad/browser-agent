import { Toggle, type PanelProps } from './common';

export function SafetyPanel({ cfg, onChange }: PanelProps) {
  const s = cfg.safety;
  function patch(p: Partial<typeof s>) {
    onChange({ ...cfg, safety: { ...s, ...p } });
  }
  return (
    <div className="panel">
      <h1>安全与确认</h1>
      <p className="lead">这些开关决定智能体在哪些情况下需要先征得你的同意。默认设置最安全，建议保留。</p>

      <div className="card toggles">
        <Toggle
          checked={s.confirmNewSite}
          onChange={(v) => patch({ confirmNewSite: v })}
          label="首次操作新网站前请求授权"
          hint="每个域名第一次被操作时，在侧边栏弹出允许 / 拒绝卡片"
        />
        <Toggle
          checked={s.confirmPassword}
          onChange={(v) => patch({ confirmPassword: v })}
          label="向密码框输入前确认"
          hint="检测到目标是 password 输入框时要求确认"
        />
        <Toggle
          checked={s.confirmUpload}
          onChange={(v) => patch({ confirmUpload: v })}
          label="上传文件前确认"
        />
        <Toggle
          checked={s.confirmJavascript}
          onChange={(v) => patch({ confirmJavascript: v })}
          label="执行页面 JavaScript 前确认"
          hint="javascript_tool 可运行任意脚本，建议保持开启"
        />
      </div>

      <div className={'card danger-zone' + (s.allowAllSites ? ' active' : '')}>
        <Toggle
          checked={s.allowAllSites}
          onChange={(v) => {
            if (v && !confirm('这会让智能体无需逐站授权即可操作任何网站（黑名单除外）。确定开启？')) return;
            patch({ allowAllSites: v });
          }}
          label="允许所有网站（不推荐）"
          hint="跳过逐站授权。黑名单中的网站仍然被阻止。"
        />
      </div>
    </div>
  );
}
