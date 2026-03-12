FROM node:20-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 8000

# Start the application
CMD ["npm", "start"]
