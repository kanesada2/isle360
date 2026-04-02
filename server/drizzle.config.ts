import type { Config } from 'drizzle-kit';

export default {
    out: './src/migrations', // マイグレーションファイルの出力先 (wrangler.jsonc と合わせる)
    schema: './src/database/schema.ts', // スキーマファイルのパス
    dialect: 'sqlite', // 使用するデータベースの種類 (D1 は SQLite 互換)
    driver: 'd1-http', // Cloudflare D1 を使う場合のドライバ指定
} satisfies Config;