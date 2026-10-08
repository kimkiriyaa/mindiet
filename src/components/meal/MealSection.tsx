import React, { useState, useRef } from 'react';
import { Plus, Trash2, Camera, Loader2, Image as ImageIcon, X, Sparkles, Zap, Check } from 'lucide-react';
import { MealItem, MealType } from '../../types/diet';
import { analyzeFoodImage, estimateNutritionFromText } from '../../services/visionService';

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

/**
 * 고해상도 모바일 이미지를 최대 800px로 리사이징하고 압축하여 Base64로 반환하는 유틸 함수
 */
const compressImage = (file: File, maxWidth = 800, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (error) => reject(error);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (error) => reject(error);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context is not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const MealSection: React.FC<MealSectionProps> = ({
  meals,
  onAddMeal,
  onDeleteMeal,
}) => {
  const [activeType, setActiveType] = useState<MealType | null>(null);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [carbs, setCarbs] = useState<number | undefined>(undefined);
  const [protein, setProtein] = useState<number | undefined>(undefined);
  const [fat, setFat] = useState<number | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEstimatingText, setIsEstimatingText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setCalories('');
    setCarbs(undefined);
    setProtein(undefined);
    setFat(undefined);
    setImageUrl('');
    setIsCompressing(false);
    setIsAnalyzing(false);
    setIsEstimatingText(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenType = (type: MealType) => {
    if (activeType === type) {
      setActiveType(null);
      resetForm();
    } else {
      setActiveType(type);
      resetForm();
    }
  };

  // 사진 분석 수행 함수 (15초 타임아웃 및 확실한 에러 핸들링 보장)
  const triggerImageAnalysis = async (imgDataUrl: string) => {
    if (!imgDataUrl) return;

    setIsAnalyzing(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('응답 시간이 초과되었습니다(15초). 다시 시도해 주세요.'));
        }, 15000);
      });

      const analysisPromise = analyzeFoodImage(imgDataUrl);
      const result = await Promise.race([analysisPromise, timeoutPromise]);

      if (result.name) {
        setName(result.name);
      }
      if (result.calories !== undefined) {
        const calNum = Number(result.calories);
        setCalories(Number.isNaN(calNum) ? '0' : calNum.toString());
      }
      setCarbs(Number.isNaN(Number(result.carbs)) ? 0 : Number(result.carbs));
      setProtein(Number.isNaN(Number(result.protein)) ? 0 : Number(result.protein));
      setFat(Number.isNaN(Number(result.fat)) ? 0 : Number(result.fat));
    } catch (error: any) {
      console.error('음식 이미지 분석 실패:', error);
      const message = error?.message || 'AI 분석에 실패했습니다. 사진이 음식인지 확인하시거나 API 키 설정을 확인해 주세요.';
      alert(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 텍스트 기반 영양성분 AI 추정 함수
  const handleEstimateTextNutrition = async () => {
    if (!name.trim()) {
      alert('음식 이름을 먼저 입력해 주세요 (예: 바나나 1개, 닭가슴살 100g).');
      return;
    }

    setIsEstimatingText(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('응답 시간이 초과되었습니다(15초). 다시 시도해 주세요.'));
        }, 15000);
      });

      const estimatePromise = estimateNutritionFromText(name.trim());
      const result = await Promise.race([estimatePromise, timeoutPromise]);

      if (result.name && !name.trim()) {
        setName(result.name);
      }
      if (result.calories !== undefined) {
        const calNum = Number(result.calories);
        setCalories(Number.isNaN(calNum) ? '0' : calNum.toString());
      }
      setCarbs(Number.isNaN(Number(result.carbs)) ? 0 : Number(result.carbs));
      setProtein(Number.isNaN(Number(result.protein)) ? 0 : Number(result.protein));
      setFat(Number.isNaN(Number(result.fat)) ? 0 : Number(result.fat));
    } catch (error: any) {
      console.error('음식 텍스트 추정 실패:', error);
      const message = error?.message || '영양성분 계산에 실패했습니다. API 키 설정을 확인해 주세요.';
      alert(message);
    } finally {
      setIsEstimatingText(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file);
      setImageUrl(compressedDataUrl);
      setIsCompressing(false);

      // 사진 업로드 즉시 AI 자동 분석 실행
      await triggerImageAnalysis(compressedDataUrl);
    } catch (err: any) {
      console.error('이미지 압축 처리 오류:', err);
      alert('이미지를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsCompressing(false);
      setIsAnalyzing(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeType) {
      alert('식사 분류(아침, 점심, 저녁, 간식)를 선택해 주세요.');
      return;
    }
    if (!name.trim()) {
      alert('음식 이름을 입력해 주세요.');
      return;
    }
    if (!calories.trim()) {
      alert('칼로리를 입력해 주세요.');
      return;
    }

    const parsedCalories = Number(calories);
    const safeCalories = Number.isNaN(parsedCalories) ? 0 : Math.max(0, parsedCalories);

    onAddMeal({
      type: activeType,
      name: name.trim(),
      calories: safeCalories,
      carbs: carbs !== undefined && !Number.isNaN(carbs) ? carbs : undefined,
      protein: protein !== undefined && !Number.isNaN(protein) ? protein : undefined,
      fat: fat !== undefined && !Number.isNaN(fat) ? fat : undefined,
      imageUrl: imageUrl || undefined,
    });

    resetForm();
    setActiveType(null);
  };

  const isBusy = isCompressing || isAnalyzing || isEstimatingText;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-700">식단 기록 (In) 🍽️</h2>
      </div>

      <div className="space-y-2.5">
        {mealTypes.map(({ type, label }) => {
          const groupMeals = meals.filter((m) => m.type === type);
          const subtotal = groupMeals.reduce((acc, m) => {
            const cal = Number(m.calories);
            return acc + (Number.isNaN(cal) ? 0 : cal);
          }, 0);
          const isOpen = activeType === type;

          return (
            <div key={type} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">{label}</span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {subtotal.toLocaleString()} kcal
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenType(type)}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 ${
                    isOpen
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isOpen ? '닫기' : '기록하기'}</span>
                </button>
              </div>

              {/* 입력 폼 */}
              {isOpen && (
                <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder={
                          isAnalyzing
                            ? 'AI가 음식 이름 파악 중...'
                            : isEstimatingText
                            ? 'AI 계산 중...'
                            : '음식 이름 (예: 바나나 1개, 삼겹살)'
                        }
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isBusy}
                        className="w-full text-xs px-3 py-2.5 pr-20 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleEstimateTextNutrition}
                        disabled={isBusy || !name.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-0.5"
                        title="입력한 음식명으로 칼로리와 영양소를 자동 계산합니다"
                      >
                        {isEstimatingText ? (
                          <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>계산 중</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-2.5 h-2.5" />
                            <span>AI 계산</span>
                          </>
                        )}
                      </button>
                    </div>

                    <input
                      type="number"
                      placeholder={isBusy ? '계산 중...' : '칼로리(kcal)'}
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      disabled={isBusy}
                      className="w-24 text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 font-semibold text-slate-800"
                      required
                    />
                  </div>

                  {/* 탄단지 자동 계산 수치 표시 안내 (계산된 경우) */}
                  {(carbs !== undefined || protein !== undefined || fat !== undefined) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-medium">
                      <span>탄수화물 {carbs ?? 0}g</span>
                      <span>·</span>
                      <span>단백질 {protein ?? 0}g</span>
                      <span>·</span>
                      <span>지방 {fat ?? 0}g</span>
                    </div>
                  )}

                  {/* 사진 첨부 영역 */}
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      className="hidden"
                    />

                    {!imageUrl ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isBusy}
                        className="w-full py-2.5 px-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-[0.99] transition flex items-center justify-center gap-1.5 text-xs font-medium"
                      >
                        {isCompressing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                            <span>사진 최적화 중...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-emerald-600" />
                            <span>사진 촬영 또는 갤러리에서 선택 (AI 자동 분석)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center gap-3">
                        <img
                          src={imageUrl}
                          alt="선택한 식단 미리보기"
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 text-xs min-w-0">
                          {isAnalyzing ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold animate-pulse">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>AI가 칼로리 계산 중...</span>
                            </div>
                          ) : (
                            <>
                              <p className="font-semibold text-slate-700 truncate">식단 사진 첨부됨</p>
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => triggerImageAnalysis(imageUrl)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>AI 분석 다시 시도</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={isAnalyzing}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 식단 추가 완료/저장 버튼 */}
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>AI 처리 중...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>식단 기록 추가하기</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* 등록된 식단 목록 */}
              {groupMeals.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-50 divide-y divide-slate-50">
                  {groupMeals.map((meal) => (
                    <div key={meal.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {meal.imageUrl ? (
                          <img
                            src={meal.imageUrl}
                            alt={meal.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-700">{