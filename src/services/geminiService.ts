import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  AGENT_PLATFORM_FALLBACK_MODELS,
  AiProvider,
  DEFAULT_AGENT_PLATFORM_MODEL,
  DEFAULT_GEMINI_MODEL,
  GEMINI_FALLBACK_MODELS,
  SYSTEM_INSTRUCTION_MATH_STEM,
} from '../constants/aiConfig';
import { apiKeyManager } from './apiKeyManager';

export type ParsedApiErrorType =
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMIT'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'MODEL_OVERLOADED'
  | 'TRANSIENT_SERVER_ERROR'
  | 'INVALID_ARGUMENT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export type ModelFallbackEvent =
  | { type: 'switch'; label: string; from: string; to: string; reason: string }
  | { type: 'key-switch'; label: string; message: string }
  | { type: 'done'; label: string };

export class PartialStreamError extends Error {
  partialText: string;
  originalError: unknown;
  constructor(message: string, partialText: string, originalError: unknown) {
    super(message);
    this.name = 'PartialStreamError';
    this.partialText = partialText;
    this.originalError = originalError;
  }
}

let fallbackListener: ((event: ModelFallbackEvent) => void) | null = null;

export const setModelFallbackListener = (listener: ((event: ModelFallbackEvent) => void) | null) => {
  fallbackListener = listener;
};

const emitFallback = (event: ModelFallbackEvent) => {
  if (fallbackListener) fallbackListener(event);
};

// Client factory DUY NHẤT khởi tạo SDK theo quy chuẩn api.md
export const createGoogleAiClient = (apiKey: string, provider: AiProvider): GoogleGenAI => {
  if (provider === 'agent-platform') {
    return new GoogleGenAI({ vertexai: true, apiKey });
  }
  return new GoogleGenAI({ apiKey });
};

const extractHttpStatus = (error: unknown): number | null => {
  const errObj = error as { status?: unknown; code?: unknown; message?: string } | null;
  if (typeof errObj?.status === 'number') return errObj.status;
  if (typeof errObj?.code === 'number') return errObj.code;
  const msg = String(errObj?.message || '');
  const match = msg.match(/"code"\s*:\s*(\d{3})/) || msg.match(/\bstatus\s*[:=]\s*(\d{3})\b/i);
  return match ? Number(match[1]) : null;
};

// Phân loại lỗi đúng thứ tự ưu tiên mục VII.3 của api.md (kiểm tra API_KEY_INVALID TRƯỚC 400)
export const parseApiError = (error: unknown): ParsedApiErrorType => {
  const status = extractHttpStatus(error);
  const rawMsg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String((error as { message?: string })?.message || error || '');
  const lower = rawMsg.toLowerCase();

  // 1. Key invalid (có thể trả về dưới dạng 400 INVALID_ARGUMENT)
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('api key expired') ||
    lower.includes('invalid api key')
  ) {
    return 'INVALID_API_KEY';
  }

  // 2. 401 Unauthenticated
  if (status === 401 || lower.includes('unauthenticated')) {
    return 'INVALID_API_KEY';
  }

  // 3. 429 Quota / Rate limit
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    if (lower.includes('per minute') || lower.includes('rate limit') || lower.includes('rpm')) {
      return 'RATE_LIMIT';
    }
    return 'QUOTA_EXCEEDED';
  }

  // 4. 403 Permission denied
  if (status === 403 || lower.includes('permission_denied')) {
    return 'PERMISSION_DENIED';
  }

  // 5. 404 Model not found / unsupported
  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('not supported for generatecontent') ||
    lower.includes('is not found')
  ) {
    return 'NOT_FOUND';
  }

  // 6. 503 Overload / high demand
  if (
    status === 503 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('try again later')
  ) {
    return 'MODEL_OVERLOADED';
  }

  // 7. 500 / 502 / 504 Transient server errors
  if (
    status === 500 ||
    status === 502 ||
    status === 504 ||
    lower.includes('internal') ||
    lower.includes('bad gateway') ||
    lower.includes('deadline_exceeded')
  ) {
    return 'TRANSIENT_SERVER_ERROR';
  }

  // 8. 400 Invalid argument
  if (status === 400 || lower.includes('invalid_argument')) {
    return 'INVALID_ARGUMENT';
  }

  // 9. Network failure
  if (
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('err_internet_disconnected')
  ) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN';
};

export const getFriendlyErrorMessage = (errorType: ParsedApiErrorType, provider: AiProvider): string => {
  switch (errorType) {
    case 'INVALID_API_KEY':
      return 'API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại trong mục Cài đặt AI.';
    case 'PERMISSION_DENIED':
      return provider === 'agent-platform'
        ? 'Google đã nhận key nhưng dự án/key chưa được cấp quyền gọi Agent Platform API hoặc model đã chọn (kiểm tra bật API, billing và API restrictions).'
        : 'API Key chưa có quyền truy cập Gemini API hoặc model hiện tại. Vui lòng kiểm tra lại cấu hình key.';
    case 'QUOTA_EXCEEDED':
      return 'Đã hết lượt sử dụng (quota) API hiện tại. Vui lòng đợi hoặc thêm API Key dự phòng trong Cài đặt AI.';
    case 'RATE_LIMIT':
      return 'Vượt giới hạn tốc độ yêu cầu mỗi phút. Vui lòng chờ khoảng 60 giây rồi thử lại.';
    case 'MODEL_OVERLOADED':
      return 'Máy chủ model AI hiện đang quá tải tạm thời (503). API Key của bạn vẫn hợp lệ — hãy thử lại sau ít phút hoặc chọn model nhẹ hơn (Gemini 3.5 Flash-Lite).';
    case 'TRANSIENT_SERVER_ERROR':
      return 'Máy chủ Google AI gặp gián đoạn tạm thời (5xx). Vui lòng bấm Thử lại.';
    case 'NOT_FOUND':
      return 'Model đã chọn hiện không khả dụng cho tài khoản này. Vui lòng đổi sang model khác trong Cài đặt AI.';
    case 'NETWORK_ERROR':
      return 'Không thể kết nối tới máy chủ Google AI. Vui lòng kiểm tra kết nối Internet.';
    case 'INVALID_ARGUMENT':
      return 'Cấu hình yêu cầu chưa tương thích với model đã chọn. Hãy thử lại hoặc đổi model khác.';
    default:
      return 'Đã xảy ra lỗi khi gọi trợ lý AI. Vui lòng bấm Thử lại.';
  }
};

const getSwitchReasonLabel = (errType: ParsedApiErrorType): string => {
  switch (errType) {
    case 'MODEL_OVERLOADED':
    case 'TRANSIENT_SERVER_ERROR':
      return 'đang bận';
    case 'QUOTA_EXCEEDED':
      return 'đã hết lượt sử dụng';
    case 'RATE_LIMIT':
      return 'đang bị giới hạn tốc độ';
    case 'NOT_FOUND':
      return 'không khả dụng';
    case 'PERMISSION_DENIED':
      return 'không mở cho API key này';
    case 'INVALID_ARGUMENT':
      return 'không nhận cấu hình yêu cầu';
    default:
      return 'tạm gián đoạn';
  }
};

export const getOrderedModels = (provider: AiProvider, selectedModel?: string): string[] => {
  const defaults = provider === 'agent-platform' ? AGENT_PLATFORM_FALLBACK_MODELS : GEMINI_FALLBACK_MODELS;
  const preferred =
    selectedModel?.trim() ||
    apiKeyManager.getSelectedModel(provider) ||
    (provider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL);
  return [preferred, ...defaults].filter((m, idx, arr) => arr.indexOf(m) === idx);
};

// Cấu hình sinh chuẩn mục IV & VII.7 của api.md
export const getGeminiGenerationConfig = (
  model: string,
  options: {
    provider: AiProvider;
    thinkingLevel?: ThinkingLevel;
    systemInstruction?: string;
    maxOutputTokens?: number;
    responseMimeType?: string;
  },
) => {
  const isGemini3 = model.startsWith('gemini-3') || model === 'gemini-flash-latest';
  const level = options.thinkingLevel ?? ThinkingLevel.MEDIUM;

  const config: Record<string, unknown> = {};
  if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
  if (options.maxOutputTokens) config.maxOutputTokens = options.maxOutputTokens;
  if (options.responseMimeType) config.responseMimeType = options.responseMimeType;

  if (isGemini3) {
    // Tuyệt đối KHÔNG gửi temperature/topP/topK cho Gemini 3.x; chỉ gửi thinkingConfig với Gemini API
    if (options.provider === 'gemini') {
      config.thinkingConfig = { thinkingLevel: level };
    }
  } else {
    // Dòng Gemini 2.5 trở xuống
    config.temperature = 0.4;
    config.topK = 64;
    config.topP = 0.95;
  }

  return config;
};

const isModelFallbackEligible = (errType: ParsedApiErrorType, provider: AiProvider): boolean => {
  if (
    errType === 'MODEL_OVERLOADED' ||
    errType === 'TRANSIENT_SERVER_ERROR' ||
    errType === 'NOT_FOUND' ||
    errType === 'INVALID_ARGUMENT' ||
    errType === 'QUOTA_EXCEEDED' ||
    errType === 'RATE_LIMIT'
  ) {
    return true;
  }
  if (errType === 'PERMISSION_DENIED' && provider === 'agent-platform') {
    return true;
  }
  return false;
};

export interface StreamRequestOptions {
  prompt: string;
  label?: string;
  thinkingLevel?: ThinkingLevel;
  maxOutputTokens?: number;
  systemInstruction?: string;
  onChunk?: (fullTextSoFar: string) => void;
}

// Luồng gọi AI tập trung: model fallback + key rotation theo đúng kiến trúc mục VII.2
export const streamAiWithFallback = async (options: StreamRequestOptions): Promise<{ text: string; usedModel: string }> => {
  const provider = apiKeyManager.getProvider();
  const label = options.label || 'Trợ lý AI';
  const attemptedKeys = new Set<string>();

  if (!apiKeyManager.hasAnyConfiguredKey(provider)) {
    throw new Error('Vui lòng cấu hình API Key trước khi sử dụng tính năng này.');
  }

  let lastError: unknown = null;
  let lastErrorType: ParsedApiErrorType = 'UNKNOWN';

  try {
    while (true) {
      const apiKey = apiKeyManager.getActiveKey(provider);
      if (!apiKey || attemptedKeys.has(apiKey)) {
        break;
      }
      attemptedKeys.add(apiKey);

      const ai = createGoogleAiClient(apiKey, provider);
      const models = getOrderedModels(provider);

      let keyExhaustedType: ParsedApiErrorType | null = null;

      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        let accumulated = '';
        try {
          const config = getGeminiGenerationConfig(model, {
            provider,
            thinkingLevel: options.thinkingLevel ?? ThinkingLevel.MEDIUM,
            systemInstruction: options.systemInstruction ?? SYSTEM_INSTRUCTION_MATH_STEM,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
          });

          const responseStream = await ai.models.generateContentStream({
            model,
            contents: options.prompt,
            config,
          });

          for await (const chunk of responseStream) {
            const delta = chunk.text || '';
            if (delta) {
              accumulated += delta;
              options.onChunk?.(accumulated);
            }
          }

          return { text: accumulated.trim(), usedModel: model };
        } catch (err) {
          lastError = err;
          lastErrorType = parseApiError(err);

          // Nếu đã stream một phần rồi mới lỗi -> không chuyển model để tránh lặp nội dung
          if (accumulated.length > 0) {
            throw new PartialStreamError(
              getFriendlyErrorMessage(lastErrorType, provider),
              accumulated,
              err,
            );
          }

          if (lastErrorType === 'INVALID_API_KEY') {
            keyExhaustedType = 'INVALID_API_KEY';
            break;
          }

          if (lastErrorType === 'NETWORK_ERROR') {
            throw new Error(getFriendlyErrorMessage('NETWORK_ERROR', provider));
          }

          if (isModelFallbackEligible(lastErrorType, provider) && i < models.length - 1) {
            emitFallback({
              type: 'switch',
              label,
              from: model,
              to: models[i + 1],
              reason: getSwitchReasonLabel(lastErrorType),
            });
            continue;
          }

          if (
            lastErrorType === 'QUOTA_EXCEEDED' ||
            lastErrorType === 'RATE_LIMIT' ||
            lastErrorType === 'PERMISSION_DENIED'
          ) {
            keyExhaustedType = lastErrorType;
          }
          break;
        }
      }

      if (
        keyExhaustedType === 'INVALID_API_KEY' ||
        keyExhaustedType === 'QUOTA_EXCEEDED' ||
        keyExhaustedType === 'RATE_LIMIT' ||
        keyExhaustedType === 'PERMISSION_DENIED'
      ) {
        const rot = apiKeyManager.markKeyError(apiKey, keyExhaustedType, provider);
        if (rot.rotated) {
          emitFallback({
            type: 'key-switch',
            label,
            message: 'Đang tự động chuyển sang API Key dự phòng...',
          });
          continue;
        }
      }

      break;
    }

    if (lastError instanceof PartialStreamError) throw lastError;
    throw new Error(getFriendlyErrorMessage(lastErrorType, provider));
  } finally {
    // BẮT BUỘC: Luôn xóa banner fallbackNotice khi kết thúc dù thành công hay lỗi
    emitFallback({ type: 'done', label });
  }
};

// Kiểm tra API key siêu nhẹ (1 request nhỏ, dừng ngay nếu key sai/lỗi mạng) theo mục VII.8
export const validateApiKey = async (
  apiKey: string,
  provider: AiProvider,
  preferredModel?: string,
): Promise<{ ok: boolean; workingModel?: string; errorType?: ParsedApiErrorType; message: string }> => {
  const ai = createGoogleAiClient(apiKey.trim(), provider);
  const models = getOrderedModels(provider, preferredModel);
  let lastType: ParsedApiErrorType = 'UNKNOWN';

  for (const model of models) {
    try {
      const config = getGeminiGenerationConfig(model, {
        provider,
        thinkingLevel: ThinkingLevel.LOW,
        maxOutputTokens: 64,
      });
      await ai.models.generateContent({
        model,
        contents: 'Trả lời đúng một từ: OK',
        config,
      });
      return {
        ok: true,
        workingModel: model,
        message: `Kết nối thành công! Model khả dụng: ${model}`,
      };
    } catch (err) {
      lastType = parseApiError(err);
      if (lastType === 'INVALID_API_KEY' || lastType === 'NETWORK_ERROR') {
        return {
          ok: false,
          errorType: lastType,
          message: getFriendlyErrorMessage(lastType, provider),
        };
      }
      if (!isModelFallbackEligible(lastType, provider)) {
        break;
      }
    }
  }

  return {
    ok: false,
    errorType: lastType,
    message: getFriendlyErrorMessage(lastType, provider),
  };
};
