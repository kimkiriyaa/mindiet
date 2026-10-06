import React, { useState } from 'react';
import { WorkoutItem } from '../../types/diet';
import { Plus, Trash2 } from 'lucide-react';

interface WorkoutSectionProps {
  workouts: WorkoutItem[];
  onAddWorkout: (workout: Omit<WorkoutItem, 'id'>) => void;
  onDeleteWorkout: (id: string) => void;
}

export const WorkoutSection: React.FC<WorkoutSectionProps> = ({
  workouts,
  onAddWorkout,
  onDeleteWorkout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [burnedCalories, setBurnedCalories] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !burnedCalories) return;
    onAddWorkout({
      name,
      burnedCalories: Number(burnedCalories),
      durationMinutes: Number(durationMinutes) || 0,
    });
    setName('');
    setBurnedCalories('');
    setDurationMinutes('');
    setIsOpen(false);
  };

  const totalWorkoutBurn = workouts.reduce((s, w) => s + w.burnedCalories, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-gray-500">운동 기록 (Out)</h2>
        <span className="text-xs text-orange-600 font-semibold">총 -{totalWorkoutBurn} kcal</span>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">활동 및 운동 추가하기</span>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-orange-600 hover:text-orange-700 text-xs font-semibold flex items-center gap-0.5"
          >
            <Plus className="w-3.5 h-3.5" /> 기록
          </button>
        </div>

        {isOpen && (
          <form onSubmit={handleSubmit} className="mb-3 p-2.5 bg-gray-50 rounded-lg flex flex-col gap-2">
            <input
              type="text"
              placeholder="운동 종류 (예: 러닝, 헬스)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-orange-500"
              required
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="시간(분)"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-1/2 text-xs px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-orange-500"
              />
              <input
                type="number"
                placeholder="소모 칼로리(kcal)"
                value={burnedCalories}
                onChange={(e) => setBurnedCalories(e.target.value)}
                className="w-1/2 text-xs px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-orange-500"
                required
              />
              <button
                type="submit"
                className="whitespace-nowrap px-3 py-1.5 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700"
              >
                저장
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-50">
          {workouts.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-3">기록된 운동이 없습니다.</p>
          ) : (
            workouts.map((workout) => (
              <div key={workout.id} className="py-2 flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-800 font-medium block">{workout.name}</span>
                  {workout.durationMinutes > 0 && (
                    <span className="text-[11px] text-gray-400">{workout.durationMinutes}분 수행</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-orange-600">-{workout.burnedCalories} kcal</span>
                  <button
                    type="button"
                    onClick={() => onDeleteWorkout(workout.id)}
                    className="text-gray-300 hover:text-rose-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
