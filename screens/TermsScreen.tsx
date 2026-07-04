import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TERMS_SECTIONS, TERMS_UPDATED_AT } from '../services/terms';

interface TermsScreenProps {
  /** accept: 初回起動時の同意画面 / view: 設定画面などからの閲覧のみ */
  mode: 'accept' | 'view';
  onAccept?: () => void;
  onClose?: () => void;
}

export default function TermsScreen({ mode, onAccept, onClose }: TermsScreenProps) {
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>利用規約</Text>
        {mode === 'view' && (
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="利用規約を閉じる"
          >
            <Text style={s.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.updatedAt}>最終改定日：{TERMS_UPDATED_AT}</Text>
        {TERMS_SECTIONS.map(section => (
          <View key={section.heading} style={s.section}>
            <Text style={s.heading}>{section.heading}</Text>
            <Text style={s.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>

      {mode === 'accept' && (
        <View style={s.footer}>
          <Text style={s.footerNote}>
            上記の利用規約に同意のうえ、アプリのご利用を開始してください。
          </Text>
          <TouchableOpacity
            style={s.acceptBtn}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="利用規約に同意して開始"
          >
            <Text style={s.acceptBtnText}>同意して開始する</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const C = {
  primary: '#304E78',
  bg: '#F2EBE4',
  card: '#FFFFFF',
  border: '#D9D0C8',
  text: '#333333',
  sub: '#555555',
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: C.primary },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  closeBtnText: { color: C.primary, fontSize: 15 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  updatedAt: { fontSize: 12, color: C.sub, marginBottom: 16 },
  section: { marginBottom: 18 },
  heading: { fontSize: 15, fontWeight: 'bold', color: C.text, marginBottom: 6 },
  body: { fontSize: 13, color: C.sub, lineHeight: 21 },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerNote: { fontSize: 12, color: C.sub, textAlign: 'center', marginBottom: 10 },
  acceptBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
