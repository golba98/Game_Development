# Use a lightweight Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy all project files into the container
COPY . .

# Expose port 3000 (matches the default in scripts/map_server.js)
EXPOSE 3000

# Start the game server
CMD ["node", "scripts/map_server.js"]