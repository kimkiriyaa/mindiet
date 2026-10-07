interface FoodVisionAnalysisResult {
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

  const prompt = `사진 속 음식을 인식해서 JSON 형식 { name: string, calories: number, carbs: number, protein: number, fat: number } 으로만 응답해줘. 칼로리는 1인분 기준 예상치.`;

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

  const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
          `[VisionService] Gemini API 호출 실패 [Model: ${model}, HTTP Status: ${response.status} ${response.statusText}]`,
          errorText
        );
        lastError = new Error(`Gemini API(${model}) 오류 [${response.status}]: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        console.error(`[VisionService] ${model} 응답 본문에 텍스트 내용 없음:`, data);
        throw new Error(`Gemini API(${model}) 응답에서 텍스트 결과 데이터를 찾을 수 없습니다.`);
      }

      // Markdown 백틱(```json ... ```) 완벽 제거 및 JSON 파싱
      const cleanedJsonStr = textResponse
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanedJsonStr);

      return {
        name: parsed.name || '알 수 없는 음식',
        calories: Number(parsed.calories) || 0,
        carbs: Number(parsed.carbs) || 0,
        protein: Number(parsed.protein) || 0,
        fat: Number(parsed.fat) || 0,
      };
    } catch (err: any) {
      console.error(`[VisionService] ${model} 처리 도중 예외 발생:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('모든 Gemini Vision 모델 호출에 실패했습니다. API 키 및 네트워크 상태를 확인해주세요.');
};
