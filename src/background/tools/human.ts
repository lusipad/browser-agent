// 人机协同工具：遇到验证码、滑块、短信验证或阻断时请求人工介入
import type { ToolDef } from './registry';

export const humanInterventionTool: ToolDef = {
  name: 'request_human_intervention',
  description:
    'Request human user assistance when encountering a CAPTCHA, slider puzzle, SMS verification code, Cloudflare Turnstile, login screen, or any interactive security challenge that automated browser tools cannot bypass. ' +
    'Calling this pauses the agent, plays a notification, and prompts the user in the sidebar to complete the verification. ' +
    'The agent will wait until the user confirms completion, then automatically resumes.',
  schema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        enum: ['captcha', 'slider', 'sms_code', 'login', 'other'],
        description: 'The type of human intervention needed, default "captcha"',
      },
      instruction: {
        type: 'string',
        description: 'Clear, concise instruction telling the user what needs to be solved on the page (e.g. "请在页面上滑动完成拼图验证", "请输入收到的手机短信验证码")',
      },
    },
    required: ['instruction'],
  },
  needsTab: false,
  async run(ctx, input) {
    const reason = (input.reason as any) || 'captcha';
    const instruction = String(input.instruction || '请在页面上完成验证后点击继续');
    await ctx.session.requestHumanIntervention({
      title: ctx.session.t('human.title'),
      hint: instruction,
      reason,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Human intervention completed: The user has solved the verification challenge (${reason}) and resumed execution. You can now re-inspect the page or continue with next steps.`,
        },
      ],
    };
  },
};
