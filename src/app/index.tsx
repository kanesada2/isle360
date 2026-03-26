import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { decodeLogs } from '@/domain/log-codec';

export default function TopScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [replayModalVisible, setReplayModalVisible] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  function handleReplayConfirm() {
    const token = tokenInput.trim();
    try {
      const logs = decodeLogs(token);
      if (logs.length === 0) throw new Error('empty');
      setReplayModalVisible(false);
      setTokenInput('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/replay', params: { token } });
    } catch {
      Alert.alert('エラー', 'トークンを正しく復元できませんでした。');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.text }]}>Isle 360</Text>

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={() => router.push('/game')}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>New Game</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.text,
                backgroundColor: pressed ? colors.backgroundSelected : 'transparent',
              },
            ]}
            onPress={() => setReplayModalVisible(true)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Replay</Text>
          </Pressable>
        </View>
      </View>

      {/* トークン入力モーダル */}
      <Modal
        visible={replayModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReplayModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setReplayModalVisible(false)}>
          <Pressable style={[styles.tokenCard, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>
            <Text style={[styles.tokenCardTitle, { color: colors.text }]}>ログトークンを入力</Text>
            <TextInput
              style={[styles.tokenInput, { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.background }]}
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="トークンを貼り付け"
              placeholderTextColor={colors.textSecondary}
              multiline
              autoFocus
            />
            <View style={styles.tokenCardButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.tokenCancelButton,
                  { backgroundColor: pressed ? colors.backgroundSelected : colors.background },
                ]}
                onPress={() => { setReplayModalVisible(false); setTokenInput(''); }}
              >
                <Text style={[styles.tokenButtonText, { color: colors.textSecondary }]}>キャンセル</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.tokenConfirmButton,
                  { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
                ]}
                onPress={handleReplayConfirm}
              >
                <Text style={[styles.tokenButtonText, { color: colors.background }]}>再生</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four * 2,
    paddingHorizontal: Spacing.four,
  },
  title: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
  },
  buttons: {
    gap: Spacing.three,
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four * 2,
    borderRadius: Spacing.two,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four * 2,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // トークン入力モーダル
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  tokenCard: {
    width: '100%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  tokenCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  tokenInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tokenCardButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tokenCancelButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  tokenConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  tokenButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
