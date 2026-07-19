import type { AdvancedSettings } from '../../shared/types';
import { Field, Toggle, type PanelProps } from './common';

export function AdvancedPanel({ cfg, onChange }: PanelProps) {
  const a = cfg.advanced;
  function patch(p: Partial<AdvancedSettings>) {
    onChange({ ...cfg, advanced: { ...a, ...p } });
  }
  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  return (
    <div className="panel">
      <h1>高级</h1>
      <p className="lead">影响智能体循环、上下文占用和请求行为的参数。默认值适用于大多数场景。</p>

      <div className="card">
        <div className="card-row">
          <Field label="单轮最大迭代次数" hint="一次消息内模型↔工具往返上限（防失控）">
            <input
              type="number"
              value={a.maxIterations}
              min={1}
              max={100}
              onChange={(e) => patch({ maxIterations: num(e.target.value, 1, 100, 24) })}
            />
          </Field>
          <Field label="保留截图数量" hint="历史中保留的最近截图数，越大越占 token">
            <input
              type="number"
              value={a.maxImagesKept}
              min={0}
              max={20}
              onChange={(e) => patch({ maxImagesKept: num(e.target.value, 0, 20, 4) })}
            />
          </Field>
        </div>
        <Field label="上下文兜底预算 (token)" hint="模型未填「上下文窗口」时，历史超过此值即从最旧消息开始裁剪">
          <input
            type="number"
            value={a.maxContextTokens}
            min={8000}
            max={1000000}
            step={4000}
            onChange={(e) => patch({ maxContextTokens: num(e.target.value, 8000, 1000000, 96000) })}
          />
        </Field>
        <div className="card-row">
          <Field label="截图最大宽度 (px)" hint="越小越省 token，但过小会看不清细节">
            <input
              type="number"
              value={a.screenshotMaxWidth}
              min={640}
              max={2560}
              step={64}
              onChange={(e) => patch({ screenshotMaxWidth: num(e.target.value, 640, 2560, 1366) })}
            />
          </Field>
          <Field label="JPEG 质量 (1-100)">
            <input
              type="number"
              value={a.jpegQuality}
              min={30}
              max={100}
              onChange={(e) => patch({ jpegQuality: num(e.target.value, 30, 100, 80) })}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-row">
          <Field label="max_tokens（单次回复上限）">
            <input
              type="number"
              value={a.maxTokens}
              min={256}
              max={32000}
              step={256}
              onChange={(e) => patch({ maxTokens: num(e.target.value, 256, 32000, 4096) })}
            />
          </Field>
          <Field label="temperature" hint="留空表示使用模型默认（gpt-5 系列会忽略该参数）">
            <input
              type="number"
              value={a.temperature ?? ''}
              min={0}
              max={2}
              step={0.1}
              placeholder="默认"
              onChange={(e) => patch({ temperature: e.target.value === '' ? null : num(e.target.value, 0, 2, 0) })}
            />
          </Field>
        </div>
        <Field label="请求超时 (秒)">
          <input
            type="number"
            value={Math.round(a.requestTimeoutMs / 1000)}
            min={30}
            max={600}
            step={10}
            onChange={(e) => patch({ requestTimeoutMs: num(e.target.value, 30, 600, 180) * 1000 })}
          />
        </Field>
      </div>

      <div className="card toggles">
        <Toggle
          checked={a.autoScreenshot}
          onChange={(v) => patch({ autoScreenshot: v })}
          label="每次操作后自动截图"
          hint="关闭后模型需主动调用 screenshot 才能看到结果，更省 token 但更易出错"
        />
        <Toggle
          checked={a.setOfMarks}
          onChange={(v) => patch({ setOfMarks: v })}
          label="set-of-marks 编号框标注"
          hint="在截图上给可交互元素叠加编号框，模型按编号点击，大幅提升视觉准确率（仅视觉模型生效）"
        />
        <Toggle
          checked={a.planning}
          onChange={(v) => patch({ planning: v })}
          label="Planner + Validator（规划与自检）"
          hint="任务开始先拆解步骤+定成功判据，模型停手时自检是否真正达成，未达成会继续。更可靠但更耗 token"
        />
      </div>
    </div>
  );
}
