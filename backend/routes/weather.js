// const express = require('express');
// const axios = require('axios');
// const { fetchFromTMDB } = require('../utils/tmdb');
// const router = express.Router();

// const weatherToGenres = {
//   clear: '35',         // ясно → комедия
//   cloudy: '18',        // облачно → драма
//   rain: '9648,53',     // дождь → детектив, триллер
//   snow: '14,10751',    // снег → фэнтези, семейный
//   default: '28'        // экшн
// };

// function mapWeatherCode(code) {
//   if ([0, 1].includes(code)) return weatherToGenres.clear;
//   if ([2, 3].includes(code)) return weatherToGenres.cloudy;
//   if ([51, 53, 55, 61, 63, 65].includes(code)) return weatherToGenres.rain;
//   if ([71, 73, 75, 77, 85, 86].includes(code)) return weatherToGenres.snow;
//   return weatherToGenres.default;
// }

// router.get('/recommendations', async (req, res) => {
//   try {
//     const { lat, lon } = req.query;
//     if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
//     const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
//       params: { latitude: lat, longitude: lon, current_weather: true }
//     });
//     const code = weatherRes.data.current_weather.weathercode;
//     const genres = mapWeatherCode(code);
//     const data = await fetchFromTMDB('/discover/movie', {
//       with_genres: genres,
//       sort_by: 'popularity.desc',
//       page: 1
//     });
//     res.json(data.results.slice(0, 10));
//   } catch (err) {
//     res.status(500).json({ error: 'Weather recommendation failed' });
//   }
// });

// module.exports = router;