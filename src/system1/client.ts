import type { System1Config } from '../shared/types';
import type { System1Action, System1DecisionRequest, System1DecisionResponse, System1Element } from './types';

const VALID_ACTIONS: Set<System1Action> = new Set([
  'CLICK',
  'TYPE_TEXT',
  'SELECT',
  'SCROLL_UP',
  'SCROLL_DOWN',
  'WAIT',
  'DONE',
  'BLOCKED',
]);

export function formatStateForSystem1(req: System1DecisionRequest): string {
  const inViewEls = req.elements.filter((e) => e.inView);
  const candidateEls = (inViewEls.length >= 5 ? inViewEls : req.elements).slice(0, 120);
  const lines: string[] = [
    `Goal: ${req.goal}`,
    req.pageTitle ? `Title: ${req.pageTitle}` : '',
    req.pageUrl ? `URL: ${req.pageUrl}` : '',
    req.stepContext ? `Context: ${req.stepContext}` : '',
    '',
    ...candidateEls.map((e) => `[${e.ref}] <${e.role}> "${e.name || '(unlabeled)'}"${e.value ? ` value="${e.value}"` : ''}${e.inView ? '' : ' (offscreen)'}`),
  ];
  return lines.filter(Boolean).join('\n');
}

export function parseSystem1Response(raw: any, elements: System1Element[]): System1DecisionResponse {
  if (!raw || typeof raw !== 'object') {
    return { action: 'BLOCKED', confidence: 0, rationale: 'Invalid response from decision engine' };
  }

  let actionStr: string = '';
  let targetRef: string | undefined;
  let text: string | undefined;
  let confidence: number = 0.5;

  // 格式 1: TypeSafe Jev 标准 questions/decisions 或 answers 结构
  const answers = raw.answers && typeof raw.answers === 'object' ? raw.answers : raw.decisions && typeof raw.decisions === 'object' ? raw.decisions : null;
  if (answers) {
    const act = answers.action;
    const tgt = answers.target;
    if (act) {
      actionStr = String(act.choice ?? act.value ?? act.action ?? '');
      const s1 = typeof act.confidence === 'number' ? act.confidence : typeof act.score === 'number' ? act.score : 0.8;
      const s2 = tgt && typeof tgt.confidence === 'number' ? tgt.confidence : typeof tgt?.score === 'number' ? tgt.score : 0.8;
      confidence = Math.min(s1, s2);
    }
    if (tgt) {
      targetRef = String(tgt.choice ?? tgt.value ?? tgt.ref ?? '');
    }
  }

  // 格式 2: 扁平 / jev-ultrafast / Laya REST 结构 (action / choice / ref / target)
  if (!actionStr) {
    actionStr = String(raw.action ?? raw.choice ?? raw.decision ?? '');
  }
  if (!targetRef) {
    targetRef = raw.ref != null ? String(raw.ref) : raw.target != null ? String(raw.target) : raw.targetRef != null ? String(raw.targetRef) : undefined;
  }
  if (typeof raw.confidence === 'number') {
    confidence = raw.confidence;
  } else if (typeof raw.score === 'number') {
    confidence = raw.score;
  }

  if (raw.text != null) {
    text = String(raw.text);
  }

  const normalizedAction = actionStr.toUpperCase().trim() as System1Action;
  const action: System1Action = VALID_ACTIONS.has(normalizedAction) ? normalizedAction : 'BLOCKED';

  // 校验 targetRef 是否存在于当前候选元素列表中
  if (targetRef) {
    const exists = elements.some((e) => e.ref === targetRef);
    if (!exists) {
      // 元素在当前视图中不存在，降低置信度
      confidence = Math.min(confidence, 0.4);
    }
  } else if (action === 'CLICK' || action === 'SELECT') {
    // 点击或选择操作缺失目标元素
    confidence = Math.min(confidence, 0.3);
  }

  return {
    action,
    targetRef: targetRef || undefined,
    text,
    confidence: Math.max(0, Math.min(1, confidence)),
    rationale: raw.rationale ? String(raw.rationale) : undefined,
  };
}

export async function executeSystem1Decision(
  cfg: System1Config,
  req: System1DecisionRequest,
  signal?: AbortSignal,
): Promise<System1DecisionResponse> {
  const start = performance.now();
  let base = cfg.baseUrl.trim().replace(/\/+$/, '');
  let endpoint = base;

  if (cfg.provider === 'typesafe') {
    if (!endpoint.endsWith('/systemone')) {
      endpoint = `${endpoint}/systemone`;
    }
  } else if (cfg.provider === 'laya-local' || cfg.provider === 'custom') {
    if (!endpoint.endsWith('/decision') && !endpoint.endsWith('/systemone')) {
      endpoint = `${endpoint}/decision`;
    }
  }

  const stateText = formatStateForSystem1(req);

  const actionCriteria: Record<string, string> = {
    CLICK: 'Click an interactive element (button, link, tab, checkbox)',
    TYPE_TEXT: 'Type text into an input field or textarea',
    SELECT: 'Select an option from a dropdown or picker',
    SCROLL_DOWN: 'Scroll down to reveal more content below viewport',
    SCROLL_UP: 'Scroll up towards the top of the page',
    WAIT: 'Wait for page content to load or settle',
    DONE: 'The goal has been fully accomplished',
    BLOCKED: 'Cannot proceed or require user intervention',
  };

  const inViewEls = req.elements.filter((e) => e.inView);
  const candidateEls = (inViewEls.length >= 5 ? inViewEls : req.elements).slice(0, 120);

  const targetCriteria: Record<string, string> = {};
  if (candidateEls.length) {
    for (const el of candidateEls) {
      targetCriteria[el.ref] = `<${el.role}> "${el.name || '(unlabeled)'}"${el.value ? ` value="${el.value}"` : ''}`;
    }
  } else {
    targetCriteria['none'] = 'No elements available';
  }

  let payload: Record<string, any>;
  if (cfg.provider === 'typesafe') {
    let modelName = (cfg.model || '').trim();
    if (!modelName || modelName.toLowerCase() === 'jev') {
      modelName = 'jev-latest';
    }
    payload = {
      model: modelName,
      state: stateText,
      questions: {
        action: {
          type: 'choice',
          criteria: actionCriteria,
        },
        target: {
          type: 'choice',
          criteria: targetCriteria,
        },
      },
    };
  } else {
    payload = {
      model: cfg.model || 'laya-modernbert-large',
      state: stateText,
      goal: req.goal,
      elements: req.elements.map((e) => ({
        ref: e.ref,
        role: e.role,
        name: e.name,
        inView: e.inView,
      })),
      questions: {
        action: {
          type: 'choice',
          criteria: actionCriteria,
          choices: Object.keys(actionCriteria),
        },
        target: {
          type: 'choice',
          criteria: targetCriteria,
          choices: Object.keys(targetCriteria),
        },
      },
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cfg.apiKey && cfg.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
  }

  let timeoutId: any;
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  timeoutId = setTimeout(() => {
    controller.abort(new Error('System 1 request timed out (8000ms)'));
  }, 8000);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`System 1 endpoint responded with HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const raw = await res.json();
  const parsed = parseSystem1Response(raw, req.elements);
  parsed.latencyMs = Math.round(performance.now() - start);
  return parsed;
}
