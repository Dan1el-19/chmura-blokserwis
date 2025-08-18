FROM node:20-alpine
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --production

# Copy app
COPY . .

EXPOSE 1080
CMD ["node", "tus-server.mjs"]
