import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

export type JobDesireLevel =
  | '第一志望'
  | '第一志望群'
  | '第二志望'
  | '第二志望群'
  | '第三志望'
  | '第三志望群'
  | '志望'
  | '検討中'
  | '志望しない';

export interface JobProgressTask {
  title?: string;
  completed?: boolean;
}

export interface JobProgressCompany {
  name?: string;
  myPageUrl?: string;
  currentGoal?: string;
  selectionStatus?: string;
  desireLevel?: JobDesireLevel | '';
  tasks?: JobProgressTask[];
  globalFieldValues?: Record<string, string>;
  memo?: string;
  progressXp?: number;
}

export interface JobSearchProgress {
  score: number;
  rawXp: number;
  cappedXp: number;
  hasFirstChoiceOffer: boolean;
  label: string;
}

export const JOB_COMPANIES_STORAGE_KEY = '@job_companies_v1';

const DESIRE_WEIGHT: Record<JobDesireLevel, number> = {
  '第一志望': 1,
  '第一志望群': 1,
  '第二志望': 0.7,
  '第二志望群': 0.7,
  '第三志望': 0.45,
  '第三志望群': 0.45,
  '志望': 0.55,
  '検討中': 0.25,
  '志望しない': 0.1,
};

const STATUS_XP: Record<string, number> = {
  '未着手': 5,
  'ES作成中': 18,
  'ES提出済': 30,
  '適性検査待ち': 34,
  '一次面接待ち': 40,
  '一次面接済': 48,
  '二次面接待ち': 52,
  '二次面接済': 60,
  '三次面接待ち': 64,
  '三次面接済': 70,
  '最終面接待ち': 76,
  '最終面接済': 84,
  '内定': 100,
  '内定辞退': 100,
  '不合格': 42,
  '選考辞退': 30,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isFirstChoice(level: string | undefined): boolean {
  return level === '第一志望' || level === '第一志望群';
}

function desireWeight(level: JobProgressCompany['desireLevel']): number {
  return level ? DESIRE_WEIGHT[level] ?? 0.35 : 0.35;
}

export function calculateCompanyExperienceXp(company: JobProgressCompany): number {
  const tasks = company.tasks ?? [];
  const completedTasks = tasks.filter(task => task.completed).length;
  const customFieldCount = Object.values(company.globalFieldValues ?? {})
    .filter(value => value.trim().length > 0).length;

  const activityXp =
    (company.name?.trim() ? 5 : 0)
    + (company.desireLevel ? 5 : 0)
    + (company.currentGoal ? 4 : 0)
    + (company.myPageUrl?.trim() ? 3 : 0)
    + (company.memo?.trim() ? 6 : 0)
    + Math.min(tasks.length, 5)
    + Math.min(completedTasks * 3, 15)
    + Math.min(customFieldCount * 2, 8);

  const statusXp = STATUS_XP[company.selectionStatus ?? ''] ?? 0;
  return clamp(Math.max(activityXp, statusXp + activityXp * 0.25), 0, 100);
}

export function withUpdatedCompanyProgress<T extends JobProgressCompany>(company: T): T {
  const currentXp = calculateCompanyExperienceXp(company);
  return {
    ...company,
    progressXp: Math.max(company.progressXp ?? 0, currentXp),
  };
}

export function calculateJobSearchProgress(companies: JobProgressCompany[]): JobSearchProgress {
  const hasFirstChoiceOffer = companies.some(company =>
    isFirstChoice(company.desireLevel) && company.selectionStatus === '内定',
  );

  if (hasFirstChoiceOffer) {
    return {
      score: 100,
      rawXp: 100,
      cappedXp: 100,
      hasFirstChoiceOffer: true,
      label: '第一志望群の内定まで到達しました',
    };
  }

  const rawXp = companies.reduce((sum, company) => {
    const companyXp = Math.max(company.progressXp ?? 0, calculateCompanyExperienceXp(company));
    return sum + companyXp * desireWeight(company.desireLevel);
  }, 0);
  const cappedXp = clamp(rawXp, 0, 100);
  const score = Math.round(cappedXp);

  let label = '少しずつ積み上がっています';
  if (score >= 75) {
    label = 'かなり経験が積み上がっています';
  } else if (score >= 45) {
    label = '選考経験が広がってきました';
  } else if (score >= 15) {
    label = '就活の記録が育ち始めています';
  }

  return { score, rawXp, cappedXp, hasFirstChoiceOffer, label };
}

export async function fetchJobSearchProgress(uid: string, isDemo: boolean): Promise<JobSearchProgress> {
  try {
    if (isDemo) {
      const raw = await AsyncStorage.getItem(JOB_COMPANIES_STORAGE_KEY);
      const companies = raw ? JSON.parse(raw) : [];
      return calculateJobSearchProgress(Array.isArray(companies) ? companies : []);
    }

    const snap = await getDocs(collection(db, 'users', uid, 'job_companies'));
    const companies = snap.docs.map(d => d.data() as JobProgressCompany);
    return calculateJobSearchProgress(companies);
  } catch {
    return calculateJobSearchProgress([]);
  }
}
