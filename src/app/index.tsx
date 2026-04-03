import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LaunchModal, type LaunchItem } from '@/components/launch-modal';
import { SoundSettingsModal } from '@/components/sound-settings-modal';
import { Colors, Spacing } from '@/constants/theme';
import { decodeLogs } from '@/domain/log-codec';
import { useSoundContext } from '@/sound';

const PLAY_ITEMS: LaunchItem[] = [
  {
    key: 'tutorial',
    label: 'Tutorial',
    description: '基本的な操作を学べるチュートリアルモードです。施設の建設や研究など、ゲームの流れをひと通り体験できます。',
  },
  {
    key: 'random',
    label: 'Random',
    description: 'ランダムに生成されたマップでプレイします。毎回異なる資源配置が楽しめます。',
  },
  {
    key: 'seed',
    label: 'Seed',
    description: '指定したシード値のマップでプレイします。同じシードなら同じマップが再現されます。',
    inputType: 'seed',
    inputPlaceholder: 'シード値（数値）を入力',
  },
];

const REPLAY_ITEMS: LaunchItem[] = [
  {
    key: 'history',
    label: 'History',
    description: '過去のプレイ履歴を一覧表示します。各プレイのSeed・Score・日時を確認し、リプレイを再生できます。',
  },
  {
    key: 'code',
    label: 'Code',
    description: 'リプレイコードを入力して再生します。結果画面のコードをペーストしてください。',
    inputType: 'code',
    inputPlaceholder: 'リプレイコードを貼り付け',
  },
];

export default function TopScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const { playBgm } = useSoundContext();
  useFocusEffect(useCallback(() => { playBgm('main'); }, [playBgm]));

  const [playModalVisible, setPlayModalVisible] = useState(false);
  const [replayModalVisible, setReplayModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  function handlePlayGo(key: string, inputValue: string) {
    setPlayModalVisible(false);
    switch (key) {
      case 'tutorial':
        router.push('/tutorial');
        break;
      case 'random':
        router.push('/game');
        break;
      case 'seed': {
        const seed = parseInt(inputValue.trim(), 10);
        if (!Number.isFinite(seed)) {
          Alert.alert('エラー', '有効な数値を入力してください。');
          return;
        }
        router.push({ pathname: '/game', params: { seed: String(seed) } });
        break;
      }
    }
  }

  function handleReplayGo(key: string, inputValue: string) {
    setReplayModalVisible(false);
    switch (key) {
      case 'history':
        router.push('/history');
        break;
      case 'code': {
        const token = inputValue.trim();
        try {
          const logs = decodeLogs(token);
          if (logs.length === 0) throw new Error('empty');
          router.push({ pathname: '/replay', params: { token } });
        } catch {
          Alert.alert('エラー', 'リプレイコードを正しく復元できませんでした。');
        }
        break;
      }
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
            onPress={() => setPlayModalVisible(true)}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>Play</Text>
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

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.text,
                backgroundColor: pressed ? colors.backgroundSelected : 'transparent',
              },
            ]}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Options</Text>
          </Pressable>
        </View>
      </View>

      <LaunchModal
        visible={playModalVisible}
        onClose={() => setPlayModalVisible(false)}
        items={PLAY_ITEMS}
        onGo={handlePlayGo}
      />

      <LaunchModal
        visible={replayModalVisible}
        onClose={() => setReplayModalVisible(false)}
        items={REPLAY_ITEMS}
        onGo={handleReplayGo}
      />

      <SoundSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />
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
});
