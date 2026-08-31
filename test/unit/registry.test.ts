import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRegistry, type RegistryData } from '../../src/shared/registry';
import type { ModelConfig, ProviderConfig } from '../../src/shared/types';

const baseProviders: ProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' },
];

const baseModels: ModelConfig[] = [
  { id: 'openai/gpt-4', providerId: 'openai', model: 'gpt-4', label: 'GPT-4', vision: true, contextWindow: 128000, pricing: { input: 10, output: 30 } },
];

test('diffRegistry: detects new models', () => {
  const registry: RegistryData = {
    version: 1,
    updatedAt: '2026-08-31',
    providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
    models: [
      { id: 'openai/gpt-4', providerId: 'openai', model: 'gpt-4', label: 'GPT-4', vision: true, contextWindow: 128000, pricing: { input: 10, output: 30 } },
      { id: 'openai/gpt-5', providerId: 'openai', model: 'gpt-5', label: 'GPT-5', vision: true, contextWindow: 200000, pricing: { input: 5, output: 15 } },
    ],
  };
  const d = diffRegistry(registry, baseModels, baseProviders);
  assert.equal(d.newModels.length, 1);
  assert.equal(d.newModels[0].id, 'openai/gpt-5');
  assert.equal(d.updatedModels.length, 0);
  assert.equal(d.newProviders.length, 0);
});

test('diffRegistry: detects updated pricing', () => {
  const registry: RegistryData = {
    version: 1,
    updatedAt: '2026-08-31',
    providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
    models: [
      { id: 'openai/gpt-4', providerId: 'openai', model: 'gpt-4', label: 'GPT-4', vision: true, contextWindow: 128000, pricing: { input: 5, output: 15 } },
    ],
  };
  const d = diffRegistry(registry, baseModels, baseProviders);
  assert.equal(d.newModels.length, 0);
  assert.equal(d.updatedModels.length, 1);
  assert.equal(d.updatedModels[0].remote.pricing?.input, 5);
});

test('diffRegistry: detects new providers', () => {
  const registry: RegistryData = {
    version: 1,
    updatedAt: '2026-08-31',
    providers: [
      { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
      { id: 'fireworks', name: 'Fireworks', baseUrl: 'https://api.fireworks.ai/v1' },
    ],
    models: baseModels,
  };
  const d = diffRegistry(registry, baseModels, baseProviders);
  assert.equal(d.newProviders.length, 1);
  assert.equal(d.newProviders[0].id, 'fireworks');
});

test('diffRegistry: no changes when identical', () => {
  const registry: RegistryData = {
    version: 1,
    updatedAt: '2026-08-31',
    providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
    models: baseModels,
  };
  const d = diffRegistry(registry, baseModels, baseProviders);
  assert.equal(d.newModels.length, 0);
  assert.equal(d.updatedModels.length, 0);
  assert.equal(d.newProviders.length, 0);
});

test('diffRegistry: detects context window change', () => {
  const registry: RegistryData = {
    version: 1,
    updatedAt: '2026-08-31',
    providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
    models: [
      { id: 'openai/gpt-4', providerId: 'openai', model: 'gpt-4', label: 'GPT-4', vision: true, contextWindow: 256000, pricing: { input: 10, output: 30 } },
    ],
  };
  const d = diffRegistry(registry, baseModels, baseProviders);
  assert.equal(d.updatedModels.length, 1);
  assert.equal(d.updatedModels[0].remote.contextWindow, 256000);
});
