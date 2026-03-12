# multi-stage Docker build: install + build in one stage, produce lean runtime image

# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# copy package definitions and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# copy source and compile
COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# copy only production dependencies and built files from previous stage
COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist

EXPOSE 8000

CMD ["npm", "start"]
