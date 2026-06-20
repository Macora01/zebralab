# ---------- Build stage ----------
FROM node:20-alpine AS builder

# Build tools needed by some node-gyp packages
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# Build
COPY . .
ARG REACT_APP_BACKEND_URL=https://zebra.facore.cl
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
ENV DISABLE_HOT_RELOAD=true
ENV CI=false
RUN yarn build

# ---------- Runtime stage ----------
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
