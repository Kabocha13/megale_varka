// 就活管理の企業データに関する共有型とストレージキー。
// （かつてここにあった「就活の積み上げ」スコア算出は廃止済み）

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
}

export const JOB_COMPANIES_STORAGE_KEY = '@job_companies_v1';
