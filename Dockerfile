# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.22.0

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /usr/src/app/dist ./dist
COPY server.mjs ./server.mjs
COPY src/data ./src/data
COPY public ./public

EXPOSE 3001

CMD ["node", "server.mjs"]
