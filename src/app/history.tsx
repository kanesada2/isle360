import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { getPlayLogs, type PlayLogRow } from '@/db/local';

function formatDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [logs, setLogs] = useState<PlayLogRow[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    getPlayLogs(20).then(setLogs).catch(console.error);
  }, []);

  const handleCopySeed = useCallback((row: PlayLogRow) => {
    Clipboard.setStringAsync(String(row.seed));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((prev) => (prev === row.id ? null : prev)), 1500);
  }, []);

  const handleReplay = useCallback((row: PlayLogRow) => {
    router.push({ pathname: '/replay', params: { token: row.log } });
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ヘッダー */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundSelected }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backLabel, { color: colors.textSecondary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
        <View style={styles.backButton} />
      </View>

      {/* カラムヘッダー */}
      <View style={[styles.columnHeader, { borderBottomColor: colors.backgroundSelected }]}>
        <Text style={[styles.colLabelSeed, { color: colors.textSecondary }]}>SEED</Text>
        <Text style={[styles.colLabelScore, { color: colors.textSecondary }]}>SCORE</Text>
        <Text style={[styles.colLabelDate, { color: colors.textSecondary }]}>PLAYED_AT</Text>
        <Text style={[styles.colLabelDate, { color: colors.textSecondary }]}>REPLAY</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={logs.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            プレイ履歴がありません
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.backgroundSelected }]}>
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

            {/* Date */}
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {formatDate(item.created_at)}
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
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colLabelSeed: {
    width: 72,
    fontSize: 12,
    fontWeight: '600',
  },
  colLabelScore: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  colLabelDate: {
    width: 110,
    fontSize: 12,
    fontWeight: '600',
  },
  colReplay: {
    width: 60,
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
  dateText: {
    width: 110,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  replayButton: {
    width: 60,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    alignItems: 'center',
  },
  replayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
