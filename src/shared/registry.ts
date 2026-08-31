import type { ModelConfig, ProviderConfig } from './types';

export interface RegistryData {
  version: number;
  updatedAt: string;
  providers: Array<Omit<ProviderConfig, 'apiKey'>>;
  models: ModelConfig[];
}

export interface RegistryDiff {
  newModels: ModelConfig[];
  newProviders: Array<Omit<ProviderConfig, 'apiKey'>>;
  updatedModels: Array<{ remote: ModelConfig; local: ModelConfig }>;
}

const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/lusipad/browser-agent/main/registry/models.json';
const REGISTRY_URL_KEY = 'registryUrl';

export async function getRegistryUrl(): Promise<string> {
  try {
    const { [REGISTRY_URL_KEY]: url } = await chrome.storage.local.get(REGISTRY_URL_KEY);
    return typeof url === 'string' && url.trim() ? url.trim() : DEFAULT_REGISTRY_URL;
  } catch {
    return DEFAULT_REGISTRY_URL;
  }
}

export async function setRegistryUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [REGISTRY_URL_KEY]: url || DEFAULT_REGISTRY_URL });
}

export async function fetchRegistry(url?: string): Promise<RegistryData> {
  const target = url || (await getRegistryUrl());
  const resp = await fetch(target, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data?.models)) throw new Error('invalid registry format');
  return data as RegistryData;
}

export function diffRegistry(
  registry: RegistryData,
  localModels: ModelConfig[],
  localProviders: ProviderConfig[],
): RegistryDiff {
  const localModelIds = new Set(localModels.map((m) => m.id));
  const localProviderIds = new Set(localProviders.map((p) => p.id));
  const localModelMap = new Map(localModels.map((m) => [m.id, m]));

  const newModels = registry.models.filter((m) => !localModelIds.has(m.id));
  const newProviders = registry.providers.filter((p) => !localProviderIds.has(p.id));

  const updatedModels: RegistryDiff['updatedModels'] = [];
  for (const remote of registry.models) {
    const local = localModelMap.get(remote.id);
    if (!local) continue;
    const changed =
      remote.contextWindow !== local.contextWindow ||
      remote.pricing?.input !== local.pricing?.input ||
      remote.pricing?.output !== local.pricing?.output ||
      remote.vision !== local.vision;
    if (changed) updatedModels.push({ remote, local });
  }

  return { newModels, newProviders, updatedModels };
}

export async function fetchProviderModelIds(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  const resp = await fetch(baseUrl.replace(/\/+$/, '') + '/models', {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const j = await resp.json();
  if (!Array.isArray(j?.data)) return [];
  return j.data
    .map((m: Record<string, unknown>) => m?.id)
    .filter((id: unknown): id is string => typeof id === 'string');
}
