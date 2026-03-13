FROM node:20-alpine AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/varunai-api/package.json apps/varunai-api/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/varunai-api apps/varunai-api
RUN pnpm --filter @varunai/shared build
RUN pnpm --filter @varunai/api build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/varunai-api/dist ./apps/varunai-api/dist
COPY --from=build /app/apps/varunai-api/package.json ./apps/varunai-api/
EXPOSE 8080
CMD ["node", "apps/varunai-api/dist/index.js"]
