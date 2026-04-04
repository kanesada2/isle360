import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

const GAME_SCORE_API = __DEV__
  ? 'http://localhost:5173/api/game/score'
  : 'https://isle.guts-kk-89.workers.dev/api/game/score';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Colors, Spacing } from '@/constants/theme';
import type { ScoreBreakdown } from '@/domain/facility-actions';
import { encodeLogs } from '@/domain/log-codec';
import type { GameLogEntry } from '@/domain/types';

type Tab = 'score' | 'graph' | 'npc';

type Props = {
  visible: boolean;
  breakdown: ScoreBreakdown;
  onRestart: () => void;
  onClose?: () => void;
  logs: GameLogEntry[];
  agentLogs?: GameLogEntry[];
  agentScore?: number;
  mapSeed?: number;
  gameId?: string | null;
  date?: string | null;
};

const RESOURCE_LABELS: Record<string, string> = {
  agriculture: '農産',
  mineral: '鉱物',
  energy: 'エネルギー',
};

// ── 数値フォーマット ──────────────────────────────────────────

function fmtY(v: number): string {
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1_000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

// ── 折れ線グラフ ─────────────────────────────────────────────

const GRAPH_HEIGHT = 200;
const PAD = { l: 38, r: 12, t: 14, b: 28 };
const SESSION_X_MAX = 360_000; // 6分固定

type Point = { x: number; y: number };

type EventLine = { elapsedMs: number; color: string };

type LineChartProps = {
  data: Point[];
  label: string;
  color: string;
  textColor: string;
  dimColor: string;
  bgColor: string;
  events?: EventLine[];
};

function LineChart({ data, label, color, textColor, dimColor, bgColor, events = [] }: LineChartProps) {
  const [width, setWidth] = useState(0);

  const innerW = Math.max(0, width - PAD.l - PAD.r);
  const innerH = GRAPH_HEIGHT - PAD.t - PAD.b;
  const hasData = data.length >= 2;

  const xMin = 0;
  const xMax = SESSION_X_MAX;
  const yMax = hasData ? Math.max(...data.map((d) => d.y), 1) : 1;

  const sx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y: number) => PAD.t + (1 - y / yMax) * innerH;

  const polylinePoints = hasData
    ? data.map((d) => `${sx(d.x)},${sy(d.y)}`).join(' ')
    : '';

  return (
    <View>
      <Text style={[styles.chartLabel, { color: textColor }]}>{label}</Text>
      <View
        style={[styles.chartArea, { backgroundColor: bgColor }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Svg width={width} height={GRAPH_HEIGHT}>
            {/* 軸 */}
            <Line
              x1={PAD.l} y1={PAD.t}
              x2={PAD.l} y2={PAD.t + innerH}
              stroke={dimColor} strokeWidth={0.5}
            />
            <Line
              x1={PAD.l} y1={PAD.t + innerH}
              x2={PAD.l + innerW} y2={PAD.t + innerH}
              stroke={dimColor} strokeWidth={0.5}
            />

            {/* Y軸ラベル */}
            <SvgText x={PAD.l - 4} y={PAD.t + 4} fontSize={9} fill={dimColor} textAnchor="end">
              {fmtY(yMax)}
            </SvgText>
            {/* X軸ラベル（右端のみ） */}
            <SvgText x={PAD.l + innerW} y={PAD.t + innerH + 14} fontSize={9} fill={dimColor} textAnchor="middle">
              360
            </SvgText>

            {/* イベント縦線（折れ線より背面に描画） */}
            {events.map((ev, i) => {
              const ex = sx(ev.elapsedMs);
              const sec = Math.round(ev.elapsedMs / 1000);
              return (
                <React.Fragment key={i}>
                  <Line
                    x1={ex} y1={PAD.t}
                    x2={ex} y2={PAD.t + innerH}
                    stroke={ev.color}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                    opacity={0.8}
                  />
                  <SvgText
                    x={ex} y={PAD.t + innerH + 14}
                    fontSize={9} fill={ev.color}
                    textAnchor="middle"
                  >
                    {sec}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* 折れ線 */}
            {hasData && (
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* データポイント（控えめに） */}
            {hasData &&
              data.map((d, i) => (
                <Circle
                  key={i}
                  cx={sx(d.x)}
                  cy={sy(d.y)}
                  r={1.5}
                  fill={color}
                  fillOpacity={0.5}
                />
              ))}

            {/* データなし */}
            {!hasData && (
              <SvgText
                x={PAD.l + innerW / 2} y={PAD.t + innerH / 2}
                fontSize={12} fill={dimColor}
                textAnchor="middle"
              >
                データなし
              </SvgText>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

// ── スコアタブ ────────────────────────────────────────────────

type AppColors = typeof Colors.light | typeof Colors.dark;

type ScoreTabProps = {
  breakdown: ScoreBreakdown;
  logs: GameLogEntry[];
  colors: AppColors;
  mapSeed?: number;
  gameId?: string | null;
  date?: string | null;
};

function ScoreTab({ breakdown, logs, colors, mapSeed, gameId, date }: ScoreTabProps) {
  const token = useMemo(() => encodeLogs(logs), [logs]);
  const [copied, setCopied] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  function handleCopy() {
    Clipboard.setStringAsync(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSeedCopy() {
    if (mapSeed === undefined) return;
    Clipboard.setStringAsync(String(mapSeed));
    setSeedCopied(true);
    setTimeout(() => setSeedCopied(false), 2000);
  }

  async function handleScoreSubmit() {
    if (!gameId || mapSeed === undefined || scoreSubmitting || scoreSubmitted) return;
    setScoreSubmitting(true);
    try {
      const res = await fetch(GAME_SCORE_API, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, seed: mapSeed, score: breakdown.total, log: token, date: date ?? null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setScoreSubmitted(true);
    } catch {
      // Alert is not imported here; use inline state for error
      setScoreSubmitting(false);
    }
  }

  return (
    <>
      <View style={[styles.scoreBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>スコア</Text>
        <Text style={[styles.scoreValue, { color: colors.text }]}>
          {breakdown.total.toLocaleString()} pt
        </Text>
      </View>

      {mapSeed !== undefined && (
        <Pressable
          style={[styles.tokenBox, { backgroundColor: colors.background, borderColor: colors.backgroundSelected }]}
          onPress={handleSeedCopy}
        >
          <Text style={[styles.tokenLabel, { color: colors.textSecondary }]}>
            {seedCopied ? 'コピーしました' : 'マップシード（タップでコピー）'}
          </Text>
          <Text style={[styles.tokenText, { color: colors.text }]}>
            {mapSeed}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.tokenBox, { backgroundColor: colors.background, borderColor: colors.backgroundSelected }]}
        onPress={handleCopy}
      >
        <Text style={[styles.tokenLabel, { color: colors.textSecondary }]}>
          {copied ? 'コピーしました' : 'リプレイコード（タップでコピー）'}
        </Text>
        <Text style={[styles.tokenText, { color: colors.text }]} numberOfLines={2}>
          {token}
        </Text>
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.breakdown, { borderTopColor: colors.backgroundSelected }]}
        showsVerticalScrollIndicator={false}
      >
        <Row label="採掘した資源量" value={`${breakdown.resourcesMined.toLocaleString()} pt`} colors={colors} bold />
        {Object.entries(breakdown.resourcesByType).map(([type, amount]) => (
          <Row
            key={type}
            label={`　${RESOURCE_LABELS[type] ?? type}`}
            value={`${amount.toLocaleString()} pt`}
            colors={colors}
            sub
          />
        ))}

        <Row label="研究投資" value={`${breakdown.researchSpent.toLocaleString()} pt`} colors={colors} bold />
        {breakdown.researchBreakdown.map((item, i) => (
          <Row
            key={i}
            label={`　${item.name}${item.repeatable ? ` Lv.${item.level}` : ''}`}
            value={`${item.cost.toLocaleString()} pt`}
            colors={colors}
            sub
          />
        ))}

        {breakdown.monumentCount > 0 && (
          <Row
            label={`繁栄の象徴 ×${breakdown.monumentCount}`}
            value={`${breakdown.monumentBonus.toLocaleString()} pt`}
            colors={colors}
            bold
          />
        )}
      </ScrollView>

      {gameId && (
        <Pressable
          disabled={scoreSubmitting || scoreSubmitted}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: scoreSubmitted
                ? colors.backgroundSelected
                : pressed
                ? colors.backgroundSelected
                : colors.text,
              opacity: scoreSubmitting ? 0.5 : 1,
            },
          ]}
          onPress={handleScoreSubmit}
        >
          <Text style={[styles.submitButtonText, { color: scoreSubmitted ? colors.textSecondary : colors.background }]}>
            {scoreSubmitted ? '登録済み' : scoreSubmitting ? '登録中...' : 'スコア登録'}
          </Text>
        </Pressable>
      )}
    </>
  );
}

// ── グラフタブ ────────────────────────────────────────────────

type GraphTabProps = {
  logs: GameLogEntry[];
  colors: AppColors;
};

function GraphTab({ logs, colors }: GraphTabProps) {
  const scoreData: Point[] = [
    { x: 0, y: 0 },
    ...logs.map((l) => ({ x: l.elapsedMs, y: l.score })),
  ];
  const fpsData: Point[] = [
    { x: 0, y: 0 },
    ...logs.map((l) => ({ x: l.elapsedMs, y: l.fundsPerSecond })),
  ];

  const eventLines: EventLine[] = [];
  for (const log of logs) {
    if (log.kind === 'research-complete' && log.researchKey === 'mineral-survey') {
      eventLines.push({ elapsedMs: log.elapsedMs, color: '#EF5350' });
    } else if (log.kind === 'research-complete' && log.researchKey === 'energy-survey') {
      eventLines.push({ elapsedMs: log.elapsedMs, color: '#FFC107' });
    } else if (log.kind === 'construction-complete' && log.facilityKind === 'monument') {
      if (!eventLines.some((e) => e.color === '#66BB6A')) {
        eventLines.push({ elapsedMs: log.elapsedMs, color: '#66BB6A' });
      }
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.graphContent}
      showsVerticalScrollIndicator={false}
    >
      <LineChart
        data={scoreData}
        label="スコア"
        color="#4CAF50"
        textColor={colors.text}
        dimColor={colors.textSecondary}
        bgColor={colors.background}
        events={eventLines}
      />
      <LineChart
        data={fpsData}
        label="資金効率 (G/s)"
        color="#2196F3"
        textColor={colors.text}
        dimColor={colors.textSecondary}
        bgColor={colors.background}
        events={eventLines}
      />
    </ScrollView>
  );
}

// ── NPCタブ ───────────────────────────────────────────────────

type NpcTabProps = {
  agentLogs?: GameLogEntry[];
  agentScore?: number;
  colors: AppColors;
  onClose?: () => void;
};

function NpcTab({ agentLogs, agentScore, colors, onClose }: NpcTabProps) {
  const router = useRouter();

  const handleView = useCallback(() => {
    if (!agentLogs) return;
    const token = encodeLogs(agentLogs);
    onClose?.();
    router.push(`/replay?token=${encodeURIComponent(token)}`);
  }, [agentLogs, router, onClose]);

  if (!agentLogs || agentScore === undefined) {
    return (
      <View style={styles.npcLoading}>
        <Text style={[styles.npcLoadingText, { color: colors.textSecondary }]}>計算中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.npcContent}>
      <View style={[styles.scoreBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>NPCスコア</Text>
        <Text style={[styles.scoreValue, { color: colors.text }]}>
          {agentScore.toLocaleString()} pt
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.viewButton,
          { backgroundColor: pressed ? colors.backgroundSelected : colors.background, borderColor: colors.backgroundSelected },
        ]}
        onPress={handleView}
      >
        <Text style={[styles.viewButtonText, { color: colors.text }]}>見る</Text>
      </Pressable>
    </View>
  );
}

// ── ResultModal ───────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = { score: 'スコア', graph: 'グラフ', npc: 'NPCプレイ' };

export function ResultModal({ visible, breakdown, onRestart, onClose, logs, agentLogs, agentScore, mapSeed, gameId, date }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [activeTab, setActiveTab] = useState<Tab>('score');
  useEffect(() => { if (!visible) setActiveTab('score'); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>

          <Text style={[styles.title, { color: colors.text }]}>ゲーム終了</Text>

          {/* タブ */}
          <View style={[styles.tabs, { borderBottomColor: colors.backgroundSelected }]}>
            {(['score', 'graph', ...(agentLogs !== undefined ? ['npc'] : [])] as Tab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  style={[styles.tab, isActive && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: isActive ? colors.text : colors.textSecondary }]}>
                    {TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* タブコンテンツ */}
          {activeTab === 'score'
            ? <ScoreTab breakdown={breakdown} logs={logs} colors={colors} mapSeed={mapSeed} gameId={gameId} date={date} />
            : activeTab === 'graph'
              ? <GraphTab logs={logs} colors={colors} />
              : <NpcTab agentLogs={agentLogs} agentScore={agentScore} colors={colors} onClose={onClose} />
          }

          <Pressable
            style={({ pressed }) => [
              styles.restartButton,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onRestart}
          >
            <Text style={[styles.restartButtonText, { color: colors.background }]}>
              トップへ
            </Text>
          </Pressable>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Row ──────────────────────────────────────────────────────

type RowProps = {
  label: string;
  value: string;
  colors: AppColors;
  bold?: boolean;
  sub?: boolean;
};

function Row({ label, value, colors, bold, sub }: RowProps) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: sub ? colors.textSecondary : colors.text, fontWeight: bold ? '600' : '400' }]}>
        {label}
      </Text>
      <Text style={[styles.breakdownValue, { color: sub ? colors.textSecondary : colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: -Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // スコアタブ
  scoreBox: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 13,
    marginBottom: Spacing.one,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  tokenBox: {
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  tokenLabel: {
    fontSize: 11,
  },
  tokenText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  scroll: {
    flexGrow: 0,
  },
  breakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  breakdownLabel: {
    fontSize: 14,
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // グラフタブ
  graphContent: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  chartLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  chartArea: {
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  // NPCタブ
  npcLoading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  npcLoadingText: {
    fontSize: 14,
  },
  npcContent: {
    gap: Spacing.three,
  },
  viewButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // 再スタートボタン
  restartButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  restartButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
