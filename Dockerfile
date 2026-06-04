FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ARG COMMIT_SHA=local
ENV COMMIT_SHA=$COMMIT_SHA
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY src/server ./src/server
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "src/server/index.js"]
