import React, { useState, useRef } from 'react';
import { Plus, Trash2, Camera, Loader2, Image as ImageIcon, X, Sparkles, Zap, Check } from 'lucide-react';
import { MealItem, MealType } from '../../types/diet';
import { analyzeMealPhoto, estimateNutritionFromText } from '../../services/visionService';

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

  // 식사 전 / 식사 후(잔반) 사진 슬롯
  const [beforeImageUrl, setBeforeImageUrl] = useState<string>('');
  const [afterImageUrl, setAfterImageUrl] = useState<string>('');

  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEstimatingText, setIsEstimatingText] = useState(false);

  const beforeFileInputRef = useRef<HTMLInputElement>(null);
  const afterFileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setCalories('');
    setCarbs(undefined);
    setProtein(undefined);
    setFat(undefined);
    setBeforeImageUrl('');
    setAfterImageUrl('');
    setIsCompressing(false);
    setIsAnalyzing(false);
    setIsEstimatingText(false);
    if (beforeFileInputRef.current) beforeFileInputRef.current.value = '';
    if (afterFileInputRef.current) afterFileInputRef.current.value = '';
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

  // 사진 분석 수행 함수 (1장 또는 2장 전/후 잔반 대조 분석)
  const triggerImageAnalysis = async (beforeImg: string, afterImg?: string) => {
    const imagesToAnalyze = [beforeImg, afterImg].filter(Boolean) as string[];
    if (imagesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('응답 시간이 초과되었습니다(15초). 다시 시도해 주세요.'));
        }, 15000);
      });

      const analysisPromise = analyzeMealPhoto(imagesToAnalyze);
      const result = await Promise.race([analysisPromise, timeoutPromise]);

      if (result.name) {
        setName(result.name);
      }