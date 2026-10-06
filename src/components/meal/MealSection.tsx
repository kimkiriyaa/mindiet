import React, { useState, useRef } from 'react';
import { Plus, Trash2, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { MealItem, MealType } from '../../types/diet';
import { analyzeFoodImage } from '../../services/visionService';

interface MealSectionProps {
  meals: MealItem[];
  onAddMeal: (meal: Omit<MealItem, 'id'>) => void;
  onDeleteMeal: (id: string) => void;
}

const mealTypes: { type: MealType; label: string }[] = [
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
  const [selectedType, setSelectedType] = useState<MealType>('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiAnalysis = async () => {
    if (!imagePreview) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeFoodImage(imagePreview);
      if (result) {
        setName(result.name || '');
        setCalories(result.calories ? String(result.calories) : '');
        setCarbs(result.carbs ? String(result.carbs) : '');
        setProtein(result.protein ? String(result.protein) : '');
        setFat(result.fat ? String(result.fat) : '');
      }
    } catch (err) {
      alert('AI 분석 중 오류가 발생했습니다. API 키를 확인해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !calories) return;

    onAddMeal({
      type: selectedType,
      name,
      calories: Number(calories) || 0,
      carbs: carbs ? Number(carbs) : undefined,
      protein: protein ? Number(protein) : undefined,
      fat: fat ? Number(fat) : undefined,
      imageUrl: imagePreview || undefined,
    });

    setName('');
    setCalories('');
    setCarbs('');
    setProtein('');
    setFat('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">식단 기록 (In)</h2>
      </div>

      {/* 식단 분류 탭 */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
        {mealTypes.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              selectedType === type
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 식단 추가 폼 */}
      <form onSubmit={handleSubmit} className="space-y-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="음식 이름 (예: 닭가슴살 샐러드)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number"
            placeholder="칼로리(kcal)"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="w-24 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* 탄단지 선택 입력 */}
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="탄수화물 (g)"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number"
            placeholder="단백질 (g)"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number"
            placeholder="지방 (g)"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* 사진 첨부 및 AI 분석 영역 */}
        <div className="flex items-center gap-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="food-image-input"
          />
          <label
            htmlFor="food-image-input"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            사진 선택
          </label>

          {imagePreview && (
            <button
              type="button"
              onClick={handleAiAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  분석 중...
                </>
              ) : (
                'AI 사진 분석'
              )}
            </button>
          )}

          <button
            type="submit"
            className="ml-auto flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600"
          >
            <Plus className="w-3.5 h-3.5" />
            등록
          </button>
        </div>

        {imagePreview && (
          <div className="mt-2 relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
            <img src={imagePreview} alt="미리보기" className="w-full h-full object-cover" />
          </div>
        )}
      </form>

      {/* 등록된 식단 목록 */}
      <div className="space-y-2">
        {meals.filter((m) => m.type === selectedType).length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            등록된 {mealTypes.find((t) => t.type === selectedType)?.label} 식단이 없습니다.
          </div>
        ) : (
          meals
            .filter((m) => m.type === selectedType)
            .map((meal) => (
              <div
                key={meal.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2.5">
                  {meal.imageUrl ? (
                    <img
                      src={meal.imageUrl}
                      alt={meal.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{meal.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {meal.carbs ? `탄 ${meal.carbs}g ` : ''}
                      {meal.protein ? `단 ${meal.protein}g ` : ''}
                      {meal.fat ? `지 ${meal.fat}g` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">{meal.calories} kcal</span>
                  <button
                    onClick={() => onDeleteMeal(meal.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};