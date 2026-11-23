import React, { useEffect, useState } from 'react';
import {
  Award,
  Box,
  ClipboardCheck,
  Compass,
  FlaskConical,
  KeyRound,
  Layers,
  Loader2,
} from 'lucide-react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Lab1AreaTab } from './components/tabs/Lab1AreaTab';
import { Lab2SlicesTab } from './components/tabs/Lab2SlicesTab';
import { Lab3RevolutionTab } from './components/tabs/Lab3RevolutionTab';
import { Lab4StemVerifyTab } from './components/tabs/Lab4StemVerifyTab';
import { QuizTab } from './components/tabs/QuizTab';
import { TeacherRubricTab } from './components/tabs/TeacherRubricTab';
import { apiKeyManager } from './services/apiKeyManager';
import { setModelFallbackListener } from './services/geminiService';

type TabKey = 'lab1' | 'lab2' | 'lab3' | 'lab4' | 'quiz' | 'teacher';

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('lab1');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState({
    provider: apiKeyManager.getProvider(),
    model: apiKeyManager.getSelectedModel(),
    hasKey: apiKeyManager.hasAnyConfiguredKey(apiKeyManager.getProvider()),
  });

  const syncAiStatus = () => {
    const provider = apiKeyManager.getProvider();
    setAiStatus({
      provider,
      model: apiKeyManager.getSelectedModel(provider),
      hasKey: apiKeyManager.hasAnyConfiguredKey(provider),
    });
  };

  useEffect(() => {
    setModelFallbackListener((event) => {
      if (event.type === 'switch') {
        setFallbackNotice(
          `Đang tự động chuyển từ ${event.from} sang ${event.to} (do ${event.from} ${event.reason})...`,
        );
      } else if (event.type === 'key-switch') {
        setFallbackNotice(event.message);
      } else {
        // Bắt buộc xóa banner cảnh báo vàng ngay khi hoàn tất tác vụ
        setFallbackNotice(null);
      }
    });
    return () => setModelFallbackListener(null);
  }, []);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'lab1', label: 'Lab 1: Diện tích & Đổi dấu', icon: <Compass className="h-4 w-4" /> },
    { key: 'lab2', label: 'Lab 2: Thiết diện 3D S(x)', icon: <Layers className="h-4 w-4" /> },
    { key: 'lab3', label: 'Lab 3: Khối tròn xoay 3D', icon: <Box className="h-4 w-4" /> },
    { key: 'lab4', label: 'Lab 4: Kiểm chứng STEM', icon: <FlaskConical className="h-4 w-4" /> },
    { key: 'quiz', label: 'Luyện đề 3 phần mới', icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: 'teacher', label: 'Góc GV: Rubric & AI STEM', icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Banner thông báo chuyển model/key tự động (tự ẩn khi hoàn tất theo api.md) */}
      {fallbackNotice && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 shadow-xs"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
          <span>{fallbackNotice}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-950 via-blue-700 to-teal-600 px-4 py-3 text-white shadow-md sm:px-6">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/30 bg-white/15 text-2xl font-black">
              ∫
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wide sm:text-base">
                INTEGRAL STEM LAB 3D PRO — MÔ PHỎNG TÍCH PHÂN &amp; DỰ ÁN STEM
              </h1>
              <p className="text-[11.5px] text-blue-100">
                Toán 12 (Kết nối tri thức) · Chương IV: Nguyên hàm &amp; Tích phân · Trường THPT Tây Nam, TP.HCM
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold md:inline-block">
              NLS: 1.2 · 2.2 · 3.2 · 5.2.NC1a
            </span>
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-xs transition hover:bg-white/25"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Cài đặt AI</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  aiStatus.hasKey ? 'bg-emerald-400/25 text-emerald-100' : 'bg-amber-400/25 text-amber-100'
                }`}
              >
                {aiStatus.hasKey ? `${aiStatus.provider === 'gemini' ? 'Gemini' : 'Agent'} · ${aiStatus.model}` : 'Chưa gắn Key'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-slate-200 bg-white px-4 py-2.5 shadow-2xs sm:px-6">
        <div className="mx-auto flex max-w-[1480px] flex-wrap gap-2">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-4 sm:px-6">
        {activeTab === 'lab1' && <Lab1AreaTab onOpenSettings={() => setIsKeyModalOpen(true)} />}
        {activeTab === 'lab2' && <Lab2SlicesTab onOpenSettings={() => setIsKeyModalOpen(true)} />}
        {activeTab === 'lab3' && <Lab3RevolutionTab onOpenSettings={() => setIsKeyModalOpen(true)} />}
        {activeTab === 'lab4' && <Lab4StemVerifyTab onOpenSettings={() => setIsKeyModalOpen(true)} />}
        {activeTab === 'quiz' && <QuizTab onOpenSettings={() => setIsKeyModalOpen(true)} />}
        {activeTab === 'teacher' && <TeacherRubricTab onOpenSettings={() => setIsKeyModalOpen(true)} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
        Sản phẩm số thuộc Sáng kiến kinh nghiệm môn Toán 12 (2025–2026) · Tác giả: <b>Phan Thị Thuỳ</b> · Trường THPT Tây Nam, TP. Hồ Chí Minh
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSaved={syncAiStatus}
      />
    </div>
  );
}

export default App;
