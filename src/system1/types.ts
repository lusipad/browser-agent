import type { System1Config } from '../shared/types';

export type System1Action =
  | 'CLICK'
  | 'TYPE_TEXT'
  | 'SELECT'
  | 'SCROLL_UP'
  | 'SCROLL_DOWN'
  | 'WAIT'
  | 'DONE'
  | 'BLOCKED';

export interface System1Element {
  ref: string;
  role: string;
  name: string;
  tag?: string;
  inView?: boolean;
  value?: string;
  x?: number;
  y?: number;
}

export interface System1DecisionRequest {
  goal: string;
  elements: System1Element[];
  pageUrl?: string;
  pageTitle?: string;
  stepContext?: string;
}

export interface System1DecisionResponse {
  action: System1Action;
  targetRef?: string;
  text?: string;
  confidence: number;
  rationale?: string;
  latencyMs?: number;
}
