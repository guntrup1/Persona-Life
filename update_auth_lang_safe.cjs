const fs = require('fs');

let auth = fs.readFileSync('server/auth.ts', 'utf8');

// Add lang to schemas
auth = auth.replace(
  'const registerSchema = z.object({',
  'const registerSchema = z.object({\n  lang: z.string().optional(),'
);

// We need to also add it to /api/auth/resend-verification since there is no schema for it
// It just uses req.body.email
auth = auth.replace(
  'const { email } = req.body;',
  'const { email, lang } = req.body;'
);

// We need to also add it to /api/auth/forgot-password since there is no schema for it
auth = auth.replace(
  'app.post("/api/auth/forgot-password", async (req, res) => {\n    const { email } = req.body;',
  'app.post("/api/auth/forgot-password", async (req, res) => {\n    const { email, lang } = req.body;'
);


// Replace the first email (Registration)
const regEmailOld = `        await sendEmail(
          user.email,
          "Подтверди email — Persona Life",
          \`
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
            <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">PERSONA LIFE</h2>
            <p style="color:#aaa;">Подтверди свой email чтобы войти в систему.</p>
            <a href="\${verifyUrl}"
              style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">
              ПОДТВЕРДИТЬ EMAIL
            </a>
            <p style="color:#666;font-size:12px;">Ссылка действует 24 часа. Если ты не регистрировался — просто проигнорируй письмо.</p>
          </div>
          \`
        );`;

const regEmailNew = `
        const userLang = parsed.data.lang || "ru";
        const subject = userLang === "en" ? "Verify your email — Persona Life" : "Подтверди email — Persona Life";
        const html = userLang === "en" ? \`
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
            <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">PERSONA LIFE</h2>
            <p style="color:#aaa;">Please verify your email to log in.</p>
            <a href="\${verifyUrl}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">VERIFY EMAIL</a>
            <p style="color:#666;font-size:12px;">The link is valid for 24 hours. If you did not register, please ignore this email.</p>
          </div>
        \` : \`
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
            <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">PERSONA LIFE</h2>
            <p style="color:#aaa;">Подтверди свой email чтобы войти в систему.</p>
            <a href="\${verifyUrl}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">ПОДТВЕРДИТЬ EMAIL</a>
            <p style="color:#666;font-size:12px;">Ссылка действует 24 часа. Если ты не регистрировался — просто проигнорируй письмо.</p>
          </div>
        \`;
        await sendEmail(user.email, subject, html);
`;

auth = auth.replace(regEmailOld, regEmailNew);

// Replace second email (Forgot Password)
const forgotEmailOld = `      await sendEmail(
        user.email,
        "Сброс пароля — Persona Life",
        \`
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Сброс пароля</h2>
          <p>Вы запросили сброс пароля для Persona Life.</p>
          <p>Нажмите на ссылку ниже (действует 1 час):</p>
          <a href="\${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
            Сбросить пароль
          </a>
        </div>
        \`
      );`;

const forgotEmailNew = `
      const userLang = lang || "ru";
      const subject = userLang === "en" ? "Password Reset — Persona Life" : "Сброс пароля — Persona Life";
      const html = userLang === "en" ? \`
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>You requested a password reset for Persona Life.</p>
          <p>Click the link below (valid for 1 hour):</p>
          <a href="\${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
        </div>
      \` : \`
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Сброс пароля</h2>
          <p>Вы запросили сброс пароля для Persona Life.</p>
          <p>Нажмите на ссылку ниже (действует 1 час):</p>
          <a href="\${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Сбросить пароль</a>
        </div>
      \`;
      await sendEmail(user.email, subject, html);
`;

auth = auth.replace(forgotEmailOld, forgotEmailNew);

// Replace third email (Resend Verification)
const resendEmailOld = `      await sendEmail(
        user.email,
        "Подтверждение email — Persona Life",
        \`
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#E11D48;">PERSONA LIFE</h2>
          <p>Для входа в систему подтвердите ваш email:</p>
          <a href="\${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;">
            ПОДТВЕРДИТЬ
          </a>
          <p style="color:#888;font-size:12px;">Ссылка действует 24 часа.</p>
        </div>
        \`
      );`;

const resendEmailNew = `
      const userLang = lang || "ru";
      const subject = userLang === "en" ? "Verify your email — Persona Life" : "Подтверждение email — Persona Life";
      const html = userLang === "en" ? \`
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#E11D48;">PERSONA LIFE</h2>
          <p>Please verify your email to log in:</p>
          <a href="\${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;">VERIFY EMAIL</a>
          <p style="color:#888;font-size:12px;">The link is valid for 24 hours.</p>
        </div>
      \` : \`
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#E11D48;">PERSONA LIFE</h2>
          <p>Для входа в систему подтвердите ваш email:</p>
          <a href="\${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;">ПОДТВЕРДИТЬ</a>
          <p style="color:#888;font-size:12px;">Ссылка действует 24 часа.</p>
        </div>
      \`;
      await sendEmail(user.email, subject, html);
`;

auth = auth.replace(resendEmailOld, resendEmailNew);

fs.writeFileSync('server/auth.ts', auth);
console.log('Fixed server/auth.ts');

// --- Frontend modifications ---

let clientAuth = fs.readFileSync('client/src/lib/auth.ts', 'utf8');
clientAuth = clientAuth.replace(
    'export async function register(data: AuthData) {',
    'export async function register(data: AuthData & { lang?: string }) {'
);
fs.writeFileSync('client/src/lib/auth.ts', clientAuth);
console.log('Fixed auth.ts frontend');

let login = fs.readFileSync('client/src/pages/login.tsx', 'utf8');
login = login.replace('await fetch("/api/auth/resend-verification", {', 'await fetch("/api/auth/resend-verification", {');
login = login.replace('body: JSON.stringify({ email: data.email }),', 'body: JSON.stringify({ email: data.email, lang }),');
login = login.replace('await register(data);', 'await register({ ...data, lang });');
if (!login.includes('body: JSON.stringify({ email: data.email, lang }),')) {
  // Try another replacement if the exact string wasn't found
  login = login.replace(/body: JSON\.stringify\(\{ email: data\.email \}\),/g, 'body: JSON.stringify({ email: data.email, lang }),');
}
fs.writeFileSync('client/src/pages/login.tsx', login);
console.log('Fixed login.tsx');

let forgot = fs.readFileSync('client/src/pages/forgot-password.tsx', 'utf8');
forgot = forgot.replace('const { t } = useI18n()', 'const { t, lang } = useI18n()');
forgot = forgot.replace(/body: JSON\.stringify\(\{ email \}\),/g, 'body: JSON.stringify({ email, lang }),');
fs.writeFileSync('client/src/pages/forgot-password.tsx', forgot);
console.log('Fixed forgot-password.tsx');

let verify = fs.readFileSync('client/src/pages/verify-email.tsx', 'utf8');
verify = verify.replace('const { t } = useI18n()', 'const { t, lang } = useI18n()');
verify = verify.replace(/body: JSON\.stringify\(\{ email \}\),/g, 'body: JSON.stringify({ email, lang }),');
fs.writeFileSync('client/src/pages/verify-email.tsx', verify);
console.log('Fixed verify-email.tsx');

