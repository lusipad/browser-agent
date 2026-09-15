import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLocalSecrets,
  mergeLocalSecrets,
  readSynced,
  writeSynced,
  removeSynced,
} from '../../src/shared/syncStorage';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../../src/shared/settings';
import type { AppConfig } from '../../src/shared/types';
import { listSkills, saveSkill, loadSkill } from '../../src/shared/skillsStore';
import type { Skill } from '../../src/shared/skill';

test('extractLocalSecrets: 默认安全模式（syncApiKeys: false）隔离 API Key', () => {
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    providers: [
      { id: 'prov1', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-secret-123' },
      { id: 'prov2', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKey: '' },
    ],
    sync: { enabled: true, syncApiKeys: false },
  };

  const { sanitized, secrets } = extractLocalSecrets(cfg);

  // 云端同步配置中的 apiKey 必须被清空
  assert.equal(sanitized.providers.find((p) => p.id === 'prov1')?.apiKey, '');
  assert.equal(sanitized.providers.find((p) => p.id === 'prov2')?.apiKey, '');

  // 密钥必须被安全收集到本地机密表中
  assert.equal(secrets['prov1'], 'sk-secret-123');
  assert.equal(secrets['prov2'], undefined);
});

test('extractLocalSecrets: 显式开启 syncApiKeys: true 时保留在同步配置中', () => {
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    providers: [
      { id: 'prov1', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-secret-123' },
    ],
    sync: { enabled: true, syncApiKeys: true },
  };

  const { sanitized, secrets } = extractLocalSecrets(cfg);
  assert.equal(sanitized.providers[0].apiKey, 'sk-secret-123');
  assert.equal(secrets['prov1'], 'sk-secret-123');
});

test('mergeLocalSecrets: 本地密钥与云端配置正确合并', () => {
  const cloudCfg: AppConfig = {
    ...DEFAULT_CONFIG,
    providers: [
      { id: 'prov1', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
      { id: 'prov2', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '' },
    ],
  };

  const localSecrets = {
    prov1: 'sk-local-prov1-key',
  };

  const merged = mergeLocalSecrets(cloudCfg, localSecrets);
  assert.equal(merged.providers.find((p) => p.id === 'prov1')?.apiKey, 'sk-local-prov1-key');
  assert.equal(merged.providers.find((p) => p.id === 'prov2')?.apiKey, '');
});

test('syncStorage: readSynced, writeSynced 与 removeSynced 在 mock storage 下表现', async () => {
  const syncStore: Record<string, any> = {};
  const localStore: Record<string, any> = {};

  (globalThis as any).chrome.storage = {
    sync: {
      get: async (key: string) => ({ [key]: syncStore[key] }),
      set: async (obj: Record<string, any>) => Object.assign(syncStore, obj),
      remove: async (keys: string[]) => {
        for (const k of keys) delete syncStore[k];
      },
      getBytesInUse: async () => 1024,
    },
    local: {
      get: async (key: string) => ({ [key]: localStore[key] }),
      set: async (obj: Record<string, any>) => Object.assign(localStore, obj),
      remove: async (keys: string[]) => {
        for (const k of keys) delete localStore[k];
      },
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  };

  // 写入同步数据（两处都应有）
  await writeSynced('test_key', { foo: 'bar' });
  assert.deepEqual(syncStore['test_key'], { foo: 'bar' });
  assert.deepEqual(localStore['test_key'], { foo: 'bar' });

  // 读取同步数据
  const readVal = await readSynced<{ foo: string }>('test_key');
  assert.deepEqual(readVal, { foo: 'bar' });

  // 模拟 sync 异常或未找到，降级回退 local
  delete syncStore['test_key'];
  const fallbackVal = await readSynced<{ foo: string }>('test_key');
  assert.deepEqual(fallbackVal, { foo: 'bar' });

  // 删除数据（两处都应被移除）
  await removeSynced('test_key');
  assert.equal(syncStore['test_key'], undefined);
  assert.equal(localStore['test_key'], undefined);
});

test('settings: saveConfig 绝不上报密钥至 sync，loadConfig 本地平滑还原', async () => {
  const syncStore: Record<string, any> = {};
  const localStore: Record<string, any> = {};

  (globalThis as any).chrome.storage = {
    sync: {
      get: async (key: string) => ({ [key]: syncStore[key] }),
      set: async (obj: Record<string, any>) => Object.assign(syncStore, obj),
      remove: async () => {},
    },
    local: {
      get: async (key: string) => ({ [key]: localStore[key] }),
      set: async (obj: Record<string, any>) => Object.assign(localStore, obj),
      remove: async () => {},
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  };

  const testConfig: AppConfig = {
    ...DEFAULT_CONFIG,
    providers: [
      { id: 'p1', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-super-secret-key-12345' },
    ],
    sync: { enabled: true, syncApiKeys: false },
  };

  await saveConfig(testConfig);

  // 验证云端 sync 中的 apiKey 为空（脱敏安全）
  const syncedConfig = syncStore['config'] as AppConfig;
  assert.ok(syncedConfig);
  assert.equal(syncedConfig.providers[0].apiKey, '');

  // 验证本地 local_api_keys 存有真实密钥
  const localSecrets = localStore['local_api_keys'];
  assert.equal(localSecrets['p1'], 'sk-super-secret-key-12345');

  // 验证加载时能成功自动还原
  const loaded = await loadConfig();
  assert.equal(loaded.providers[0].apiKey, 'sk-super-secret-key-12345');
});

test('skillsStore: 保存技能时自动对变量默认值中的敏感 Token 进行脱敏过滤', async () => {
  const syncStore: Record<string, any> = {};
  const localStore: Record<string, any> = {};

  (globalThis as any).chrome.storage = {
    sync: {
      get: async (key: string) => ({ [key]: syncStore[key] }),
      set: async (obj: Record<string, any>) => Object.assign(syncStore, obj),
      remove: async () => {},
    },
    local: {
      get: async (key: string) => ({ [key]: localStore[key] }),
      set: async (obj: Record<string, any>) => Object.assign(localStore, obj),
      remove: async () => {},
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  };

  const sampleSkill: Skill = {
    id: 'skill-token-leak-test',
    name: 'Token Leak Test',
    description: 'Test secret sanitization',
    icon: '⚡',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: [
      {
        name: 'token',
        label: 'API Token',
        type: 'string',
        required: true,
        // 用户误将敏感 token 填入默认值中
        default: 'sk-123456789012345678901234567890',
      },
      {
        name: 'query',
        label: 'Search Query',
        type: 'string',
        required: true,
        default: 'normal keyword',
      },
    ],
    steps: [
      { id: '1', intent: 'Search {{query}}', url: 'https://example.com' },
    ],
  };

  await saveSkill(sampleSkill);

  const loaded = await loadSkill('skill-token-leak-test');
  assert.ok(loaded);
  // sk- 开头的凭证应被置空，普通字符串保留
  assert.equal(loaded.variables[0].default, '');
  assert.equal(loaded.variables[1].default, 'normal keyword');
});
