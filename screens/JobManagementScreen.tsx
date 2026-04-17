import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  cancelTaskNotification,
  getReminderDays,
  requestNotificationPermission,
  scheduleTaskNotification,
} from '../services/notifications';

// ─── Types ───────────────────────────────────────────────────────────────────

type GoalType = 'インターン' | '説明会' | '本選考' | 'OB訪問' | 'その他';
type DesireLevel = '第一志望' | '第一志望群' | '第二志望' | '第二志望群' | '第三志望' | '第三志望群' | '志望' | '検討中' | '志望しない';

interface GlobalField {
  id: string;
  label: string;
}

interface Task {
  id: string;
  title: string;
  deadline: string;
  time: string;
  submissionUrl: string;
  completed: boolean;
}

interface Company {
  id: string;
  name: string;
  myPageUrl: string;
  myPageLoginId: string;
  currentGoal: GoalType | '';
  selectionStatus: string;
  desireLevel: DesireLevel | '';
  tasks: Task[];
  globalFieldValues: Record<string, string>;
  memo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_OPTIONS: GoalType[] = ['インターン', '説明会', '本選考', 'OB訪問', 'その他'];
const DESIRE_OPTIONS: DesireLevel[] = ['第一志望', '第一志望群', '第二志望', '第二志望群', '第三志望', '第三志望群', '志望', '検討中', '志望しない'];
const SELECTION_STATUS_OPTIONS: string[] = [
  '未着手',
  'ES作成中',
  'ES提出済',
  '適性検査待ち',
  '一次面接待ち',
  '一次面接済',
  '二次面接待ち',
  '二次面接済',
  '三次面接待ち',
  '三次面接済',
  '最終面接待ち',
  '最終面接済',
  '内定',
  '内定辞退',
  '不合格',
  '選考辞退',
];
const STORAGE_KEY = '@job_companies_v1';
const GLOBAL_FIELDS_KEY = '@job_global_fields_v1';

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

const DESIRE_COLOR: Record<DesireLevel, string> = {
  '第一志望':   '#304E78',
  '第一志望群': '#3D6494',
  '第二志望':   '#5A7696',
  '第二志望群': '#7090A8',
  '第三志望':   '#8AAABB',
  '第三志望群': '#A0BDC8',
  '志望':       '#43A047',
  '検討中':     '#F59E0B',
  '志望しない': '#E53935',
};

const GOAL_COLOR: Record<GoalType, string> = {
  'インターン': '#43A047',
  '説明会': '#1E88E5',
  '本選考': '#8E24AA',
  'OB訪問': '#FB8C00',
  'その他': '#6D4C41',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeEmptyCompany(): Company {
  return {
    id: uid(),
    name: '',
    myPageUrl: '',
    myPageLoginId: '',
    currentGoal: '',
    selectionStatus: '',
    desireLevel: '',
    tasks: [],
    globalFieldValues: {},
    memo: '',
  };
}

// ─── PickerModal ──────────────────────────────────────────────────────────────

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
        <View style={pmS.sheet}>
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
        </View>
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
  optionList: { maxHeight: 340 },
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

// ─── GlobalFieldsModal ────────────────────────────────────────────────────────

interface GlobalFieldsModalProps {
  visible: boolean;
  fields: GlobalField[];
  onUpdate: (fields: GlobalField[]) => void;
  onClose: () => void;
}

function GlobalFieldsModal({ visible, fields, onUpdate, onClose }: GlobalFieldsModalProps) {
  const [draft, setDraft] = useState<GlobalField[]>(fields);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (visible) { setDraft(fields); setNewLabel(''); }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (draft.some(f => f.label === label)) {
      Alert.alert('重複', `「${label}」はすでに追加されています。`);
      return;
    }
    setDraft(d => [...d, { id: uid(), label }]);
    setNewLabel('');
  };

  const removeField = (id: string) => {
    Alert.alert('共通項目を削除', '全企業からこの入力欄が非表示になります。\n（入力済みの値は内部に保持されます）', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => setDraft(d => d.filter(f => f.id !== id)) },
    ]);
  };

  const handleDone = () => { onUpdate(draft); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDone}>
      <View style={gfS.overlay}>
        <View style={gfS.sheet}>
          <View style={gfS.header}>
            <Text style={gfS.title}>全社共通項目の管理</Text>
            <TouchableOpacity onPress={handleDone} style={gfS.doneBtn}>
              <Text style={gfS.doneBtnText}>完了</Text>
            </TouchableOpacity>
          </View>
          <Text style={gfS.desc}>
            ここで追加した項目は全企業の入力欄に表示されます。
          </Text>

          <ScrollView style={gfS.list} bounces={false}>
            {draft.length === 0 && (
              <Text style={gfS.emptyText}>共通項目はまだありません</Text>
            )}
            {draft.map(field => (
              <View key={field.id} style={gfS.fieldRow}>
                <Text style={gfS.fieldLabel}>{field.label}</Text>
                <TouchableOpacity
                  onPress={() => removeField(field.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={gfS.removeText}>削除</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={gfS.addRow}>
            <TextInput
              style={gfS.addInput}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="新しい項目名（例：初任給）"
              placeholderTextColor={C.muted}
              onSubmitEditing={addField}
              returnKeyType="done"
            />
            <TouchableOpacity style={gfS.addBtn} onPress={addField}>
              <Text style={gfS.addBtnText}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const gfS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: C.text },
  doneBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneBtnText: { color: C.card, fontSize: 14, fontWeight: 'bold' },
  desc: { fontSize: 13, color: C.sub, marginBottom: 12 },
  list: { maxHeight: 240, marginBottom: 12 },
  emptyText: { color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  fieldLabel: { fontSize: 15, color: C.text },
  removeText: { color: C.danger, fontSize: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    backgroundColor: '#FAFAFA',
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: C.card, fontSize: 14, fontWeight: 'bold' },
});

// ─── Date/Time helpers ───────────────────────────────────────────────────────

function parseDate(s: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? new Date() : date;
}
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function displayDate(s: string): string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
  const [y, m, d] = s.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
function parseTime(s: string): Date {
  const [h, m] = (s || '23:59').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── PickerFieldModal（iOS用ラッパー） ────────────────────────────────────────

function PickerFieldModal({
  visible,
  onDone,
  children,
}: {
  visible: boolean;
  onDone: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={pfS.overlay}>
        <View style={pfS.sheet}>
          <TouchableOpacity
            style={pfS.doneRow}
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="日付/時刻選択を完了"
          >
            <Text style={pfS.doneText}>完了</Text>
          </TouchableOpacity>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const pfS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  doneRow: { alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D9D0C8' },
  doneText: { color: '#304E78', fontSize: 16, fontWeight: 'bold' },
});

// ─── DatePickerField ──────────────────────────────────────────────────────────

function DatePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const today = new Date();
  const parsed = value ? parseDate(value) : today;
  const date = parsed.getTime() < today.getTime() ? today : parsed;

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(formatDate(selected));
  };

  return (
    <>
      <TouchableOpacity
        style={pfS2.btn}
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel="期限（日付）を選択"
      >
        <Text style={value ? pfS2.btnText : pfS2.btnPlaceholder}>
          {value ? displayDate(value) : '日付を選択'}
        </Text>
        <Text style={pfS2.icon}>📅</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker value={date} mode="date" minimumDate={new Date()} onChange={handleChange} />
      )}
      {Platform.OS === 'ios' && (
        <PickerFieldModal visible={show} onDone={() => setShow(false)}>
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            minimumDate={new Date()}
            onChange={handleChange}
            locale="ja"
            textColor="#000000"
          />
        </PickerFieldModal>
      )}
    </>
  );
}

// ─── TimePickerField ──────────────────────────────────────────────────────────

function TimePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const date = parseTime(value || '23:59');

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(formatTime(selected));
  };

  return (
    <>
      <TouchableOpacity
        style={pfS2.btn}
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel="期限（時刻）を選択"
        accessibilityValue={{ text: value || '23:59' }}
      >
        <Text style={pfS2.btnText}>{value || '23:59'}</Text>
        <Text style={pfS2.icon}>🕐</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker value={date} mode="time" is24Hour onChange={handleChange} />
      )}
      {Platform.OS === 'ios' && (
        <PickerFieldModal visible={show} onDone={() => setShow(false)}>
          <DateTimePicker
            value={date}
            mode="time"
            display="spinner"
            is24Hour
            onChange={handleChange}
            textColor="#000000"
          />
        </PickerFieldModal>
      )}
    </>
  );
}

const pfS2 = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D0C8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  btnText: { fontSize: 14, color: '#333333' },
  btnPlaceholder: { fontSize: 14, color: '#A8BDD4' },
  icon: { fontSize: 16 },
});

// ─── TaskItem ─────────────────────────────────────────────────────────────────

interface TaskItemProps {
  task: Task;
  onUpdate: (t: Task) => void;
  onDelete: () => void;
}

function TaskItem({ task, onUpdate, onDelete }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={tiS.card}>
      <TouchableOpacity
        style={tiS.header}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={[tiS.checkbox, task.completed && tiS.checkboxDone]}
          onPress={() => onUpdate({ ...task, completed: !task.completed })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {task.completed && <Text style={tiS.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text
          style={[tiS.taskTitle, task.completed && tiS.taskTitleDone]}
          numberOfLines={1}
        >
          {task.title || '（タイトル未入力）'}
        </Text>
        {task.deadline ? (
          <Text style={tiS.deadline}>
            {displayDate(task.deadline)}{task.time ? ` ${task.time}` : ''}
          </Text>
        ) : null}
        <Text style={tiS.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={tiS.body}>
          <Text style={tiS.label}>タイトル</Text>
          <TextInput
            style={tiS.input}
            value={task.title}
            onChangeText={v => onUpdate({ ...task, title: v })}
            placeholder="タスクのタイトル"
            placeholderTextColor={C.muted}
          />
          <Text style={tiS.label}>期限（日付）</Text>
          <DatePickerField
            value={task.deadline}
            onChange={v => onUpdate({ ...task, deadline: v })}
          />
          <Text style={tiS.label}>期限（時刻）</Text>
          <TimePickerField
            value={task.time ?? '23:59'}
            onChange={v => onUpdate({ ...task, time: v })}
          />
          <Text style={tiS.label}>提出先URL（任意）</Text>
          <TextInput
            style={tiS.input}
            value={task.submissionUrl}
            onChangeText={v => onUpdate({ ...task, submissionUrl: v })}
            placeholder="https://..."
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity style={tiS.deleteBtn} onPress={onDelete}>
            <Text style={tiS.deleteBtnText}>このタスクを削除</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const tiS = StyleSheet.create({
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.muted,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: C.success, borderColor: C.success },
  checkmark: { color: C.card, fontSize: 13, fontWeight: 'bold' },
  taskTitle: { flex: 1, fontSize: 14, color: C.text },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.muted },
  deadline: { fontSize: 12, color: C.light, marginRight: 6 },
  chevron: { fontSize: 11, color: C.muted },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  label: { fontSize: 12, color: C.sub, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.card,
  },
  deleteBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  deleteBtnText: { color: C.danger, fontSize: 13 },
});

// ─── SearchFilterModal ────────────────────────────────────────────────────────

interface FilterState {
  query: string;
  desireLevel: DesireLevel | '';
  goal: GoalType | '';
  hasTask: boolean;
}

const EMPTY_FILTER: FilterState = { query: '', desireLevel: '', goal: '', hasTask: false };

interface SearchFilterModalProps {
  visible: boolean;
  filter: FilterState;
  onApply: (f: FilterState) => void;
  onClose: () => void;
}

function SearchFilterModal({ visible, filter, onApply, onClose }: SearchFilterModalProps) {
  const [draft, setDraft] = useState<FilterState>(filter);

  useEffect(() => {
    if (visible) setDraft(filter);
  }, [visible, filter]);

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setDraft(f => ({ ...f, [key]: value }));

  const toggle = <K extends 'goal' | 'desireLevel'>(
    key: K,
    value: Exclude<FilterState[K], ''>,
  ) =>
    setDraft((f): FilterState => {
      const nextValue: FilterState[K] = f[key] === value ? '' : value;
      return { ...f, [key]: nextValue } as FilterState;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sfS.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={sfS.sheet}>
          <View style={sfS.handle} />

          <View style={sfS.titleRow}>
            <Text style={sfS.title}>検索・絞り込み</Text>
            <TouchableOpacity onPress={() => setDraft(EMPTY_FILTER)}>
              <Text style={sfS.resetText}>リセット</Text>
            </TouchableOpacity>
          </View>

          {/* 企業名 */}
          <Text style={sfS.label}>企業名</Text>
          <TextInput
            style={sfS.input}
            value={draft.query}
            onChangeText={v => set('query', v)}
            placeholder="企業名で検索"
            placeholderTextColor={C.muted}
            autoCorrect={false}
          />

          {/* 目標 */}
          <Text style={sfS.label}>目標</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sfS.chipRow}>
            {GOAL_OPTIONS.map(g => (
              <TouchableOpacity
                key={g}
                style={[sfS.chip, draft.goal === g && sfS.chipActive]}
                onPress={() => toggle('goal', g)}
              >
                <Text style={[sfS.chipText, draft.goal === g && sfS.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 志望度 */}
          <Text style={sfS.label}>志望度</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sfS.chipRow}>
            {DESIRE_OPTIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[sfS.chip, draft.desireLevel === d && sfS.chipActive]}
                onPress={() => toggle('desireLevel', d)}
              >
                <Text style={[sfS.chipText, draft.desireLevel === d && sfS.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 未完了タスクあり */}
          <TouchableOpacity
            style={sfS.toggleRow}
            onPress={() => set('hasTask', !draft.hasTask)}
            activeOpacity={0.7}
            accessibilityRole="switch"
            accessibilityLabel="未完了タスクがある企業のみ表示"
            accessibilityState={{ checked: draft.hasTask }}
          >
            <Text style={sfS.toggleLabel}>未完了タスクがある企業のみ</Text>
            <View style={[sfS.track, draft.hasTask && sfS.trackOn]}>
              <View style={[sfS.knob, draft.hasTask && sfS.knobOn]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={sfS.applyBtn} onPress={() => onApply(draft)}>
            <Text style={sfS.applyBtnText}>この条件で絞り込む</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const sfS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: 'bold', color: C.text },
  resetText: { fontSize: 14, color: C.danger },
  label: { fontSize: 12, fontWeight: 'bold', color: C.sub, marginBottom: 8, marginTop: 14 },
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
  chipRow: { paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.sub },
  chipTextActive: { color: C.card, fontWeight: 'bold' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 15, color: C.text },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.border,
    justifyContent: 'center',
    padding: 2,
  },
  trackOn: { backgroundColor: C.primary },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  knobOn: { alignSelf: 'flex-end' },
  applyBtn: {
    marginTop: 20,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: { color: C.card, fontSize: 15, fontWeight: 'bold' },
});

// ─── CompanyViewScreen（読み取り専用詳細） ────────────────────────────────────

interface CompanyViewScreenProps {
  company: Company;
  globalFields: GlobalField[];
  onEdit: () => void;
  onBack: () => void;
}

function CompanyViewScreen({ company, globalFields, onEdit, onBack }: CompanyViewScreenProps) {
  const pendingTasks = company.tasks.filter(t => !t.completed);
  const doneTasks = company.tasks.filter(t => t.completed);

  return (
    <View style={vS.root}>
      {/* ヘッダー */}
      <View style={vS.navBar}>
        <TouchableOpacity style={vS.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="一覧に戻る">
          <Text style={vS.backBtnText}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text style={vS.navTitle} numberOfLines={1}>{company.name || '（会社名未設定）'}</Text>
        <TouchableOpacity style={vS.editBtn} onPress={onEdit} accessibilityRole="button" accessibilityLabel="編集">
          <Text style={vS.editBtnText}>編集</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={vS.scroll} contentContainerStyle={vS.content}>
        {/* バッジ行 */}
        <View style={vS.badgeRow}>
          {company.desireLevel ? (
            <View style={[vS.desireBadge, { backgroundColor: DESIRE_COLOR[company.desireLevel as DesireLevel] }]}>
              <Text style={vS.badgeText}>{company.desireLevel}</Text>
            </View>
          ) : null}
          {company.currentGoal ? (
            <View style={[vS.goalBadge, { backgroundColor: GOAL_COLOR[company.currentGoal as GoalType] }]}>
              <Text style={vS.badgeText}>{company.currentGoal}</Text>
            </View>
          ) : null}
          {company.selectionStatus ? (
            <View style={vS.statusBadge}>
              <Text style={vS.statusBadgeText}>{company.selectionStatus}</Text>
            </View>
          ) : null}
        </View>

        {/* 基本情報 */}
        <View style={vS.section}>
          <Text style={vS.sectionTitle}>基本情報</Text>
          <View style={vS.card}>
            <ViewRow label="マイページURL" value={company.myPageUrl} isUrl />
            <ViewRow label="ログインID" value={company.myPageLoginId} />
          </View>
        </View>

        {/* グローバルカスタム項目 */}
        {globalFields.length > 0 && (
          <View style={vS.section}>
            <Text style={vS.sectionTitle}>全社共通項目</Text>
            <View style={vS.card}>
              {globalFields.map((f, i) => (
                <ViewRow
                  key={f.id}
                  label={f.label}
                  value={company.globalFieldValues?.[f.id] ?? ''}
                  last={i === globalFields.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* メモ */}
        {company.memo ? (
          <View style={vS.section}>
            <Text style={vS.sectionTitle}>メモ</Text>
            <View style={vS.card}>
              <Text style={vS.memoText}>{company.memo}</Text>
            </View>
          </View>
        ) : null}

        {/* 未完了タスク */}
        <View style={vS.section}>
          <Text style={vS.sectionTitle}>未完了タスク（{pendingTasks.length}件）</Text>
          {pendingTasks.length === 0 ? (
            <Text style={vS.emptyText}>未完了のタスクはありません</Text>
          ) : (
            <View style={vS.card}>
              {pendingTasks.map((t, i) => (
                <ViewTask key={t.id} task={t} last={i === pendingTasks.length - 1} />
              ))}
            </View>
          )}
        </View>

        {/* 完了済みタスク */}
        {doneTasks.length > 0 && (
          <View style={vS.section}>
            <Text style={vS.sectionTitle}>完了済みタスク（{doneTasks.length}件）</Text>
            <View style={vS.card}>
              {doneTasks.map((t, i) => (
                <ViewTask key={t.id} task={t} last={i === doneTasks.length - 1} done />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ViewRow({
  label,
  value,
  isUrl,
  last,
}: {
  label: string;
  value: string;
  isUrl?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[vS.row, last && vS.rowLast]}>
      <Text style={vS.rowLabel}>{label}</Text>
      {isUrl && value ? (
        <TouchableOpacity onPress={() => Linking.openURL(value)} hitSlop={{ top: 4, bottom: 4 }}>
          <Text style={vS.rowValueLink} numberOfLines={1}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={vS.rowValue} numberOfLines={2}>{value || '—'}</Text>
      )}
    </View>
  );
}

function ViewTask({ task, last, done }: { task: Task; last?: boolean; done?: boolean }) {
  return (
    <View style={[vS.taskRow, last && vS.rowLast]}>
      <View style={[vS.taskDot, done && vS.taskDotDone]} />
      <View style={vS.taskBody}>
        <Text style={[vS.taskTitle, done && vS.taskTitleDone]}>{task.title || '（タイトル未設定）'}</Text>
        {task.deadline ? (
          <Text style={vS.taskMeta}>
            {displayDate(task.deadline)}　{task.time || '23:59'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const vS = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { paddingHorizontal: 4, paddingVertical: 4, minWidth: 56 },
  backBtnText: { color: C.primary, fontSize: 17 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 'bold', color: C.text },
  editBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: 'center',
  },
  editBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  desireBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  goalBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadge: { backgroundColor: '#E8EEF6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  statusBadgeText: { color: C.primary, fontSize: 13, fontWeight: 'bold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: C.sub, marginBottom: 8 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: C.sub, flex: 1 },
  rowValue: { fontSize: 14, color: C.text, flex: 2, textAlign: 'right' },
  rowValueLink: { fontSize: 14, color: C.primary, textDecorationLine: 'underline', flex: 2, textAlign: 'right' },
  memoText: { fontSize: 14, color: C.text, paddingHorizontal: 16, paddingVertical: 12, lineHeight: 22 },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  taskDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginTop: 4 },
  taskDotDone: { backgroundColor: C.muted },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 14, color: C.text, fontWeight: '500' },
  taskTitleDone: { color: C.muted, textDecorationLine: 'line-through' },
  taskMeta: { fontSize: 12, color: C.sub, marginTop: 2 },
});

// ─── CompanyListScreen ────────────────────────────────────────────────────────

interface CompanyListScreenProps {
  companies: Company[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
}

function CompanyListScreen({ companies, onSelect, onEdit, onAdd }: CompanyListScreenProps) {
  const [showFilter, setShowFilter] = useState(false);
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);

  const isFiltered = !!(filter.query || filter.desireLevel || filter.goal || filter.hasTask);

  const displayed = companies
    .filter(c => {
      if (filter.query && !c.name.toLowerCase().includes(filter.query.toLowerCase())) return false;
      if (filter.desireLevel && c.desireLevel !== filter.desireLevel) return false;
      if (filter.goal && c.currentGoal !== filter.goal) return false;
      if (filter.hasTask && c.tasks.filter(t => !t.completed).length === 0) return false;
      return true;
    })
    .sort((a, b) => {
      const ia = DESIRE_OPTIONS.indexOf(a.desireLevel as DesireLevel);
      const ib = DESIRE_OPTIONS.indexOf(b.desireLevel as DesireLevel);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

  const pendingCount = (c: Company) => c.tasks.filter(t => !t.completed).length;

  return (
    <View style={lS.root}>
      {/* ヘッダー */}
      <View style={lS.navBar}>
        <Text style={lS.navTitle}>就活管理</Text>
        <View style={lS.navActions}>
          <TouchableOpacity
            style={[lS.iconBtn, isFiltered && lS.iconBtnActive]}
            onPress={() => setShowFilter(true)}
            accessibilityLabel="検索・絞り込み"
          >
            <Text style={lS.iconBtnText}>🔍</Text>
            {isFiltered && <View style={lS.filterDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={lS.addBtn} onPress={onAdd} accessibilityLabel="企業を追加">
            <Text style={lS.addBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 絞り込み中バナー */}
      {isFiltered && (
        <TouchableOpacity style={lS.filterBanner} onPress={() => setFilter(EMPTY_FILTER)}>
          <Text style={lS.filterBannerText}>絞り込み中　 ✕ クリア</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={displayed}
        keyExtractor={item => item.id}
        contentContainerStyle={lS.list}
        ListEmptyComponent={
          <View style={lS.empty}>
            <Text style={lS.emptyTitle}>
              {isFiltered ? '条件に一致する企業がありません' : '企業が登録されていません'}
            </Text>
            <Text style={lS.emptySub}>
              {isFiltered ? '絞り込み条件を変更してください' : '右上の ＋ ボタンから追加できます'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const pc = pendingCount(item);
          return (
            <TouchableOpacity style={lS.card} onPress={() => onSelect(item.id)} activeOpacity={0.75}>
              <View style={lS.cardTop}>
                <TouchableOpacity
                  style={lS.cardNameWrap}
                  onPress={() => item.myPageUrl ? Linking.openURL(item.myPageUrl) : null}
                  disabled={!item.myPageUrl}
                  hitSlop={{ top: 4, bottom: 4 }}
                >
                  <Text
                    style={[lS.companyName, !!item.myPageUrl && lS.companyNameLink]}
                    numberOfLines={1}
                  >
                    {item.name || '（会社名未設定）'}
                  </Text>
                </TouchableOpacity>
                <View style={lS.cardTopRight}>
                  {item.desireLevel ? (
                    <View style={[lS.desireBadge, { backgroundColor: DESIRE_COLOR[item.desireLevel as DesireLevel] }]}>
                      <Text style={lS.badgeText}>{item.desireLevel}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={lS.editBtn}
                    onPress={() => onEdit(item.id)}
                    accessibilityLabel={`${item.name}を編集`}
                    accessibilityRole="button"
                  >
                    <Text style={lS.editBtnText}>編集</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={lS.cardMid}>
                {item.currentGoal ? (
                  <View style={[lS.goalBadge, { backgroundColor: GOAL_COLOR[item.currentGoal as GoalType] }]}>
                    <Text style={lS.badgeText}>{item.currentGoal}</Text>
                  </View>
                ) : null}
                {item.selectionStatus ? (
                  <Text style={lS.statusText} numberOfLines={1}>{item.selectionStatus}</Text>
                ) : null}
              </View>

              {pc > 0 && (
                <View style={lS.taskAlert}>
                  <Text style={lS.taskAlertText}>未完了タスク {pc} 件</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <SearchFilterModal
        visible={showFilter}
        filter={filter}
        onApply={f => { setFilter(f); setShowFilter(false); }}
        onClose={() => setShowFilter(false)}
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
  navActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBtnActive: { borderColor: C.primary, backgroundColor: '#EBF0F8' },
  iconBtnText: { fontSize: 18 },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: C.card, fontSize: 24, lineHeight: 28 },
  filterBanner: {
    backgroundColor: '#EBF0F8',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterBannerText: { fontSize: 13, color: C.primary, fontWeight: 'bold' },
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardNameWrap: { flex: 1, marginRight: 8 },
  companyName: { fontSize: 17, fontWeight: 'bold', color: C.text },
  companyNameLink: { color: C.primary, textDecorationLine: 'underline' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  desireBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  editBtn: {
    backgroundColor: C.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  goalBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 },
  badgeText: { color: C.card, fontSize: 12, fontWeight: 'bold' },
  cardMid: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 13, color: C.sub, flex: 1 },
  taskAlert: {
    marginTop: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  taskAlertText: { color: '#E65100', fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 72 },
  emptyTitle: { fontSize: 16, color: C.sub, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.muted },
});

// ─── SelectField ──────────────────────────────────────────────────────────────

interface SelectFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}

function SelectField({ label, value, placeholder, onPress }: SelectFieldProps) {
  return (
    <>
      <Text style={dS.fieldLabel}>{label}</Text>
      <TouchableOpacity style={dS.selectBtn} onPress={onPress}>
        <Text style={value ? dS.selectValue : dS.selectPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={dS.selectArrow}>▼</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── CompanyDetailScreen ──────────────────────────────────────────────────────

interface CompanyDetailScreenProps {
  company: Company;
  isNew: boolean;
  globalFields: GlobalField[];
  onUpdateGlobalFields: (fields: GlobalField[]) => void;
  onSave: (c: Company) => void;
  onDelete: () => void;
  onBack: () => void;
}

function CompanyDetailScreen({ company, isNew, globalFields, onUpdateGlobalFields, onSave, onDelete, onBack }: CompanyDetailScreenProps) {
  const [form, setForm] = useState<Company>(company);
  const [picker, setPicker] = useState<'goal' | 'desire' | 'status' | null>(null);
  const [showGlobalFieldsModal, setShowGlobalFieldsModal] = useState(false);
  const originalRef = useRef(JSON.stringify(company));

  const set = <K extends keyof Company>(key: K, value: Company[K]) =>
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
    if (!form.name.trim()) {
      Alert.alert('エラー', '会社名を入力してください。');
      return;
    }
    onSave(form);
    originalRef.current = JSON.stringify(form);
    onBack();
  };

  const handleDelete = () => {
    Alert.alert(
      '企業を削除',
      `「${company.name || '（未設定）'}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => { onDelete(); onBack(); } },
      ],
    );
  };

  const addTask = () =>
    set('tasks', [...form.tasks, { id: uid(), title: '', deadline: '', time: '23:59', submissionUrl: '', completed: false }]);

  const updateTask = (id: string, t: Task) =>
    set('tasks', form.tasks.map(x => x.id === id ? t : x));

  const deleteTask = (id: string) =>
    set('tasks', form.tasks.filter(x => x.id !== id));

  return (
    <View style={dS.root}>
      {/* Nav header */}
      <View style={dS.navBar}>
        <TouchableOpacity onPress={handleBack} style={dS.navBack}>
          <Text style={dS.navBackText}>＜ 戻る</Text>
        </TouchableOpacity>
        <Text style={dS.navTitle} numberOfLines={1}>
          {form.name || (isNew ? '新規企業' : '企業詳細')}
        </Text>
        <TouchableOpacity onPress={handleSave} style={dS.navSave}>
          <Text style={dS.navSaveText}>保存</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={dS.scroll} contentContainerStyle={dS.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ── 基本情報 ── */}
        <Text style={dS.sectionTitle}>基本情報</Text>
        <View style={dS.section}>
          <Text style={dS.fieldLabel}>会社名 *</Text>
          <TextInput
            style={dS.input}
            value={form.name}
            onChangeText={v => set('name', v)}
            placeholder="例：株式会社〇〇"
            placeholderTextColor={C.muted}
          />

          <Text style={dS.fieldLabel}>マイページURL</Text>
          <TextInput
            style={dS.input}
            value={form.myPageUrl}
            onChangeText={v => set('myPageUrl', v)}
            placeholder="https://..."
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={dS.fieldLabel}>マイページログインID</Text>
          <TextInput
            style={dS.input}
            value={form.myPageLoginId}
            onChangeText={v => set('myPageLoginId', v)}
            placeholder="メールアドレスや学籍番号など"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />

          <SelectField
            label="現目標"
            value={form.currentGoal}
            placeholder="選択してください"
            onPress={() => setPicker('goal')}
          />

          <SelectField
            label="選考状況"
            value={form.selectionStatus}
            placeholder="選択してください"
            onPress={() => setPicker('status')}
          />

          <SelectField
            label="志望度"
            value={form.desireLevel}
            placeholder="選択してください"
            onPress={() => setPicker('desire')}
          />
        </View>

        {/* ── タスク管理 ── */}
        <Text style={dS.sectionTitle}>タスク管理</Text>
        <View style={dS.section}>
          {form.tasks.length === 0 && (
            <Text style={dS.emptySectionText}>タスクはありません</Text>
          )}
          {form.tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={t => updateTask(task.id, t)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
          <TouchableOpacity style={dS.addBtn} onPress={addTask}>
            <Text style={dS.addBtnText}>＋ タスクを追加</Text>
          </TouchableOpacity>
        </View>

        {/* ── メモ ── */}
        <Text style={dS.sectionTitle}>メモ</Text>
        <View style={dS.section}>
          <TextInput
            style={[dS.input, dS.inputMemo]}
            value={form.memo ?? ''}
            onChangeText={v => set('memo', v)}
            placeholder="自由にメモを残せます"
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* ── カスタム項目 ── */}
        <View style={dS.sectionTitleRow}>
          <Text style={dS.sectionTitle}>カスタム項目</Text>
        </View>

        {/* 全社共通項目 */}
        <View style={dS.subHeader}>
          <Text style={dS.subHeaderTitle}>全社共通項目</Text>
          <TouchableOpacity onPress={() => setShowGlobalFieldsModal(true)}>
            <Text style={dS.manageLink}>項目を管理</Text>
          </TouchableOpacity>
        </View>
        <View style={dS.section}>
          {globalFields.length === 0 ? (
            <TouchableOpacity onPress={() => setShowGlobalFieldsModal(true)} style={dS.addBtn}>
              <Text style={dS.addBtnText}>＋ 全社共通項目を設定する</Text>
            </TouchableOpacity>
          ) : (
            globalFields.map(gf => (
              <View key={gf.id}>
                <Text style={dS.fieldLabel}>{gf.label}</Text>
                <TextInput
                  style={dS.input}
                  value={(form.globalFieldValues ?? {})[gf.id] ?? ''}
                  onChangeText={v => set('globalFieldValues', { ...(form.globalFieldValues ?? {}), [gf.id]: v })}
                  placeholder="未入力"
                  placeholderTextColor={C.muted}
                />
              </View>
            ))
          )}
        </View>

        {/* Delete company */}
        {!isNew && (
          <TouchableOpacity style={dS.deleteCompanyBtn} onPress={handleDelete}>
            <Text style={dS.deleteCompanyText}>この企業を削除する</Text>
          </TouchableOpacity>
        )}

        <View style={dS.bottomPad} />
      </ScrollView>

      <GlobalFieldsModal
        visible={showGlobalFieldsModal}
        fields={globalFields}
        onUpdate={onUpdateGlobalFields}
        onClose={() => setShowGlobalFieldsModal(false)}
      />
      <PickerModal
        visible={picker === 'goal'}
        title="現目標を選択"
        options={GOAL_OPTIONS}
        value={form.currentGoal}
        onSelect={v => set('currentGoal', v as GoalType)}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'status'}
        title="選考状況を選択"
        options={SELECTION_STATUS_OPTIONS}
        value={form.selectionStatus}
        onSelect={v => set('selectionStatus', v)}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'desire'}
        title="志望度を選択"
        options={DESIRE_OPTIONS}
        value={form.desireLevel}
        onSelect={v => set('desireLevel', v as DesireLevel)}
        onClose={() => setPicker(null)}
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
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  inputMemo: { minHeight: 100, textAlignVertical: 'top' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 4 },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  subHeaderTitle: { fontSize: 13, fontWeight: 'bold', color: C.sub },
  manageLink: { fontSize: 13, color: C.primary },
  selectBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectValue: { fontSize: 14, color: C.text },
  selectPlaceholder: { fontSize: 14, color: C.muted },
  selectArrow: { fontSize: 11, color: C.muted },
  addBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: { color: C.primary, fontSize: 14 },
  emptySectionText: { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  deleteCompanyBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.danger,
  },
  deleteCompanyText: { color: C.danger, fontSize: 15, fontWeight: 'bold' },
  bottomPad: { height: 32 },
});

// ─── JobManagementScreen (root) ───────────────────────────────────────────────

type ViewState =
  | { mode: 'list' }
  | { mode: 'view'; companyId: string }
  | { mode: 'detail'; companyId: string }
  | { mode: 'new'; draft: Company };

function JobManagementScreen() {
  const { uid, isDemo } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [globalFields, setGlobalFields] = useState<GlobalField[]>([]);
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  // 初期データ読み込み・通知権限リクエスト
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
    if (!uid) return;
    if (isDemo) {
      Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(GLOBAL_FIELDS_KEY),
      ]).then(([cJson, fJson]) => {
        if (cJson) setCompanies(JSON.parse(cJson));
        if (fJson) setGlobalFields(JSON.parse(fJson));
      }).catch(() => {});
    } else {
      Promise.all([
        getDocs(collection(db, 'users', uid, 'job_companies')),
        getDoc(doc(db, 'users', uid, 'job_settings', 'global_fields')),
      ]).then(([snap, fSnap]) => {
        setCompanies(snap.docs.map(d => d.data() as Company));
        if (fSnap.exists()) setGlobalFields(fSnap.data().fields ?? []);
      }).catch(() => {});
    }
  }, [uid, isDemo]);

  // タスク通知をスケジュール
  const syncNotifications = useCallback((company: Company) => {
    getReminderDays().then(reminderDays => {
      company.tasks.forEach(task => {
        if (task.completed || !task.deadline) {
          cancelTaskNotification(task.id).catch(() => {});
        } else {
          scheduleTaskNotification(
            task.id,
            task.title,
            company.name,
            task.deadline,
            task.time ?? '23:59',
            reminderDays,
          ).catch(() => {});
        }
      });
    }).catch(() => {});
  }, []);

  // 企業を保存（追加・更新）
  const saveCompany = useCallback((company: Company) => {
    setCompanies(prev => {
      const next = prev.find(c => c.id === company.id)
        ? prev.map(c => c.id === company.id ? company : c)
        : [...prev, company];
      if (isDemo) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    if (!isDemo && uid) {
      setDoc(doc(db, 'users', uid, 'job_companies', company.id), company).catch(() => {});
    }
    syncNotifications(company);
  }, [uid, isDemo, syncNotifications]);

  // 企業を削除
  const removeCompany = useCallback((companyId: string, tasks: Task[]) => {
    setCompanies(prev => {
      const next = prev.filter(c => c.id !== companyId);
      if (isDemo) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    if (!isDemo && uid) {
      deleteDoc(doc(db, 'users', uid, 'job_companies', companyId)).catch(() => {});
    }
    tasks.forEach(t => cancelTaskNotification(t.id).catch(() => {}));
  }, [uid, isDemo]);

  // 全社共通項目を保存
  const persistGlobalFields = useCallback((fields: GlobalField[]) => {
    setGlobalFields(fields);
    if (isDemo) {
      AsyncStorage.setItem(GLOBAL_FIELDS_KEY, JSON.stringify(fields)).catch(() => {});
    } else if (uid) {
      setDoc(doc(db, 'users', uid, 'job_settings', 'global_fields'), { fields }).catch(() => {});
    }
  }, [uid, isDemo]);

  if (view.mode === 'view') {
    const company = companies.find(c => c.id === view.companyId);
    if (!company) { setView({ mode: 'list' }); return null; }
    return (
      <CompanyViewScreen
        company={company}
        globalFields={globalFields}
        onEdit={() => setView({ mode: 'detail', companyId: view.companyId })}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  if (view.mode === 'new') {
    return (
      <CompanyDetailScreen
        company={view.draft}
        isNew
        globalFields={globalFields}
        onUpdateGlobalFields={persistGlobalFields}
        onSave={saveCompany}
        onDelete={() => {/* ドラフトはまだ未保存のため削除不要 */}}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  if (view.mode === 'detail') {
    const company = companies.find(c => c.id === view.companyId);
    if (!company) {
      setView({ mode: 'list' });
      return null;
    }
    return (
      <CompanyDetailScreen
        company={company}
        isNew={false}
        globalFields={globalFields}
        onUpdateGlobalFields={persistGlobalFields}
        onSave={saveCompany}
        onDelete={() => removeCompany(view.companyId, company.tasks)}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <CompanyListScreen
      companies={companies}
      onSelect={id => setView({ mode: 'view', companyId: id })}
      onEdit={id => setView({ mode: 'detail', companyId: id })}
      onAdd={() => setView({ mode: 'new', draft: makeEmptyCompany() })}
    />
  );
}

export default JobManagementScreen;
