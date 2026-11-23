import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  AGENT_PLATFORM_MODELS,
  AiProvider,
  GEMINI_MODELS,
} from '../constants/aiConfig';
import {
  ApiKeyInfo,
  apiKeyManager,
  isValidGoogleAiApiKey,
  maskApiKey,
} from '../services/apiKeyManager';
import { validateApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [userKeys, setUserKeys] = useState<ApiKeyInfo[]>([]);
  const [envCount, setEnvCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadProviderState = (target: AiProvider) => {
    setProvider(target);
    setSelectedModel(apiKeyManager.getSelectedModel(target));
    setUserKeys(apiKeyManager.getUserKeys(target));
    setEnvCount(apiKeyManager.getEnvKeyCount(target));
    setFormError(null);
    setTestResult(null);
  };

  useEffect(() => {
    if (isOpen) {
      loadProviderState(apiKeyManager.getProvider());
      setNewKeyInput('');
      setNewKeyLabel('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modelOptions = provider === 'agent-platform' ? AGENT_PLATFORM_MODELS : GEMINI_MODELS;

  const handleAddKey = () => {
    setFormError(null);
    setTestResult(null);
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setFormError('Vui lòng nhập API Key (bắt đầu bằng AIzaSy... hoặc AQ...).');
      return;
    }
    if (!isValidGoogleAiApiKey(trimmed)) {
      setFormError('Định dạng API Key không hợp lệ. Key cần bắt đầu bằng AIzaSy... hoặc AQ... và không chứa dấu cách.');
      return;
    }
    const res = apiKeyManager.useKey(trimmed, provider, newKeyLabel || undefined);
    if (!res.ok) {
      setFormError(res.error || 'Không thể lưu API Key.');
      return;
    }
    setUserKeys(apiKeyManager.getUserKeys(provider));
    setNewKeyInput('');
    setNewKeyLabel('');
  };

  const handleRemoveKey = (key: string) => {
    apiKeyManager.removeUserKey(key, provider);
    setUserKeys(apiKeyManager.getUserKeys(provider));
    setTestResult(null);
  };

  const handleSelectActive = (key: string) => {
    apiKeyManager.useKey(key, provider);
    setUserKeys(apiKeyManager.getUserKeys(provider));
  };

  const handleResetStatuses = () => {
    apiKeyManager.resetAllKeys(provider);
    setUserKeys(apiKeyManager.getUserKeys(provider));
    setTestResult(null);
  };

  const handleTestKey = async () => {
    setFormError(null);
    setTestResult(null);

    const candidate = newKeyInput.trim() || apiKeyManager.getActiveKey(provider) || '';
    if (!candidate) {
      setFormError('Vui lòng nhập hoặc thêm ít nhất 1 API Key trước khi kiểm tra.');
      return;
    }
    if (!isValidGoogleAiApiKey(candidate)) {
      setFormError('Định dạng API Key không hợp lệ (chấp nhận tiền tố AIzaSy... hoặc AQ...).');
      return;
    }

    setTesting(true);
    try {
      const res = await validateApiKey(candidate, provider, selectedModel);
      setTestResult({ ok: res.ok, message: res.message });
      if (res.ok && res.workingModel && res.workingModel !== selectedModel) {
        const validIds = new Set<string>(modelOptions.map((m) => m.id));
        if (validIds.has(res.workingModel)) {
          setSelectedModel(res.workingModel);
        }
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndClose = () => {
    // Nếu người dùng đã gõ key vào ô nhưng chưa bấm "Thêm", tự động lưu luôn nếu hợp lệ
    if (newKeyInput.trim()) {
      const res = apiKeyManager.useKey(newKeyInput.trim(), provider, newKeyLabel || undefined);
      if (!res.ok) {
        setFormError(res.error || 'API Key chưa đúng định dạng.');
        return;
      }
    }
    apiKeyManager.setProvider(provider);
    apiKeyManager.setSelectedModel(selectedModel, provider);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-950 via-blue-700 to-teal-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5" />
            <div>
              <h2 className="text-base font-bold">Cài đặt Trợ lý AI (Gemini API &amp; Agent Platform API)</h2>
              <p className="text-xs text-blue-100">
                Hỗ trợ cả khóa AIzaSy... và AQ..., tự động fallback model khi quá tải 503
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
            aria-label="Đóng cài đặt AI"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {/* Bước 1: Chọn dịch vụ thủ công */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
              1. Chọn nhà cung cấp dịch vụ AI (lưu khóa tách biệt)
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => loadProviderState('gemini')}
                className={`rounded-xl border p-3.5 text-left transition ${
                  provider === 'gemini'
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Gemini API</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                    Mặc định
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Google AI Studio (dòng Gemini 3.8 Flash mới nhất, hỗ trợ Thinking &amp; miễn phí/trả phí).
                </p>
              </button>

              <button
                type="button"
                onClick={() => loadProviderState('agent-platform')}
                className={`rounded-xl border p-3.5 text-left transition ${
                  provider === 'agent-platform'
                    ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Agent Platform API</span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                    Doanh nghiệp
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Kết nối qua endpoint Google Cloud Agent Platform bằng API Key riêng biệt.
                </p>
              </button>
            </div>
          </div>

          {/* Bước 2: Chọn Model */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              2. Model ưu tiên ({provider === 'gemini' ? 'Gemini API' : 'Agent Platform API'})
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Khi model ưu tiên bận (503) hoặc gián đoạn, hệ thống sẽ tự động chuyển lần lượt sang chuỗi model dự phòng ổn định.
            </p>
          </div>

          {/* Bước 3: Nhập và quản lý API Key */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                3. API Key cho {provider === 'gemini' ? 'Gemini API' : 'Agent Platform API'}
              </label>
              <a
                href={
                  provider === 'gemini'
                    ? 'https://aistudio.google.com/apikey'
                    : 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/api-keys'
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                Lấy API Key chính thức <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                placeholder="Nhập API Key dạng AIzaSy... hoặc AQ..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-36"
              />
              <button
                type="button"
                onClick={handleAddKey}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-900"
              >
                <Plus className="h-4 w-4" /> Thêm key
              </button>
            </div>

            {formError && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {testResult && (
              <div
                className={`mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  testResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Danh sách key đã lưu */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Key cá nhân đã lưu: <b>{userKeys.length}</b>
                  {envCount > 0 && (
                    <>
                      {' '}
                      · Key hệ thống sẵn có: <b>{envCount}</b>
                    </>
                  )}
                </span>
                {userKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetStatuses}
                    className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Đặt lại trạng thái key
                  </button>
                )}
              </div>

              {userKeys.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-500">
                  Chưa có API Key cá nhân nào cho nhà cung cấp này. Các mô phỏng 3D và bộ công cụ STEM vẫn hoạt động 100% không cần API Key.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {userKeys.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            item.status === 'active'
                              ? 'bg-emerald-500'
                              : item.status === 'cooldown'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          }`}
                        />
                        <span className="font-semibold text-slate-800">{item.label}</span>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {maskApiKey(item.key)}
                        </code>
                        <span className="text-[11px] text-slate-500">
                          ({item.status === 'active' ? 'Sẵn sàng' : item.status === 'cooldown' ? 'Tạm nghỉ' : 'Lỗi'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectActive(item.key)}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          Ưu tiên
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveKey(item.key)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Xóa key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>
              API Key của bạn chỉ được lưu cục bộ trên trình duyệt (<code>localStorage</code>) và chỉ gửi trực tiếp tới máy chủ Google AI khi bạn bấm tính năng AI.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Kiểm tra key
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
