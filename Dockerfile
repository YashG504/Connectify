# Use official Node.js Alpine image for a smaller footprint
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root package.json (if any) and backend package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for both backend and frontend
RUN npm install --prefix backend
RUN npm install --prefix frontend

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN npm run build --prefix frontend

# --- Production Image ---
FROM node:20-alpine

WORKDIR /app

# Set Node environment to production
ENV NODE_ENV=production

# Copy backend dependencies (production only)
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev

# Copy backend source code
COPY backend/src ./backend/src

# Copy built frontend from builder stage
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 5001

# Healthcheck configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

# Start server
CMD ["node", "backend/src/server.js"]
