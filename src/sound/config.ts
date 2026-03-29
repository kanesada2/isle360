import type { SoundConfig } from './types';

/**
 * export type SeKey =
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
 */

/**
 * サウンド設定。
 * 音声ファイルを追加したら各キーに require() で渡す。
 * 例: se: { build_start: require('../../assets/sounds/build_start.mp3') }
 */
export const SOUND_CONFIG: SoundConfig = {
  se: {
    build_start:       require('../../assets/sounds/build_start.mp3'),
    build_complete:    require('../../assets/sounds/build_complete.mp3'),
    demolish_start:    require('../../assets/sounds/demolish_start.mp3'),
    demolish_complete: require('../../assets/sounds/demolish_complete.mp3'),
    research_start:    require('../../assets/sounds/research_start.mp3'),
    research_complete: require('../../assets/sounds/research_complete.mp3'),
    game_start:        require('../../assets/sounds/game_start.mp3'),
    game_end:          require('../../assets/sounds/game_end.mp3'),
    monument_complete: require('../../assets/sounds/monument_complete.mp3'),
    swipe:             require('../../assets/sounds/swipe.mp3'),
  },
  bgm: {
    main: require('../../assets/sounds/bgm_main.wav'),
    game: require('../../assets/sounds/bgm_game.wav'),
  },
};
