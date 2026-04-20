import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type ESStatus = '下書き' | '提出済';

interface EntrySheet {
  id: string;
  companyName: string;
  question: string;
  answer: string;
  charLimit: number;
  status: ESStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@entry_sheets_v1';
const STATUS_OPTIONS: ESStatus[] = ['下書き', '提出済'];

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  border: '#D9D0C8',
  card: '#FFFFFF',
  text: '#333333',
  sub: '#555555',
  muted: '#A8BDD4',
  light: '#5A7696',
  success: '#4CAF50',
  danger: '#E53935',
  warning: '#F59E0B',
};

const STATUS_COLOR: Record<ESStatus, string> = {
  '下書き': '#F59E0B',
  '提出済': '#4CAF50',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now(): string {
  return new Date().toISOString();
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function makeEmptyES(): EntrySheet {
  const t = now();
  return {
    id: uid(),
    companyName: '',
    question: '',
    answer: '',
    charLimit: 0,
    status: '下書き',
    memo: '',
    createdAt: t,
    updatedAt: t,
  };
}

// ─── PickerModal ──────────────────────────────────────────────────────────────

const noop = () => {};

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, value, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pmS.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={noop} style={pmS.sheet}>
          <Text style={pmS.title}>{title}</Text>
          <ScrollView style={pmS.optionList} bounces={false}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[pmS.option, opt === value && pmS.optionSelected]}
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={[pmS.optionText, opt === value && pmS.optionTextSelected]}>
                  {opt}
                </Text>
                {opt === value && <Text style={pmS.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={pmS.cancel} onPress={onClose}>
            <Text style={pmS.cancelText}>キャンセル</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const pmS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: C.card,
    borderRadius: 14,
    width: '82%',
    padding: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  optionList: { maxHeight: 240 },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: C.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionSelected: { backgroundColor: '#EBF0F8' },
  optionText: { fontSize: 15, color: C.text },
  optionTextSelected: { color: C.primary, fontWeight: 'bold' },
  check: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
  cancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  cancelText: { color: C.danger, fontSize: 15 },
});

// ─── ESListScreen ─────────────────────────────────────────────────────────────

interface ESListScreenProps {
  sheets: EntrySheet[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function ESListScreen({ sheets, onSelect, onAdd }: ESListScreenProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ESStatus | ''>('');

  const displayed = sheets.filter(s => {
    if (query && !s.companyName.toLowerCase().includes(query.toLowerCase()) &&
        !s.question.toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <View style={lS.root}>
      <View style={lS.navBar}>
        <Text style={lS.navTitle}>ESドキュメント</Text>
        <TouchableOpacity style={lS.addBtn} onPress={onAdd} accessibilityLabel="ESを追加">
          <Text style={lS.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* 検索バー */}
      <View style={lS.searchBar}>
        <TextInput
          style={lS.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="企業名・設問で検索"
          placeholderTextColor={C.muted}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={lS.clearBtn}>
            <Text style={lS.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ステータスフィルター */}
      <View style={lS.filterRow}>
        {(['', ...STATUS_OPTIONS] as (ESStatus | '')[]).map(s => (
          <TouchableOpacity
            key={s || 'all'}
            style={[lS.chip, statusFilter === s && lS.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[lS.chipText, statusFilter === s && lS.chipTextActive]}>
              {s || 'すべて'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={item => item.id}
        contentContainerStyle={lS.list}
        ListEmptyComponent={
          <View style={lS.empty}>
            <Text style={lS.emptyTitle}>
              {query || statusFilter ? '条件に一致するESがありません' : 'ESがまだありません'}
            </Text>
            <Text style={lS.emptySub}>
              {query || statusFilter ? '条件を変更してください' : '右上の ＋ ボタンから追加できます'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const charCount = item.answer.length;
          const overLimit = item.charLimit > 0 && charCount > item.charLimit;
          return (
            <TouchableOpacity style={lS.card} onPress={() => onSelect(item.id)} activeOpacity={0.75}>
              <View style={lS.cardTop}>
                <Text style={lS.companyName} numberOfLines={1}>
                  {item.companyName || '（企業名未設定）'}
                </Text>
                <View style={[lS.statusBadge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                  <Text style={lS.statusBadgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={lS.question} numberOfLines={2}>
                {item.question || '（設問未入力）'}
              </Text>
              <View style={lS.cardBottom}>
                <Text style={[lS.charCount, overLimit && lS.charCountOver]}>
                  {charCount}{item.charLimit > 0 ? ` / ${item.charLimit}字` : '字'}
                </Text>
                <Text style={lS.updatedAt}>更新: {formatDate(item.updatedAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const lS = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: C.bg,
  },
  navTitle: { fontSize: 22, fontWeight: 'bold', color: C.primary },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: C.card, fontSize: 24, lineHeight: 28 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingVertical: 10,
  },
  clearBtn: { padding: 4 },
  clearBtnText: { color: C.muted, fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.sub },
  chipTextActive: { color: C.card, fontWeight: 'bold' },
  list: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  companyName: { fontSize: 16, fontWeight: 'bold', color: C.text, flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { color: C.card, fontSize: 12, fontWeight: 'bold' },
  question: { fontSize: 13, color: C.sub, marginBottom: 8, lineHeight: 18 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, color: C.light },
  charCountOver: { color: C.danger, fontWeight: 'bold' },
  updatedAt: { fontSize: 11, color: C.muted },
  empty: { alignItems: 'center', paddingTop: 72 },
  emptyTitle: { fontSize: 16, color: C.sub, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.muted },
});

// ─── ESDetailScreen ───────────────────────────────────────────────────────────

interface ESDetailScreenProps {
  sheet: EntrySheet;
  isNew: boolean;
  onSave: (s: EntrySheet) => void;
  onDelete: () => void;
  onBack: () => void;
}

function ESDetailScreen({ sheet, isNew, onSave, onDelete, onBack }: ESDetailScreenProps) {
  const [form, setForm] = useState<EntrySheet>(sheet);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [charLimitText, setCharLimitText] = useState(
    sheet.charLimit > 0 ? String(sheet.charLimit) : '',
  );
  const originalRef = useRef(JSON.stringify(sheet));

  const set = <K extends keyof EntrySheet>(key: K, value: EntrySheet[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const isDirty = () => JSON.stringify(form) !== originalRef.current;

  const handleBack = () => {
    if (isDirty()) {
      Alert.alert('変更を破棄しますか？', '保存されていない変更は失われます。', [
        { text: '続けて編集', style: 'cancel' },
        { text: '破棄して戻る', style: 'destructive', onPress: onBack },
      ]);
    } else {
      onBack();
    }
  };

  const handleSave = () => {
    if (!form.companyName.trim()) {
      Alert.alert('エラー', '企業名を入力してください。');
      return;
    }
    if (!form.question.trim()) {
      Alert.alert('エラー', '設問を入力してください。');
      return;
    }
    const limit = charLimitText.trim() === '' ? 0 : parseInt(charLimitText, 10);
    const updated = { ...form, charLimit: isNaN(limit) ? 0 : limit, updatedAt: now() };
    onSave(updated);
    originalRef.current = JSON.stringify(updated);
    onBack();
  };

  const handleDelete = () => {
    Alert.alert(
      'ESを削除',
      '削除すると元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => { onDelete(); onBack(); } },
      ],
    );
  };

  const charCount = form.answer.length;
  const parsedLimit = charLimitText.trim() === '' ? 0 : parseInt(charLimitText, 10);
  const effectiveLimit = isNaN(parsedLimit) ? 0 : parsedLimit;
  const overLimit = effectiveLimit > 0 && charCount > effectiveLimit;

  return (
    <View style={dS.root}>
      <View style={dS.navBar}>
        <TouchableOpacity onPress={handleBack} style={dS.navBack}>
          <Text style={dS.navBackText}>＜ 戻る</Text>
        </TouchableOpacity>
        <Text style={dS.navTitle} numberOfLines={1}>
          {isNew ? '新規ES' : (form.companyName || 'ES詳細')}
        </Text>
        <TouchableOpacity onPress={handleSave} style={dS.navSave}>
          <Text style={dS.navSaveText}>保存</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={dS.scroll} contentContainerStyle={dS.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 基本情報 */}
        <Text style={dS.sectionTitle}>基本情報</Text>
        <View style={dS.section}>
          <Text style={dS.fieldLabel}>企業名 *</Text>
          <TextInput
            style={dS.input}
            value={form.companyName}
            onChangeText={v => set('companyName', v)}
            placeholder="例：株式会社〇〇"
            placeholderTextColor={C.muted}
          />

          <Text style={dS.fieldLabel}>ステータス</Text>
          <TouchableOpacity
            style={dS.selectBtn}
            onPress={() => setShowStatusPicker(true)}
          >
            <View style={[dS.statusDot, { backgroundColor: STATUS_COLOR[form.status] }]} />
            <Text style={dS.selectValue}>{form.status}</Text>
            <Text style={dS.selectArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={dS.fieldLabel}>文字数制限（任意）</Text>
          <TextInput
            style={dS.input}
            value={charLimitText}
            onChangeText={setCharLimitText}
            placeholder="例：400（なければ空欄）"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
          />
        </View>

        {/* 設問 */}
        <Text style={dS.sectionTitle}>設問</Text>
        <View style={dS.section}>
          <TextInput
            style={[dS.input, dS.inputMulti]}
            value={form.question}
            onChangeText={v => set('question', v)}
            placeholder="設問をここに入力してください"
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* 回答 */}
        <View style={dS.sectionTitleRow}>
          <Text style={dS.sectionTitle}>回答</Text>
          <Text style={[dS.charCounter, overLimit && dS.charCounterOver]}>
            {charCount}{effectiveLimit > 0 ? ` / ${effectiveLimit}字` : '字'}
          </Text>
        </View>
        <View style={dS.section}>
          <TextInput
            style={[dS.input, dS.inputAnswer]}
            value={form.answer}
            onChangeText={v => set('answer', v)}
            placeholder="回答を入力してください"
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
          />
          {overLimit && (
            <Text style={dS.overLimitMsg}>
              文字数制限を {charCount - effectiveLimit} 字超過しています
            </Text>
          )}
        </View>

        {/* メモ */}
        <Text style={dS.sectionTitle}>メモ</Text>
        <View style={dS.section}>
          <TextInput
            style={[dS.input, dS.inputMemo]}
            value={form.memo}
            onChangeText={v => set('memo', v)}
            placeholder="参考にしたこと・修正ポイントなど"
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {!isNew && (
          <View style={dS.metaRow}>
            <Text style={dS.metaText}>作成日: {formatDate(form.createdAt)}</Text>
            <Text style={dS.metaText}>更新日: {formatDate(form.updatedAt)}</Text>
          </View>
        )}

        {!isNew && (
          <TouchableOpacity style={dS.deleteBtn} onPress={handleDelete}>
            <Text style={dS.deleteBtnText}>このESを削除する</Text>
          </TouchableOpacity>
        )}

        <View style={dS.bottomPad} />
      </ScrollView>

      <PickerModal
        visible={showStatusPicker}
        title="ステータスを選択"
        options={STATUS_OPTIONS}
        value={form.status}
        onSelect={v => set('status', v as ESStatus)}
        onClose={() => setShowStatusPicker(false)}
      />
    </View>
  );
}

const dS = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBack: { paddingRight: 10, paddingVertical: 4 },
  navBackText: { color: C.primary, fontSize: 15 },
  navTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', color: C.text },
  navSave: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navSaveText: { color: C.card, fontSize: 14, fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: C.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  charCounter: { fontSize: 14, color: C.light, fontWeight: '600' },
  charCounterOver: { color: C.danger },
  section: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
  },
  fieldLabel: { fontSize: 12, color: C.sub, marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    backgroundColor: '#FAFAFA',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  inputAnswer: { minHeight: 200, textAlignVertical: 'top', lineHeight: 22 },
  inputMemo: { minHeight: 80, textAlignVertical: 'top' },
  selectBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  selectValue: { flex: 1, fontSize: 14, color: C.text },
  selectArrow: { fontSize: 11, color: C.muted },
  overLimitMsg: {
    marginTop: 6,
    fontSize: 12,
    color: C.danger,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  metaText: { fontSize: 11, color: C.muted },
  deleteBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.danger,
  },
  deleteBtnText: { color: C.danger, fontSize: 15, fontWeight: 'bold' },
  bottomPad: { height: 32 },
});

// ─── EntrySheetScreen (root) ──────────────────────────────────────────────────

type ViewState =
  | { mode: 'list' }
  | { mode: 'edit'; id: string }
  | { mode: 'new'; draft: EntrySheet };

function EntrySheetScreen() {
  const { uid, isDemo } = useAuth();
  const [sheets, setSheets] = useState<EntrySheet[]>([]);
  const [view, setView] = useState<ViewState>({ mode: 'list' });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (!uid) return;
    if (isDemo) {
      AsyncStorage.getItem(STORAGE_KEY).then(json => {
        if (!json) return;
        try {
          const loaded = JSON.parse(json);
          if (Array.isArray(loaded)) setSheets(loaded);
        } catch {
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      }).catch(() => {});
    } else {
      getDocs(collection(db, 'users', uid, 'entry_sheets')).then(snap => {
        const loaded = snap.docs.map(d => {
          const data = d.data() as Partial<EntrySheet>;
          const t = now();
          return {
            id: data.id ?? d.id,
            companyName: data.companyName ?? '',
            question: data.question ?? '',
            answer: data.answer ?? '',
            charLimit: typeof data.charLimit === 'number' ? data.charLimit : 0,
            status: (data.status as ESStatus) ?? '下書き',
            memo: data.memo ?? '',
            createdAt: data.createdAt ?? t,
            updatedAt: data.updatedAt ?? t,
          } as EntrySheet;
        });
        setSheets(loaded);
      }).catch(() => {});
    }
  }, [uid, isDemo]);

  useEffect(() => {
    const currentView = viewRef.current;
    if (
      currentView.mode === 'edit' &&
      sheets.length > 0 &&
      !sheets.find(s => s.id === currentView.id)
    ) {
      setView({ mode: 'list' });
    }
  }, [sheets]);

  const persist = useCallback((next: EntrySheet[]) => {
    if (isDemo) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }
  }, [isDemo]);

  const saveSheet = useCallback((sheet: EntrySheet) => {
    setSheets(prev => {
      const next = prev.find(s => s.id === sheet.id)
        ? prev.map(s => s.id === sheet.id ? sheet : s)
        : [...prev, sheet];
      persist(next);
      return next;
    });
    if (!isDemo && uid) {
      setDoc(doc(db, 'users', uid, 'entry_sheets', sheet.id), sheet).catch(() => {});
    }
  }, [uid, isDemo, persist]);

  const removeSheet = useCallback((id: string) => {
    setSheets(prev => {
      const next = prev.filter(s => s.id !== id);
      persist(next);
      return next;
    });
    if (!isDemo && uid) {
      deleteDoc(doc(db, 'users', uid, 'entry_sheets', id)).catch(() => {});
    }
  }, [uid, isDemo, persist]);

  if (view.mode === 'edit') {
    const sheet = sheets.find(s => s.id === view.id);
    if (!sheet) {
      setView({ mode: 'list' });
      return null;
    }
    return (
      <ESDetailScreen
        sheet={sheet}
        isNew={false}
        onSave={saveSheet}
        onDelete={() => removeSheet(view.id)}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  if (view.mode === 'new') {
    return (
      <ESDetailScreen
        sheet={view.draft}
        isNew
        onSave={saveSheet}
        onDelete={() => {}}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <ESListScreen
      sheets={sheets}
      onSelect={id => setView({ mode: 'edit', id })}
      onAdd={() => setView({ mode: 'new', draft: makeEmptyES() })}
    />
  );
}

export default EntrySheetScreen;
