import { useEffect, useRef, useState } from 'react';
import type { MissionStatus, PlotViewTrigger, TutorialStage } from '@/domain/tutorial';
import type { PlotIndex } from '@/domain/types';

export type UsePlotTriggersResult = {
  /** 現在表示中のトリガー。null = 非表示 */
  currentTrigger: PlotViewTrigger | null;
  dismissTrigger: () => void;
};

/**
 * プロット表示トリガーを監視するフック。
 * - selectedPlotIndex が変化したとき、条件を満たすトリガーがあれば表示キューに積む。
 * - 一度発火したトリガーは再発火しない。
 * - active=false（ゲーム未開始）の間は発火しない。
 */
export function usePlotTriggers(
  stage: TutorialStage | undefined,
  selectedPlotIndex: PlotIndex,
  missionStatuses: MissionStatus[],
  active: boolean,
): UsePlotTriggersResult {
  const firedRef = useRef<Set<number>>(new Set());
  const [queue, setQueue] = useState<PlotViewTrigger[]>([]);

  useEffect(() => {
    if (!active || !stage?.plotTriggers) return;
    const newTriggers: PlotViewTrigger[] = [];
    stage.plotTriggers.forEach((trigger, i) => {
      if (firedRef.current.has(i)) return;
      if (trigger.plotIndex !== selectedPlotIndex) return;
      if (trigger.afterMissionIndex !== undefined) {
        for (let m = 0; m <= trigger.afterMissionIndex; m++) {
          if (!missionStatuses[m]?.completed) return;
        }
      }
      firedRef.current.add(i);
      newTriggers.push(trigger);
    });
    if (newTriggers.length > 0) {
      setQueue(q => [...q, ...newTriggers]);
    }
  }, [selectedPlotIndex, missionStatuses, active, stage]);

  const dismissTrigger = () => setQueue(q => q.slice(1));

  return { currentTrigger: queue[0] ?? null, dismissTrigger };
}
