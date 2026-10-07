import React, { useState, useEffect, useMemo } from 'react';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Flame,
  Utensils,
  Footprints,
  Droplet,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';

type PeriodTab = 'daily' | 'weekly' | 'monthly';
const DEFAULT_TARGET_CALORIES = 1700;
const DEFAULT_TARGET_WATER = 2000;

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('min_diet_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [isProfileOpen, setIsProfileOpen] =