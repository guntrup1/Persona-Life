const fs = require('fs');

// 1. Update server/auth.ts
let auth = fs.readFileSync('server/auth.ts', 'utf8');

// Helper to replace email templates in server/auth.ts
// Register & Resend Verification template
const ruVerify = `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
            <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">PERSONA LIFE</h2>
            <p style="color:#aaa;">Подтверди свой email чтобы войти в систему.</p>
            <a href="\${verifyUrl}"
              style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">
              ПОДТВЕРДИТЬ EMAIL
            </a>
            <p style="color:#666;font-size:12px;">Ссылка действует 24 часа. Если ты не регистрировался — просто проигнорируй письмо.</p>
          </div>
`;

const getEmailTemplate = (type) => `
        const lang = req.body.lang || "ru";
        const subject = lang === "en" ? 
          (type === "verify" ? "Verify your email — Persona Life" : "Password Reset — Persona Life") :
          (type === "verify" ? "Подтверди email — Persona Life" : "Сброс пароля — Persona Life");
        
        const html = lang === "en" ? 
          (type === "verify" ? \`
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
              <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">PERSONA LIFE</h2>
              <p style="color:#aaa;">Please verify your email to log in.</p>
              <a href="\${verifyUrl}"
                style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">
                VERIFY EMAIL
              </a>
              <p style="color:#666;font-size:12px;">The link is valid for 24 hours. If you did not register, please ignore this email.</p>
            </div>
          \` : \`
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Password Reset</h2>
              <p>You requested a password reset for Persona Life.</p>
              <p>Click the link below (valid for 1 hour):</p>
              <a href="\${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
                Reset Password
              </a>
            </div>
          \`) :
          (type === "verify" ? \`
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
              <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">PERSONA LIFE</h2>
              <p style="color:#aaa;">Подтверди свой email чтобы войти в систему.</p>
              <a href="\${verifyUrl}"
                style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">
                ПОДТВЕРДИТЬ EMAIL
              </a>
              <p style="color:#666;font-size:12px;">Ссылка действует 24 часа. Если ты не регистрировался — просто проигнорируй письмо.</p>
            </div>
          \` : \`
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Сброс пароля</h2>
              <p>Вы запросили сброс пароля для Persona Life.</p>
              <p>Нажмите на ссылку ниже (действует 1 час):</p>
              <a href="\${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
                Сбросить пароль
              </a>
            </div>
          \`);
        
        await sendEmail(user.email, subject, html);
`;

// It's quite complex to replace this precisely with regex since it's multiline.
// I will just read auth.ts and rewrite the specific routes.
auth = auth.replace(
/await sendEmail\(\s*user\.email,\s*"Подтверди email — Persona Life",\s*`[\s\S]*?`\s*\);/,
    getEmailTemplate('verify').replace('type === "verify"', 'true')
);

auth = auth.replace(
/await sendEmail\(\s*user\.email,\s*"Сброс пароля — Persona Life",\s*`[\s\S]*?`\s*\);/,
    getEmailTemplate('reset').replace('type === "verify"', 'false')
);

auth = auth.replace(
/await sendEmail\(\s*user\.email,\s*"Подтверждение email — Persona Life",\s*`[\s\S]*?`\s*\);/,
    getEmailTemplate('verify').replace('type === "verify"', 'true')
);

fs.writeFileSync('server/auth.ts', auth);

// 2. Update client/src/lib/auth.ts to accept lang
let clientAuth = fs.readFileSync('client/src/lib/auth.ts', 'utf8');
clientAuth = clientAuth.replace(
    'export async function register(data: AuthData) {',
    'export async function register(data: AuthData & { lang?: string }) {'
);
fs.writeFileSync('client/src/lib/auth.ts', clientAuth);

// 3. Update client/src/pages/login.tsx
let login = fs.readFileSync('client/src/pages/login.tsx', 'utf8');
login = login.replace('await fetch("/api/auth/resend-verification", {', 'await fetch("/api/auth/resend-verification", {\n        body: JSON.stringify({ email: data.email, lang }),');
login = login.replace('body: JSON.stringify({ email: data.email }),', ''); // remove old if it exists
login = login.replace('await register(data);', 'await register({ ...data, lang });');
fs.writeFileSync('client/src/pages/login.tsx', login);

// 4. Update client/src/pages/forgot-password.tsx
let forgot = fs.readFileSync('client/src/pages/forgot-password.tsx', 'utf8');
if (forgot.includes('const { t } = useI18n()')) {
    forgot = forgot.replace('const { t } = useI18n()', 'const { t, lang } = useI18n()');
}
forgot = forgot.replace('body: JSON.stringify({ email }),', 'body: JSON.stringify({ email, lang }),');
fs.writeFileSync('client/src/pages/forgot-password.tsx', forgot);

// 5. Update client/src/pages/verify-email.tsx
let verify = fs.readFileSync('client/src/pages/verify-email.tsx', 'utf8');
if (verify.includes('const { t } = useI18n()')) {
    verify = verify.replace('const { t } = useI18n()', 'const { t, lang } = useI18n()');
}
verify = verify.replace('body: JSON.stringify({ email }),', 'body: JSON.stringify({ email, lang }),');
fs.writeFileSync('client/src/pages/verify-email.tsx', verify);

console.log('API and frontend updated for lang parameters.');
