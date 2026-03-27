import type { TutorialStage } from './tutorial';
import type { ResearchId } from './types';

const r = (s: string) => s as ResearchId;

// ── カタログエントリ型 ───────────────────────────────────────────

export type TutorialCatalogEntry = {
  /** URL パラメータ・一覧表示で使う一意 ID（stage.id と同じ） */
  id: string;
  /** ステージ選択画面に表示するタイトル */
  title: string;
  /** ステージ選択画面に表示する短い説明 */
  description: string;
  stage: TutorialStage;
};

// ── ステージデータ ──────────────────────────────────────────────

export const TUTORIAL_CATALOG: readonly TutorialCatalogEntry[] = [
  {
    id: 'stage-1',
    title: '農場を建てよう',
    description: '農場を建設し、農産資源を採集して資金を集めよう。',
    stage: {
      id: 'stage-1',
      plotSetups: [
        { plotIndex: 4, deposits: { agriculture: { abundance: 800 } } },
      ],
      initialFunds: 200,
      startOverlay: {
        title: 'ステージ 1：農場を建てよう',
        body:
          'マップの中央に農産資源がある。\n' +
          '農場を建設して採集を始めよう！\n\n' +
          'マスをタップすると建設メニューが開く。\n' +
          '準備ができたらスタートしてください。',
        buttonLabel: 'スタート',
      },
      missions: [
        {
          kind: 'construct-facility',
          facilityKind: 'extractor',
          count: 1,
          label: '農場を1つ建設する',
          completionMessage: '農産資源の採集が始まり、資金が溜まっていくようになった。',
        },
      ],
      completionModal: {
        title: 'ミッション完了！',
        body: '農場を建てられるようになった。\n次は研究所を建設し、研究を進めよう。',
        buttonLabel: '次のステージへ',
      },
    },
  },

  {
    id: 'stage-2',
    title: '研究を進めよう',
    description: '研究所を建設し、研究を実行して農産物の採集効率を向上させよう。',
    stage: {
      id: 'stage-2',
      plotSetups: [
        {
          plotIndex: 4,
          deposits: { agriculture: { abundance: 800 } },
          preBuildFacility: { facilityKey: 'extractor-agriculture' },
        },
      ],
      initialFunds: 500,
      startOverlay: {
        title: 'ステージ 2：研究を進めよう',
        body:
          'マップ中央にはすでに農場が建っている。\n' +
          'スワイプで他のマスに移動し、\n' +
          '研究所を建設して研究を実行してみよう。\n\n' +
          '研究所をタップすると研究メニューが開く。',
        buttonLabel: 'スタート',
      },
      missions: [
        {
          kind: 'construct-facility',
          facilityKind: 'laboratory',
          count: 1,
          label: '研究所を1つ建設する',
          completionMessage: 
          '研究所が完成！研究所をタップして研究を始めよう。\n' +
          'まずは「農産物採集効率上昇」を研究しよう。',
        },
        {
          kind: 'complete-research',
          researchKey: r('agri-efficiency'),
          level: 1,
          label: '農産物採集効率上昇を研究する',
          completionMessage: 
          '採集速度が 20% 向上し、新しい研究がアンロックされた。'
        },
      ],
      completionModal: {
        title: 'ミッション完了！',
        body: '研究を進めると、出来ることが増える。\n次のステージではアンロックした「鉱物調査」を研究し、鉱山を建てよう。',
        buttonLabel: '次のステージへ',
      },
    },
  },
  {
    id: 'stage-3',
    title: '鉱物資源を採集しよう',
    description: '鉱物調査を研究し、鉱物資源のあるマスを探してそこに鉱山を建設しよう。',
    stage: {
      id: 'stage-3',
      plotSetups: [
        { plotIndex: 1, deposits: { mineral: { abundance: 800 } } },
        {
          plotIndex: 4,
          deposits: { agriculture: { abundance: 800, current: 400} },
          preBuildFacility: { facilityKey: 'extractor-agriculture' },
        },{
          plotIndex: 7,
          preBuildFacility: { facilityKey: 'laboratory'}
        }
      ],
      initialFunds: 600,
      initialResearch: [
        { researchKey: r('agri-efficiency'), level: 1 },
      ],
      startOverlay: {
        title: 'ステージ 3：鉱物資源を採集しよう',
        body:
          'マップ下部のマスに研究所がある。\n' +
          'アンロックされた「鉱物調査」を研究すると、\n' +
          'マスに埋蔵された鉱物の資源量がわかる。\n' +
          '鉱物が埋蔵されたマスを探し、\n' +
          'そこに鉱山を建ててみよう。',
        buttonLabel: 'スタート',
      },
      missions: [
        {
          kind: 'complete-research',
          researchKey: r('mineral-survey'),
          level: 1,
          label: '鉱物調査を研究する',
          completionMessage: 
          'マスに埋蔵された鉱物資源の量がわかるようになった。\n' +
          '鉱物のあるマスをスワイプで探して鉱山を建てよう。'
        },
        {
          kind: 'construct-facility',
          facilityKind: 'extractor',
          resourceType: 'mineral',
          count: 1,
          label: '鉱山を1つ建設する',
          completionMessage: '鉱山が建設された。鉱物資源を採集すると、農産資源の2倍の資金を得ることができる。',
        },
      ],
      completionModal: {
        title: 'ミッション完了！',
        body: 'それぞれのマスに埋蔵された資源の分布にはばらつきがある。マスごとに適切な採集施設を建てよう。',
        buttonLabel: '次のステージへ',
      },
    },
  },
  {
    id: 'stage-4',
    title: 'エネルギー資源を採集しよう',
    description: '鉱物調査を研究し、鉱物資源のあるマスを探してそこに鉱山を建設しよう。',
    stage: {
      id: 'stage-3',
      plotSetups: [
        { plotIndex: 1, 
          deposits: { mineral: { abundance: 400 } },
          preBuildFacility: { facilityKey: 'extractor-mineral' },
        },
        {
          plotIndex: 4,
          deposits: { agriculture: { abundance: 800, current: 100 }, energy: { abundance: 800 }},
          preBuildFacility: { facilityKey: 'extractor-agriculture' },
        },{
          plotIndex: 7,
          preBuildFacility: { facilityKey: 'laboratory'}
        }
      ],
      initialFunds: 850,
      initialResearch: [
        { researchKey: r('agri-efficiency'), level: 1 },
        { researchKey: r('mineral-survey'), level: 1 },
      ],
      startOverlay: {
        title: 'ステージ 4：エネルギー資源を採集しよう',
        body:
          '次はエネルギー資源を採集したい。\n' +
          'そのために「エネルギー資源調査」を研究したいが、\n' +
          '先に「鉱物採掘効率向上」の研究が必要だ。\n' +
          '順次研究を進めたらエネルギー資源のあるマスを探し、\n' +
          'そこにエネルギー生産場を建設しよう。',
        buttonLabel: 'スタート',
      },
      missions: [
        {
          kind: 'complete-research',
          researchKey: r('mineral-efficiency'),
          level: 1,
          label: '鉱物採掘効率向上を研究する',
          completionMessage: 
          '鉱物の採掘効率が20%向上し、「エネルギー資源調査」の研究がアンロックされた。\n' +
          '次はエネルギー資源調査を研究しよう。'
        },
        {
          kind: 'complete-research',
          researchKey: r('energy-survey'),
          level: 1,
          label: 'エネルギー資源調査を研究する',
          completionMessage: 
          'マスに埋蔵されたエネルギー資源の量がわかるようになった。\n' +
          'エネルギー資源のあるマスをスワイプで探してみよう。'
        },
        {
          kind: 'demolish-facility',
          facilityKind: 'extractor',
          resourceType: 'agriculture',
          count: 1,
          label: '枯渇した農場を破壊する',
          completionMessage: '既に資源が枯渇して生産が停止した農場を破壊した。\n' + 
          'これで新しい施設を建設できるようになった。エネルギー生産場を建設しよう。',
        },
        {
          kind: 'construct-facility',
          facilityKind: 'extractor',
          resourceType: 'energy',
          count: 1,
          label: 'エネルギー生産場を1つ建設する',
          completionMessage: 'エネルギー生産場が建設された。\n' +
          'エネルギー資源は農産資源の3倍の資金を生産できる。'
        }
      ],
      plotTriggers: [
        {
          plotIndex: 4,
          afterMissionIndex: 1,
          title: 'エネルギー資源発見',
          body:
          'エネルギー資源が埋蔵されているのはこのマスだった。\n' + 
          'しかし、ここには既に農場が建っている。\n' + 
          'そして既に農産資源が枯渇しているので、この農場は稼働していない。 \n' +
          'このマスをタップし、不要になった農場を破壊しよう。'
        }
      ],
      completionModal: {
        title: 'ミッション完了！',
        body: '資源の採集を進めていくと、その資源が枯渇してしまうことがある。\n'+
        '不要になった施設は破壊し、新しい適切な施設に建て替えよう。',
        buttonLabel: '次のステージへ',
      },
    },
  },
  {
    id: 'stage-5',
    title: '繁栄の象徴を建てよう',
    description: 'スコアに大幅に貢献する施設、繁栄の象徴を建設しよう。',
    stage: {
      id: 'stage-5',
      plotSetups: [
        { plotIndex: 1, 
          deposits: { mineral: { abundance: 400 } },
          preBuildFacility: { facilityKey: 'extractor-mineral' },
        },
        {
          plotIndex: 2,
          preBuildFacility: { facilityKey: 'refinery'}
        },
        {
          plotIndex: 3,
          preBuildFacility: { facilityKey: 'refinery'}
        },
        {
          plotIndex: 4,
          deposits: { agriculture: { abundance: 800, current: 0}, energy: { abundance: 600 }},
          preBuildFacility: { facilityKey: 'extractor-energy' },
        },
        { plotIndex: 5, 
          deposits: { mineral: { abundance: 400 } },
          preBuildFacility: { facilityKey: 'extractor-mineral' },
        },
        {
          plotIndex: 6,
          deposits: { energy: { abundance: 400 }},
          preBuildFacility: { facilityKey: 'extractor-energy' },
        },
        {
          plotIndex: 7,
          preBuildFacility: { facilityKey: 'laboratory'}
        },
        {
          plotIndex: 8,
          deposits: { energy: { abundance: 400 }},
          preBuildFacility: { facilityKey: 'extractor-energy' },
        },
      ],
      initialFunds: 3000,
      initialResearch: [
        { researchKey: r('agri-efficiency'), level: 1 },
        { researchKey: r('mineral-survey'), level: 1 },
        { researchKey: r('mineral-efficiency'), level: 1 },
        { researchKey: r('energy-survey'), level: 1 },
      ],
      startOverlay: {
        title: 'ステージ 5：繁栄の象徴を建てよう',
        body:
          'いよいよゲームも終盤。\n' +
          '生産体制も整い、資金も溜まってきた。\n' +
          '溜まった資金を使ってスコアを稼ぐため、\n' +
          '「繁栄の象徴」を建設しよう。' +
          '準備ができたらスタートしてください。',
        buttonLabel: 'スタート',
      },
      missions: [
        {
          kind: 'construct-facility',
          facilityKind: 'monument',
          count: 1,
          label: '繁栄の象徴を1つ建設する',
          completionMessage: '「繁栄の象徴」を建設した。何も生産しない高い施設だが、1つあたり5000ものスコアを稼げる。',
        },
      ],
      completionModal: {
        title: 'ミッション完了！',
        body: 
        '繁栄の象徴を建設した。\n' +
        'スコアを稼ぐためには複数を建設したくなるが、\n' +
        '繁栄の象徴は同時に1つずつしか建てられない。\n' +
        '実際のゲームでは制限時間内に稼いだスコアを競うので、 \n' + 
        '「いつから」「どこに」建てていくかの判断が重要になる。', 
        buttonLabel: 'チュートリアル完了',
      },
    },
  },
];
