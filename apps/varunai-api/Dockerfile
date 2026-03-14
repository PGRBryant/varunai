FROM node:20-alpine AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/varunai-api/package.json apps/varunai-api/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY apps/varunai-api/src apps/varunai-api/src
COPY apps/varunai-api/tsconfig.json apps/varunai-api/
RUN pnpm --filter @varunai/shared build
RUN pnpm --filter @varunai/api build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/varunai-api/node_modules ./apps/varunai-api/node_modules
COPY --from=build /app/apps/varunai-api/dist ./apps/varunai-api/dist
COPY --from=build /app/apps/varunai-api/package.json ./apps/varunai-api/
EXPOSE 8080
CMD ["node", "apps/varunai-api/dist/index.js"]
