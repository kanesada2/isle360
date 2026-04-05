import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';

const USER_NAME_API = __DEV__
  ? 'http://localhost:5173/api/user/name'
  : 'https://api.isle360.nosada.com/api/user/name';

export default function AccountScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const { data: session, isPending } = authClient.useSession();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = (session?.user as { displayName?: string })?.displayName ?? '';

  useEffect(() => {
    if (displayName) {
      setName(displayName);
    }
  }, [displayName]);

  async function handleSave() {
    if (saving || name.trim().length === 0) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(USER_NAME_API, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await authClient.getSession({ fetchOptions: { cache: 'no-store' } });
      setSaved(true);
    } catch {
      setError('保存に失敗しました。再度お試しください。');
    } finally {
      setSaving(false);
    }
  }

  const isDirty = name.trim() !== displayName;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ヘッダー */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundSelected }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backLabel, { color: colors.textSecondary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isPending ? (
          <ActivityIndicator style={styles.loader} />
        ) : !session ? (
          <Text style={[styles.notLoggedIn, { color: colors.textSecondary }]}>
            ログインしていません
          </Text>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>表示名</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                  backgroundColor: colors.backgroundElement,
                },
              ]}
              value={name}
              onChangeText={(v) => { setName(v); setSaved(false); setError(null); }}
              placeholder="名前を入力"
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={32}
            />

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <Pressable
              disabled={saving || !isDirty || name.trim().length === 0}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.text,
                  opacity: (saving || !isDirty || name.trim().length === 0) ? 0.4 : 1,
                },
              ]}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.background }]}>
                  {saved ? '保存しました' : '保存'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 64,
  },
  backLabel: {
    fontSize: 15,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  loader: {
    marginTop: Spacing.six,
  },
  notLoggedIn: {
    textAlign: 'center',
    marginTop: Spacing.six,
    fontSize: 15,
  },
  form: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  errorText: {
    color: '#EF5350',
    fontSize: 13,
  },
  saveButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
