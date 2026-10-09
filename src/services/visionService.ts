export interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  description?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * fetch 요청에 지정된 시간(ms) 타임아웃을 적용하는 헬퍼 함수
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> => {
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
 * 1장 또는 2장(식사 전, 식사 후 잔반)의 사진을 받아 순 섭취량을 분석하는 고도화 함수
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
  const menuPlanContext = weeklyMenuPlan
    ? `\n[예정식단표]: ${weeklyMenuPlan}`
    : '';

  const notesContext = userNotes && userNotes.trim()
    ? `\n[메모]: ${userNotes.trim()}`
    : '';

  let prompt = '';
  if (isMultiPhoto) {
    prompt = `영양사 AI입니다. 1번: 식사 전, 2번: 식사 후 잔반.
두 사진을 대조하여 실제 순 섭취량(배식량-잔반량) 기준 영양소를 계산하세요.
반드시 아래 JSON 포맷으로만 응답:${menuPlanContext}${notesContext}
{"name": "식단 대표명 (순섭취)", "calories": 480, "carbs": 58, "protein": 26, "fat": 15, "description": "섭취 요약"}`;
  } else {
    prompt = `영양사 AI입니다. 사진 속 식단의 1인분 예상 칼로리와 영양소를 계산하세요.
반드시 아래 JSON 포맷으로만 응답:${menuPlanContext}${notesContext}
{"name": "식단 대표명", "calories": 550, "carbs": 65, "protein": 27, "fat": 18, "description": "메뉴 구성"}`;
  }

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
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 300,
      response_mime_type: 'application/json',
    },
  };

  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
          8000
        );

        if (response.status === 503) {
          console.warn(`[VisionService] ${model} 503 과부하 (시도 ${attempt}/2).`);
          if (attempt < 2) {
            await sleep(600);
            continue;
          }
          break;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[VisionService] ${model} 호출 실패 [${response.status}]: ${errorText}`);
          if (attempt < 2) {
            await sleep(600);
            continue;
          }
          break;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidateText) {
          throw new Error('음식 인식 결과를 전달받지 못했습니다.');
        }

        const cleanedText = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        const parsedCalories = Number(parsed.calories);
        const parsedCarbs = Number(parsed.carbs);
        const parsedProtein = Number(parsed.protein);
        const parsedFat = Number(parsed.fat);

        return {
          name: String(parsed.name || '알 수 없는 식단').trim(),
          calories: Number.isFinite(parsedCalories) ? Math.max(0, Math.round(parsedCalories)) : 0,
          carbs: Number.isFinite(parsedCarbs) ? Math.max(0, Math.round(parsedCarbs)) : 0,
          protein: Number.isFinite(parsedProtein) ? Math.max(0, Math.round(parsedProtein)) : 0,
          fat: Number.isFinite(parsedFat) ? Math.max(0, Math.round(parsedFat)) : 0,
          description: parsed.description ? String(parsed.description).trim() : undefined,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[VisionService] ${model} 처리 오류 (시도 ${attempt}/2):`, err?.message || err);
        if (attempt < 2) {
          await sleep(600);
        }
      }
    }
  }

  console.error('[VisionService] 모든 모델 및 재시도 실패:', lastError);
  throw new Error('일시적으로 AI 서버가 혼잡하거나 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.');
};

/**
 * 하위 호환성을 유지하기 위한 기존 단일 이미지 분석 래퍼 함수
 */
export const analyzeFoodImage = async (base64ImageWithHeader: string): Promise<FoodVisionAnalysisResult> => {
  return analyzeMealPhoto(base64ImageWithHeader);
};

/**
 * 텍스트 음식명을 입력받아 칼로리와 영양성분을 정밀 추정하는 함수
 */
export const estimateNutritionFromText = async (foodName: string): Promise<FoodVisionAnalysisResult> => {
  const apiKey = getApiKey();
  const trimmedName = foodName.trim();
  if (!trimmedName) {
    throw new Error('음식명을 입력해 주세요.');
  }

  const prompt = `영양사 AI입니다. "${trimmedName}" 음식의 일반적인 1회 섭취량 기준 영양소를 계산하세요.
반드시 아래 JSON 포맷으로만 응답:
{"name": "${trimmedName}", "calories": 250, "carbs": 30, "protein": 15, "fat": 5}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 200,
      response_mime_type: 'application/json',
    },
  };

  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
          8000
        );

        if (response.status === 503) {
          console.warn(`[VisionService/Text] ${model} 503 과부하 (시도 ${attempt}/2).`);
          if (attempt < 2) {
            await sleep(600);
            continue;
          }
          break;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[VisionService/Text] ${model} 호출 실패 [${response.status}]: ${errorText}`);
          if (attempt < 2) {
            await sleep(600);
            continue;
          }
          break;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidateText) {
          throw new Error('영양소 추정 결과를 전달받지 못했습니다.');
        }

        const cleanedText = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        const parsedCalories = Number(parsed.calories);
        const parsedCarbs = Number(parsed.carbs);
        const parsedProtein = Number(parsed.protein);
        const parsedFat = Number(parsed.fat);

        return {
          name: String(parsed.name || trimmedName).trim(),
          calories: Number.isFinite(parsedCalories) ? Math.max(0, Math.round(parsedCalories)) : 0,
          carbs: Number.isFinite(parsedCarbs) ? Math.max(0, Math.round(parsedCarbs)) : 0,
          protein: Number.isFinite(parsedProtein) ? Math.max(0, Math.round(parsedProtein)) : 0,
          fat: Number.isFinite(parsedFat) ? Math.max(0, Math.round(parsedFat)) : 0,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[VisionService/Text] ${model} 처리 오류 (시도 ${attempt}/2):`, err?.message || err);
        if (attempt < 2) {
          await sleep(600);
        }
      }
    }
  }

  console.error('[VisionService/Text] 모든 모델 및 재시도 실패:', lastError);
  throw new Error('일시적으로 AI 서버가 혼잡하거나 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.');
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

  const prompt = `식단표 OCR입니다. 요일/일자별 식단 메뉴를 줄단위로 요약 추출하세요.
예시:
월: 쌀밥, 제육볶음, 된장찌개
화: 흑미밥, 닭볶음탕, 콩나물국
텍스트만 출력하세요.`;

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
      maxOutputTokens: 500,
    },
  };

  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
          10000
        );

        if (response.status === 503) {
          console.warn(`[VisionService/MenuOCR] ${model} 503 과부하 (시도 ${attempt}/2).`);
          if (attempt < 2) {
            await sleep(600);
            continue;
          }
          break;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[VisionService/MenuOCR] ${model} 호출 실패 [${response.status}]: ${errorText}`);
          if (attempt < 2) {
            await sleep(600);
            continue;
          }
          break;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (candidateText && candidateText.trim().length > 0) {
          return candidateText.trim();
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[VisionService/MenuOCR] ${model} 처리 오류 (시도 ${attempt}/2):`, err?.message || err);
        if (attempt < 2) {
          await sleep(600);
        }
      }
    }
  }

  console.error('[VisionService/MenuOCR] 주간 식단표 인식 실패:', lastError);
  throw new Error('식단표 사진을 분석하지 못했습니다. 글자가 선명한 사진으로 다시 시도해 주세요.');
};
