# Установка всех необходимых пакетов одной командой
npm install express mongoose bcryptjs jsonwebtoken axios dotenv cors
npm install -D nodemon

# Создание файла .env (если его нет)
echo PORT=3000 > .env
echo MONGODB_URI=mongodb://localhost:27017/moodmovie >> .env
echo JWT_SECRET=your_secret_key >> .env
echo TMDB_API_KEY=611c7d469272e7193dcd150a0b4a8f67 >> .env

# Запуск сервера
node server.js