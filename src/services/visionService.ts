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
 * 1. 로컬 영양 데이터베이스 (한국인 다소비 대표 식품 70종)
 * 서버 통신 없이 0ms 즉각 반환
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
  '사과': { calories: 95, carbs: 25, protein: 0, fat: 0, name: '사과 1개' },
  '토마토': { calories: 25, carbs: 5, protein: 1, fat: 0, name: '토마토 1개' },
  '방울토마토': { calories: 35, carbs: 7, protein: 2, fat: 0, name: '방울토마토 10알' },
  '견과류': { calories: 160, carbs: 6, protein: 5, fat: 14, name: '하루견과 1봉(25g)' },
  '아몬드': { calories: 160, carbs: 6, protein: 6, fat: 14, name: '아몬드 20알' },

  // 면류 및 분식
  '라면': { calories: 500, carbs: 75, protein: 10, fat: 16, name: '신라면 1봉지' },
  '신라면': { calories: 500, carbs: 75, protein: 10, fat: 16, name: '신라면 1봉지' },
  '짜파게티': { calories: 610, carbs: 90, protein: 11, fat: 20, name: '짜파게티 1봉지' },
  '떡볶이': { calories: 450, carbs: 80, protein: 8, fat: 8, name: '떡볶이 1인분' },
  '김밥': { calories: 400, carbs: 60, protein: 12, fat: 11, name: '일반 김밥 1줄' },
  '참치김밥': { calories: 480, carbs: 62, protein: 16, fat: 18, name: '참치김밥 1줄' },
  '만두': { calories: 280, carbs: 28, protein: 10, fat: 12, name: '찐만두 4개' },
  '우동': { calories: 420, carbs: 80, protein: 10, fat: 4, name: '우동 1그릇' },
  '파스타': { calories: 550, carbs: 75, protein: 18, fat: 18, name: '토마토 파스타 1인분' },

  // 카페 음료
  '아메리카노': { calories: 10, carbs: 1, protein: 1, fat: 0, name: '아이스 아메리카노 1잔' },
  '카페라떼': { calories: 150, carbs: 12, protein: 8, fat: 7, name: '카페라떼 1잔' },
  '라떼': { calories: 150, carbs: 12, protein: 8, fat: 7, name: '카페라떼 1잔' },
  '바닐라라떼': { calories: 220, carbs: 32, protein: 7, fat: 6, name: '바닐라라떼 1잔' },
  '콜라': { calories: 140, carbs: 35, protein: 0, fat: 0, name: '콜라 1캔(355ml)' },
  '제로콜라': { calories: 0, carbs: 0, protein: 0, fat: 0, name: '제로콜라 1캔' },
  '우유': { calories: 130, carbs: 10, protein: 6, fat: 7, name: '흰우유 1팩(200ml)' },
};

/**
 * 2. 로컬 운동 칼로리 공식 데이터베이스
 */
const COMMON_EXERCISES = [
  { keywords: ['헬스', '웨이트', '쇠질', '근력', '피트니스', '가슴', '하체', '등운동', '어깨'], met: 5.5, label: '웨이트 트레이닝' },
  { keywords: ['조깅', '러닝', '달리기', '런닝'], met: 8.0, label: '러닝/조깅' },
  { keywords: ['걷기', '산책', '걸음', '보행'], met: 3.5, label: '빠른 걷기' },
  { keywords: ['자전거', '사이클', '실내자전거'], met: 6.5, label: '사이클링' },
  { keywords: ['수영', '자유형'], met: 7.5, label: '수영' },
  { keywords: ['줄넘기'], met: 9.0, label: '줄넘기' },
  { keywords: ['계단', '천국의계단', '스텝밀'], met: 8.5, label: '계단 오르기' },
  { keywords: ['필라테스', '요가', '스트레칭'], met: 3.0, label: '필라테스/요가' },
  { keywords: ['등산', '트레킹'], met: 7.0, label: '등산' },
  { keywords: ['축구', '농구', '배드민턴', '테니스'], met: 7.0, label: '구기 운동' },
];

/**
 * fetch 요청에 타임아웃을 적용하는 헬퍼 함수
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * 1장 또는 2장(식사 전, 식사 후 잔반)의 사진을 받아 순 섭취량을 초고속 분석하는 함수
 */
export const analyzeMealPhoto = async (
  images: string | string[],
  userNotes?: string
): Promise<FoodVisionAnalysisResult> => {
  const apiKey = getApiKey();
  const imageList = Array.isArray(images) ? images.filter(Boolean) : [images].filter(Boolean);

  if (imageList.length === 0) {
    throw new Error('분석할 음식 이미지가 없습니다.');
  }

  const isMultiPhoto = imageList.length >= 2;
  const weeklyMenuPlan = (localStorage.getItem('weekly_menu_plan') || '').trim();
  const menuPlanContext = weeklyMenuPlan ? ` 식단표 참고:${weeklyMenuPlan}` : '';
  const notesContext = userNotes && userNotes.trim() ? ` 메모:${userNotes.trim()}` : '';

  const prompt = isMultiPhoto
    ? `1번 식사 전, 2번 식사 후 잔반. 잔반을 뺀 순 섭취량 영양소를 JSON으로만 반환: {"name": string, "calories": number, "carbs": number, "protein": number, "fat": number, "description": string}${menuPlanContext}${notesContext}`
    : `사진 속 음식의 1인분 예상 칼로리와 영양소를 JSON으로만 반환: {"name": string, "calories": number, "carbs": number, "protein": number, "fat": number, "description": string}${menuPlanContext}${notesContext}`;

  const parts: any[] = [{ text: prompt }];

  imageList.slice(0, 2).forEach((img) => {
    const splitArr = img.split(',');
    const rawBase64 = splitArr.length > 1 ? splitArr[1].trim() : splitArr[0].trim();
    const mimeMatch = img.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*?,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: rawBase64,
      },
    });
  });

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 250,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      15000
    );

    if (!response.ok) {
      throw new Error(`Gemini 응답 실패 [${response.status}]`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('분석 결과를 전달받지 못했습니다.');
    }

    const cleanedText = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      name: String(parsed.name || '알 수 없는 식단').trim(),
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
      description: parsed.description ? String(parsed.description).trim() : undefined,
    };
  } catch (err: any) {
    console.warn('[VisionService] 이미지 분석 실패:', err?.message || err);
    throw new Error('일시적으로 AI 분석 서버가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
  }
};

export const analyzeFoodImage = async (base64ImageWithHeader: string): Promise<FoodVisionAnalysisResult> => {
  return analyzeMealPhoto(base64ImageWithHeader);
};

/**
 * 텍스트 음식명을 입력받아 칼로리와 영양성분을 추정하는 함수
 * 로컬 영양 사전(COMMON_FOODS) 우선 조회로 0ms 즉시 응답
 */
export const estimateNutritionFromText = async (foodName: string): Promise<FoodVisionAnalysisResult> => {
  const trimmed = foodName.trim();
  if (!trimmed) {
    throw new Error('음식명을 입력해 주세요.');
  }

  // 1. 공백 및 특수문자 제거 후 로컬 사전 매칭 (0ms 즉시 반환)
  const normalized = trimmed.replace(/\s+/g, '').toLowerCase();
  for (const [key, value] of Object.entries(COMMON_FOODS)) {
    const cleanKey = key.replace(/\s+/g, '').toLowerCase();
    if (normalized.includes(cleanKey) || cleanKey.includes(normalized)) {
      return {
        name: trimmed,
        calories: value.calories,
        carbs: value.carbs,
        protein: value.protein,
        fat: value.fat,
      };
    }
  }

  // 2. 사전에 없는 경우 Gemini 2.5 Flash 호출
  try {
    const apiKey = getApiKey();
    const prompt = `Food: "${trimmed}". Output JSON only: {"name":"${trimmed}","calories":number,"carbs":number,"protein":number,"fat":number}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      8000
    );

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          name: String(parsed.name || trimmed).trim(),
          calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
          carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
          protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
          fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
        };
      }
    }
  } catch (err: any) {
    console.warn('[VisionService/Text] API 통신 실패, 기본 추정치로 안전 폴백:', err?.message || err);
  }

  // 3. API 실패 시 에러 팝업 대신 합리적인 기본 추정치(250kcal) 반환
  return {
    name: trimmed,
    calories: 250,
    carbs: 35,
    protein: 12,
    fat: 6,
  };
};

/**
 * 사용자 체중과 운동 내역 텍스트를 기반으로 예상 소모 칼로리를 추정하는 함수
 * 대표 운동 로컬 공식 우선 적용
 */
export const estimateExerciseCalories = async (
  exerciseText: string,
  currentWeight: number = 65
): Promise<ExerciseAnalysisResult> => {
  const trimmed = exerciseText.trim();
  if (!trimmed) {
    throw new Error('운동 내용을 입력해 주세요.');
  }

  const safeWeight = currentWeight > 0 ? currentWeight : 65;

  // 시간 파싱 (기본값: 30분)
  let durationMinutes = 30;
  const hourMatch = trimmed.match(/(\d+)\s*(시간|h|hr)/i);
  const minMatch = trimmed.match(/(\d+)\s*(분|m|min)/i);

  if (hourMatch) {
    durationMinutes = parseInt(hourMatch[1], 10) * 60;
    if (minMatch) {
      durationMinutes += parseInt(minMatch[1], 10);
    }
  } else if (minMatch) {
    durationMinutes = parseInt(minMatch[1], 10);
  }

  durationMinutes = Math.min(300, Math.max(5, durationMinutes));

  // 1. 대표 운동 키워드 로컬 매칭 (0ms 즉시 반환)
  for (const item of COMMON_EXERCISES) {
    if (item.keywords.some((k) => trimmed.includes(k))) {
      // 칼로리 소모 공식: MET * 체중(kg) * (시간(분) / 60) * 1.05
      const burned = Math.round(item.met * safeWeight * (durationMinutes / 60) * 1.05);
      return {
        calories: burned,
        description: `${item.label} ${durationMinutes}분 기준 예상 소모량`,
      };
    }
  }

  // 2. 사전에 없는 경우 Gemini 2.5 Flash 호출
  try {
    const apiKey = getApiKey();
    const prompt = `Weight: ${safeWeight}kg, Exercise: "${trimmed}". Output JSON only: {"calories": number, "description": string}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      8000
    );

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
          description: parsed.description ? String(parsed.description).trim() : `${trimmed} 예상 소모량`,
        };
      }
    }
  } catch (err: any) {
    console.warn('[VisionService/Exercise] API 통신 실패, 기본 추정치로 안전 폴백:', err?.message || err);
  }

  // 3. API 실패 시 중강도 기본 운동(MET 5.0) 공식으로 안전 계산
  const fallbackBurned = Math.round(5.0 * safeWeight * (durationMinutes / 60) * 1.05);
  return {
    calories: fallbackBurned,
    description: `${trimmed} (${durationMinutes}분 기준 예상치)`,
  };
};

/**
 * 주간 식단표 사진(구내식당 안내표 등)에서 날짜/요일별 식단 메뉴를 추출하는 함수
 */
export const parseWeeklyMenuFromImage = async (base64ImageWithHeader: string): Promise<string> => {
  const apiKey = getApiKey();

  const parts = base64ImageWithHeader.split(',');
  const rawBase64 = parts.length > 1 ? parts[1].trim() : parts[0].trim();
  const mimeTypeMatch = base64ImageWithHeader.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*?,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

  const prompt = `식단표 사진의 요일/일자별 메뉴를 줄단위 텍스트로만 요약 출력하세요. 사족 금지.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: rawBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 400,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      15000
    );

    if (!response.ok) {
      throw new Error(`식단표 인식 실패 [${response.status}]`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (candidateText && candidateText.trim().length > 0) {
      return candidateText.trim();
    }
  } catch (err: any) {
    console.warn('[VisionService/MenuOCR] OCR 실패:', err?.message || err);
  }

  throw new Error('식단표 사진을 분석하지 못했습니다. 글자가 선명한 사진으로 다시 시도해 주세요.');
};
