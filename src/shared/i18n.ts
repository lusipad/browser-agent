// 轻量运行时 i18n：核心（Lang / translate / makeT / 语言检测）+ 合并各区域字典。
// 字典按区域拆分到 ./i18n/*.ts，便于并行维护、避免写冲突。
import { backgroundDict } from './i18n/background';
import { optionsDict } from './i18n/options';
import { sidepanelDict } from './i18n/sidepanel';

export type Lang = 'zh' | 'en';
export type LangSetting = 'auto' | Lang;

const DICT = { ...sidepanelDict, ...optionsDict, ...backgroundDict };

export type MsgKey = keyof typeof DICT;

/** 从浏览器语言推断（zh* → zh，其余 → en） */
export function detectLang(): Lang {
  let nav = 'en';
  try {
    nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  } catch {
    /* 无 navigator（SW 早期）*/
  }
  return /^zh/i.test(nav) ? 'zh' : 'en';
}

/** 把设置（auto/zh/en）解析为具体语言 */
export function resolveLang(setting: LangSetting | undefined): Lang {
  return setting === 'zh' || setting === 'en' ? setting : detectLang();
}

/** 翻译 + 参数插值；缺失回落中文，再回落 key 本身 */
export function translate(lang: Lang, key: MsgKey, params?: Array<string | number>): string {
  const entry = DICT[key] as { zh: string; en: string } | undefined;
  let s = entry ? entry[lang] || entry.zh : String(key);
  if (params) params.forEach((p, i) => (s = s.replace(new RegExp(`\\{${i}\\}`, 'g'), String(p))));
  return s;
}

/** 绑定语言，返回 t(key, params) */
export function makeT(lang: Lang) {
  return (key: MsgKey, params?: Array<string | number>) => translate(lang, key, params);
}

export type TFn = ReturnType<typeof makeT>;
