export interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[VisionService] Gemini API 호출 실패 [Model: gemini-3.8-flash, HTTP Status: ${response.status} ${response.statusText}]`,
        errorText
      );
      throw new Error(`Gemini API(gemini-3.8-flash) 오류 [${response.status} ${response.statusText}]: ${errorText}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Gemini API로부터 분석 결과를 전달받지 못했습니다.');
    }

    // 마크다운 형식 제거 (```json ... ``` 대응)
    const cleanedText = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      name: String(parsed.name || '알 수 없는 음식').trim(),
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
    };
  } catch (error: any) {
    console.error('[VisionService] 분석 중 오류 발생:', error);
    throw error;
  }
};
