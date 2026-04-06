import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runOnJS } from 'react-native-worklets';

import { runAgent } from '@/agent/simulator';
import { BuildModal } from '@/components/build-modal';
import { FacilityDetailModal } from '@/components/facility-detail-modal';
import { MissionBar } from '@/components/mission-bar';
import { MissionCompleteModal } from '@/components/mission-complete-modal';
import { PhaseResourceBar } from '@/components/phase-resource-bar';
import { ResearchModal } from '@/components/research-modal';
import { ResultModal } from '@/components/result-modal';
import { SoundSettingsModal } from '@/components/sound-settings-modal';
import { StartOverlay } from '@/components/start-overlay';
import { TimerBar } from '@/components/timer-bar';
import { TutorialCompleteModal } from '@/components/tutorial-complete-modal';
import { TutorialHintModal } from '@/components/tutorial-hint-modal';
import { Colors, Spacing } from '@/constants/theme';
import { insertPlayLog } from '@/db/local';
import {
  applyReplayEvent,
  buildFacility,
  computeScore,
  demolishFacility,
  getFacilityDetailRows,
  getFacilityDisplayName,
  getMineralBuildDiscountRate,
  startGame,
  startResearch,
  tickFacilities,
} from '@/domain/facility-actions';
import type { FacilityCatalogEntry } from '@/domain/facility-catalog';
import { createGame } from '@/domain/game';
import { encodeLogs } from '@/domain/log-codec';
import { scoreFromLogs } from '@/domain/replay-simulator';
import type { ResearchCatalogEntry } from '@/domain/research-catalog';
import { getUnlockedPhases } from '@/domain/research-unlock';
import type { TutorialStage } from '@/domain/tutorial';
import { createTutorialGame } from '@/domain/tutorial';
import type { Game, GameLogEntry, PlotIndex, ResourcePhase } from '@/domain/types';
import { useGameLoop } from '@/hooks/use-game-loop';
import { useMissions } from '@/hooks/use-missions';
import { usePlotTriggers } from '@/hooks/use-plot-triggers';
import { useSoundContext } from '@/sound';

const SESSION_DURATION_MS = 360_000;
const INITIAL_FUNDS = 1_000;
const SWIPE_THRESHOLD = 40;
const SPEED_STEPS: (0.5 | 1 | 2 | 3)[] = [0.5, 1, 2, 3];
/** リプレイ時のサブティック刻み幅（仮想ms）。倍速分だけ1フレームで複数回tickを回す */
const SUBTICK_MS = 16;

type Props = {
  /** リプレイモード用のログ。指定するとリプレイ画面として動作する */
  replayLogs?: GameLogEntry[];
  /** チュートリアルステージ設定。指定するとチュートリアルモードで動作する */
  tutorialStage?: TutorialStage;
  /** チュートリアル完了時のコールバック。省略時はトップ画面に戻る */
  onTutorialComplete?: () => void;
  /** 指定シードでマップを生成する（Play with seed 用） */
  initialMapSeed?: number;
  /** スコア登録用ゲームID（score/dailyモード時のみ） */
  gameId?: string | null;
  /** デイリーチャレンジの日付（dailyモード時のみ） */
  date?: string | null;
};

export function GameScreen({ replayLogs, tutorialStage, onTutorialComplete, initialMapSeed, gameId, date }: Props) {
  const isReplay = !!replayLogs;
  const isTutorial = !!tutorialStage;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // リプレイ時は game-start エントリの mapSeed でゲームを初期化
  const mapSeed = useMemo(() => {
    if (!replayLogs) return undefined;
    return replayLogs.find((e) => e.kind === 'game-start')?.mapSeed;
  }, [replayLogs]);

  const [game, setGame] = useState<Game>(() =>
    isTutorial
      ? createTutorialGame(tutorialStage!)
      : createGame({ sessionDurationMs: SESSION_DURATION_MS, initialFunds: INITIAL_FUNDS, mapSeed: mapSeed ?? initialMapSeed }),
  );

  const gameStarted = game.status !== 'setup';
  const gameFinished = game.status === 'finished';

  const { playEffect, playBgm, stopBgm } = useSoundContext();

  // ── 再生速度（リプレイのみ）────────────────────────────────────
  const [speedMultiplier, setSpeedMultiplier] = useState<0.5 | 1 | 2 | 3>(1);
  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

  // リプレイ用仮想時間管理
  const virtualElapsedRef = useRef(0);       // ゲーム開始からの仮想経過 ms（目標値）
  const lastProcessedVirtualMsRef = useRef(0); // サブティックで処理済みの仮想経過 ms
  const prevRealNowRef = useRef<number | null>(null);

  // リプレイイベントのディスパッチ済みインデックス
  const replayEventIndexRef = useRef(0);
  const dispatchableEvents = useMemo(
    () => (replayLogs ?? []).filter(
      (e) => e.kind === 'construction-start' || e.kind === 'demolish-start' || e.kind === 'research-start',
    ),
    [replayLogs],
  );

  const [now, setNow] = useState(() => Date.now());

  useGameLoop((realNow) => {
    if (isReplay) {
      // リプレイモード: 仮想時間をサブティック方式で処理する。
      // 倍速分だけ1フレームあたりのtick数を増やすことで、
      // イベントの順序が崩れず研究・採掘の計算も正確になる。
      if (prevRealNowRef.current !== null) {
        const delta = realNow - prevRealNowRef.current;
        virtualElapsedRef.current += delta * speedMultiplierRef.current;
      }
      prevRealNowRef.current = realNow;

      const targetVirtualElapsed = virtualElapsedRef.current;
      const gameStartedAt = game.startedAt ?? realNow;

      setNow(gameStartedAt + targetVirtualElapsed);
      setGame((g) => {
        let nextG = g;
        const startedAt = g.startedAt ?? realNow;
        // SUBTICK_MS 刻みで tick を回し、各ステップでイベントを dispatch する
        while (lastProcessedVirtualMsRef.current + SUBTICK_MS <= targetVirtualElapsed) {
          lastProcessedVirtualMsRef.current += SUBTICK_MS;
          const subVNow = startedAt + lastProcessedVirtualMsRef.current;
          nextG = tickFacilities(nextG, subVNow);
          while (
            replayEventIndexRef.current < dispatchableEvents.length &&
            dispatchableEvents[replayEventIndexRef.current].elapsedMs <= lastProcessedVirtualMsRef.current
          ) {
            nextG = applyReplayEvent(nextG, dispatchableEvents[replayEventIndexRef.current], subVNow);
            replayEventIndexRef.current++;
          }
        }
        return nextG;
      });
    } else {
      // 通常モード: 実時間で1フレーム1tick
      setNow(realNow);
      setGame((g) => tickFacilities(g, realNow));
    }
  }, game.status === 'playing');

  const remaining =
    game.startedAt !== null
      ? Math.max(0, game.sessionDurationMs - (now - game.startedAt))
      : game.sessionDurationMs;

  useEffect(() => {
    if (!gameStarted || gameFinished) return;
    if (remaining === 0) {
      setGame((g) => ({ ...g, status: 'finished' }));
    }
  }, [remaining, gameStarted, gameFinished]);

  // ── ミッション追跡（チュートリアルのみ）────────────────────────
  const { statuses: missionStatuses, currentMission, dismissCurrent, allDone: missionAllDone } =
    useMissions(tutorialStage, game, gameStarted);

  // 最後に閉じたヒントモーダルの内容（「?」ボタンで再表示）
  const [lastHint, setLastHint] = useState<{ title?: string; body: string; buttonLabel?: string } | null>(null);
  const [lastHintVisible, setLastHintVisible] = useState(false);

  // チュートリアルスタートヒント（StartOverlay の代替）
  const [startHintDismissed, setStartHintDismissed] = useState(false);
  const tutorialStartHint = (isTutorial && tutorialStage && !startHintDismissed)
    ? { title: tutorialStage.startOverlay.title, body: tutorialStage.startOverlay.body, buttonLabel: tutorialStage.startOverlay.buttonLabel ?? 'スタート' }
    : null;

  const handleDismissMission = useCallback(() => {
    if (currentMission?.completionMessage) {
      setLastHint({ title: currentMission.label, body: currentMission.completionMessage });
    }
    dismissCurrent();
  }, [currentMission, dismissCurrent]);

  // 全ミッション達成でゲームを終了させる
  useEffect(() => {
    if (!isTutorial || !missionAllDone || gameFinished || !gameStarted) return;
    setGame(g => ({ ...g, status: 'finished' }));
  }, [isTutorial, missionAllDone, gameFinished, gameStarted]);

  const [resultVisible, setResultVisible] = useState(false);
  const [tutorialCompleteVisible, setTutorialCompleteVisible] = useState(false);
  const [agentResult, setAgentResult] = useState<{ logs: GameLogEntry[]; score: number } | null>(null);

  useEffect(() => {
    if (!gameFinished) return;
    playEffect('game_end');
    stopBgm();
    setBuildModalVisible(false);
    setFacilityDetailVisible(false);
    setLabModalVisible(false);
    if (!isTutorial) {
      setResultVisible(true);
      if (!isReplay) {
        insertPlayLog({
          seed: game.mapSeed,
          score: computeScore(game).total,
          log: encodeLogs(game.logs),
        }).catch(console.error);
      }
      // 同じシードでエージェントをシミュレートしてNPCスコアを計算（リプレイ時はスキップ）
      if (!isReplay) {
        setTimeout(() => {
          const agentGame = startGame(
            createGame({ sessionDurationMs: SESSION_DURATION_MS, initialFunds: INITIAL_FUNDS, mapSeed: game.mapSeed }),
            Date.now(),
          );
          const finalGame = runAgent(agentGame);
          setAgentResult({ logs: finalGame.logs, score: scoreFromLogs(finalGame.logs).total });
        }, 0);
      }
    }
  }, [gameFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  // 施設の状態変化（完了イベント）を検知して SE を鳴らす
  const prevFacilitiesRef = useRef(game.facilities);
  useEffect(() => {
    const prev = prevFacilitiesRef.current;
    const curr = game.facilities;
    for (const [id, f] of curr) {
      const prevF = prev.get(id);
      if (prevF?.state === 'constructing' && f.state === 'idle') {
        playEffect(f.kind === 'monument' ? 'monument_complete' : 'build_complete');
      } else if (prevF?.state === 'processing' && f.state === 'idle') {
        playEffect('research_complete');
      }
    }
    for (const id of prev.keys()) {
      if (!curr.has(id)) playEffect('demolish_complete');
    }
    prevFacilitiesRef.current = curr;
  }, [game.facilities, playEffect]);

  // チュートリアル完了モーダルは、最後のミッション達成メッセージを閉じてから表示する
  useEffect(() => {
    if (!isTutorial || !gameFinished || currentMission !== null) return;
    setTutorialCompleteVisible(true);
  }, [isTutorial, gameFinished, currentMission]);

  const scoreBreakdown = useMemo(
    () => scoreFromLogs(game.logs),
    [gameFinished], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── プロットナビゲーション ────────────────────────────────────
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<PlotIndex>(4);

  // ── プロット表示トリガー（チュートリアルのみ）────────────────
  const { currentTrigger, dismissTrigger } =
    usePlotTriggers(tutorialStage, selectedPlotIndex, missionStatuses, gameStarted);

  const handleDismissTrigger = useCallback(() => {
    if (currentTrigger) {
      setLastHint({ title: currentTrigger.title, body: currentTrigger.body, buttonLabel: currentTrigger.buttonLabel });
    }
    dismissTrigger();
  }, [currentTrigger, dismissTrigger]);

  // トリガーモーダル・ミッション達成モーダルのいずれか表示中のヒント（統合）
  const visibleHint = currentTrigger ?? (lastHintVisible ? lastHint : null);
  const handleDismissHint = currentTrigger ? handleDismissTrigger : () => setLastHintVisible(false);
  const currentIndexSv = useSharedValue<number>(4);

  const unlockedPhases = useMemo(
    () => getUnlockedPhases(game.player.completedResearch),
    [game.player.completedResearch],
  );



  const { phaseTotals, phaseCurrents, phaseUnlocked } = useMemo(() => {
    const totals: Record<ResourcePhase, number> = { 1: 0, 2: 0, 3: 0 };
    const currents: Record<ResourcePhase, number> = { 1: 0, 2: 0, 3: 0 };
    const unlocked: Record<ResourcePhase, boolean> = { 1: false, 2: false, 3: false };
    for (const deposit of game.plots[selectedPlotIndex].deposits) {
      if (unlockedPhases.has(deposit.phase)) {
        totals[deposit.phase] = Math.round((totals[deposit.phase] + deposit.abundance) * 100) / 100;
        currents[deposit.phase] = Math.round((currents[deposit.phase] + deposit.current) * 100) / 100;
        unlocked[deposit.phase] = true;
      }
    }
    return { phaseTotals: totals, phaseCurrents: currents, phaseUnlocked: unlocked };
  }, [game.plots, selectedPlotIndex, unlockedPhases]);

  const navigateTo = useCallback((index: number) => {
    setSelectedPlotIndex(index as PlotIndex);
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan().onEnd((e) => {
        'worklet';
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;
        const current = currentIndexSv.value;
        const row = Math.floor(current / 3);
        const col = current % 3;
        let next = current;
        if (absX > absY) {
          if (e.translationX > 0 && col > 0) next = current - 1;
          else if (e.translationX < 0 && col < 2) next = current + 1;
        } else {
          if (e.translationY > 0 && row > 0) next = current - 3;
          else if (e.translationY < 0 && row < 2) next = current + 3;
        }
        if (next !== current) {
          currentIndexSv.value = next;
          runOnJS(navigateTo)(next);
          runOnJS(playEffect)('swipe');
        }
      }),
    [currentIndexSv, navigateTo, playEffect],
  );

  const handleStart = useCallback(() => {
    const t = Date.now();
    prevRealNowRef.current = t;
    virtualElapsedRef.current = 0;
    lastProcessedVirtualMsRef.current = 0;
    replayEventIndexRef.current = 0;
    setGame((g) => startGame(g, t));
    setNow(t);
    playEffect('game_start');
    playBgm('game');
  }, [playEffect, playBgm]);

  const handleDismissStartHint = useCallback(() => {
    if (tutorialStage) {
      setLastHint({ title: tutorialStage.startOverlay.title, body: tutorialStage.startOverlay.body, buttonLabel: tutorialStage.startOverlay.buttonLabel });
    }
    setStartHintDismissed(true);
    handleStart();
  }, [tutorialStage, handleStart]);

  const handleRestart = useCallback(() => {
    router.replace('/');
  }, [router]);

  const [buildModalVisible, setBuildModalVisible] = useState(false);
  const [facilityDetailVisible, setFacilityDetailVisible] = useState(false);
  const [labModalVisible, setLabModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const currentFacility = useMemo(() => {
    const facilityId = game.plots[selectedPlotIndex].facilityId;
    return facilityId ? game.facilities.get(facilityId) : undefined;
  }, [game.plots, game.facilities, selectedPlotIndex]);

  const facilityDetailRows = useMemo(
    () => currentFacility
      ? getFacilityDetailRows(currentFacility, game.plots, game.facilities, game.player.completedResearch)
      : [],
    [currentFacility, game.plots, game.facilities, game.player.completedResearch],
  );


  const handleFacilityTap = useCallback(() => {
    if (gameFinished) {
      setTimeout(() => setResultVisible(true), 0);
      return;
    }
    if (!gameStarted) return;
    if (!currentFacility) {
      setTimeout(() => setBuildModalVisible(true), 0);
      return;
    }
    if (currentFacility.kind === 'laboratory') {
      if (currentFacility.state === 'idle' || currentFacility.state === 'processing') {
        setTimeout(() => setLabModalVisible(true), 0);
      }
    } else if (
      (currentFacility.state === 'idle' || currentFacility.state === 'stopped') &&
      (currentFacility.kind === 'extractor' || currentFacility.kind === 'refinery')
    ) {
      setTimeout(() => setFacilityDetailVisible(true), 0);
    }
  }, [gameFinished, gameStarted, currentFacility]);

  const handleFacilityTapRef = useRef(handleFacilityTap);
  handleFacilityTapRef.current = handleFacilityTap;
  const stableFacilityTap = useCallback(() => handleFacilityTapRef.current(), []);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(stableFacilityTap)();
      }),
    [stableFacilityTap],
  );

  const composedGesture = useMemo(
    () => Gesture.Race(tapGesture, panGesture),
    [tapGesture, panGesture],
  );

  const handleBuild = useCallback((entry: FacilityCatalogEntry) => {
    setGame((g) => buildFacility(g, selectedPlotIndex, entry, Date.now()));
    playEffect('build_start');
  }, [selectedPlotIndex, playEffect]);

  const handleDemolish = useCallback(() => {
    setGame((g) => demolishFacility(g, selectedPlotIndex, Date.now()));
    playEffect('demolish_start');
  }, [selectedPlotIndex, playEffect]);

  const cycleSpeed = useCallback(() => {
    setSpeedMultiplier((s) => {
      const idx = SPEED_STEPS.indexOf(s);
      return SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    });
  }, []);

  const speedBadgeTapGesture = useMemo(
    () => Gesture.Tap().onEnd(() => { 'worklet'; runOnJS(cycleSpeed)(); }),
    [cycleSpeed],
  );

  const showLastHint = useCallback(() => { setTimeout(() => setLastHintVisible(true), 0); }, []);
  const hintButtonTapGesture = useMemo(
    () => Gesture.Tap().onEnd(() => { 'worklet'; runOnJS(showLastHint)(); }),
    [showLastHint],
  );

  const showSettings = useCallback(() => { setTimeout(() => setSettingsModalVisible(true), 0); }, []);
  const gearTapGesture = useMemo(
    () => Gesture.Tap().onEnd(() => { 'worklet'; runOnJS(showSettings)(); }),
    [showSettings],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* フェーズ別資源バー */}
      <View style={styles.phaseBarsRow}>
        {([1, 2, 3] as const).map((phase) => (
          <PhaseResourceBar
            key={phase}
            phase={phase}
            unlocked={phaseUnlocked[phase]}
            total={phaseTotals[phase]}
            current={phaseCurrents[phase]}
          />
        ))}
      </View>

      {/* プロットマップ */}
      <GestureDetector gesture={composedGesture}>
        <View style={[styles.plotMap, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.plotMapLabel, { color: colors.textSecondary }]}>
            Plot #{selectedPlotIndex}
          </Text>

          {/* リプレイ速度バッジ */}
          {isReplay && gameStarted && !gameFinished && (
            <GestureDetector gesture={speedBadgeTapGesture}>
              <View style={[styles.speedBadge, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                <Text style={styles.speedBadgeText}>{speedMultiplier}×</Text>
              </View>
            </GestureDetector>
          )}

          {/* ヒント再表示ボタン（チュートリアルのみ） */}
          {isTutorial && lastHint && (
            <GestureDetector gesture={hintButtonTapGesture}>
              <View style={[styles.hintButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                <Text style={styles.hintButtonText}>?</Text>
              </View>
            </GestureDetector>
          )}

          {/* 設定ボタン */}
          <GestureDetector gesture={gearTapGesture}>
            <View style={[styles.gearButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
              <Text style={styles.gearButtonText}>⚙</Text>
            </View>
          </GestureDetector>

          {/* 3×3 ミニマップ */}
          <View style={styles.miniMap}>
            {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map((i) => (
              <View
                key={i}
                style={[
                  styles.miniMapCell,
                  { backgroundColor: i === selectedPlotIndex ? colors.text : colors.backgroundSelected },
                ]}
              />
            ))}
          </View>

          {/* 施設情報 */}
          {currentFacility ? (
            <View style={styles.facilityInfo}>
              <Text style={[styles.facilityName, { color: colors.text }]}>
                {getFacilityDisplayName(currentFacility)}
                {'  '}
                <Text style={{ color: colors.textSecondary }}>
                  {currentFacility.state === 'constructing' && '建設中'}
                  {currentFacility.state === 'demolishing' && '破壊中'}
                  {currentFacility.state === 'idle' && '稼働中'}
                  {currentFacility.state === 'stopped' && '停止中'}
                  {currentFacility.state === 'processing' && '処理中'}
                </Text>
              </Text>
              {currentFacility.currentJob && (() => {
                const ratio = Math.min(
                  1,
                  (now - currentFacility.currentJob.startedAt) / currentFacility.currentJob.durationMs,
                );
                const isDemolish = currentFacility.state === 'demolishing';
                return (
                  <View style={styles.facilityProgress}>
                    <View style={[styles.facilityProgressTrack, { backgroundColor: colors.backgroundSelected }]}>
                      <View
                        style={[
                          styles.facilityProgressFill,
                          { width: `${ratio * 100}%`, backgroundColor: isDemolish ? '#F44336' : '#4CAF50' },
                        ]}
                      />
                    </View>
                    <Text style={[styles.facilityProgressLabel, { color: colors.textSecondary }]}>
                      {Math.round(ratio * 100)}%
                    </Text>
                  </View>
                );
              })()}
            </View>
          ) : (
            <Text style={[styles.facilityName, { color: colors.backgroundSelected }]}>施設なし</Text>
          )}
        </View>
      </GestureDetector>

      {/* 下部操作バー */}
      <View style={styles.bottomBar}>
        {isTutorial
          ? <MissionBar statuses={missionStatuses} />
          : <TimerBar remaining={remaining} sessionDurationMs={game.sessionDurationMs} />
        }
        <View style={styles.fundsDisplay}>
          <Text style={[styles.fundsLabel, { color: colors.textSecondary }]}>資金</Text>
          <Text style={[styles.fundsValue, { color: colors.text }]}>
            {Math.floor(game.player.funds).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 建設モーダル */}
      <BuildModal
        visible={buildModalVisible}
        onClose={() => setBuildModalVisible(false)}
        onBuild={isReplay ? () => {} : handleBuild}
        completedResearch={game.player.completedResearch}
        facilities={game.facilities}
        funds={game.player.funds}
        discountRate={getMineralBuildDiscountRate(selectedPlotIndex, game.plots, game.player.completedResearch)}
        actionDisabled={isReplay}
      />

      {/* 施設詳細モーダル */}
      <FacilityDetailModal
        visible={facilityDetailVisible}
        onClose={() => setFacilityDetailVisible(false)}
        title={currentFacility ? getFacilityDisplayName(currentFacility) : ''}
        rows={facilityDetailRows}
        onDemolish={() => {
          setFacilityDetailVisible(false);
          handleDemolish();
        }}
        demolishDisabled={isReplay}
      />

      {/* 研究モーダル */}
      <ResearchModal
        visible={labModalVisible}
        onClose={() => setLabModalVisible(false)}
        completedResearch={game.player.completedResearch}
        funds={game.player.funds}
        onResearch={(entry: ResearchCatalogEntry) => {
          const facilityId = game.plots[selectedPlotIndex].facilityId;
          if (!facilityId) return;
          setGame((g) => startResearch(g, facilityId, entry, Date.now()));
          playEffect('research_start');
        }}
        onDemolish={() => {
          setLabModalVisible(false);
          handleDemolish();
        }}
        labProcessing={currentFacility?.state === 'processing'}
        facilities={game.facilities}
        now={now}
        actionDisabled={isReplay}
        demolishDisabled={isReplay}
      />

      {/* ゲームスタートオーバーレイ（通常モードのみ） */}
      {!gameStarted && !isTutorial && (
        <StartOverlay onStart={handleStart} />
      )}

      {/* チュートリアルスタートヒント（TutorialHintModal として表示） */}
      {isTutorial && (
        <TutorialHintModal hint={tutorialStartHint} onDismiss={handleDismissStartHint} />
      )}

      {/* ミッション達成モーダル（チュートリアルのみ） */}
      {isTutorial && (
        <MissionCompleteModal mission={currentMission} onDismiss={handleDismissMission} />
      )}

      {/* プロット表示トリガー・再表示モーダル（チュートリアルのみ） */}
      {isTutorial && (
        <TutorialHintModal hint={visibleHint} onDismiss={handleDismissHint} />
      )}

      {/* チュートリアル完了モーダル */}
      {isTutorial && tutorialStage && (
        <TutorialCompleteModal
          visible={tutorialCompleteVisible}
          stage={tutorialStage}
          onClose={onTutorialComplete ?? handleRestart}
        />
      )}

      {/* リザルトモーダル（通常モードのみ） */}
      {!isTutorial && (
        <ResultModal
          visible={resultVisible}
          breakdown={scoreBreakdown}
          onRestart={handleRestart}
          onClose={() => setResultVisible(false)}
          logs={game.logs}
          agentLogs={isReplay ? undefined : agentResult?.logs}
          agentScore={isReplay ? undefined : agentResult?.score}
          mapSeed={game.mapSeed}
          gameId={gameId}
          date={date}
        />
      )}
      {/* 設定モーダル */}
      <SoundSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        onQuit={() => { setSettingsModalVisible(false); handleRestart(); }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  phaseBarsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  plotMap: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  plotMapLabel: {
    fontSize: 20,
  },
  speedBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  speedBadgeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hintButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  gearButton: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearButtonText: {
    color: '#ffffff',
    fontSize: 22,
  },
  miniMap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 72,
    gap: 4,
  },
  miniMapCell: {
    width: 20,
    height: 20,
    borderRadius: 3,
  },
  facilityInfo: {
    alignItems: 'center',
    gap: Spacing.one,
    width: '100%',
    paddingHorizontal: Spacing.three,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  facilityProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
  },
  facilityProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  facilityProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  facilityProgressLabel: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    width: 32,
    textAlign: 'right',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  fundsDisplay: {
    alignItems: 'flex-end',
  },
  fundsLabel: {
    fontSize: 11,
  },
  fundsValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
