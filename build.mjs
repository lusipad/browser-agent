import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { genIcons } from './scripts/gen-icons.mjs';

const watch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
genIcons('dist/icons');

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  target: ['chrome120'],
  logLevel: 'info',
  sourcemap: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
};

/** 后台 Service Worker：打成单文件 IIFE，避免模块加载问题 */
const bg = {
  ...common,
  entryPoints: [{ in: 'src/background/index.ts', out: 'background' }],
  format: 'iife',
  outdir: 'dist',
};

/** 侧边栏 / 设置页：ESM + JSX */
const ui = {
  ...common,
  entryPoints: [
    { in: 'src/sidepanel/main.tsx', out: 'sidepanel' },
    { in: 'src/options/main.tsx', out: 'options' },
  ],
  format: 'esm',
  jsx: 'automatic',
  outdir: 'dist',
};

if (watch) {
  const c1 = await esbuild.context(bg);
  const c2 = await esbuild.context(ui);
  await Promise.all([c1.watch(), c2.watch()]);
  console.log('[watch] 监听中… 修改 public/ 下的文件需要重新执行 build');
} else {
  await esbuild.build(bg);
  await esbuild.build(ui);
  console.log('构建完成 → dist/（在 chrome://extensions 加载 dist 目录）');
}
