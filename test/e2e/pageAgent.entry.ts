// 把自包含的 pageAgent 暴露到页面全局，供 Playwright 注入后调用（模拟扩展的注入方式）
import { pageAgent } from '../../src/background/reader';
(globalThis as any).__pageAgent = pageAgent;
