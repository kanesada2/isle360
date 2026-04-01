import { useLocalSearchParams } from 'expo-router';
import { GameScreen } from '@/components/game-screen';

export default function GamePage() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const initialMapSeed = seed ? parseInt(seed, 10) : undefined;
  return <GameScreen initialMapSeed={Number.isFinite(initialMapSeed) ? initialMapSeed : undefined} />;
}
