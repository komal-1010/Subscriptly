# Use official Node.js image
FROM node:24

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Expose port your dev server uses (Vite default: 5173)
EXPOSE 5173

# Start frontend dev server
CMD ["npm", "run", "dev"]
