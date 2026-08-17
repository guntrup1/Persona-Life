const https = require('https');

const apiKey = process.env.GEMINI_API_KEY || "AIzaSy..."; // I will pass the env var
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.parse(data));
  });
});
