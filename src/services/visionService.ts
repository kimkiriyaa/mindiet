interface FoodVisionAnalysisResult {
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export const analyzeFoodImage = async (base64ImageWithHeader: string): Promise<FoodVisionAnalysisResult> => {
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const localKey = localStorage.getItem('min_diet_gemini_api_key');
  const apiKey = envKey || localKey;

  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. 프로필 설정에서 API 키를 입력해주세요.');
  }

  // base64 헤더 분리 (예: data:image/jpeg;base64,...)
  const parts = base64ImageWithHeader.split(',');
  const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
  const mimeTypeMatch = base64ImageWithHeader.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*?,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

  const prompt = `이 음식 사진을 분석해서 음식 이름(name), 총 칼로리(calories, 숫자), 탄수화물(carbs, g 단위 숫자), 단백질(protein, g 단위 숫자), 지방(fat, g 단위 숫자)을 JSON 형식으로만 반환해줘.
응답 형식:
{
  "name": "음식명",
  "calories": 450,
  "carbs": 50,
  "protein": 20,
  "fat": 15
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Gemini API 응답에서 분석 결과를 찾을 수 없습니다.');
  }

  // Markdown 백틱(```json ... ```) 제거 후 파싱
  const cleanedJsonStr = textResponse.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
  const parsed = JSON.parse(cleanedJsonStr);

  return {
    name: parsed.name || '알 수 없는 음식',
    calories: Number(parsed.calories) || 0,
    carbs: Number(parsed.carbs) || 0,
    protein: Number(parsed.protein) || 0,
    fat: Number(parsed.fat) || 0,
  };
};
