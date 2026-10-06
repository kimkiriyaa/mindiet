import React from 'react';

interface HeaderNavProps {
  currentDate: string;
  onPrevDate: () => void;
  onNextDate: () => void;
  onOpenProfile: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentDate,
  onPrevDate,
  onNextDate,
  onOpenProfile,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur shadow-sm">
      <div className="flex items-center space-x-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-base font-bold text-white shadow-sm">
          민
        </span>
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900">민다이어트</h1>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={onPrevDate}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-xs transition"
            aria-label="이전 날짜"
          >
            ‹
          </button>
          <span className="px-2 text-xs font-semibold text-slate-700">{currentDate}</span>
          <button
            onClick={onNextDate}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-xs transition"
            aria-label="다음 날짜"
          >
            ›
          </button>
        </div>

        <button
          onClick={onOpenProfile}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition shadow-xs"
          title="내 프로필 및 기초대사량 설정"
          aria-label="프로필 설정"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
};
