import { useEffect, useMemo, useRef, useState } from 'react';
import { detectLang, makeT, resolveLang, type Lang } from '../shared/i18n';
import { I18nProvider } from '../shared/i18nReact';
import { loadConfig, onConfigChange } from '../shared/settings';
import type { BgToPanel, ConvMeta, BindingPick, RegionSnippet, TimelineItem } from '../shared/types';
import { BgPort } from './port';
import { Timeline } from './components/Timeline';
import { Composer } from './components/Composer';
import { Header } from './components/Header';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SkillDrawer } from './components/SkillDrawer';
import { RecordingBanner } from './components/RecordingBanner';
import type { SkillMeta } from '../shared/skill';

export function App() {
  const port = useMemo(() => new BgPort(), []);
  const [lang, setLang] = useState<Lang>(detectLang());
  const t = useMemo(() => makeT(lang), [lang]);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [running, setRunning] = useState(false);
  const [bindings, setBindings] = useState<BindingPick[]>([]);
  const [bindingId, setBindingId] = useState('');
  const [visionOverride, setVisionOverride] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{
    input: number;
    output: number;
    cost: number | null;
    contextTokens?: number;
    contextBudget?: number;
  }>({ input: 0, output: 0, cost: null });
  const [conversations, setConversations] = useState<ConvMeta[]>([]);
  const [activeConv, setActiveConv] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [skillDrawerOpen, setSkillDrawerOpen] = useState(false);
  const [drawerSkillId, setDrawerSkillId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'run' | 'edit'>('run');
  const [recording, setRecording] = useState(false);
  const [recordingCount, setRecordingCount] = useState(0);
  const [recordingLastAction, setRecordingLastAction] = useState<string | undefined>();
  const [selectedRegion, setSelectedRegion] = useState<RegionSnippet | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedBottom = useRef(true);

  // 界面语言：加载配置 + 监听变更
  useEffect(() => {
    void loadConfig().then((c) => setLang(resolveLang(c.uiLang)));
    onConfigChange((c) => setLang(resolveLang(c.uiLang)));
  }, []);

  useEffect(() => {
    const off = port.onMessage((msg: BgToPanel) => {
      switch (msg.type) {
        case 'snapshot':
          setItems(msg.items);
          setRunning(msg.running);
          setBindings(msg.bindings);
          setBindingId(msg.bindingId);
          setVisionOverride(msg.visionOverride);
          setRecording(!!msg.recording);
          if (!msg.recording) {
            setRecordingCount(0);
            setRecordingLastAction(undefined);
          }
          break;
        case 'item_upsert':
          setItems((prev) => {
            const i = prev.findIndex((x) => x.id === msg.item.id);
            if (i >= 0) {
              const next = prev.slice();
              next[i] = msg.item;
              return next;
            }
            return [...prev, msg.item];
          });
          break;
        case 'text_delta':
          setItems((prev) => {
            const i = prev.findIndex((x) => x.id === msg.id);
            if (i < 0) return prev;
            const it = prev[i];
            if (it.kind !== 'assistant') return prev;
            const next = prev.slice();
            next[i] = { ...it, text: it.text + msg.delta };
            return next;
          });
          break;
        case 'run_state':
          setRunning(msg.running);
          break;
        case 'bindings':
          setBindings(msg.bindings);
          setBindingId(msg.bindingId);
          break;
        case 'conversations':
          setConversations(msg.list);
          setActiveConv(msg.activeId);
          break;
        case 'usage':
          setUsage((prev) => ({
            input: msg.input,
            output: msg.output,
            cost: msg.cost,
            // 上下文占用仅主循环请求会带上，其余（planner/切模型）沿用上次的值
            contextTokens: msg.contextTokens ?? prev.contextTokens,
            contextBudget: msg.contextBudget ?? prev.contextBudget,
          }));
          break;
        case 'skills_list':
          setSkills(msg.skills);
          break;
        case 'skill_saved':
          setDrawerSkillId(msg.skillId);
          setDrawerMode('edit');
          setSkillDrawerOpen(true);
          break;
        case 'recording_state':
          setRecording(msg.recording);
          setRecordingCount(msg.count);
          setRecordingLastAction(msg.lastAction);
          if (!msg.recording) {
            setRecordingCount(0);
            setRecordingLastAction(undefined);
          }
          break;
        case 'region_selected':
          setSelectedRegion(msg.region);
          break;
        case 'region_select_canceled':
          break;
      }
    });
    void port.connect();
    return off;
  }, [port]);

  // 自动滚到底（除非用户手动上滚）
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  return (
    <I18nProvider value={t}>
    <div className="app">
      <Header
        bindings={bindings}
        bindingId={bindingId}
        usage={usage}
        items={items}
        visionOverride={visionOverride}
        onBinding={(id) => {
          setBindingId(id);
          port.post({ type: 'set_binding', bindingId: id });
        }}
        onVision={(enabled) => {
          setVisionOverride(enabled);
          port.post({ type: 'set_vision', enabled });
        }}
        onNewChat={() => port.post({ type: 'new_chat' })}
        onHistory={() => setHistoryOpen((o) => !o)}
        onSkills={() => {
          setDrawerSkillId(null);
          setDrawerMode('run');
          setSkillDrawerOpen((o) => !o);
        }}
        onOptions={() => port.post({ type: 'open_options' })}
        onDetach={() => port.post({ type: 'detach' })}
        running={running}
      />
      {historyOpen && (
        <HistoryDrawer
          conversations={conversations}
          activeId={activeConv}
          running={running}
          onClose={() => setHistoryOpen(false)}
          onNew={() => {
            port.post({ type: 'new_chat' });
            setHistoryOpen(false);
          }}
          onSwitch={(id) => {
            port.post({ type: 'switch_conv', id });
            setHistoryOpen(false);
          }}
          onDelete={(id) => port.post({ type: 'delete_conv', id })}
        />
      )}
      {skillDrawerOpen && (
        <SkillDrawer
          skills={skills}
          running={running}
          onClose={() => {
            setSkillDrawerOpen(false);
            setDrawerSkillId(null);
            setDrawerMode('run');
          }}
          onRun={(skillId, variables) => port.post({ type: 'run_skill', skillId, variables })}
          onDelete={(id) => port.post({ type: 'delete_skill', id })}
          onOptions={(skillId) => port.post({ type: 'open_options', tab: 'skills', skillId })}
          onStartRecording={() => port.post({ type: 'start_recording' })}
          initialSkillId={drawerSkillId}
          initialMode={drawerMode}
        />
      )}
      <RecordingBanner
        recording={recording}
        count={recordingCount}
        lastAction={recordingLastAction}
        onFinish={() => port.post({ type: 'stop_recording', learn: true })}
        onCancel={() => port.post({ type: 'stop_recording', learn: false })}
      />
      <div className="scroll" ref={scrollRef} onScroll={onScroll}>
        <Timeline
          items={items}
          running={running}
          onApprove={(id, decision) => port.post({ type: 'approval', id, decision })}
          onResolveIntervention={(id) => port.post({ type: 'resolve_human_intervention', id })}
          onAbort={() => port.post({ type: 'abort' })}
          onContinue={() => port.post({ type: 'continue' })}
          onSelectExample={(text) => port.post({ type: 'send', text })}
          onSaveSkill={() => port.post({ type: 'save_skill' })}
        />
      </div>
      <Composer
        running={running}
        region={selectedRegion}
        onClearRegion={() => setSelectedRegion(null)}
        onSelectRegion={() => port.post({ type: 'start_region_select' })}
        onSend={(text, region) => port.post({ type: 'send', text, region })}
        onAbort={() => port.post({ type: 'abort' })}
        hasModel={!!bindingId}
      />
    </div>
    </I18nProvider>
  );
}
