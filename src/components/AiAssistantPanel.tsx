import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface AiAssistantPanelProps {
  title: string;
  content: string;
  loading: boolean;
  error: string | null;
  usedModel?: string | null;
  onRetry?: () => void;
  onOpenSettings: () => void;
}

const renderFormattedLines = (text: string) => {
  return text.split('\n').map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-2" />;

    // Bold inline parser **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={pIdx}>{part}</React.Fragment>;
    });

    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} className="mt-2.5 text-sm font-bold text-blue-900">
          {trimmed.replace(/^###\s+/, '')}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={idx} className="mt-3 border-b border-blue-100 pb-1 text-sm font-extrabold text-blue-950">
          {trimmed.replace(/^##\s+/, '')}
        </h3>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      return (
        <div key={idx} className="flex gap-2 pl-2 text-sm leading-relaxed text-slate-800">
          <span className="mt-0.5 text-teal-600">•</span>
          <span>{parts}</span>
        </div>
      );
    }
    return (
      <p key={idx} className="text-sm leading-relaxed text-slate-800">
        {parts}
      </p>
    );
  });
};

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  title,
  content,
  loading,
  error,
  usedModel,
  onRetry,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);

  if (!loading && !content && !error) return null;

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-teal-50/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-white/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-bold text-indigo-950">{title}</span>
          {usedModel && !loading && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
              {usedModel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {content && !loading && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Đã sao chép' : 'Sao chép'}
            </button>
          )}
          {onRetry && !loading && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Thử lại
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-4 py-3">
        {loading && !content && (
          <div className="flex items-center gap-2.5 py-4 text-xs font-medium text-indigo-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Trợ lý AI Sư phạm Toán 12 đang phân tích mô hình và phản hồi...</span>
          </div>
        )}

        {content && <div className="space-y-1">{renderFormattedLines(content)}</div>}

        {loading && content && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tiếp tục sinh nội dung...
          </div>
        )}

        {error && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="space-y-2">
                <p className="font-semibold">{error}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-800"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Mở Cài đặt AI
                  </button>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Thử lại
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
