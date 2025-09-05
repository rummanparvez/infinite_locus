FROM node:18-alpine

WORKDIR /app

# Copy package files from backend subfolder
COPY backend/package*.json ./

# Install production dependencies  
RUN npm install --omit=dev

# Copy the rest of the backend application
COPY backend/ ./

# Change ownership to node user
RUN chown -R node:node /app

# Expose the port
EXPOSE 5000

# Switch to non-root user
USER node

# Start the application
CMD ["npm", "start"]
