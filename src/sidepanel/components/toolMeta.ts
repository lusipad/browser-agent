const ICONS: Record<string, string> = {
  tabs_context: '🗂',
  tabs_create: '➕',
  tabs_close: '✖',
  navigate: '🧭',
  screenshot: '📸',
  computer: '🖱',
  read_page: '📄',
  extract_data: '🧾',
  find: '🔎',
  form_input: '⌨',
  scroll_to_ref: '⇕',
  get_page_text: '📝',
  wait_for: '⏳',
  file_upload: '📎',
  javascript_tool: '🧩',
  read_console_messages: '🖥',
  read_network_requests: '🌐',
  resize_window: '↔',
  gif_creator: '🎞',
};

const LABELS: Record<string, string> = {
  tabs_context: '查看标签页',
  tabs_create: '新建标签页',
  tabs_close: '关闭标签页',
  navigate: '导航',
  screenshot: '截图',
  computer: '操作',
  read_page: '读取页面',
  extract_data: '抽取数据',
  find: '查找元素',
  form_input: '填写',
  scroll_to_ref: '滚动到',
  get_page_text: '提取正文',
  wait_for: '等待',
  file_upload: '上传文件',
  javascript_tool: '执行脚本',
  read_console_messages: '读取控制台',
  read_network_requests: '读取网络',
  resize_window: '调整窗口',
  gif_creator: '生成 GIF',
};

export function toolIcon(name: string): string {
  return ICONS[name] ?? '🔧';
}

export function toolLabel(name: string): string {
  return LABELS[name] ?? name;
}
