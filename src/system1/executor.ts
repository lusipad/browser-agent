import { executeToolUse } from '../background/tools/registry';
import type { Session } from '../background/session';
import { uid } from '../shared/util';
import type { System1DecisionResponse, System1Element } from './types';

export interface FastStepResult {
  executed: boolean;
  action: string;
  targetRef?: string;
  targetName?: string;
  summary: string;
  needsSystem2: boolean;
  isDone?: boolean;
}

export async function executeFastAction(
  session: Session,
  decision: System1DecisionResponse,
  elements: System1Element[],
): Promise<FastStepResult> {
  const { action, targetRef, text } = decision;

  if (action === 'DONE') {
    return {
      executed: true,
      action: 'DONE',
      summary: 'System 1 signaled goal completion',
      needsSystem2: false,
      isDone: true,
    };
  }

  if (action === 'BLOCKED') {
    return {
      executed: false,
      action: 'BLOCKED',
      summary: 'System 1 signaled BLOCKED, delegating to System 2',
      needsSystem2: true,
    };
  }

  if (action === 'WAIT') {
    const tuId = uid('t');
    await executeToolUse(session, {
      type: 'tool_use',
      id: tuId,
      name: 'computer',
      input: { action: 'wait', duration_ms: 1000 },
    });
    return {
      executed: true,
      action: 'WAIT',
      summary: 'Waited 1000ms',
      needsSystem2: false,
    };
  }

  if (action === 'SCROLL_DOWN' || action === 'SCROLL_UP') {
    const tuId = uid('t');
    const dir = action === 'SCROLL_DOWN' ? 'down' : 'up';
    await executeToolUse(session, {
      type: 'tool_use',
      id: tuId,
      name: 'computer',
      input: { action: 'scroll', scroll_direction: dir, scroll_amount: 600 },
    });
    return {
      executed: true,
      action,
      summary: `Scrolled ${dir} 600px`,
      needsSystem2: false,
    };
  }

  if (action === 'CLICK' || action === 'SELECT') {
    if (!targetRef) {
      return {
        executed: false,
        action,
        summary: 'Target ref missing for click',
        needsSystem2: true,
      };
    }
    const el = elements.find((e) => e.ref === targetRef);
    const tuId = uid('t');
    const out = await executeToolUse(session, {
      type: 'tool_use',
      id: tuId,
      name: 'computer',
      input: { action: 'left_click', ref: targetRef },
    });

    if (out.isError) {
      return {
        executed: false,
        action,
        targetRef,
        summary: `Click failed on [${targetRef}], delegating to System 2`,
        needsSystem2: true,
      };
    }

    return {
      executed: true,
      action,
      targetRef,
      targetName: el?.name || el?.role,
      summary: `Clicked [${targetRef}] <${el?.role || 'element'}> "${el?.name || ''}"`,
      needsSystem2: false,
    };
  }

  if (action === 'TYPE_TEXT') {
    if (!targetRef) {
      return {
        executed: false,
        action,
        summary: 'Target ref missing for typing',
        needsSystem2: true,
      };
    }
    if (!text) {
      // 无法确定输入的具体文字，交由 System 2 推理生成
      return {
        executed: false,
        action,
        targetRef,
        summary: `Target [${targetRef}] identified for text input, but text content requires System 2 generation`,
        needsSystem2: true,
      };
    }

    const el = elements.find((e) => e.ref === targetRef);
    const tuId = uid('t');
    const out = await executeToolUse(session, {
      type: 'tool_use',
      id: tuId,
      name: 'form_input',
      input: { ref: targetRef, value: text },
    });

    if (out.isError) {
      return {
        executed: false,
        action,
        targetRef,
        summary: `Type failed on [${targetRef}], delegating to System 2`,
        needsSystem2: true,
      };
    }

    return {
      executed: true,
      action,
      targetRef,
      targetName: el?.name || el?.role,
      summary: `Typed "${text}" into [${targetRef}] <${el?.role || 'input'}>`,
      needsSystem2: false,
    };
  }

  return {
    executed: false,
    action,
    summary: `Unhandled System 1 action: ${action}`,
    needsSystem2: true,
  };
}
