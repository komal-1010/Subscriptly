# Use official Node.js image
FROM node:24

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Expose port your Express app uses
EXPOSE 3000

# Start the backend
CMD ["node", "index.js"]
