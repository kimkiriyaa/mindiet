import React from 'react';
import { Droplet, Plus, Minus } from 'lucide-react';

interface WaterTrackerCardProps {
  waterIntake: number;
  targetWater: number;
  onAddWater: (amount: number) => void;
}

export const WaterTrackerCard: React.FC<WaterTrackerCardProps> = ({
  waterIntake,
  targetWater,
  onAddWater,
}) => {
  const percentage = Math.min(100, Math.round((waterIntake / targetWater) * 100));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
            <Droplet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">물 섭취량</h2>
          </div>
        </div>
        <div className="text-xs font-bold text-sky-600">
          {waterIntake} / {targetWater} ml
        </div>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className="bg-sky-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAddWater(250)}
          className="flex-1 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+250ml</span>
        </button>
        <button
          type="button"
          onClick={() => onAddWater(500)}
          className="flex-1 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+500ml</span>
        </button>
        {waterIntake > 0 && (
          <button
            type="button"
            onClick={() => onAddWater(-250)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            title="250ml 빼기"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
