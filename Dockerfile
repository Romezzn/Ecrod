# Imagen ligera de Node.js Alpine
FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar definiciones de dependencias
COPY package*.json ./

# Instalar dependencias en producción
RUN npm install --production

# Copiar el código de la aplicación
COPY . .

# Exponer el puerto 3000
EXPOSE 9090

# Variable de entorno
ENV PORT=9090
ENV NODE_ENV=production

# Comando de inicio
CMD ["npm", "start"]
