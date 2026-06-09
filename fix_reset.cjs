const fs = require('fs');
let code = fs.readFileSync('client/src/pages/reset-password.tsx', 'utf8');
code = code.replace('Новый пароль', '{t.authPages?.newPassword?.toUpperCase() || "НОВЫЙ ПАРОЛЬ"}');
fs.writeFileSync('client/src/pages/reset-password.tsx', code);
console.log('Fixed reset-password.tsx');
