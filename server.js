
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./backend/routes/auth');
// const movieRoutes = require('./backend/routes/movies'); // отключено – фильмы запрашиваются напрямую из браузера
const weatherRoutes = require('./backend/routes/weather');
const favoriteRoutes = require('./backend/routes/favorites');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
  console.log(`→ ${req.method} ${req.originalUrl}`);
  next();
});

// Раздача статики (фронтенд)
app.use(express.static(path.join(__dirname, 'public')));

// API-маршруты
app.use('/api/auth', authRoutes);
// app.use('/api/movies', movieRoutes);   // отключено, фильмы загружаются напрямую из браузера через TMDB API
app.use('/api/weather', weatherRoutes);
app.use('/api/favorites', favoriteRoutes);

// Центральный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('!!! SERVER ERROR:', err.stack || err.message || err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3).join('\n')
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });