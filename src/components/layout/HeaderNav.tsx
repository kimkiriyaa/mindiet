import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface HeaderNavProps {
  currentDate: string;
  onDateChange: (nextDate: string) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentDate,
  onDateChange,
}) => {
  const getShiftedDate = (days: number): string => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = currentDate === todayStr;

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${year}년 ${Number(month)}월 ${Number(day)}일`;
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onDateChange(getShiftedDate(-1))}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition"
          aria-label="이전 날짜"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-gray-800 text-base">
          {formatDateDisplay(currentDate)}
        </span>
        <button
          type="button"
          onClick={() => onDateChange(getShiftedDate(1))}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition"
          aria-label="다음 날짜"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {!isToday && (
        <button
          type="button"
          onClick={() => onDateChange(todayStr)}
          className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full hover:bg-emerald-100 transition flex items-center gap-1"
        >
          <Calendar className="w-3.5 h-3.5" />
          오늘
        </button>
      )}
    </header>
  );
};
