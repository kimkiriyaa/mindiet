import React, { useState } from 'react';
import { MealItem, MealType } from '../../types/diet';
import { Plus, Trash2 } from 'lucide-react';

interface MealSectionProps {
  meals: MealItem[];
  onAddMeal: (meal: Omit<MealItem, 'id'>) => void;
  onDeleteMeal: (id: string) => void;
}

const MEAL_GROUPS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: '아침' },
  { type: 'lunch', label: '점심' },
  { type: 'dinner', label: '저녁' },
  { type: 'snack', label: '간식' },
];

export const MealSection: React.FC<MealSectionProps> = ({
  meals,
  onAddMeal,
  onDeleteMeal,
}) => {
  const [activeType, setActiveType] = useState<MealType | null>(null);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !calories || !activeType) return;
    onAddMeal({
      type: activeType,
      name,
      calories: Number(calories),
    });
    setName('');
    setCalories('');
    setActiveType(null);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-gray-500 px-1">식단 기록 (In)</h2>

      {MEAL_GROUPS.map(({ type, label }) => {
        const groupMeals = meals.filter((m) => m.type === type);
        const subtotal = groupMeals.reduce((s, m) => s + m.calories, 0);

        return (
          <div key={type} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-sm">{label}</span>
                <span className="text-xs text-gray-400">{subtotal} kcal</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveType(activeType === type ? null : type)}
                className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            </div>

            {activeType === type && (
              <form onSubmit={handleSubmit} className="mb-3 p-2.5 bg-gray-50 rounded-lg flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="음식명"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-emerald-500"
                  required
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="칼로리(kcal)"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
                  >
                    저장
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-gray-50">
              {groupMeals.map((meal) => (
                <div key={meal.id} className="py-1.5 flex justify-between items-center text-xs">
                  <span className="text-gray-700">{meal.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-600">{meal.calories} kcal</span>
                    <button
                      type="button"
                      onClick={() => onDeleteMeal(meal.id)}
                      className="text-gray-300 hover:text-rose-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
};
