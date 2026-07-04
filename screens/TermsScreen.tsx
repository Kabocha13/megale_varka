import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TERMS_SECTIONS, TERMS_UPDATED_AT } from '../services/terms';

interface TermsScreenProps {
  /** accept: 初回起動時の同意画面 / view: 設定画面などからの閲覧のみ */
  mode: 'accept' | 'view';
  onAccept?: () => void;
  onClose?: () => void;
  topInset?: number;
  bottomInset?: number;
}

export default function TermsScreen({ mode, onAccept, onClose, topInset, bottomInset }: TermsScreenProps) {
  const insets = useSafeAreaInsets();
  const safeTop = topInset ?? insets.top;
  const safeBottom = bottomInset ?? insets.bottom;
  const { height } = useWindowDimensions();
  const isCompactHeight = height < 700;
  const headerVerticalPadding = isCompactHeight ? 8 : 12;
  const headerStyle = [
    s.header,
    {
      paddingTop: safeTop + headerVerticalPadding,
      paddingBottom: headerVerticalPadding,
    },
  ];
  const contentStyle = [
    s.content,
    { paddingBottom: mode === 'accept' ? 24 : Math.max(32, safeBottom + 24) },
  ];
  const footerStyle = [
    s.footer,
    { paddingBottom: Math.max(16, safeBottom + 16) },
  ];

  return (
    <SafeAreaView style={s.root} edges={['left', 'right']}>
      <View style={headerStyle}>
        <Text style={s.headerTitle} numberOfLines={1}>利用規約</Text>
        {mode === 'view' && (
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="利用規約を閉じる"
          >
            <Text style={s.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={contentStyle}>
        <Text style={s.updatedAt}>最終改定日：{TERMS_UPDATED_AT}</Text>
        {TERMS_SECTIONS.map(section => (
          <View key={section.heading} style={s.section}>
            <Text style={s.heading}>{section.heading}</Text>
            <Text style={s.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>

      {mode === 'accept' && (
        <View style={footerStyle}>
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
    </SafeAreaView>
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: C.primary },
  closeBtn: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  closeBtnText: { color: C.primary, fontSize: 15 },
  scroll: { flex: 1 },
  content: { padding: 20 },
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
