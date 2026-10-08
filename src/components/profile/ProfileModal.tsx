import React, { useState, useEffect, useRef } from 'react';
import { Camera, Loader2, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types/diet';
import { calculateBMR, calculateTargetCalories } from '../../services/profileService';
import { parseWeeklyMenuFromImage } from '../../services/visionService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

const compressMenuImage = (file: File, maxWidth = 1200, quality = 0.85): Promise<string> => {
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
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<UserProfile>({ ...profile });
  const [weeklyMenuPlan, setWeeklyMenuPlan] = useState<string>('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const menuFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...profile });
      const savedMenu = localStorage.getItem('weekly_menu_plan') || '';
      setWeeklyMenuPlan(savedMenu);
      setIsOcrProcessing(false);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const bmr = calculateBMR(formData);
  const targetCal = calculateTargetCalories(formData);

  const handleMenuImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    try {
      const base64Data = await compressMenuImage(file);
      const parsedText = await parseWeeklyMenuFromImage(base64Data);

      if (parsedText && parsedText.trim().length > 0) {
        setWeeklyMenuPlan(parsedText.trim());
        localStorage.setItem('weekly_menu_plan', parsedText.trim());
        alert('식단표 사진에서 메뉴를 성공적으로 추출했습니다!');
      }
    } catch (err: any) {
      console.error('식단표 사진 OCR 실패:', err);
      alert(err?.message || '식단표 사진을 읽는 중 문제가 발생했습니다.');
    } finally {
      setIsOcrProcessing(false);
      if (menuFileInputRef.current) {
        menuFileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('weekly_menu_plan', weeklyMenuPlan.trim());
    if (formData.geminiApiKey) {
      localStorage.setItem('min_diet_gemini_api_key', formData.geminiApiKey.trim());
    }
    onSaveProfile(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl transition-all my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-slate-800">내 신체 정보 및 설정</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">성별</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, gender: 'female' }))}
                className={`py-2 text-sm font-semibold rounded-xl border transition ${
                  formData.gender === 'female'
                    ? 'border-rose-500 bg-rose-50 text-rose-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                여성
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, gender: 'male' }))}
                className={`py-2 text-sm font-semibold rounded-xl border transition ${
                  formData.gender === 'male'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                남성
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">생년월일</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">키 (cm)</label>
              <input
                type="number"
                min="100"
                max="250"
                value={formData.height || ''}
                onChange={e => setFormData({ ...formData, height: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="165"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">몸무게 (kg)</label>
              <input
                type="number"
                min="30"
                max="250"
                step="0.1"
                value={formData.weight || ''}
                onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="60"
                required
              />
            </div>
          </div>

          {/* 주간 식단표 (구내식당 메뉴 등) + 사진 OCR 기능 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600">
                주간 식단표 (구내식당 메뉴 등)
              </label>
              <input
                type="file"
                accept="image/*"
                ref={menuFileInputRef}
                onChange={handleMenuImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => menuFileInputRef.current?.click()}
                disabled={isOcrProcessing}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-100 disabled:text-slate-400 px-2.5 py-1 rounded-lg transition"
              >
                {isOcrProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                    <span>식단표 인식 중...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3 h-3 text-emerald-600" />
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                    <span>사진으로 자동 입력</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={4}
              value={weeklyMenuPlan}
              onChange={e => setWeeklyMenuPlan(e.target.value)}
              placeholder="예:&#10;월: 닭가슴살 볶음밥, 미역국&#10;화: 제육볶음, 된장찌개, 흑미밥&#10;수: 안동찜닭, 콩나물국"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none resize-none leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              식단표 안내문 사진을 올리거나 텍스트를 적어두면 Gemini AI가 음식 사진 분석 시 최우선 참고합니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Gemini API 키 (선택)
            </label>
            <input
              type="password"
              value={formData.geminiApiKey || ''}
              onChange={e => setFormData({ ...formData, geminiApiKey: e.target.value })}
              placeholder="AI 사진 분석에 사용됩니다"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              .env가 없을 경우 위 키를 우선 적용합니다.
            </p>
          </div>

          {/* 계산 결과 안내 카드 */}
          <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-100 space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>기초대사량(BMR)</span>
              <span className="font-semibold text-slate-800">{bmr.toLocaleString()} kcal</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-semibold pt-1 border-t border-slate-200">
              <span>추천 목표 칼로리</span>
              <span>{targetCal.toLocaleString()} kcal</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-600 text-sm hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 font-semibold text-white text-sm shadow-md shadow-emerald-200 hover:bg-emerald-600 active:scale-95 transition"
            >
              저장 및 반영
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
