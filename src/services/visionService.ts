export interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  description?: string;
}

export interface ExerciseAnalysisResult {
  calories: number;
  description: string;
}

const getApiKey = (): string => {
  const envKey = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY
    ? String((import.meta as any).env.VITE_GEMINI_API_KEY).trim()
    : '';
  const localKey = (localStorage.getItem('min_diet_gemini_api_key') || '').trim();
  const apiKey = envKey || localKey;

  if (!apiKey || apiKey.length === 0) {
    const errorMsg = 'Gemini API 키가 설정되지 않았습니다. .env(VITE_GEMINI_API_KEY) 또는 설정에서 API 키를 입력해 주세요.';
    console.error(`[VisionService] API Key 누락: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  return apiKey;
};

/**
 * 1. 로컬 영양 데이터베이스 (대표 다소비 식품 70종)
 * 서버 통신 없이 0ms 즉시 반환
 */
const COMMON_FOODS: Record<string, { calories: number; carbs: number; protein: number; fat: number; name: string }> = {
  // 밥 및 탄수화물
  '밥': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥(백미 200g)' },
  '공기밥': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥(백미 200g)' },
  '백미': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥(백미 200g)' },
  '현미밥': { calories: 280, carbs: 60, protein: 6, fat: 1, name: '현미밥 1공기' },
  '잡곡밥': { calories: 285, carbs: 62, protein: 6, fat: 1, name: '잡곡밥 1공기' },
  '볶음밥': { calories: 520, carbs: 70, protein: 12, fat: 20, name: '볶음밥 1인분' },
  '김치볶음밥': { calories: 480, carbs: 68, protein: 11, fat: 16, name: '김치볶음밥 1인분' },
  '고구마': { calories: 140, carbs: 32, protein: 2, fat: 0, name: '찐고구마 1개(120g)' },
  '감자': { calories: 110, carbs: 26, protein: 2, fat: 0, name: '삶은 감자 1개' },
  '식빵': { calories: 150, carbs: 28, protein: 5, fat: 2, name: '식빵 2쪽' },
  '베이글': { calories: 280, carbs: 56, protein: 11, fat: 2, name: '플레인 베이글 1개' },
  '오트밀': { calories: 150, carbs: 27, protein: 5, fat: 3, name: '오트밀 1그릇(40g)' },

  // 단백질 및 육류
  '닭가슴살': { calories: 130, carbs: 0, protein: 26, fat: 2, name: '닭가슴살 100g' },
  '삶은계란': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '삶은 달걀 1개' },
  '계란': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '달걀 1개' },
  '달걀': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '달걀 1개' },
  '계란후라이': { calories: 100, carbs: 1, protein: 6, fat: 8, name: '계란후라이 1개' },
  '두부': { calories: 85, carbs: 2, protein: 9, fat: 4, name: '두부 반모(100g)' },
  '삼겹살': { calories: 550, carbs: 0, protein: 25, fat: 48, name: '삼겹살 200g' },
  '목살': { calories: 420, carbs: 0, protein: 35, fat: 30, name: '돼지 목살 200g' },
  '소고기': { calories: 350, carbs: 0, protein: 38, fat: 20, name: '소고기 등심 150g' },
  '제육볶음': { calories: 480, carbs: 18, protein: 28, fat: 32, name: '제육볶음 1인분' },
  '불고기': { calories: 380, carbs: 20, protein: 28, fat: 20, name: '소불고기 1인분' },
  '돈까스': { calories: 650, carbs: 50, protein: 28, fat: 38, name: '돈까스 1인분' },
  '치킨': { calories: 320, carbs: 10, protein: 25, fat: 20, name: '후라이드 치킨 1조각' },
  '연어': { calories: 220, carbs: 0, protein: 22, fat: 14, name: '연어 구이 1토막(120g)' },
  '고등어': { calories: 250, carbs: 0, protein: 20, fat: 18, name: '고등어 구이 1토막' },

  // 다이어트 / 보충식
  '프로틴': { calories: 120, carbs: 3, protein: 24, fat: 1, name: '단백질 쉐이크 1회' },
  '단백질쉐이크': { calories: 120, carbs: 3, protein: 24, fat: 1, name: '단백질 쉐이크 1회' },
  '그릭요거트': { calories: 100, carbs: 4, protein: 10, fat: 5, name: '그릭요거트 100g' },
  '요거트': { calories: 90, carbs: 12, protein: 4, fat: 3, name: '플레인 요거트 1개' },
  '샐러드': { calories: 180, carbs: 15, protein: 5, fat: 11, name: '기본 샐러드 1그릇(드레싱 포함)' },
  '닭가슴살샐러드': { calories: 280, carbs: 15, protein: 28, fat: 12, name: '닭가슴살 샐러드 1그릇' },
  '서브웨이': { calories: 380, carbs: 45, protein: 25, fat: 10, name: '서브웨이 샌드위치 15cm' },

  // 과일 및 간식
  '바나나': { calories: 105, carbs: 27, protein: 1, fat: 0, name: '바나나 1개' },