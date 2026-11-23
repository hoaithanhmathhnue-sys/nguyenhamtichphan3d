import {
  AiProvider,
  AGENT_PLATFORM_MODEL_STORAGE_KEY,
  AGENT_PLATFORM_MODELS,
  DEFAULT_AGENT_PLATFORM_MODEL,
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_STORAGE_KEY,
  GEMINI_MODELS,
  LEGACY_GEMINI_MODEL_STORAGE_KEY,
} from '../constants/aiConfig';

// Chấp nhận cả key AI Studio (AIzaSy...) và auth key mới (AQ... / AQ....)
export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIza|AQ)[\w.\-]{20,}$/;

export const isValidGoogleAiApiKey = (key: string): boolean => {
  return GOOGLE_AI_API_KEY_PATTERN.test(key.trim());
};

export const maskApiKey = (key: string): string => {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••';
  const prefix = trimmed.startsWith('AIza') ? trimmed.slice(0, 6) : trimmed.slice(0, 4);
  return `${prefix}••••${trimmed.slice(-4)}`;
};

export type KeyStatus = 'active' | 'cooldown' | 'error';

export interface ApiKeyInfo {
  key: string;
  label: string;
  status: KeyStatus;
  source: 'user' | 'env';
  cooldownUntil?: number;
  lastError?: string;
  consecutiveErrors?: number;
}

interface StoredPool {
  keys: Omit<ApiKeyInfo, 'source'>[];
  currentIndex: number;
}

const STORAGE_KEYS = {
  provider: 'google_ai_provider',
  providerSource: 'google_ai_provider_selection_source',
  geminiPrimary: 'gemini_api_key',
  geminiPool: 'gemini_api_keys',
  agentPrimary: 'agent_platform_api_key',
  agentPool: 'agent_platform_api_keys',
} as const;

const parseEnvKeys = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => isValidGoogleAiApiKey(k));
};

class ApiKeyManager {
  private envKeys: Record<AiProvider, ApiKeyInfo[]>;
  private envIndex: Record<AiProvider, number> = { gemini: 0, 'agent-platform': 0 };

  constructor() {
    const geminiEnv = parseEnvKeys(import.meta.env.VITE_GEMINI_API_KEYS as string | undefined);
    const agentEnv = parseEnvKeys(import.meta.env.VITE_AGENT_PLATFORM_API_KEYS as string | undefined);

    this.envKeys = {
      gemini: geminiEnv.map((key, idx) => ({
        key,
        label: `Hệ thống #${idx + 1}`,
        status: 'active',
        source: 'env',
      })),
      'agent-platform': agentEnv.map((key, idx) => ({
        key,
        label: `Hệ thống #${idx + 1}`,
        status: 'active',
        source: 'env',
      })),
    };

    this.migrateLegacyStorage();
  }

  private migrateLegacyStorage() {
    if (typeof window === 'undefined') return;
    // Tự động di trú model mặc định lên gemini-3.8-flash theo quy chuẩn api.md mục V
    localStorage.removeItem(LEGACY_GEMINI_MODEL_STORAGE_KEY);

    // Nếu app cũ từng lưu 'vertex', đưa về mặc định 'gemini'
    const storedProvider = localStorage.getItem(STORAGE_KEYS.provider);
    if (storedProvider && storedProvider !== 'gemini' && storedProvider !== 'agent-platform') {
      localStorage.setItem(STORAGE_KEYS.provider, 'gemini');
      localStorage.removeItem(STORAGE_KEYS.providerSource);
    }

    // Dọn dẹp nếu có bản sao env key từng lỡ lưu xuống localStorage
    (['gemini', 'agent-platform'] as AiProvider[]).forEach((provider) => {
      const envSet = new Set(this.envKeys[provider].map((k) => k.key));
      if (envSet.size === 0) return;
      const pool = this.readUserPool(provider);
      const filtered = pool.keys.filter((k) => !envSet.has(k.key));
      if (filtered.length !== pool.keys.length) {
        this.writeUserPool(provider, { keys: filtered, currentIndex: 0 });
      }
    });
  }

  getProvider(): AiProvider {
    if (typeof window === 'undefined') return 'gemini';
    const raw = localStorage.getItem(STORAGE_KEYS.provider);
    return raw === 'agent-platform' ? 'agent-platform' : 'gemini';
  }

  setProvider(provider: AiProvider) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.provider, provider);
    localStorage.setItem(STORAGE_KEYS.providerSource, 'manual');
  }

  getSelectedModel(provider: AiProvider = this.getProvider()): string {
    if (typeof window === 'undefined') {
      return provider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL;
    }
    if (provider === 'agent-platform') {
      const saved = localStorage.getItem(AGENT_PLATFORM_MODEL_STORAGE_KEY);
      const validIds = new Set<string>(AGENT_PLATFORM_MODELS.map((m) => m.id));
      return saved && validIds.has(saved) ? saved : DEFAULT_AGENT_PLATFORM_MODEL;
    }
    const saved = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
    const validIds = new Set<string>(GEMINI_MODELS.map((m) => m.id));
    return saved && validIds.has(saved) ? saved : DEFAULT_GEMINI_MODEL;
  }

  setSelectedModel(model: string, provider: AiProvider = this.getProvider()) {
    if (typeof window === 'undefined') return;
    if (provider === 'agent-platform') {
      const validIds = new Set<string>(AGENT_PLATFORM_MODELS.map((m) => m.id));
      const normalized = validIds.has(model) ? model : DEFAULT_AGENT_PLATFORM_MODEL;
      localStorage.setItem(AGENT_PLATFORM_MODEL_STORAGE_KEY, normalized);
    } else {
      const validIds = new Set<string>(GEMINI_MODELS.map((m) => m.id));
      const normalized = validIds.has(model) ? model : DEFAULT_GEMINI_MODEL;
      localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, normalized);
    }
  }

  private getPoolStorageKey(provider: AiProvider): string {
    return provider === 'agent-platform' ? STORAGE_KEYS.agentPool : STORAGE_KEYS.geminiPool;
  }

  private getPrimaryStorageKey(provider: AiProvider): string {
    return provider === 'agent-platform' ? STORAGE_KEYS.agentPrimary : STORAGE_KEYS.geminiPrimary;
  }

  private readUserPool(provider: AiProvider): StoredPool {
    if (typeof window === 'undefined') return { keys: [], currentIndex: 0 };
    try {
      const raw = localStorage.getItem(this.getPoolStorageKey(provider));
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPool;
        if (Array.isArray(parsed.keys)) {
          return {
            keys: parsed.keys.filter((k) => k && typeof k.key === 'string'),
            currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0,
          };
        }
      }
    } catch {
      // ignore malformed storage
    }

    // Fallback đọc khóa primary nếu có
    const primary = localStorage.getItem(this.getPrimaryStorageKey(provider))?.trim();
    if (primary && isValidGoogleAiApiKey(primary)) {
      return {
        keys: [{ key: primary, label: 'Key chính', status: 'active' }],
        currentIndex: 0,
      };
    }
    return { keys: [], currentIndex: 0 };
  }

  private writeUserPool(provider: AiProvider, pool: StoredPool) {
    if (typeof window === 'undefined') return;
    const safePool: StoredPool = {
      keys: pool.keys,
      currentIndex: pool.keys.length > 0 ? pool.currentIndex % pool.keys.length : 0,
    };
    localStorage.setItem(this.getPoolStorageKey(provider), JSON.stringify(safePool));
    const current = safePool.keys[safePool.currentIndex]?.key || '';
    if (current) {
      localStorage.setItem(this.getPrimaryStorageKey(provider), current);
    } else {
      localStorage.removeItem(this.getPrimaryStorageKey(provider));
    }
  }

  private refreshExpiredCooldowns(list: { status: KeyStatus; cooldownUntil?: number }[]): boolean {
    const now = Date.now();
    let changed = false;
    for (const item of list) {
      if (item.status === 'cooldown' && item.cooldownUntil && now >= item.cooldownUntil) {
        item.status = 'active';
        item.cooldownUntil = undefined;
        changed = true;
      }
    }
    return changed;
  }

  getUserKeys(provider: AiProvider): ApiKeyInfo[] {
    const pool = this.readUserPool(provider);
    if (this.refreshExpiredCooldowns(pool.keys)) {
      this.writeUserPool(provider, pool);
    }
    return pool.keys.map((k) => ({ ...k, source: 'user' }));
  }

  getEnvKeyCount(provider: AiProvider): number {
    return this.envKeys[provider].length;
  }

  hasAnyConfiguredKey(provider: AiProvider): boolean {
    return this.getUserKeys(provider).length > 0 || this.envKeys[provider].length > 0;
  }

  useKey(rawKey: string, provider: AiProvider, label?: string): { ok: boolean; error?: string } {
    const key = rawKey.trim();
    if (!isValidGoogleAiApiKey(key)) {
      return {
        ok: false,
        error: 'Định dạng API Key chưa đúng. Key hợp lệ cần bắt đầu bằng AIza... hoặc AQ... và không chứa khoảng trắng.',
      };
    }

    const pool = this.readUserPool(provider);
    const existingIdx = pool.keys.findIndex((k) => k.key === key);
    if (existingIdx >= 0) {
      pool.keys[existingIdx].status = 'active';
      pool.keys[existingIdx].cooldownUntil = undefined;
      pool.keys[existingIdx].lastError = undefined;
      pool.currentIndex = existingIdx;
    } else {
      pool.keys.push({
        key,
        label: label?.trim() || `Key #${pool.keys.length + 1}`,
        status: 'active',
      });
      pool.currentIndex = pool.keys.length - 1;
    }
    this.writeUserPool(provider, pool);
    return { ok: true };
  }

  removeUserKey(key: string, provider: AiProvider) {
    const pool = this.readUserPool(provider);
    pool.keys = pool.keys.filter((k) => k.key !== key);
    pool.currentIndex = 0;
    this.writeUserPool(provider, pool);
  }

  getActiveKey(provider: AiProvider): string | null {
    // 1. Ưu tiên key người dùng tự nhập
    const pool = this.readUserPool(provider);
    const refreshed = this.refreshExpiredCooldowns(pool.keys);
    if (refreshed) this.writeUserPool(provider, pool);

    if (pool.keys.length > 0) {
      for (let offset = 0; offset < pool.keys.length; offset++) {
        const idx = (pool.currentIndex + offset) % pool.keys.length;
        const item = pool.keys[idx];
        if (item.status === 'active') {
          if (idx !== pool.currentIndex) {
            pool.currentIndex = idx;
            this.writeUserPool(provider, pool);
          }
          return item.key;
        }
      }
    }

    // 2. Fallback sang key hệ thống (chỉ trong bộ nhớ) của ĐÚNG provider
    const envList = this.envKeys[provider];
    this.refreshExpiredCooldowns(envList);
    if (envList.length > 0) {
      for (let offset = 0; offset < envList.length; offset++) {
        const idx = (this.envIndex[provider] + offset) % envList.length;
        if (envList[idx].status === 'active') {
          this.envIndex[provider] = idx;
          return envList[idx].key;
        }
      }
    }

    return null;
  }

  markKeyError(
    key: string,
    errorType: 'INVALID_API_KEY' | 'PERMISSION_DENIED' | 'QUOTA_EXCEEDED' | 'RATE_LIMIT' | 'MODEL_OVERLOADED',
    provider: AiProvider,
  ): { rotated: boolean; hasMoreKeys: boolean; message: string } {
    // Tuyệt đối không phạt key vì MODEL_OVERLOADED
    if (errorType === 'MODEL_OVERLOADED') {
      return {
        rotated: false,
        hasMoreKeys: Boolean(this.getActiveKey(provider)),
        message: 'Model tạm thời quá tải; API Key vẫn giữ trạng thái hoạt động.',
      };
    }

    const applyPenalty = (item: { status: KeyStatus; cooldownUntil?: number; lastError?: string }) => {
      item.lastError = errorType;
      if (errorType === 'QUOTA_EXCEEDED') {
        item.status = 'cooldown';
        item.cooldownUntil = Date.now() + 10 * 60 * 1000; // 10 phút
      } else if (errorType === 'RATE_LIMIT') {
        item.status = 'cooldown';
        item.cooldownUntil = Date.now() + 60 * 1000; // 60 giây
      } else {
        item.status = 'error';
      }
    };

    const pool = this.readUserPool(provider);
    const userIdx = pool.keys.findIndex((k) => k.key === key);
    if (userIdx >= 0) {
      applyPenalty(pool.keys[userIdx]);
      pool.currentIndex = (userIdx + 1) % Math.max(1, pool.keys.length);
      this.writeUserPool(provider, pool);
    } else {
      const envIdx = this.envKeys[provider].findIndex((k) => k.key === key);
      if (envIdx >= 0) {
        applyPenalty(this.envKeys[provider][envIdx]);
        this.envIndex[provider] = (envIdx + 1) % Math.max(1, this.envKeys[provider].length);
      }
    }

    const nextKey = this.getActiveKey(provider);
    return {
      rotated: Boolean(nextKey && nextKey !== key),
      hasMoreKeys: Boolean(nextKey),
      message: nextKey ? 'Đang tự động chuyển sang API Key dự phòng...' : 'Không còn API Key khả dụng cho nhà cung cấp hiện tại.',
    };
  }

  resetAllKeys(provider: AiProvider) {
    const pool = this.readUserPool(provider);
    pool.keys.forEach((k) => {
      k.status = 'active';
      k.cooldownUntil = undefined;
      k.lastError = undefined;
    });
    pool.currentIndex = 0;
    this.writeUserPool(provider, pool);

    this.envKeys[provider].forEach((k) => {
      k.status = 'active';
      k.cooldownUntil = undefined;
      k.lastError = undefined;
    });
    this.envIndex[provider] = 0;
  }
}

export const apiKeyManager = new ApiKeyManager();
