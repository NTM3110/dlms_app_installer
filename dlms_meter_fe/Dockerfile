FROM node:22 AS build

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy the built files from Angular 17+ output directory structure
COPY --from=build /app/dist/dlms-meter-fe/browser /usr/share/nginx/html
# Copy custom Nginx config for routing and proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]