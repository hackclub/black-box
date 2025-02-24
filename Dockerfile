# Use Node.js 23 as the base image
FROM node:23

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app files
COPY . .

# Expose port 8080 inside the container (not mapped to host)
EXPOSE 9999

# Command to start the Express server
CMD ["node", "server.js"]
