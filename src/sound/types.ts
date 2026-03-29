/** SE（効果音）のキー一覧 */
export type SeKey =
  | 'build_start'
  | 'build_complete'
  | 'demolish_start'
  | 'demolish_complete'
  | 'research_start'
  | 'research_complete'
  | 'game_start'
  | 'game_end'
  | 'monument_complete'
  | 'swipe';

/** BGM のキー一覧 */
export type BgmKey = 'main' | 'game';

/** React Native の require() が返すアセット参照 */
type AssetSource = number;

/**
 * 外部から渡すサウンド設定。
 * キーが未指定のサウンドは再生をスキップ（no-op）する。
 */
export interface SoundConfig {
  se?: Partial<Record<SeKey, AssetSource>>;
  bgm?: Partial<Record<BgmKey, AssetSource>>;
  /** BGM の音量（0.0〜1.0、デフォルト: 0.5） */
  bgmVolume?: number;
  /** SE の初期状態（デフォルト: true） */
  initialSeEnabled?: boolean;
  /** BGM の初期状態（デフォルト: true） */
  initialBgmEnabled?: boolean;
}
