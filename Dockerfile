FROM node:lts-slim
WORKDIR /app
COPY package*.json ./
RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get -y install openssl
RUN npm install
COPY . .
CMD ["node", "index.js"]