import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runOnJS } from 'react-native-worklets';

import { BuildModal } from '@/components/build-modal';
import { FacilityDetailModal } from '@/components/facility-detail-modal';
import { PhaseResourceBar } from '@/components/phase-resource-bar';
import { ResearchModal } from '@/components/research-modal';
import { ResultModal } from '@/components/result-modal';
import { StartOverlay } from '@/components/start-overlay';
import { TimerBar } from '@/components/timer-bar';
import { Colors, Spacing } from '@/constants/theme';
import {
  buildFacility,
  computeScore,
  demolishFacility,
  getFacilityDetailRows,
  getFacilityDisplayName,
  startGame,
  startResearch,
  tickFacilities,
} from '@/domain/facility-actions';
import type { FacilityCatalogEntry } from '@/domain/facility-catalog';
import { createGame } from '@/domain/game';
import type { ResearchCatalogEntry } from '@/domain/research-catalog';
import { getAvailableFacilityKeys, getUnlockedPhases } from '@/domain/research-unlock';
import type { Game, PlotIndex, ResourcePhase } from '@/domain/types';
import { useGameLoop } from '@/hooks/use-game-loop';

const SESSION_DURATION_MS = 360_000;
const INITIAL_FUNDS = 1_000;
const SWIPE_THRESHOLD = 40;

export default function GameScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [game, setGame] = useState<Game>(() =>
    createGame({ sessionDurationMs: SESSION_DURATION_MS, initialFunds: INITIAL_FUNDS }),
  );

  const gameStarted = game.status !== 'setup';
  const gameFinished = game.status === 'finished';

  const [now, setNow] = useState(() => Date.now());
  useGameLoop((currentNow) => {
    setNow(currentNow);
    setGame((g) => tickFacilities(g, currentNow));
  }, game.status === 'playing');

  const remaining =
    game.startedAt !== null
      ? Math.max(0, game.sessionDurationMs - (now - game.startedAt))
      : game.sessionDurationMs;

  // 残り時間が 0 になったらゲーム終了
  useEffect(() => {
    if (!gameStarted || gameFinished) return;
    if (remaining === 0) {
      setGame((g) => ({ ...g, status: 'finished' }));
    }
  }, [remaining, gameStarted, gameFinished]);

  // ゲーム終了時に全モーダルを閉じる
  useEffect(() => {
    if (!gameFinished) return;
    setBuildModalVisible(false);
    setFacilityDetailVisible(false);
    setLabModalVisible(false);
  }, [gameFinished]);

  const scoreBreakdown = useMemo(
    () => computeScore(game),
    [gameFinished], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── プロットナビゲーション ────────────────────────────────────
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<PlotIndex>(4);
  // ワークレット内から参照するための shared value
  const currentIndexSv = useSharedValue<number>(4);

  const unlockedPhases = useMemo(
    () => getUnlockedPhases(game.player.completedResearch),
    [game.player.completedResearch],
  );

  const availableFacilityKeys = useMemo(
    () => getAvailableFacilityKeys(game.player.completedResearch),
    [game.player.completedResearch],
  );

  const { phaseTotals, phaseCurrents, phaseUnlocked } = useMemo(() => {
    const totals: Record<ResourcePhase, number> = { 1: 0, 2: 0, 3: 0 };
    const currents: Record<ResourcePhase, number> = { 1: 0, 2: 0, 3: 0 };
    const unlocked: Record<ResourcePhase, boolean> = { 1: false, 2: false, 3: false };
    for (const deposit of game.plots[selectedPlotIndex].deposits) {
      if (unlockedPhases.has(deposit.phase)) {
        totals[deposit.phase] =
          Math.round((totals[deposit.phase] + deposit.abundance) * 100) / 100;
        currents[deposit.phase] =
          Math.round((currents[deposit.phase] + deposit.current) * 100) / 100;
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

        // ドラッグした方向の逆にあるplotへ移動（マップパン的な感覚）
        // 右ドラッグ → 左のplotを表示、下ドラッグ → 上のplotを表示
        const current = currentIndexSv.value;
        const row = Math.floor(current / 3);
        const col = current % 3;

        let next = current;
        if (absX > absY) {
          if (e.translationX > 0 && col > 0) next = current - 1; // 右ドラッグ → 左へ
          else if (e.translationX < 0 && col < 2) next = current + 1; // 左ドラッグ → 右へ
        } else {
          if (e.translationY > 0 && row > 0) next = current - 3; // 下ドラッグ → 上へ
          else if (e.translationY < 0 && row < 2) next = current + 3; // 上ドラッグ → 下へ
        }

        if (next !== current) {
          currentIndexSv.value = next;
          runOnJS(navigateTo)(next);
        }
      }),
    [currentIndexSv, navigateTo],
  );

  const handleStart = useCallback(() => {
    const now = Date.now();
    setGame((g) => startGame(g, now));
    setNow(now);
  }, []);

  const handleRestart = useCallback(() => {
    setGame(createGame({ sessionDurationMs: SESSION_DURATION_MS, initialFunds: INITIAL_FUNDS }));
    setNow(Date.now());
    setSelectedPlotIndex(4);
    currentIndexSv.value = 4;
  }, [currentIndexSv]);

  const [buildModalVisible, setBuildModalVisible] = useState(false);
  const [facilityDetailVisible, setFacilityDetailVisible] = useState(false);
  const [labModalVisible, setLabModalVisible] = useState(false);

  // 現在選択中の plot の施設（なければ undefined）
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
    if (!gameStarted) return;
    // InteractionManager.runAfterInteractions でモーダル開放を全インタラクション完了後に遅延し、
    // 現在のタッチイベント処理が完全に終わってからモーダルを開く。
    // これにより「開いた瞬間にモーダルが閉じる」「ボタンが即確定される」を防ぐ。
    if (!currentFacility) {
      InteractionManager.runAfterInteractions().then(() =>setBuildModalVisible(true));
      return;
    }
    if (currentFacility.kind === 'laboratory') {
      if (currentFacility.state === 'idle' || currentFacility.state === 'processing') {
        InteractionManager.runAfterInteractions().then(() => setLabModalVisible(true));
      }
    } else if (
      currentFacility.state === 'idle' &&
      (currentFacility.kind === 'extractor' || currentFacility.kind === 'refinery')
    ) {
      InteractionManager.runAfterInteractions().then(() =>setFacilityDetailVisible(true));
    }
  }, [gameStarted, currentFacility]);

  // ゲームループで currentFacility が毎フレーム更新されても
  // tapGesture を再生成しないよう ref 経由で最新の関数を保持する
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
  }, [selectedPlotIndex]);

  const handleDemolish = useCallback(() => {
    setGame((g) => demolishFacility(g, selectedPlotIndex, Date.now()));
  }, [selectedPlotIndex]);

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
          {/* 3×3 ミニマップ インジケーター */}
          <View style={styles.miniMap}>
            {([0, 1, 2, 3, 4, 5, 6, 7, 8] as const).map((i) => (
              <View
                key={i}
                style={[
                  styles.miniMapCell,
                  {
                    backgroundColor:
                      i === selectedPlotIndex ? colors.text : colors.backgroundSelected,
                  },
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
                          {
                            width: `${ratio * 100}%`,
                            backgroundColor: isDemolish ? '#F44336' : '#4CAF50',
                          },
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
        <TimerBar remaining={remaining} sessionDurationMs={game.sessionDurationMs} />
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
        onBuild={handleBuild}
        availableFacilityKeys={availableFacilityKeys}
        funds={game.player.funds}
        monumentUnderConstruction={[...game.facilities.values()].some(
          (f) => f.kind === 'monument' && f.state === 'constructing',
        )}
      />
      {/* 施設詳細モーダル（Extractor / Refinery） */}
      <FacilityDetailModal
        visible={facilityDetailVisible}
        onClose={() => setFacilityDetailVisible(false)}
        title={currentFacility ? getFacilityDisplayName(currentFacility) : ''}
        rows={facilityDetailRows}
        onDemolish={() => {
          setFacilityDetailVisible(false);
          handleDemolish();
        }}
      />
      {/* 研究モーダル（Laboratory からのみ開く） */}
      <ResearchModal
        visible={labModalVisible}
        onClose={() => setLabModalVisible(false)}
        completedResearch={game.player.completedResearch}
        funds={game.player.funds}
        onResearch={(entry: ResearchCatalogEntry) => {
          const facilityId = game.plots[selectedPlotIndex].facilityId;
          if (!facilityId) return;
          setGame((g) => startResearch(g, facilityId, entry, Date.now()));
        }}
        onDemolish={() => {
          setLabModalVisible(false);
          handleDemolish();
        }}
        labProcessing={currentFacility?.state === 'processing'}
        activeResearchId={currentFacility?.kind === 'laboratory' ? currentFacility.activeResearchId : null}
      />
      {/* ゲームスタートオーバーレイ（スワイプは背後のGestureDetectorへ通過） */}
      {!gameStarted && <StartOverlay onStart={handleStart} />}
      {/* リザルトモーダル */}
      <ResultModal
        visible={gameFinished}
        breakdown={scoreBreakdown}
        onRestart={handleRestart}
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
  // フェーズ別資源バー
  phaseBarsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // プロットマップ
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
  // 下部操作バー
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
  // 施設情報
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
});
