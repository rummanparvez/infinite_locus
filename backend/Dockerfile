FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Change ownership to node user
RUN chown -R node:node /app

# Expose the port
EXPOSE 5000

# Switch to non-root user
USER node

# Start the application
CMD ["npm", "start"]
