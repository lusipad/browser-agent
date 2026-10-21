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
  /** 可选页面视口截图 (如 data:image/jpeg;base64,...) */
  screenshot?: string;
}

export interface System1DecisionResponse {
  action: System1Action;
  targetRef?: string;
  /** 点击或定位的真实物理/视口坐标 [x, y] (如来自 Jev 视觉 Box 预测) */
  coordinate?: [number, number];
  /** 目标边界框 { x, y, w, h } */
  box?: { x: number; y: number; w: number; h: number };
  text?: string;
  confidence: number;
  rationale?: string;
  latencyMs?: number;
}
