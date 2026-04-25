import { auth } from '../firebase/config';

export type CareerFitChatRole = 'assistant' | 'user';

export interface CareerFitChatMessage {
  role: CareerFitChatRole;
  text: string;
}

export interface CareerFitChatResponse {
  message: string;
  choices: string[];
  done: boolean;
  metrics?: {
    label: string;
    value: number;
  }[];
}

const CAREER_FIT_CHAT_URL =
  'https://asia-northeast1-megale-varka.cloudfunctions.net/careerFitChat';

export async function askCareerFitChat(messages: CareerFitChatMessage[]): Promise<CareerFitChatResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('ログイン情報を確認できませんでした。再ログインしてください。');
  }

  const response = await fetch(CAREER_FIT_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { messages } }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload?.error?.message ?? 'AIとの通信に失敗しました。';
    throw new Error(message);
  }

  return payload.result;
}
