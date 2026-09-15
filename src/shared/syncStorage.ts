// 分层安全存储适配器：自动处理 chrome.storage.sync 云同步、本地离线镜像、配额超限保护与敏感密钥隔离
import type { AppConfig, ProviderConfig } from './types';

/** 检测当前运行环境是否支持 chrome.storage.sync */
export function isSyncAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
  } catch {
    return false;
  }
}

/** 获取云同步存储已使用字节数（上限通常为 102,400 字节 / 100 KB） */
export async function getSyncBytesUsed(): Promise<number> {
  if (!isSyncAvailable()) return 0;
  try {
    return await chrome.storage.sync.getBytesInUse(null);
  } catch {
    return 0;
  }
}

const LOCAL_SECRETS_KEY = 'local_api_keys';

/**
 * 敏感凭证本地隔离（安全核心）：
 * 从配置中剥离 API Key，返回脱敏后的配置与独立的本地密钥映射。
 * 只有当用户显式开启 syncApiKeys: true 时才保留在脱敏对象中。
 */
export function extractLocalSecrets(cfg: AppConfig): {
  sanitized: AppConfig;
  secrets: Record<string, string>;
} {
  const allowSyncKey = cfg.sync?.syncApiKeys === true;
  const secrets: Record<string, string> = {};
  const providers: ProviderConfig[] = cfg.providers.map((p) => {
    if (p.apiKey) {
      secrets[p.id] = p.apiKey;
    }
    return {
      ...p,
      apiKey: allowSyncKey ? p.apiKey : '',
    };
  });

  return {
    sanitized: { ...cfg, providers },
    secrets,
  };
}

/** 将脱敏后的云端配置与本机的独立密钥库合并 */
export function mergeLocalSecrets(
  config: AppConfig,
  secrets: Record<string, string>,
): AppConfig {
  const providers = config.providers.map((p) => {
    const localKey = secrets[p.id];
    return {
      ...p,
      apiKey: p.apiKey || localKey || '',
    };
  });

  return { ...config, providers };
}

/** 从本地存储读取独立密钥库 */
export async function loadLocalSecrets(): Promise<Record<string, string>> {
  try {
    const res = await chrome.storage.local.get(LOCAL_SECRETS_KEY);
    return (res[LOCAL_SECRETS_KEY] as Record<string, string>) || {};
  } catch {
    return {};
  }
}

/** 保存独立密钥库到本地存储（绝不上云） */
export async function saveLocalSecrets(secrets: Record<string, string>): Promise<void> {
  try {
    await chrome.storage.local.set({ [LOCAL_SECRETS_KEY]: secrets });
  } catch {
    /* 忽略存储异常 */
  }
}

/**
 * 读取云端同步数据（若不存在或同步未开启则降级读取本地存储）
 */
export async function readSynced<T>(key: string): Promise<T | null> {
  if (isSyncAvailable()) {
    try {
      const syncRes = await chrome.storage.sync.get(key);
      if (syncRes[key] !== undefined) return syncRes[key] as T;
    } catch {
      /* 读取 sync 失败时降级读 local */
    }
  }
  try {
    const localRes = await chrome.storage.local.get(key);
    return localRes[key] !== undefined ? (localRes[key] as T) : null;
  } catch {
    return null;
  }
}

/**
 * 写入云端同步数据（同时写入本地镜像副本以支持离线读取与配额超限保护）
 */
export async function writeSynced<T>(key: string, value: T): Promise<void> {
  // 1. 本地镜像始终落盘，保证离线可用性
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    /* 本地存储异常 */
  }

  // 2. 尝试同步到云端
  if (isSyncAvailable()) {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (e) {
      console.warn(`[browser-agent] chrome.storage.sync write failed for "${key}", kept in local storage:`, e);
    }
  }
}

/**
 * 删除同步数据（同时清理 sync 与 local）
 */
export async function removeSynced(key: string | string[]): Promise<void> {
  const keys = Array.isArray(key) ? key : [key];
  if (isSyncAvailable()) {
    try {
      await chrome.storage.sync.remove(keys);
    } catch {
      /* 忽略异常 */
    }
  }
  try {
    await chrome.storage.local.remove(keys);
  } catch {
    /* 忽略异常 */
  }
}
