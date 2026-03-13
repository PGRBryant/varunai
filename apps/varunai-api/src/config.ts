import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('8080'),
  GEMINI_API_KEY: z.string().default(''),
  VERIKA_SERVICE_TOKEN: z.string().default(''),
  MYSTWEAVER_API_URL: z.string().default('https://mystweaver-api.run.app'),
  ROOM404_API_URL: z.string().default('https://room404-api.run.app'),
  VERIKA_API_URL: z.string().default('https://verika-api.run.app'),
  GRAFANA_URL: z.string().default('http://localhost:3000'),
  GCP_PROJECT_ID: z.string().default('varunai-prod'),
  NODE_ENV: z.string().default('development'),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
