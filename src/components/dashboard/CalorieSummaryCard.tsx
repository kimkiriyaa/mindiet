import React from 'react';
import { NutritionTotals } from '../../types/diet';
import { formatNumber } from '../../services/nutritionCalc';
import { Flame, Utensils, Target } from 'lucide-react';

interface CalorieSummaryCardProps {
  targetCalories: number;
  totals: NutritionTotals;
}

export const CalorieSummaryCard: React.FC<CalorieSummaryCardProps> = ({
  targetCalories,
  totals,
}) => {
  const isSurplus = totals.remainingCalories < 0;

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="text-center pb-4 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-400">잔여 칼로리</span>
        <div className="mt-1 flex items-baseline justify-center gap-1">
          <span
            className={`text-4xl font-extrabold tracking-tight ${
              isSurplus ? 'text-rose-500' : 'text-gray-900'
            }`}
          >
            {formatNumber(Math.abs(totals.remainingCalories))}
          </span>
          <span className="text-sm font-semibold text-gray-500">
            kcal {isSurplus ? '초과' : '남음'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div className="bg-gray-50 p-2.5 rounded-xl">
          <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-1">
            <Target className="w-3.5 h-3.5" />
            목표
          </div>
          <p className="font-bold text-gray-800 text-sm">
            {formatNumber(targetCalories)}
          </p>
        </div>

        <div className="bg-emerald-50 p-2.5 rounded-xl">
          <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs mb-1">
            <Utensils className="w-3.5 h-3.5" />
            In (섭취)
          </div>
          <p className="font-bold text-emerald-700 text-sm">
            +{formatNumber(totals.totalIn)}
          </p>
        </div>

        <div className="bg-orange-50 p-2.5 rounded-xl">
          <div className="flex items-center justify-center gap-1 text-orange-600 text-xs mb-1">
            <Flame className="w-3.5 h-3.5" />
            Out (소모)
          </div>
          <p className="font-bold text-orange-700 text-sm">
            -{formatNumber(totals.totalOut)}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-around text-xs text-gray-500 font-medium">
        <span>탄수화물 <strong className="text-gray-700">{totals.totalCarbs}g</strong></span>
        <span>단백질 <strong className="text-gray-700">{totals.totalProtein}g</strong></span>
        <span>지방 <strong className="text-gray-700">{totals.totalFat}g</strong></span>
      </div>
    </section>
  );
};
