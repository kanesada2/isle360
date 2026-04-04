import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { GameScreen } from '@/components/game-screen';

const GAME_START_API = 'https://isle.guts-kk-89.workers.dev/api/game/start';

export default function GamePage() {
  const router = useRouter();
  const { seed, date, source } = useLocalSearchParams<{ seed?: string; date?: string; source?: string }>();

  const parsedSeed = seed ? parseInt(seed, 10) : undefined;
  const initialMapSeed = Number.isFinite(parsedSeed) ? parsedSeed : undefined;

  // random の場合はここでシードを確定させて API と GameScreen 両方に渡す
  const resolvedSeed = useRef<number>(
    initialMapSeed ?? Math.floor(Math.random() * 2 ** 32)
  );

  const [gameId, setGameId] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    if (source !== 'score' && source !== 'daily') return;
    calledRef.current = true;

    fetch(GAME_START_API, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: resolvedSeed.current,
        date: source === 'daily' ? (date ?? null) : null,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { id: string };
        setGameId(data.id);
      })
      .catch((e: unknown) => {
        const isUnauthorized = e instanceof Error && e.message.includes('401');
        Alert.alert(
          'スコア登録できません',
          isUnauthorized
            ? '未ログインのためスコアの登録ができません。このまま続けますか？'
            : 'ネットワークエラーによりスコアの登録ができません。このまま続けますか？',
          [
            { text: 'やめる', style: 'cancel', onPress: () => router.back() },
            { text: '続ける', style: 'default' },
          ],
        );
      });
  }, []);

  console.log('gameId', gameId); // TODO: スコア提出時に使用

  return <GameScreen initialMapSeed={resolvedSeed.current} />;
}
