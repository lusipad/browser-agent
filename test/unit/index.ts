// chrome 桩必须最先加载（cdp 等模块在导入时注册监听器）
import '../chrome-stub';
import './util.test';
import './marks.test';
import './settings.test';
import './permissions.test';
import './providers.test';
import './page.test';
import './context.test';
import './export.test';
import './history.test';
import './prompts.test';
import './i18n.test';
import './registry.test';
