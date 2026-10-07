import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types/diet';
import { calculateBMR, calculateTargetCalories } from '../../services/profileService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<UserProfile>({ ...profile });
  const [weeklyMenuPlan, setWeeklyMenuPlan] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...profile });
      const savedMenu = localStorage.getItem('weekly_menu_plan') || '';
      setWeeklyMenuPlan(savedMenu);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const bmr = calculateBMR(formData);
  const targetCal = calculateTargetCalories(formData);

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

          {/* 주간 식단표 (구내식당 메뉴 등) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              주간 식단표 (구내식당 메뉴 등)
            </label>
            <textarea
              rows={4}
              value={weeklyMenuPlan}
              onChange={e => setWeeklyMenuPlan(e.target.value)}
              placeholder="예:&#10;월: 닭가슴살 볶음밥, 미역국&#10;화: 제육볶음, 된장찌개, 흑미밥&#10;수: 안동찜닭, 콩나물국"
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none resize-none leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              입력 시 Gemini AI가 사진 분석할 때 해당 식단표를 최우선 참고하여 분석합니다.
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
