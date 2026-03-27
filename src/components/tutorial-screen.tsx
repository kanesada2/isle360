import React from 'react';

import { GameScreen } from '@/components/game-screen';
import type { TutorialStage } from '@/domain/tutorial';

type Props = {
  stage: TutorialStage;
  /** 全ミッション達成後のボタン押下時に呼ばれる。省略時はトップ画面へ遷移 */
  onComplete?: () => void;
};

/**
 * チュートリアル用スクリーン。
 * TutorialStage データを渡すだけで、マップ生成・ミッション追跡・完了モーダルが
 * すべて GameScreen 内で動作する。
 */
export function TutorialScreen({ stage, onComplete }: Props) {
  return <GameScreen tutorialStage={stage} onTutorialComplete={onComplete} />;
}
