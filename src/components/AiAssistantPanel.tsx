import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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

// Chuẩn hóa mọi dạng dấu phân cách LaTeX (\(...\), \[...\], $$...$$, $...$) mà không làm hỏng code blocks
const normalizeLatexDelimiters = (raw: string): string => {
  if (!raw) return '';
  const segments = raw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((seg, idx) => {
      // Giữ nguyên code blocks / inline code ở vị trí lẻ
      if (idx % 2 === 1) return seg;
      return seg
        // \[ ... \] -> multi-line $$ ... $$
        .replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr: string) => `\n$$\n${expr.trim()}\n$$\n`)
        // $$ ... $$ trên 1 dòng -> multi-line $$ ... $$ để remark-math render dạng display block căn giữa
        .replace(/\$\$([^\n$][\s\S]*?)\$\$/g, (_m, expr: string) => `\n$$\n${expr.trim()}\n$$\n`)
        // \( ... \) -> $ ... $
        .replace(/\\\(([\s\S]*?)\\\)/g, (_m, expr: string) => `$${expr.trim()}$`);
    })
    .join('');
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

  const normalizedContent = useMemo(() => normalizeLatexDelimiters(content), [content]);

  if (!loading && !content && !error) return null;

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-teal-50/35 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-white/90 px-4 py-2.5">
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

      <div className="max-h-[540px] overflow-y-auto px-5 py-4">
        {loading && !content && (
          <div className="flex items-center gap-2.5 py-4 text-xs font-medium text-indigo-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Trợ lý AI Sư phạm Toán 12 đang phân tích mô hình và trình bày công thức toán học...</span>
          </div>
        )}

        {normalizedContent && (
          <div className="ai-markdown text-[13.5px] leading-relaxed text-slate-800">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
            >
              {normalizedContent}
            </ReactMarkdown>
          </div>
        )}

        {loading && content && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tiếp tục sinh nội dung...
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
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
