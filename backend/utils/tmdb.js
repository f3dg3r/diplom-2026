const { request } = require('undici');
const dns = require('dns');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const apiKey = process.env.TMDB_API_KEY;

// Форсируем использование публичного DNS
dns.setDefaultResultOrder('ipv4first');

async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.append('api_key', apiKey);
  url.searchParams.append('language', 'ru');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  console.log(`→ TMDB request: ${url.toString()}`);

  try {
    const { body } = await request(url.toString(), {
      method: 'GET',
      headers: {},
      maxRedirections: 2,
      timeout: 10000,
      // Отключаем использование глобального агента
      dispatcher: undefined,
    });
    const data = await body.json();
    return data;
  } catch (error) {
    console.error('TMDB ERROR:', error.message);
    throw new Error('TMDB request failed');
  }
}

module.exports = { fetchFromTMDB };