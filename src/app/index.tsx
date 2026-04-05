import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
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
import { authClient } from '@/lib/auth-client';
import { useSoundContext } from '@/sound';

const DAILY_API = __DEV__
  ? 'http://localhost:5173/api/daily/seed'
  : 'https://api.isle360.nosada.com/api/daily/seed';

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

  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [playModalVisible, setPlayModalVisible] = useState(false);
  const [replayModalVisible, setReplayModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Daily: 今日プレイ済みかどうか（null = 未確認）
  const [todayPlayed, setTodayPlayed] = useState<boolean | null>(null);
  const [dailySeedData, setDailySeedData] = useState<{ date: string; seed: number } | null>(null);
  const [dailyFetching, setDailyFetching] = useState(false);
  const [dailyFetchError, setDailyFetchError] = useState(false);
  const [dailyAlreadyPlayed, setDailyAlreadyPlayed] = useState(false);

  // モーダルを開くたびに今日のレコード確認 + API フェッチを同時に行う（ログイン済みの場合のみ）
  useEffect(() => {
    if (!playModalVisible) return;
    if (!session) return;

    const date = getTodayDate();

    setDailySeedData(null);
    setDailyFetchError(false);
    setDailyAlreadyPlayed(false);
    setDailyFetching(true);
    fetch(`${DAILY_API}?date=${date}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 409) {
          setDailyAlreadyPlayed(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { date: string; seed: number };
        setDailySeedData(data);
      })
      .catch(() => setDailyFetchError(true))
      .finally(() => setDailyFetching(false));
  }, [playModalVisible, session]);

  const playItems = useMemo<LaunchItem[]>(() => {
    const needsLogin = !session && !sessionPending;
    return [
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
        key: 'score',
        label: 'Score',
        description: needsLogin
          ? 'プレイするにはログインが必要です。'
          : 'ランダムマップでスコアを記録します。ログインしているとランキングに登録されます。',
        goLabel: needsLogin ? 'サインイン' : undefined,
      },
      {
        key: 'daily',
        label: 'Daily',
        description: needsLogin
          ? 'プレイするにはログインが必要です。'
          : todayPlayed || dailyAlreadyPlayed
          ? '今日は既に挑戦済みです。'
          : dailyFetchError
          ? 'デイリーチャレンジの取得に失敗しました。再度お試しください。'
          : dailyFetching
          ? 'デイリーチャレンジを取得中...'
          : '今日のデイリーチャレンジです。全プレイヤーが1日1回だけ同じマップに挑戦できます。',
        disabled: !needsLogin && (todayPlayed === true || dailyAlreadyPlayed || dailyFetching || dailyFetchError),
        goLabel: needsLogin ? 'サインイン' : undefined,
      },
      {
        key: 'seed',
        label: 'Seed',
        description: '指定したシード値のマップでプレイします。同じシードなら同じマップが再現されます。',
        inputType: 'seed',
        inputPlaceholder: 'シード値（数値）を入力',
      },
    ];
  }, [session, sessionPending, todayPlayed, dailyAlreadyPlayed, dailyFetchError, dailyFetching]);

  async function signInWithGoogle() {
    const callbackURL = Platform.OS === 'web'
      ? `${window.location.origin}/account`
      : Linking.createURL('/account');
    await authClient.signIn.social({ provider: 'google', callbackURL });
  }

  async function handlePlayGo(key: string, inputValue: string) {
    // 未ログイン時はサインインフローへ
    if (!session && (key === 'daily' || key === 'score')) {
      await signInWithGoogle();
      return;
    }
    switch (key) {
      case 'daily': {
        if (!dailySeedData) return;
        setTodayPlayed(true);
        setPlayModalVisible(false);
        router.push({ pathname: '/game', params: { seed: String(dailySeedData.seed), date: dailySeedData.date, source: 'daily' } });
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
      case 'score':
        setPlayModalVisible(false);
        router.push({ pathname: '/game', params: { source: 'score' } });
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
            onPress={() => router.push('/rank')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Rank</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.text,
                backgroundColor: pressed ? colors.backgroundSelected : 'transparent',
              },
            ]}
            onPress={() => router.push('/account')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Account</Text>
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
