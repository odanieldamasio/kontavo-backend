FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json ./

EXPOSE 3000

CMD ["sh", "-c", "pnpm install --no-frozen-lockfile && pnpm prisma generate && pnpm start:dev"]
