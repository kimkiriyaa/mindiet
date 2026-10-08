export interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyzeFoodImage = async (base64ImageWithHeader: string): Promise<FoodVisionAnalysisResult> => {
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

  // base64 헤더 분리 (예: data:image/jpeg;base64,...)
  const parts = base64ImageWithHeader.split(',');
  const rawBase64 = parts.length > 1 ? parts[1].trim() : parts[0].trim();
  const mimeTypeMatch = base64ImageWithHeader.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*?,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

  const weeklyMenuPlan = (localStorage.getItem('weekly_menu_plan') || '').trim();
  const menuPlanContext = weeklyMenuPlan
    ? `\n참고: 사용자의 이번 주 예정 식단표: [${weeklyMenuPlan}]. 사진 속 음식이 식단표와 일치하면 해당 음식명을 최우선 적용하고 칼로리를 계산해줘.`
    : '';

  const prompt = `사진 속 음식을 인식해서 JSON 형식 { name: string, calories: number, carbs: number, protein: number, fat: number } 으로만 응답해줘. 칼로리는 1인분 기준 예상치.${menuPlanContext}`;

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
      temperature: 0.2,
      response_mime_type: 'application/json',
    },
  };

  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.status === 503) {
          console.warn(`[VisionService] ${model} 503 과부하 발생 (시도 ${attempt}/2).`);
          if (attempt < 2) {
            await sleep(1500);
            continue;
          }
          // 2회 시도 모두 503이면 다음 모델(fallback)로 전환
          break;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[VisionService] ${model} 호출 실패 [${response.status}]: ${errorText}`);
          if (attempt < 2) {
            await sleep(1500);
            continue;
          }
          break;
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidateText) {
          throw new Error('음식 인식 결과를 전달받지 못했습니다.');
        }

        // 마크다운 형식 제거 (```json ... ``` 대응)
        const cleanedText = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        const parsedCalories = Number(parsed.calories);
        const parsedCarbs = Number(parsed.carbs);
        const parsedProtein = Number(parsed.protein);
        const parsedFat = Number(parsed.fat);

        return {
          name: String(parsed.name || '알 수 없는 음식').trim(),
          calories: Number.isFinite(parsedCalories) ? Math.max(0, Math.round(parsedCalories)) : 0,
          carbs: Number.isFinite(parsedCarbs) ? Math.max(0, Math.round(parsedCarbs)) : 0,
          protein: Number.isFinite(parsedProtein) ? Math.max(0, Math.round(parsedProtein)) : 0,
          fat: Number.isFinite(parsedFat) ? Math.max(0, Math.round(parsedFat)) : 0,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[VisionService] ${model} 처리 오류 (시도 ${attempt}/2):`, err?.message || err);
        if (attempt < 2) {
          await sleep(1500);
        }
      }
    }
  }

  console.error('[VisionService] 모든 모델 및 재시도 실패:', lastError);
  throw new Error('일시적으로 AI 서버가 혼잡하거나 네트워크가 불안정합니다. 잠시 후 다시 시도해 주세요.');
};
