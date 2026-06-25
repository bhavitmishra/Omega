FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json .
RUN npm install

FROM base AS development
COPY . .
EXPOSE 8080
CMD ["npm", "run", "dev"]

FROM base AS prod
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node" , "dist/index.js"]
