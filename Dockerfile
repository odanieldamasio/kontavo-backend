FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma generate && pnpm prisma migrate deploy && pnpm start:dev"]