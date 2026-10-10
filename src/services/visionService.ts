export interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  quantity?: number;
  unit?: string;
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
 * [속도 개선] 클라이언트 측 Canvas 기반 이미지 리사이징 & 압축 (최대 1024px, JPEG 0.75 품질)
 */
export const resizeAndCompressImage = (
  base64Str: string,
  maxDimension = 1024,
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(base64Str);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(base64Str);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      resolve(base64Str);
    };

    img.src = base64Str;
  });
};

/**
 * 로컬 영양 데이터베이스 (기본 단품 기준)
 */
const COMMON_FOODS: Record<string, { calories: number; carbs: number; protein: number; fat: number; name: string; unit: string }> = {
  // 밥 및 탄수화물
  '밥': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥', unit: '공기' },
  '공기밥': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥', unit: '공기' },
  '백미': { calories: 300, carbs: 65, protein: 5, fat: 1, name: '공기밥(백미 200g)', unit: '공기' },
  '현미밥': { calories: 280, carbs: 60, protein: 6, fat: 1, name: '현미밥', unit: '공기' },
  '잡곡밥': { calories: 285, carbs: 62, protein: 6, fat: 1, name: '잡곡밥', unit: '공기' },
  '볶음밥': { calories: 520, carbs: 70, protein: 12, fat: 20, name: '볶음밥', unit: '인분' },
  '김치볶음밥': { calories: 480, carbs: 68, protein: 11, fat: 16, name: '김치볶음밥', unit: '인분' },
  '고구마': { calories: 140, carbs: 32, protein: 2, fat: 0, name: '찐고구마(120g)', unit: '개' },
  '감자': { calories: 110, carbs: 26, protein: 2, fat: 0, name: '삶은 감자', unit: '개' },
  '식빵': { calories: 75, carbs: 14, protein: 2.5, fat: 1, name: '식빵', unit: '쪽' },
  '베이글': { calories: 280, carbs: 56, protein: 11, fat: 2, name: '플레인 베이글', unit: '개' },
  '오트밀': { calories: 150, carbs: 27, protein: 5, fat: 3, name: '오트밀(40g)', unit: '그릇' },

  // 단백질 및 육류
  '닭가슴살': { calories: 130, carbs: 0, protein: 26, fat: 2, name: '닭가슴살 100g', unit: '팩' },
  '삶은계란': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '삶은 달걀', unit: '개' },
  '계란': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '달걀', unit: '개' },
  '달걀': { calories: 75, carbs: 1, protein: 6, fat: 5, name: '달걀', unit: '개' },
  '계란후라이': { calories: 100, carbs: 1, protein: 6, fat: 8, name: '계란후라이', unit: '개' },
  '두부': { calories: 85, carbs: 2, protein: 9, fat: 4, name: '두부(100g)', unit: '모' },
  '삼겹살': { calories: 550, carbs: 0, protein: 25, fat: 48, name: '삼겹살 200g', unit: '인분' },
  '목살': { calories: 420, carbs: 0, protein: 35, fat: 30, name: '돼지 목살 200g', unit: '인분' },
  '소고기': { calories: 350, carbs: 0, protein: 38, fat: 20, name: '소고기 등심 150g', unit: '인분' },
  '제육볶음': { calories: 480, carbs: 18, protein: 28, fat: 32, name: '제육볶음', unit: '인분' },
  '불고기': { calories: 380, carbs: 20, protein: 28, fat: 20, name: '소불고기', unit: '인분' },
  '돈까스': { calories: 650, carbs: 50, protein: 28, fat: 38, name: '돈까스', unit: '인분' },
  '치킨': { calories: 320, carbs: 10, protein: 25, fat: 20, name: '후라이드 치킨', unit: '조각' },
  '연어': { calories: 220, carbs: 0, protein: 22, fat: 14, name: '연어 구이 1토막(120g)', unit: '토막' },
  '고등어': { calories: 250, carbs: 0, protein: 20, fat: 18, name: '고등어 구이 1토막', unit: '토막' },

  // 다이어트 / 보충식
  '프로틴': { calories: 120, carbs: 3, protein: 24, fat: 1, name: '단백질 쉐이크', unit: '잔' },
  '단백질쉐이크': { calories: 120, carbs: 3, protein: 24, fat: 1, name: '단백질 쉐이크', unit: '잔' },
  '그릭요거트': { calories: 100, carbs: 4, protein: 10, fat: 5, name: '그릭요거트 100g', unit: '개' },
  '요거트': { calories: 90, carbs: 12, protein: 4, fat: 3, name: '플레인 요거트', unit: '개' },
  '샐러드': { calories: 180, carbs: 15, protein: 5, fat: 11, name: '기본 샐러드', unit: '그릇' },
  '닭가슴살샐러드': { calories: 280, carbs: 15, protein: 28, fat: 12, name: '닭가슴살 샐러드', unit: '그릇' },
  '서브웨이': { calories: 380, carbs: 45, protein: 25, fat: 10, name: '서브웨이 샌드위치 15cm', unit: '개' },

  // 과일 및 간식
  '바나나': { calories: 105, carbs: 27, protein: 1, fat: 0, name: '바나나', unit: '개' },
  '사과': { calories: 95, carbs: 25, protein: 0, fat: 0, name: '사과', unit: '개' },
  '토마토': { calories: 25, carbs: 5, protein: 1, fat: 0, name: '토마토', unit: '개' },
  '방울토마토': { calories: 3.5, carbs: 0.7, protein: 0.2, fat: 0, name: '방울토마토', unit: '알' },
  '견과류': { calories: 160, carbs: 6, protein: 5, fat: 14, name: '하루견과', unit: '봉' },
  '아몬드': { calories: 8, carbs: 0.3, protein: 0.3, fat: 0.7, name: '아몬드', unit: '알' },

  // 면류 및 분식
  '라면': { calories: 500, carbs: 75, protein: 10, fat: 16, name: '라면', unit: '봉지' },
  '신라면': { calories: 500, carbs: 75, protein: 10, fat: 16, name: '신라면', unit: '봉지' },
  '짜파게티': { calories: 610, carbs: 90, protein: 11, fat: 20, name: '짜파게티', unit: '봉지' },
  '떡볶이': { calories: 450, carbs: 80, protein: 8, fat: 8, name: '떡볶이', unit: '인분' },
  '김밥': { calories: 400, carbs: 60, protein: 12, fat: 11, name: '김밥', unit: '줄' },
  '참치김밥': { calories: 480, carbs: 62, protein: 16, fat: 18, name: '참치김밥', unit: '줄' },
  '만두': { calories: 70, carbs: 7, protein: 2.5, fat: 3, name: '만두', unit: '개' },
  '우동': { calories: 420, carbs: 80, protein: 10, fat: 4, name: '우동', unit: '그릇' },
  '파스타': { calories: 550, carbs: 75, protein: 18, fat: 18, name: '파스타', unit: '인분' },

  // 카페 음료
  '아메리카노': { calories: 10, carbs: 1, protein: 1, fat: 0, name: '아메리카노', unit: '잔' },
  '카페라떼': { calories: 150, carbs: 12, protein: 8, fat: 7, name: '카페라떼', unit: '잔' },
  '라떼': { calories: 150, carbs: 12, protein: 8, fat: 7, name: '카페라떼', unit: '잔' },
  '바닐라라떼': { calories: 220, carbs: 32, protein: 7, fat: 6, name: '바닐라라떼', unit: '잔' },
  '콜라': { calories: 140, carbs: 35, protein: 0, fat: 0, name: '콜라 1캔(355ml)', unit: '캔' },
  '제로콜라': { calories: 0, carbs: 0, protein: 0, fat: 0, name: '제로콜라', unit: '캔' },
  '우유': { calories: 130, carbs: 10, protein: 6, fat: 7, name: '우유(200ml)', unit: '팩' },
};

/**
 * 로컬 운동 공식 데이터베이스
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
 * [안정성] 12초 AbortController 타임아웃 헬퍼
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      throw new Error('일시적인 서버 지연입니다. 다시 시도해 주세요');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * 텍스트에서 수량과 단위를 추출하는 유틸리티
 */
const extractQuantityAndUnit = (text: string): { quantity: number; unit?: string; cleanText: string } => {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(개|알|개입|줄|공기|그릇|인분|조각|토막|캔|잔|병|봉지|봉|팩|g|ml)?/i);
  if (match) {
    const qty = parseFloat(match[1]);
    const unit = match[2] || '개';
    const cleanText = text.replace(match[0], '').trim();
    return { quantity: qty > 0 ? qty : 1, unit, cleanText };
  }
  return { quantity: 1, unit: undefined, cleanText: text };
};

/**
 * [250kcal 고정 제거] 조리법/식재료 기반 동적 자체 추정
 */
const estimateFallbackNutrition = (foodName: string, quantity: number = 1): FoodVisionAnalysisResult => {
  const lower = foodName.toLowerCase();
  let baseCal = 350;
  let baseCarbs = 40;
  let baseProtein = 15;
  let baseFat = 12;

  if (lower.includes('튀김') || lower.includes('돈까스') || lower.includes('치킨') || lower.includes('탕수육') || lower.includes('전')) {
    baseCal = 620;
    baseCarbs = 48;
    baseProtein = 24;
    baseFat = 36;
  } else if (lower.includes('샐러드') || lower.includes('채소') || lower.includes('야채') || lower.includes('과일')) {
    baseCal = 150;
    baseCarbs = 20;
    baseProtein = 4;
    baseFat = 5;
  } else if (lower.includes('국') || lower.includes('찌개') || lower.includes('탕')) {
    baseCal = 280;
    baseCarbs = 18;
    baseProtein = 18;
    baseFat = 14;
  } else if (lower.includes('면') || lower.includes('국수') || lower.includes('파스타') || lower.includes('우동') || lower.includes('라면') || lower.includes('짜장') || lower.includes('짬뽕')) {
    baseCal = 550;
    baseCarbs = 82;
    baseProtein = 14;
    baseFat = 16;
  } else if (lower.includes('고기') || lower.includes('구이') || lower.includes('스테이크') || lower.includes('삼겹') || lower.includes('갈비')) {
    baseCal = 480;
    baseCarbs = 6;
    baseProtein = 35;
    baseFat = 32;
  } else if (lower.includes('빵') || lower.includes('케이크') || lower.includes('과자') || lower.includes('디저트') || lower.includes('쿠키')) {
    baseCal = 380;
    baseCarbs = 56;
    baseProtein = 6;
    baseFat = 16;
  }

  const factor = Math.max(0.5, quantity);
  return {
    name: foodName,
    quantity,
    unit: '인분',
    calories: Math.round(baseCal * factor),
    carbs: Math.round(baseCarbs * factor),
    protein: Math.round(baseProtein * factor),
    fat: Math.round(baseFat * factor),
    description: `[자체 추정] ${foodName} ${quantity > 1 ? `x${quantity}` : ''} 영양성분`,
  };
};

/**
 * 사진 분석 (최대 1024px 리사이징, 12초 타임아웃, 총 수량 반영 곱셈)
 */
export const analyzeMealPhoto = async (
  images: string | string[],
  userNotes?: string
): Promise<FoodVisionAnalysisResult> => {
  const apiKey = getApiKey();
  const rawImageList = Array.isArray(images) ? images.filter(Boolean) : [images].filter(Boolean);

  if (rawImageList.length === 0) {
    throw new Error('분석할 음식 이미지가 없습니다.');
  }

  // 1. [속도 개선] 클라이언트 캔버스 리사이징 (최대 1024px, JPEG 0.75)
  const imageList = await Promise.all(
    rawImageList.slice(0, 2).map((img) => resizeAndCompressImage(img, 1024, 0.75))
  );

  const isMultiPhoto = imageList.length >= 2;
  const weeklyMenuPlan = (localStorage.getItem('weekly_menu_plan') || '').trim();
  const menuPlanContext = weeklyMenuPlan ? ` 식단표 참고:${weeklyMenuPlan}` : '';
  const notesContext = userNotes && userNotes.trim() ? ` 사용자메모:${userNotes.trim()}` : '';

  // 3. [정확도 & 250kcal 고정 제거] 프롬프트 규칙 강화
  const promptRules = `
너는 대한민국 최고의 임상영양사 AI다.
[핵심 규칙]
1. 사진 속 각 음식의 총 수량/개수(예: 삶은 달걀 3개면 3개 전체 분량, 만두 6개면 6개 전체, 밥 한 공기 반이면 1.5공기)를 반드시 정확히 파악하라.
2. 단위 1개당 영양소가 아니라, 사진에 보이는 전체 섭취량 기준의 총 수량(quantity)을 반영하여 "총 칼로리 = 개당 칼로리 × quantity" 및 총 탄/단/지를 계산하라.
3. 250kcal 같은 임의 고정값을 절대 사용하지 말 것. 식재료와 조리 형태(튀김, 볶음, 찜, 구이, 국물 등), 총 섭취 분량을 종합하여 가장 합리적이고 정확한 추정치를 직접 계산하여 반환하라.
${isMultiPhoto ? '4. 1번 사진은 식사 전, 2번 사진은 식사 후 잔반이다. 잔반을 차감한 실제 순 섭취량 기준의 총 수량과 총 칼로리/영양소를 도출하라.' : ''}
5. 반드시 아래 JSON 형식으로만 순수 텍스트로 응답하라 (코드블록 마크다운 기호 없이 순수 JSON만 반환):
{"name": string, "quantity": number, "unit": string, "calories": number, "carbs": number, "protein": number, "fat": number, "description": string}
${menuPlanContext}
${notesContext}
`.trim();

  const parts: any[] = [{ text: promptRules }];

  imageList.forEach((img) => {
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
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    // 2. [안정성] 12초 타임아웃
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      12000
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
      name: String(parsed.name || '식단').trim(),
      quantity: Number(parsed.quantity) || 1,
      unit: parsed.unit ? String(parsed.unit).trim() : '인분',
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
      description: parsed.description ? String(parsed.description).trim() : undefined,
    };
  } catch (err: any) {
    console.warn('[VisionService] 이미지 분석 실패:', err?.message || err);
    if (err?.message?.includes('서버 지연')) {
      throw err;
    }
    throw new Error('일시적인 서버 지연입니다. 다시 시도해 주세요');
  }
};

export const analyzeFoodImage = async (base64ImageWithHeader: string): Promise<FoodVisionAnalysisResult> => {
  return analyzeMealPhoto(base64ImageWithHeader);
};

/**
 * 텍스트 음식명을 입력받아 칼로리와 영양성분을 추정하는 함수
 * - 수량(개수/인분) 파싱 및 곱셈 적용
 * - 250kcal 고정값 제거 및 AI 자체 맞춤 추정
 * - 12초 타임아웃 적용
 */
export const estimateNutritionFromText = async (foodName: string): Promise<FoodVisionAnalysisResult> => {
  const trimmed = foodName.trim();
  if (!trimmed) {
    throw new Error('음식명을 입력해 주세요.');
  }

  const { quantity, unit, cleanText } = extractQuantityAndUnit(trimmed);

  // 1. 로컬 사전 매칭 시 수량 곱셈 적용
  const normalized = (cleanText || trimmed).replace(/\s+/g, '').toLowerCase();
  for (const [key, value] of Object.entries(COMMON_FOODS)) {
    const cleanKey = key.replace(/\s+/g, '').toLowerCase();
    if (normalized.includes(cleanKey) || cleanKey.includes(normalized)) {
      const q = quantity || 1;
      return {
        name: `${value.name}${q > 1 ? ` ${q}${unit || value.unit}` : ''}`,
        quantity: q,
        unit: unit || value.unit,
        calories: Math.round(value.calories * q),
        carbs: Math.round(value.carbs * q),
        protein: Math.round(value.protein * q),
        fat: Math.round(value.fat * q),
        description: `로컬 DB (${value.name} × ${q}${unit || value.unit})`,
      };
    }
  }

  // 2. 사전에 없는 경우 Gemini 2.5 Flash 호출 (12초 타임아웃)
  try {
    const apiKey = getApiKey();
    const prompt = `
음식명: "${trimmed}"
반드시 음식의 조리 방식, 주재료 구성, 총 분량/수량(예: ${quantity}${unit || '개'})을 엄밀히 반영하여 총 칼로리와 영양성분을 계산하라.
단위 1개가 아닌 사용자가 입력한 총량 전체의 칼로리(총 칼로리 = 단위 칼로리 × 수량)와 탄수화물, 단백질, 지방을 계산하라.
250kcal 같은 임의 고정값을 절대 넣지 말고 식재료와 조리 형태에 맞는 실제적인 추정치를 JSON 형식으로만 응답하라:
{"name":"${trimmed}","quantity":${quantity},"unit":"${unit || '인분'}","calories":number,"carbs":number,"protein":number,"fat":number,"description":string}
`.trim();

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
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
      12000
    );

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          name: String(parsed.name || trimmed).trim(),
          quantity: Number(parsed.quantity) || quantity,
          unit: parsed.unit ? String(parsed.unit).trim() : unit || '인분',
          calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
          carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
          protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
          fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
          description: parsed.description ? String(parsed.description).trim() : undefined,
        };
      }
    }
  } catch (err: any) {
    console.warn('[VisionService/Text] API 통신 지연 또는 실패:', err?.message || err);
    if (err?.message?.includes('서버 지연')) {
      throw err;
    }
  }

  // 3. API 비상 상황 시 250kcal 고정이 아닌 음식 특성 기반 지능형 자체 추정치 반환
  return estimateFallbackNutrition(trimmed, quantity);
};

/**
 * 사용자 체중과 운동 내역 텍스트를 기반으로 예상 소모 칼로리를 추정하는 함수 (12초 타임아웃)
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
      const burned = Math.round(item.met * safeWeight * (durationMinutes / 60) * 1.05);
      return {
        calories: burned,
        description: `${item.label} ${durationMinutes}분 기준 예상 소모량`,
      };
    }
  }

  // 2. 사전에 없는 경우 Gemini 2.5 Flash 호출 (12초 타임아웃)
  try {
    const apiKey = getApiKey();
    const prompt = `체중: ${safeWeight}kg, 운동: "${trimmed}". 운동 강도와 시간을 종합해 소모 칼로리를 정확히 계산하라. JSON으로만 반환: {"calories": number, "description": string}`;

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
      12000
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
    console.warn('[VisionService/Exercise] API 통신 실패/지연:', err?.message || err);
    if (err?.message?.includes('서버 지연')) {
      throw err;
    }
  }

  // 3. API 실패 시 중강도 기본 운동(MET 5.0) 공식으로 계산
  const fallbackBurned = Math.round(5.0 * safeWeight * (durationMinutes / 60) * 1.05);
  return {
    calories: fallbackBurned,
    description: `${trimmed} (${durationMinutes}분 기준 예상치)`,
  };
};

/**
 * 주간 식단표 사진에서 메뉴 추출 (최대 1024px 리사이징, 12초 타임아웃)
 */
export const parseWeeklyMenuFromImage = async (base64ImageWithHeader: string): Promise<string> => {
  const apiKey = getApiKey();

  const resizedImage = await resizeAndCompressImage(base64ImageWithHeader, 1024, 0.75);
  const parts = resizedImage.split(',');
  const rawBase64 = parts.length > 1 ? parts[1].trim() : parts[0].trim();
  const mimeTypeMatch = resizedImage.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*?,/);
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
      12000
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
    console.warn('[VisionService/MenuOCR] OCR 실패/지연:', err?.message || err);
    if (err?.message?.includes('서버 지연')) {
      throw err;
    }
  }

  throw new Error('식단표 사진을 분석하지 못했습니다. 글자가 선명한 사진으로 다시 시도해 주세요.');
};
