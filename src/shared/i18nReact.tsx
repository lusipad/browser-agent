import { createContext, useContext } from 'react';
import { makeT, type TFn } from './i18n';

const I18nCtx = createContext<TFn>(makeT('zh'));

export const I18nProvider = I18nCtx.Provider;

/** 组件内取当前语言的翻译函数：const t = useT(); t('header.settings') */
export function useT(): TFn {
  return useContext(I18nCtx);
}
