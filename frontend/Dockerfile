# Stage 1: Build the React application
# Node 20 LTS for security and long-term support.
FROM node:20-alpine as build

WORKDIR /app

# The backend URL to bake into this build (CRA inlines env vars at BUILD time,
# not at container runtime). Defaults to the previous hardcoded value so
# nothing changes unless you pass --build-arg / set it in docker-compose.
ARG REACT_APP_API_URL=http://localhost:5000
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the application for production
RUN npm run build

# Stage 2: Serve the application using Nginx
# Using 1.27-stable-alpine for latest security patches
FROM nginx:1.27-alpine

# Copy the build output from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom Nginx config (SPA routing, gzip, security headers)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]