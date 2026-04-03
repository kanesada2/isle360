import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getDailySeed, upsertDailySeed } from '@/db/local';
import { decodeLogs } from '@/domain/log-codec';
import { useSoundContext } from '@/sound';

const DAILY_API = 'https://isle.guts-kk-89.workers.dev/api/daily/seed';

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

  // Daily: 今日プレイ済みかどうか（null = 未確認）
  const [todayPlayed, setTodayPlayed] = useState<boolean | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // モーダルを開くたびに今日のレコードを確認する
  useEffect(() => {
    if (!playModalVisible) return;
    getDailySeed(getTodayDate())
      .then((row) => setTodayPlayed(row !== null))
      .catch(() => setTodayPlayed(false));
  }, [playModalVisible]);

  const playItems = useMemo<LaunchItem[]>(() => [
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
      key: 'daily',
      label: 'Daily',
      description: todayPlayed
        ? '本日のデイリーチャレンジはプレイ済みです。'
        : '今日のデイリーチャレンジです。全プレイヤーが1日1回だけ同じマップに挑戦できます。',
      disabled: todayPlayed === true,
    },
    {
      key: 'seed',
      label: 'Seed',
      description: '指定したシード値のマップでプレイします。同じシードなら同じマップが再現されます。',
      inputType: 'seed',
      inputPlaceholder: 'シード値（数値）を入力',
    },
  ], [todayPlayed]);

  async function handlePlayGo(key: string, inputValue: string) {
    switch (key) {
      case 'daily': {
        const date = getTodayDate();
        setDailyLoading(true);
        try {
          const res = await fetch(`${DAILY_API}?date=${date}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { date: string; seed: number };
          await upsertDailySeed(data.date, data.seed);
          setTodayPlayed(true);
          setPlayModalVisible(false);
          router.push({ pathname: '/game', params: { seed: String(data.seed) } });
        } catch(e) {
          console.log(e)
          Alert.alert('エラー', 'デイリーチャレンジの取得に失敗しました。ネットワーク接続を確認してください。');
        } finally {
          setDailyLoading(false);
        }
        break;
      }
      case 'tutorial':
        setPlayModalVisible(false);
        router.push('/tutorial');
        break;
      case 'random':
        setPlayModalVisible(false);
        router.push('/game');
        break;
      case 'seed': {
        const seed = parseInt(inputValue.trim(), 10);
        if (!Number.isFinite(seed)) {
          Alert.alert('エラー', '有効な数値を入力してください。');
          return;
        }
        setPlayModalVisible(false);
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
        items={playItems}
        onGo={handlePlayGo}
        goLoading={dailyLoading}
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
