import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateMissions } from '@/domain/tutorial';
import type { Mission, MissionStatus, TutorialStage } from '@/domain/tutorial';
import type { Game } from '@/domain/types';

export type UseMissionsResult = {
  /** 全ミッションの現在の達成状況 */
  statuses: MissionStatus[];
  /** 新たに達成されたミッション（表示待ちキューの先頭）。null = 表示なし */
  currentMission: Mission | null;
  /** currentMission のモーダルを閉じてキューを進める */
  dismissCurrent: () => void;
  /** 全ミッション達成済みか */
  allDone: boolean;
};

/**
 * ミッション追跡フック。
 * - ゲーム状態の変化を監視し、新たに達成されたミッションを pendingMissions キューに積む。
 * - active=false（ゲーム未開始）の間は変化を検知しない（初期完了済みミッションの誤通知防止）。
 */
export function useMissions(
  stage: TutorialStage | undefined,
  game: Game,
  active: boolean,
): UseMissionsResult {
  const rawStatuses = useMemo(
    () => (stage ? evaluateMissions(stage.missions, game) : []),
    [stage, game],
  );

  // 一度達成したミッションは取り消されない（永続的に completed=true）
  const everCompletedRef = useRef<Set<number>>(new Set());

  const statuses: MissionStatus[] = useMemo(
    () => rawStatuses.map((s, i) => ({
      ...s,
      completed: everCompletedRef.current.has(i) || s.completed,
    })),
    [rawStatuses],
  );

  const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);

  useEffect(() => {
    if (!active) return;
    const newlyDone: Mission[] = [];
    for (let i = 0; i < rawStatuses.length; i++) {
      // 前のミッションが全て完了済みでなければ、このミッションはまだ達成不可
      if (!everCompletedRef.current.has(i - 1) && i > 0) break;
      if (rawStatuses[i].completed && !everCompletedRef.current.has(i)) {
        everCompletedRef.current.add(i);
        newlyDone.push(rawStatuses[i].mission);
      }
    }
    if (newlyDone.length > 0) {
      setPendingMissions(q => [...q, ...newlyDone]);
    }
  }, [rawStatuses, active]);

  const dismissCurrent = () => setPendingMissions(q => q.slice(1));
  const allDone = statuses.length > 0 && statuses.every(s => s.completed);

  return {
    statuses,
    currentMission: pendingMissions[0] ?? null,
    dismissCurrent,
    allDone,
  };
}
