import AsyncStorage from '@react-native-async-storage/async-storage';

const GRADUATION_YEAR_KEY = '@graduation_year_v1';

/** 卒業年度（YYYY年3月卒の西暦）。未設定なら null。 */
export async function getGraduationYear(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(GRADUATION_YEAR_KEY);
    if (raw === null) return null;
    const year = parseInt(raw, 10);
    return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null;
  } catch {
    return null;
  }
}

export async function saveGraduationYear(year: number | null): Promise<void> {
  if (year === null) {
    await AsyncStorage.removeItem(GRADUATION_YEAR_KEY);
  } else {
    await AsyncStorage.setItem(GRADUATION_YEAR_KEY, String(year));
  }
}

/** 設定画面の選択肢: 今年度の卒業年から6年分。 */
export function graduationYearOptions(now = new Date()): number[] {
  // 4月始まりの年度で考える: 2026年7月時点の最短の卒業は2027年3月
  const fiscalYear = now.getMonth() + 1 >= 4 ? now.getFullYear() + 1 : now.getFullYear();
  return Array.from({ length: 6 }, (_, i) => fiscalYear + i);
}
