FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=7000
EXPOSE 7000

CMD ["node", "src/index.js"]
