import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  submissionUrl: string;
  completed: boolean;
}

interface CustomField {
  id: string;
  label: string;
  value: string;
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
  customFields: CustomField[];
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
    customFields: [],
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
          <Text style={tiS.deadline}>{task.deadline}</Text>
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
          <Text style={tiS.label}>期限</Text>
          <TextInput
            style={tiS.input}
            value={task.deadline}
            onChangeText={v => onUpdate({ ...task, deadline: v })}
            placeholder="例：2025-06-30"
            placeholderTextColor={C.muted}
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

// ─── CompanyListScreen ────────────────────────────────────────────────────────

interface CompanyListScreenProps {
  companies: Company[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function CompanyListScreen({ companies, onSelect, onAdd }: CompanyListScreenProps) {
  const [filterDesire, setFilterDesire] = useState<DesireLevel | 'all'>('all');
  const [filterGoal, setFilterGoal] = useState<GoalType | 'all'>('all');

  const sorted = companies
    .filter(c => {
      if (filterDesire !== 'all' && c.desireLevel !== filterDesire) return false;
      if (filterGoal !== 'all' && c.currentGoal !== filterGoal) return false;
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
      <Text style={lS.header}>就活管理</Text>

      {/* Desire filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={lS.filterRow}
        contentContainerStyle={lS.filterContent}
      >
        {(['all', ...DESIRE_OPTIONS] as const).map(d => (
          <TouchableOpacity
            key={d}
            style={[lS.chip, filterDesire === d && lS.chipActive]}
            onPress={() => setFilterDesire(d === filterDesire && d !== 'all' ? 'all' : d)}
          >
            <Text style={[lS.chipText, filterDesire === d && lS.chipTextActive]}>
              {d === 'all' ? 'すべて' : d}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Goal filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={lS.filterRow}
        contentContainerStyle={lS.filterContent}
      >
        {(['all', ...GOAL_OPTIONS] as const).map(g => (
          <TouchableOpacity
            key={g}
            style={[lS.chip, lS.chipGoal, filterGoal === g && lS.chipGoalActive]}
            onPress={() => setFilterGoal(g === filterGoal && g !== 'all' ? 'all' : g)}
          >
            <Text style={[lS.chipText, filterGoal === g && lS.chipTextActive]}>
              {g === 'all' ? '目標：全て' : g}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        contentContainerStyle={lS.list}
        ListEmptyComponent={
          <View style={lS.empty}>
            <Text style={lS.emptyTitle}>企業が登録されていません</Text>
            <Text style={lS.emptySub}>右下の ＋ ボタンから追加できます</Text>
          </View>
        }
        renderItem={({ item }) => {
          const pc = pendingCount(item);
          return (
            <TouchableOpacity style={lS.card} onPress={() => onSelect(item.id)} activeOpacity={0.75}>
              <View style={lS.cardTop}>
                <TouchableOpacity
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
                {item.desireLevel ? (
                  <View style={[lS.desireBadge, { backgroundColor: DESIRE_COLOR[item.desireLevel as DesireLevel] }]}>
                    <Text style={lS.badgeText}>{item.desireLevel}</Text>
                  </View>
                ) : null}
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

      <TouchableOpacity style={lS.fab} onPress={onAdd} accessibilityLabel="企業を追加">
        <Text style={lS.fabIcon}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const lS = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: C.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterRow: { maxHeight: 42, paddingLeft: 12, marginBottom: 4 },
  filterContent: { paddingRight: 12, alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: C.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipGoal: { backgroundColor: '#EEF5FF', borderColor: '#90CAF9' },
  chipGoalActive: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  chipText: { fontSize: 13, color: C.sub },
  chipTextActive: { color: C.card, fontWeight: 'bold' },
  list: { padding: 12, paddingBottom: 88 },
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
  companyName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  companyNameLink: { color: C.primary, textDecorationLine: 'underline' },
  desireBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 7,
  },
  fabIcon: { color: C.card, fontSize: 28, lineHeight: 32 },
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
    set('tasks', [...form.tasks, { id: uid(), title: '', deadline: '', submissionUrl: '', completed: false }]);

  const updateTask = (id: string, t: Task) =>
    set('tasks', form.tasks.map(x => x.id === id ? t : x));

  const deleteTask = (id: string) =>
    set('tasks', form.tasks.filter(x => x.id !== id));

  const addCustomField = () =>
    set('customFields', [...form.customFields, { id: uid(), label: '', value: '' }]);

  const updateCustomField = (id: string, patch: Partial<CustomField>) =>
    set('customFields', form.customFields.map(f => f.id === id ? { ...f, ...patch } : f));

  const deleteCustomField = (id: string) =>
    set('customFields', form.customFields.filter(f => f.id !== id));

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

        {/* この企業だけの項目 */}
        <View style={dS.subHeader}>
          <Text style={dS.subHeaderTitle}>この企業だけの項目</Text>
        </View>
        <View style={dS.section}>
          {form.customFields.length === 0 && (
            <Text style={dS.emptySectionText}>項目はありません</Text>
          )}
          {form.customFields.map(field => (
            <View key={field.id} style={dS.customRow}>
              <TextInput
                style={[dS.input, dS.customLabel]}
                value={field.label}
                onChangeText={v => updateCustomField(field.id, { label: v })}
                placeholder="項目名"
                placeholderTextColor={C.muted}
              />
              <TextInput
                style={[dS.input, dS.customValue]}
                value={field.value}
                onChangeText={v => updateCustomField(field.id, { value: v })}
                placeholder="値"
                placeholderTextColor={C.muted}
              />
              <TouchableOpacity
                onPress={() => deleteCustomField(field.id)}
                style={dS.customDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={dS.customDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={dS.addBtn} onPress={addCustomField}>
            <Text style={dS.addBtnText}>＋ 項目を追加</Text>
          </TouchableOpacity>
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
  customRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  customLabel: { flex: 2, marginRight: 6 },
  customValue: { flex: 3, marginRight: 6 },
  customDelete: { padding: 4 },
  customDeleteText: { color: C.danger, fontSize: 16 },
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
  | { mode: 'detail'; companyId: string }
  | { mode: 'new'; draft: Company };

function JobManagementScreen() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [globalFields, setGlobalFields] = useState<GlobalField[]>([]);
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(GLOBAL_FIELDS_KEY),
    ])
      .then(([companiesJson, fieldsJson]) => {
        if (companiesJson) setCompanies(JSON.parse(companiesJson));
        if (fieldsJson) setGlobalFields(JSON.parse(fieldsJson));
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((list: Company[]) => {
    setCompanies(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  const persistGlobalFields = useCallback((fields: GlobalField[]) => {
    setGlobalFields(fields);
    AsyncStorage.setItem(GLOBAL_FIELDS_KEY, JSON.stringify(fields)).catch(() => {});
  }, []);

  if (view.mode === 'new') {
    return (
      <CompanyDetailScreen
        company={view.draft}
        isNew
        globalFields={globalFields}
        onUpdateGlobalFields={persistGlobalFields}
        onSave={c => persist([...companies, c])}
        onDelete={() => {/* nothing to delete – draft was never persisted */}}
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
        onSave={updated => persist(companies.map(c => c.id === updated.id ? updated : c))}
        onDelete={() => persist(companies.filter(c => c.id !== view.companyId))}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <CompanyListScreen
      companies={companies}
      onSelect={id => setView({ mode: 'detail', companyId: id })}
      onAdd={() => setView({ mode: 'new', draft: makeEmptyCompany() })}
    />
  );
}

export default JobManagementScreen;
