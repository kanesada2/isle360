import { useLocalSearchParams } from 'expo-router';
import { GameScreen } from '@/components/game-screen';
import { decodeLogs } from '@/domain/log-codec';
import type { GameLogEntry } from '@/domain/types';
import { useMemo } from 'react';

export default function ReplayPage() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const replayLogs: GameLogEntry[] = useMemo(() => {
    try {
      return decodeLogs(token ?? '');
    } catch {
      return [];
    }
  }, [token]);

  return <GameScreen replayLogs={replayLogs} />;
}
