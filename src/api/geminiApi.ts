const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL = 'https://generativelanguage.googleapis.com';

export interface GeminiFile {
  name: string;
  uri: string;
  display_name: string;
  mime_type: string;
  size_bytes: string;
  create_time: string;
  update_time: string;
  expiration_time: string;
  sha256_hash: string;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', desc: 'Recommended - Ultra Fast & Efficient', recommended: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Optional - Deep Reasoning & Stable', recommended: false },
];

export async function uploadFile(file: File): Promise<GeminiFile> {
  const metadata = {
    file: {
      display_name: file.name,
    },
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/upload/v1beta/files?key=${API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'multipart',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload file');
  }

  const result = await response.json();
  return result.file;
}

export async function generateContent(
  fileUri: string,
  mimeType: string,
  userMessage: string,
  modelId: string = 'gemini-3.1-flash-lite-preview',
  imagePart?: { mimeType: string; data: string }
) {
  const systemPrompt = `You are a specialized Document Q&A assistant. Every answer you provide must be sourced strictly from the uploaded document. 

Formatting Rules:
1. Use clean Markdown for all answers.
2. Use bold headings for multiple questions.
3. Use bullet points for lists.
4. If the answer is not found in the document, you must explicitly say: 'No answer regarding this question in your document.' 
5. Do not guess or use external knowledge. 
6. Keep answers concise and well-organized.`;

  const parts: any[] = [
    { file_data: { mime_type: mimeType, file_uri: fileUri } }, 
    { text: userMessage },
  ];

  if (imagePart) {
    parts.push({
      inline_data: {
        mime_type: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts }],
  };

  const response = await fetch(
    `${BASE_URL}/v1beta/models/${modelId}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json();
    const error = errorBody.error;
    
    // Check for quota or high demand errors
    if (error?.status === 'UNAVAILABLE' || error?.message?.includes('high demand') || error?.message?.includes('quota')) {
      throw {
        type: 'QUOTA_EXCEEDED',
        message: error?.message || 'This model is currently experiencing high demand or quota limits reached.',
        model: modelId
      };
    }
    
    throw new Error(error?.message || 'Failed to generate content');
  }

  const result = await response.json();
  return result.candidates[0]?.content?.parts[0]?.text || 'No response from AI';
}
