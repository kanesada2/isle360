import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

const GAME_SCORE_API = __DEV__
  ? 'http://localhost:5173/api/game/score'
  : 'https://isle.guts-kk-89.workers.dev/api/game/score';

type Tab = 'daily' | 'alltime';

type ScoreRow = {
  id: string;
  userId: string;
  seed: number;
  score: number;
  log: string;
  date: string | null;
  createdAt: string;
};

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RankScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [dailyRows, setDailyRows] = useState<ScoreRow[]>([]);
  const [alltimeRows, setAlltimeRows] = useState<ScoreRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [alltimeLoading, setAlltimeLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setDailyLoading(true);
    fetch(`${GAME_SCORE_API}?date=${getTodayDate()}`)
      .then((res) => res.json() as Promise<ScoreRow[]>)
      .then(setDailyRows)
      .catch(() => {})
      .finally(() => setDailyLoading(false));
  }, []);

  useEffect(() => {
    setAlltimeLoading(true);
    fetch(GAME_SCORE_API)
      .then((res) => res.json() as Promise<ScoreRow[]>)
      .then(setAlltimeRows)
      .catch(() => {})
      .finally(() => setAlltimeLoading(false));
  }, []);

  const handleCopySeed = useCallback((row: ScoreRow) => {
    Clipboard.setStringAsync(String(row.seed));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((prev) => (prev === row.id ? null : prev)), 1500);
  }, []);

  const handleReplay = useCallback((row: ScoreRow) => {
    router.push({ pathname: '/replay', params: { token: row.log } });
  }, [router]);

  const rows = activeTab === 'daily' ? dailyRows : alltimeRows;
  const loading = activeTab === 'daily' ? dailyLoading : alltimeLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ヘッダー */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundSelected }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backLabel, { color: colors.textSecondary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ranking</Text>
        <View style={styles.backButton} />
      </View>

      {/* タブ */}
      <View style={[styles.tabs, { borderBottomColor: colors.backgroundSelected }]}>
        {(['daily', 'alltime'] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, isActive && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: isActive ? colors.text : colors.textSecondary }]}>
                {tab === 'daily' ? 'Daily' : 'All-Time'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* カラムヘッダー */}
      <View style={[styles.columnHeader, { borderBottomColor: colors.backgroundSelected }]}>
        <Text style={[styles.colName, { color: colors.textSecondary }]}>NAME</Text>
        <Text style={[styles.colSeed, { color: colors.textSecondary }]}>SEED</Text>
        <Text style={[styles.colScore, { color: colors.textSecondary }]}>SCORE</Text>
        <Text style={[styles.colReplay, { color: colors.textSecondary }]}>REPLAY</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              データがありません
            </Text>
          }
          renderItem={({ item, index }) => (
            <View style={[styles.row, { borderBottomColor: colors.backgroundSelected }]}>
              {/* NAME */}
              <View style={styles.colName}>
                <Text style={[styles.rankText, { color: colors.textSecondary }]}>
                  {index + 1}.
                </Text>
                <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
                  Dummy
                </Text>
              </View>

              {/* Seed（タップでコピー） */}
              <Pressable
                style={[styles.seedCell, { backgroundColor: colors.backgroundElement, borderRadius: Spacing.one }]}
                onPress={() => handleCopySeed(item)}
              >
                <Text style={[styles.seedText, { color: copiedId === item.id ? colors.textSecondary : colors.text }]}>
                  {copiedId === item.id ? 'Copied' : item.seed}
                </Text>
              </Pressable>

              {/* Score */}
              <Text style={[styles.scoreText, { color: colors.text }]}>
                {item.score.toLocaleString()}
              </Text>

              {/* Replay ボタン */}
              <Pressable
                style={({ pressed }) => [
                  styles.replayButton,
                  { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement },
                ]}
                onPress={() => handleReplay(item)}
              >
                <Text style={[styles.replayLabel, { color: colors.text }]}>GO</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 64,
  },
  backLabel: {
    fontSize: 15,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: Spacing.four,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  colName: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  colSeed: {
    width: 72,
    fontSize: 12,
    fontWeight: '600',
  },
  colScore: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  colReplay: {
    width: 44,
    fontSize: 12,
    fontWeight: '600',
  },
  rankText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  nameText: {
    fontSize: 13,
    flex: 1,
  },
  seedCell: {
    width: 72,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  seedText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontFamily: 'monospace',
  },
  scoreText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  replayButton: {
    width: 44,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    alignItems: 'center',
  },
  replayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
