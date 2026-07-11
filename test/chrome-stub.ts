// 最小 chrome API 桩：让引用了 chrome 的 src 模块能在 Node 单测中被导入
// （cdp.ts 等在模块加载时注册监听器，缺了会抛 ReferenceError）
const noop = () => {};
const listener = { addListener: noop, removeListener: noop };
(globalThis as any).chrome = {
  debugger: { onEvent: listener, onDetach: listener, sendCommand: async () => ({}), attach: async () => {}, detach: async () => {} },
  tabs: { onRemoved: listener, onUpdated: listener, query: async () => [], get: async () => ({}), create: async () => ({}) },
  runtime: { onConnect: listener, onMessage: listener, getPlatformInfo: noop, connect: () => ({ onMessage: listener, onDisconnect: listener, postMessage: noop }) },
  storage: {
    local: { get: async () => ({}), set: async () => {} },
    session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    onChanged: listener,
  },
  webNavigation: { getAllFrames: async () => [] },
  sidePanel: { setPanelBehavior: async () => {} },
  windows: { onRemoved: listener },
  scripting: { executeScript: async () => [] },
};
export {};
