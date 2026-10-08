export interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  description?: string;
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
    ? `\n[사용자 이번 주 예정 식단표]\n${weeklyMenuPlan}\n(사진 속 식단과 일치하는 메뉴가 있다면 해당 메뉴명을 최우선 적용하여 정확도를 높여라.)`
    : '';

  const prompt = `당신은 최고 수준의 임상 영양사 및 식품 분석 AI입니다.
제공된 음식 사진(특히 급식판, 구내식당 식판, 일반 한 접시 등)을 세밀하게 분석하세요.

[분석 가이드라인]
1. 식판 칸별 메뉴 파악:
   - 밥(쌀밥/잡곡밥 여부 및 담긴 공기량)
   - 메인 단백질(육류/생선/두부/달걀 등의 조리 방식 및 양)
   - 국류(건더기 종류 및 염분/국물 섭취량)
   - 반찬류(나물, 김치, 튀김, 샐러드 드레싱 등)
2. 실제 섭취한 예상 순수 총 칼로리(kcal)와 탄수화물(carbs, g), 단백질(protein, g), 지방(fat, g)을 정밀 계산하세요.
3. 사족이나 인사말, 서술형 문장, 마크다운 설명 없이 오직 순수 JSON 형식만 반환하세요.${menuPlanContext}

[응답 JSON 스키마]
{
  "name": "식단 대표명 (예: 제육볶음과 된장찌개 정식)",
  "calories": 550,
  "carbs": 65,
  "protein": 27,
  "fat": 18,
  "description": "섭취 메뉴 구성 요약 (예: 흑미밥 200g, 제육볶음 120g, 배추된장국, 깍두기, 시금치나물)"
}`;

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
          description: parsed.description ? String(parsed.description).trim() : undefined,
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
