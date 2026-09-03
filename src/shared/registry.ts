import type { DiscoveredModel, ModelBinding, ModelConfig, ProviderConfig } from './types';
import { endpointUrls } from './endpoints';

export interface RegistryData {
  version: number;
  updatedAt: string;
  providers: Array<Omit<ProviderConfig, 'apiKey'>>;
  models: ModelConfig[];
  bindings: ModelBinding[];
}

export interface RegistryMetadataDiff {
  updatedModels: Array<{ remote: ModelConfig; local: ModelConfig }>;
  updatedBindings: Array<{ remote: ModelBinding; local: ModelBinding }>;
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
  const data = await resp.json() as {
    version?: number;
    updatedAt?: string;
    providers?: Array<Omit<ProviderConfig, 'apiKey'>>;
    models?: Array<ModelConfig | LegacyRegistryModel>;
    bindings?: ModelBinding[];
  };
  if (!Array.isArray(data.models)) throw new Error('invalid registry format');
  return normalizeRegistry(data as {
    version?: number;
    updatedAt?: string;
    providers?: Array<Omit<ProviderConfig, 'apiKey'>>;
    models: Array<ModelConfig | LegacyRegistryModel>;
    bindings?: ModelBinding[];
  });
}

interface LegacyRegistryModel {
  id: string;
  providerId: string;
  model: string;
  label: string;
  vision: boolean;
  contextWindow?: number;
  pricing?: ModelBinding['pricing'];
}

/** 兼容 v1 注册表；新格式直接使用独立的 models / bindings。 */
export function normalizeRegistry(data: {
  version?: number;
  updatedAt?: string;
  providers?: Array<Omit<ProviderConfig, 'apiKey'>>;
  models: Array<ModelConfig | LegacyRegistryModel>;
  bindings?: ModelBinding[];
}): RegistryData {
  if (Array.isArray(data.bindings)) {
    return {
      version: data.version ?? 1,
      updatedAt: data.updatedAt ?? '',
      providers: data.providers ?? [],
      models: data.models as ModelConfig[],
      bindings: data.bindings,
    };
  }

  const models = new Map<string, ModelConfig>();
  const bindings: ModelBinding[] = [];
  for (const legacy of data.models as LegacyRegistryModel[]) {
    const key = legacy.model.toLowerCase();
    const existing = models.get(key);
    const modelId = existing?.id ?? legacy.model;
    if (existing) {
      existing.vision ||= legacy.vision;
      if ((legacy.contextWindow ?? 0) > (existing.contextWindow ?? 0)) {
        existing.contextWindow = legacy.contextWindow;
      }
    } else {
      models.set(key, {
        id: modelId,
        label: legacy.label,
        vision: !!legacy.vision,
        contextWindow: legacy.contextWindow,
      });
    }
    bindings.push({
      id: legacy.id,
      modelId,
      providerId: legacy.providerId,
      apiModelName: legacy.model,
      pricing: legacy.pricing,
      enabled: true,
    });
  }
  return {
    version: data.version ?? 1,
    updatedAt: data.updatedAt ?? '',
    providers: data.providers ?? [],
    models: [...models.values()],
    bindings,
  };
}

export function diffRegistryMetadata(
  registry: RegistryData,
  localModels: ModelConfig[],
  localBindings: ModelBinding[],
): RegistryMetadataDiff {
  const remoteModelMap = new Map(registry.models.map((m) => [m.id.toLowerCase(), m]));
  const updatedModels: RegistryMetadataDiff['updatedModels'] = [];
  for (const local of localModels) {
    const source = remoteModelMap.get(local.id.toLowerCase());
    if (!source) continue;
    const remote = {
      ...source,
      contextWindow: source.contextWindow ?? local.contextWindow,
    };
    const changed =
      remote.label !== local.label ||
      remote.contextWindow !== local.contextWindow ||
      remote.vision !== local.vision;
    if (changed) updatedModels.push({ remote, local });
  }

  const remoteBindingMap = new Map(
    registry.bindings.map((b) => [bindingMetadataKey(b.providerId, b.apiModelName), b]),
  );
  const updatedBindings: RegistryMetadataDiff['updatedBindings'] = [];
  for (const local of localBindings) {
    const remote = remoteBindingMap.get(bindingMetadataKey(local.providerId, local.apiModelName));
    if (!remote?.pricing) continue;
    const changed =
      remote.pricing?.input !== local.pricing?.input ||
      remote.pricing?.output !== local.pricing?.output;
    if (changed) updatedBindings.push({ remote, local });
  }

  return { updatedModels, updatedBindings };
}

function bindingMetadataKey(providerId: string, apiModelName: string): string {
  return `${providerId.toLowerCase()}\0${apiModelName.toLowerCase()}`;
}

export async function fetchProviderModelIds(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  const models = await discoverEndpointModels({ baseUrl, apiKey });
  return models.map((m) => m.id);
}

export async function discoverEndpointModels(
  provider: Pick<ProviderConfig, 'baseUrl' | 'apiKey'>,
): Promise<DiscoveredModel[]> {
  const urls = endpointUrls(provider.baseUrl, 'models');
  if (!urls.length) throw new Error('Base URL 为空');
  let lastStatus = 0;
  for (const url of urls) {
    const resp = await fetch(url, {
      headers: provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {},
    });
    if (resp.status === 404 && url !== urls[urls.length - 1]) {
      lastStatus = resp.status;
      continue;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const j = await resp.json().catch(() => null);
    if (!Array.isArray(j?.data)) throw new Error('接口返回的不是 OpenAI /models 格式');
    return j.data
      .map((m: Record<string, unknown>) => {
        const result: DiscoveredModel = {
          id: typeof m?.id === 'string' ? m.id : '',
        };
        if (typeof m?.owned_by === 'string') result.ownedBy = m.owned_by;
        if (typeof m?.object === 'string') result.object = m.object;
        return result;
      })
      .filter((m: DiscoveredModel) => !!m.id);
  }
  throw new Error(`HTTP ${lastStatus || 404}`);
}
