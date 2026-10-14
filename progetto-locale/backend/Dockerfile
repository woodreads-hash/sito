FROM node:18-alpine
# Installazione delle dipendenze per compilare pacchetti nativi se necessario
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev nasm bash vips-dev
ENV NODE_ENV=development
WORKDIR /opt/app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 1337
CMD ["npm", "run", "develop"]
