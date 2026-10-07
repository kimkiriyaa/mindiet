import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LoginView } from './components/auth/LoginView';
import { HeaderNav } from './components/common/HeaderNav';
import { CalorieDashboardCard } from './components/dashboard/CalorieDashboardCard';
import { CalorieSummaryCard } from './components/dashboard/CalorieSummaryCard';
import { WaterTrackerCard } from './components/dashboard/WaterTrackerCard';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { UserSession, UserProfile, DailyLog, MealItem } from './types/diet';
import { loadUserProfile, saveUserProfile } from './services/profileService';
import { loadDailyLog, saveDailyLog } from './services/storageService';
import { calculateBMR, calculateTDEE } from './utils/nutritionCalc';

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('diet_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentDate, setCurrentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    return (
      loadUserProfile() || {
        birthDate: '1995-01-01',
        gender: 'male',
        height: 175,
        weight: 70,
        activityLevel: 'moderate',
        targetWeight: 65,
        targetCalories: 2000,
        targetWater: 2000,
      }
    );
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    return (
      loadDailyLog(currentDate) || {
        date: currentDate,
        targetCalories: profile.targetCalories || 2000,
        steps: 0,
        meals: [],
        waterIntake: 0,
      }
    );
  });

  useEffect(() => {
    const log = loadDailyLog(currentDate);
    if (log) {
      setDailyLog(log);
    } else {
      setDailyLog({
        date: currentDate,
        targetCalories: profile.targetCalories || 2000,
        steps: 0,
        meals: [],
        waterIntake: 0,
      });
    }
  }, [currentDate, profile.targetCalories]);

  const handleUpdateLog = useCallback(
    (newLog: DailyLog) => {
      setDailyLog(newLog);
      saveDailyLog(newLog);
    },
    []
  );

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('diet_session', JSON.stringify(newSession));
  };

  const handlePrevDate = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next.toISOString().split('T')[0]);
  };

  const handleSaveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    saveUserProfile(newProfile);
    setIsProfileOpen(false);
  };

  const handleAddMeal = (meal: Omit<MealItem, 'id'>) => {
    const newMeal: MealItem = {
      ...meal,
      id: Date.now().toString(),
    };
    const updatedMeals = [...dailyLog.meals, newMeal];
    handleUpdateLog({
      ...dailyLog,
      meals: updatedMeals,
    });
  };

  const handleDeleteMeal = (id: string) => {
    const updatedMeals = dailyLog.meals.filter((m) => m.id !== id);
    handleUpdateLog({
      ...dailyLog,
      meals: updatedMeals,
    });
  };

  const handleStepsChange = (steps: number) => {
    handleUpdateLog({
      ...dailyLog,
      steps,
    });
  };

  const handleAddWater = (amount: number) => {
    const newAmount = Math.max(0, (dailyLog.waterIntake || 0) + amount);
    handleUpdateLog({
      ...dailyLog,
      waterIntake: newAmount,
    });
  };

  const burnedStepCalories = useMemo(() => {
    return Math.round((dailyLog.steps || 0) * 0.04);
  }, [dailyLog.steps]);

  const nutritionTotals = useMemo(() => {
    return dailyLog.meals.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        fat: acc.fat + (Number(item.fat) || 0),
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );
  }, [dailyLog.meals]);

  const totalInCalories = nutritionTotals.calories;
  const targetCalories = dailyLog.targetCalories || profile.targetCalories || 2000;
  const netCalories = totalInCalories - burnedStepCalories;
  const remainingCalories = targetCalories - netCalories;

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <HeaderNav
          currentDate={currentDate}
          onPrevDate={handlePrevDate}
          onNextDate={handleNextDate}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        <CalorieDashboardCard
          netCalories={netCalories}
          targetCalories={targetCalories}
          remainingCalories={remainingCalories}
          totalInCalories={totalInCalories}
          burnedStepCalories={burnedStepCalories}
        />

        <CalorieSummaryCard
          targetCalories={targetCalories}
          totals={nutritionTotals}
        />

        <WaterTrackerCard
          waterIntake={dailyLog.waterIntake || 0}
          targetWater={profile.targetWater || 2000}
          onAddWater={handleAddWater}
        />

        <MealSection
          meals={dailyLog.meals}
          onAddMeal={handleAddMeal}
          onDeleteMeal={handleDeleteMeal}
        />

        <WorkoutSection
          steps={dailyLog.steps}
          onStepsChange={handleStepsChange}
          burnedCalories={burnedStepCalories}
        />
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
};

export default App;
