import type { AppConfig, ModelBinding, ModelConfig, ProviderConfig } from './types';

export interface ResolvedModelBinding {
  binding: ModelBinding;
  model: ModelConfig;
  provider: ProviderConfig;
}

export function isBindingEnabled(binding: ModelBinding): boolean {
  return binding.enabled !== false;
}

export function defaultEnabledBindingId(cfg: AppConfig): string {
  const requested = cfg.bindings.find((b) => b.id === cfg.defaultBindingId);
  if (requested && isBindingEnabled(requested)) return requested.id;
  return cfg.bindings.find(isBindingEnabled)?.id ?? cfg.defaultBindingId;
}

export function resolveModelBinding(
  cfg: AppConfig,
  bindingId: string,
): ResolvedModelBinding | null {
  const binding = cfg.bindings.find((b) => b.id === bindingId);
  if (!binding) return null;
  const model = cfg.models.find((m) => m.id === binding.modelId);
  const provider = cfg.providers.find((p) => p.id === binding.providerId);
  return model && provider ? { binding, model, provider } : null;
}
