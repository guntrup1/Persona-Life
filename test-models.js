const https = require('https');

const apiKey = process.env.GEMINI_API_KEY; // dev-only test script; pass via env var
if (!apiKey) {
  console.error("GEMINI_API_KEY env var is required");
  process.exit(1);
}
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.parse(data));
  });
});
