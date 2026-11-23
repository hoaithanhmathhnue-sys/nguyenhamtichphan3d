import React, { useMemo } from 'react';
import katex from 'katex';

interface MathFormulaProps {
  tex: string;
  block?: boolean;
  className?: string;
}

/**
 * Render 1 công thức LaTeX đơn lẻ bằng KaTeX (nhanh, an toàn, không báo lỗi crash)
 */
export const MathFormula: React.FC<MathFormulaProps> = ({ tex, block = false, className = '' }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return tex;
    }
  }, [tex, block]);

  return block ? (
    <div className={`my-1.5 overflow-x-auto ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
};

interface RichMathTextProps {
  text: string;
  className?: string;
}

/**
 * Render chuỗi hỗn hợp văn bản tiếng Việt + công thức LaTeX ($...$ và $$...$$) bằng KaTeX
 * Dùng cho hộp công thức, đề kiểm tra Pre-test / Post-test và thẻ phân tích lỗi sai.
 */
export const RichMathText: React.FC<RichMathTextProps> = ({ text, className = '' }) => {
  const parts = useMemo(() => {
    if (!text) return [];
    const normalized = text
      .replace(/\\\[([\s\S]*?)\\\]/g, (_m, e: string) => `$$${e.trim()}$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_m, e: string) => `$${e.trim()}$`);
    return normalized.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          return <MathFormula key={idx} tex={part.slice(2, -2).trim()} block={true} />;
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return <MathFormula key={idx} tex={part.slice(1, -1).trim()} block={false} />;
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
};
