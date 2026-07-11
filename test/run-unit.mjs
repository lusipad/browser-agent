// 用 esbuild 把 TS 单测打成单文件（解决扩展名/路径/chrome 桩顺序），再交给 node --test 运行
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await esbuild.build({
  entryPoints: ['test/unit/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: 'dist-test/unit.mjs',
  logLevel: 'warning',
});

const r = spawnSync(process.execPath, ['--test', 'dist-test/unit.mjs'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
