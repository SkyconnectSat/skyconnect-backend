// SkyConnect Platform — Zero-dependency Node.js Server
// Uses only built-in modules: http, fs, path, crypto, url, querystring
//
// =====================================================
// SMTP / EMAIL CONFIGURATION (optional)
// =====================================================
// To enable real email notifications, install nodemailer:
//   npm install nodemailer
//
// Then set the following environment variables:
//   SMTP_HOST=smtp.gmail.com        (or your SMTP server)
//   SMTP_PORT=587                   (or 465 for SSL)
//   SMTP_SECURE=false               (true for port 465)
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=your-app-password
//   SMTP_FROM="SkyConnect <noreply@skyconnectsat.com>"
//
// The sendNotification function below will automatically use
// nodemailer when it is installed and SMTP_HOST is set.
// =====================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const LOGO_FILE = path.join(__dirname, 'data', 'logo.png');
const LOGO_LIGHT_FILE = path.join(__dirname, 'data', 'logo-light.png');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vanessacarreno91@gmail.com';

// =====================================================
// SIMPLE SESSION STORE (in-memory)
// =====================================================
const sessions = {};

function createSession(userData) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions[sid] = { ...userData, created: Date.now() };
  return sid;
}

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/sid=([a-f0-9]+)/);
  if (!match) return null;
  return sessions[match[1]] || null;
}

function destroySession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/sid=([a-f0-9]+)/);
  if (match) delete sessions[match[1]];
}

function sessionCookie(sid) {
  return `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

// =====================================================
// PASSWORD HASHING (built-in crypto)
// =====================================================
function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pwd, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(pwd, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pwd, salt, 64).toString('hex');
  return hash === test;
}

// =====================================================
// DATA LAYER (JSON file)
// =====================================================
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    const db = createDefaultDB();
    saveDB(db);
    return db;
  }
}

function saveDB(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function createDefaultSim(overrides = {}) {
  return {
    id: 'sim_' + uuid().slice(0, 8),
    serial: '',
    clientId: '',
    status: 'inactive',
    iccid: '',
    imei: '',
    msisdn: '',
    puk: '',
    pin: '',
    puk2: '',
    pin2: '',
    network: '',
    telephony: '',
    simData: '',
    balance: 0,
    dataUsed: 0,
    dataTotal: 0,
    lastLocation: '',
    expiryDate: '',
    activationDate: '',
    lastConnection: '',
    planType: '',
    serviceType: '',
    cardType: '',
    minutesActive: 0,
    monthlyCharge: 0,
    name: '',
    reference: '',
    subClient: '',
    lastUpdated: new Date().toISOString(),
    operations: [],
    ...overrides
  };
}

function defaultPermissions() {
  return {
    canViewSims: true,
    canActivate: false,
    canDeactivate: false,
    canRecharge: false,
    canViewBilling: false,
    canViewReports: false,
    canManageAccounts: false
  };
}

// =====================================================
// EMAIL TEMPLATE HTML BUILDER
// =====================================================
function buildEmailHtml(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:20px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<!-- HEADER -->
<tr><td style="background-color:#0d2137;padding:28px 40px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="text-align:center;">
<span style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:3px;">SKY</span><span style="font-size:28px;font-weight:700;color:#e63956;letter-spacing:3px;">CONNECT</span>
<br><span style="font-size:12px;color:#8899aa;letter-spacing:2px;text-transform:uppercase;">Anywhere. Anytime.</span>
</td>
</tr></table>
</td></tr>
<!-- ACCENT BAR -->
<tr><td style="height:4px;background:linear-gradient(90deg,#e63956,#0d2137);"></td></tr>
<!-- BODY -->
<tr><td style="padding:36px 40px 30px 40px;">
${bodyContent}
</td></tr>
<!-- FOOTER -->
<tr><td style="background-color:#f8f9fb;padding:24px 40px;border-top:1px solid #e8ecf1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;">
<p style="margin:0 0 6px 0;font-size:13px;color:#0d2137;font-weight:600;">SkyConnect Satellite Services</p>
<p style="margin:0 0 10px 0;font-size:11px;color:#8899aa;">Comunicaciones satelitales confiables en cualquier lugar del mundo.</p>
<p style="margin:0;font-size:10px;color:#aab4c0;">Este correo fue generado autom&aacute;ticamente. Por favor no responda directamente a este mensaje.<br>&copy; ${new Date().getFullYear()} SkyConnect. Todos los derechos reservados.</p>
</td></tr></table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function createDefaultDB() {
  // Build email template HTML bodies
  const tplBodies = {};

  tplBodies.activation_request_admin = buildEmailHtml('Nueva Solicitud de Activación', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Nueva Solicitud de Activaci&oacute;n</h2>
<p style="margin:0 0 20px 0;font-size:14px;color:#e63956;font-weight:600;">Se requiere acci&oacute;n administrativa</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#f0f4f8;border-left:4px solid #e63956;border-radius:4px;">
<p style="margin:0 0 4px 0;font-size:13px;color:#6b7c8f;">Cliente</p>
<p style="margin:0;font-size:16px;color:#0d2137;font-weight:600;">{{clientName}} — {{company}}</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Tipo de Servicio</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{serviceType}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Plan Solicitado</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{planType}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha de Solicitud</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Ingrese al panel de administraci&oacute;n para procesar esta solicitud.</p>`);

  tplBodies.deactivation_request_admin = buildEmailHtml('Nueva Solicitud de Desactivación', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Nueva Solicitud de Desactivaci&oacute;n</h2>
<p style="margin:0 0 20px 0;font-size:14px;color:#e63956;font-weight:600;">Se requiere acci&oacute;n administrativa</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#f0f4f8;border-left:4px solid #e63956;border-radius:4px;">
<p style="margin:0 0 4px 0;font-size:13px;color:#6b7c8f;">Cliente</p>
<p style="margin:0;font-size:16px;color:#0d2137;font-weight:600;">{{clientName}} — {{company}}</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha de Solicitud</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">El cliente ha solicitado la desactivaci&oacute;n de esta l&iacute;nea. Ingrese al panel para procesar.</p>`);

  tplBodies.recharge_request_admin = buildEmailHtml('Nueva Solicitud de Recarga', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Nueva Solicitud de Recarga</h2>
<p style="margin:0 0 20px 0;font-size:14px;color:#e63956;font-weight:600;">Se requiere acci&oacute;n administrativa</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#f0f4f8;border-left:4px solid #e63956;border-radius:4px;">
<p style="margin:0 0 4px 0;font-size:13px;color:#6b7c8f;">Cliente</p>
<p style="margin:0;font-size:16px;color:#0d2137;font-weight:600;">{{clientName}} — {{company}}</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Plan de Recarga</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{planType}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha de Solicitud</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Ingrese al panel de administraci&oacute;n para aplicar la recarga.</p>`);

  tplBodies.subuser_pending_admin = buildEmailHtml('Nuevo Sub-Usuario Pendiente', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Nuevo Sub-Usuario Pendiente de Aprobaci&oacute;n</h2>
<p style="margin:0 0 20px 0;font-size:14px;color:#e63956;font-weight:600;">Se requiere revisi&oacute;n y aprobaci&oacute;n</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#f0f4f8;border-left:4px solid #0d2137;border-radius:4px;">
<p style="margin:0 0 4px 0;font-size:13px;color:#6b7c8f;">Solicitado por</p>
<p style="margin:0;font-size:16px;color:#0d2137;font-weight:600;">{{clientName}} — {{company}}</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">Nombre</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{subuserName}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Email</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{subuserEmail}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Ingrese al panel de administraci&oacute;n para aprobar o rechazar este sub-usuario.</p>`);

  tplBodies.activation_inprocess_client = buildEmailHtml('Activación en Proceso', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Su Solicitud Est&aacute; en Proceso</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Hemos recibido su solicitud de <strong>activaci&oacute;n</strong> y nuestro equipo ya est&aacute; trabajando en ella. Le notificaremos tan pronto como su l&iacute;nea est&eacute; activa.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Tipo de Servicio</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{serviceType}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Plan</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{planType}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Estado</td><td style="font-size:14px;padding:10px 16px;border-top:1px solid #e8ecf1;"><span style="background-color:#fff3e0;color:#e65100;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">En Proceso</span></td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Gracias por confiar en SkyConnect. Si tiene alguna pregunta, no dude en contactarnos.</p>`);

  tplBodies.deactivation_inprocess_client = buildEmailHtml('Desactivación en Proceso', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Su Solicitud Est&aacute; en Proceso</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Hemos recibido su solicitud de <strong>desactivaci&oacute;n</strong> y nuestro equipo la est&aacute; procesando. Le confirmaremos cuando se complete.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Estado</td><td style="font-size:14px;padding:10px 16px;border-top:1px solid #e8ecf1;"><span style="background-color:#fff3e0;color:#e65100;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">En Proceso</span></td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Si tiene alguna pregunta sobre esta solicitud, no dude en contactarnos.</p>`);

  tplBodies.recharge_inprocess_client = buildEmailHtml('Recarga en Proceso', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Su Solicitud de Recarga Est&aacute; en Proceso</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Hemos recibido su solicitud de <strong>recarga</strong> y nuestro equipo la est&aacute; procesando. Le notificaremos cuando la recarga haya sido aplicada exitosamente.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;width:40%;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Plan de Recarga</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{planType}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Estado</td><td style="font-size:14px;padding:10px 16px;border-top:1px solid #e8ecf1;"><span style="background-color:#fff3e0;color:#e65100;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">En Proceso</span></td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Gracias por elegir SkyConnect para sus comunicaciones satelitales.</p>`);

  tplBodies.activation_completed_client = buildEmailHtml('SIM Activada Exitosamente', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">&#127881; SIM Activada Exitosamente</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Nos complace informarle que su SIM ha sido <strong style="color:#2e7d32;">activada exitosamente</strong>. A continuaci&oacute;n los detalles de su l&iacute;nea:</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#e8f5e9;"><td style="font-size:13px;color:#2e7d32;padding:10px 16px;width:40%;font-weight:600;">Estado</td><td style="font-size:14px;color:#2e7d32;font-weight:700;padding:10px 16px;">&#10003; ACTIVA</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simSerial}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Plan</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{planType}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Servicio</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{serviceType}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0 0 8px 0;font-size:14px;color:#444d56;">Puede consultar el estado de su SIM en cualquier momento desde su panel de cliente.</p>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Gracias por confiar en SkyConnect.</p>`);

  tplBodies.deactivation_completed_client = buildEmailHtml('SIM Desactivada', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">SIM Desactivada</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Le confirmamos que su SIM ha sido <strong>desactivada</strong> seg&uacute;n su solicitud.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#fce4ec;"><td style="font-size:13px;color:#c62828;padding:10px 16px;width:40%;font-weight:600;">Estado</td><td style="font-size:14px;color:#c62828;font-weight:700;padding:10px 16px;">INACTIVA</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simSerial}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0 0 8px 0;font-size:14px;color:#444d56;">Si desea reactivar esta l&iacute;nea en el futuro, puede hacerlo desde su panel de cliente.</p>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Gracias por su preferencia.</p>`);

  tplBodies.recharge_completed_client = buildEmailHtml('Recarga Aplicada Exitosamente', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">&#9889; Recarga Aplicada Exitosamente</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Su recarga ha sido <strong style="color:#2e7d32;">aplicada exitosamente</strong>. Su l&iacute;nea satelital est&aacute; lista para usar.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#e8f5e9;"><td style="font-size:13px;color:#2e7d32;padding:10px 16px;width:40%;font-weight:600;">Estado</td><td style="font-size:14px;color:#2e7d32;font-weight:700;padding:10px 16px;">&#10003; Recarga Completada</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simSerial}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">N&uacute;mero (MSISDN)</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simNumber}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Plan Aplicado</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{planType}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Puede consultar su saldo actualizado desde su panel de cliente.</p>`);

  tplBodies.request_rejected_client = buildEmailHtml('Solicitud Rechazada', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Solicitud No Procesada</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{clientName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Lamentamos informarle que su solicitud de <strong>{{requestType}}</strong> para la SIM <strong>{{simSerial}}</strong> no ha podido ser procesada en esta ocasi&oacute;n.</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e8ecf1;border-radius:6px;margin-bottom:24px;">
<tr style="background-color:#fff3e0;"><td style="font-size:13px;color:#e65100;padding:10px 16px;width:40%;font-weight:600;">Estado</td><td style="font-size:14px;color:#e65100;font-weight:700;padding:10px 16px;">Rechazada</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Tipo de Solicitud</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{requestType}}</td></tr>
<tr style="background-color:#f8f9fb;"><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">SIM Serial</td><td style="font-size:14px;color:#0d2137;font-weight:600;padding:10px 16px;border-top:1px solid #e8ecf1;">{{simSerial}}</td></tr>
<tr><td style="font-size:13px;color:#6b7c8f;padding:10px 16px;border-top:1px solid #e8ecf1;">Fecha</td><td style="font-size:14px;color:#0d2137;padding:10px 16px;border-top:1px solid #e8ecf1;">{{date}}</td></tr>
</table>
<p style="margin:0 0 12px 0;font-size:14px;color:#444d56;">Si considera que esto es un error o necesita m&aacute;s informaci&oacute;n, por favor cont&aacute;ctenos y con gusto le asistiremos.</p>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Lamentamos las molestias. Estamos a su disposici&oacute;n.</p>`);

  tplBodies.subuser_approved = buildEmailHtml('Cuenta Aprobada', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">&#127881; Su Cuenta Ha Sido Aprobada</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{subuserName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Nos complace informarle que su cuenta de sub-usuario en la plataforma <strong>SkyConnect</strong> ha sido <strong style="color:#2e7d32;">aprobada</strong>. Ya puede acceder al sistema.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:20px;background-color:#e8f5e9;border-radius:8px;text-align:center;">
<p style="margin:0 0 12px 0;font-size:14px;color:#2e7d32;font-weight:600;">Datos de Acceso</p>
<p style="margin:0 0 6px 0;font-size:13px;color:#444d56;">Email: <strong>{{subuserEmail}}</strong></p>
<p style="margin:0 0 16px 0;font-size:13px;color:#444d56;">Contrase&ntilde;a: La que usted proporcion&oacute; al registrarse</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
<td style="background-color:#0d2137;border-radius:6px;padding:12px 32px;">
<span style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Iniciar Sesi&oacute;n</span>
</td>
</tr></table>
</td></tr>
</table>
<p style="margin:0 0 8px 0;font-size:14px;color:#444d56;">Empresa asociada: <strong>{{company}}</strong></p>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Bienvenido/a a SkyConnect. Si tiene alguna pregunta, no dude en contactarnos.</p>`);

  tplBodies.subuser_rejected = buildEmailHtml('Solicitud de Cuenta Rechazada', `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#0d2137;">Solicitud de Cuenta No Aprobada</h2>
<p style="margin:0 0 24px 0;font-size:15px;color:#444d56;line-height:1.6;">Estimado/a <strong>{{subuserName}}</strong>,</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#444d56;line-height:1.6;">Lamentamos informarle que su solicitud de cuenta de sub-usuario en la plataforma <strong>SkyConnect</strong> no ha sido aprobada en esta ocasi&oacute;n.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="padding:16px 20px;background-color:#fff3e0;border-left:4px solid #e65100;border-radius:4px;">
<p style="margin:0 0 4px 0;font-size:13px;color:#e65100;font-weight:600;">Estado: Rechazada</p>
<p style="margin:0;font-size:13px;color:#444d56;">Email registrado: {{subuserEmail}}</p>
</td></tr>
</table>
<p style="margin:0 0 12px 0;font-size:14px;color:#444d56;">Si cree que esto es un error o desea obtener m&aacute;s informaci&oacute;n, por favor comun&iacute;quese con el administrador de su empresa o con nuestro equipo de soporte.</p>
<p style="margin:0;font-size:13px;color:#6b7c8f;">Agradecemos su inter&eacute;s en SkyConnect.</p>`);

  return {
    users: [
      {
        id: 'usr_admin',
        email: 'admin@skyconnectsat.com',
        password: hashPassword('admin2026'),
        name: 'Vanessa Admin',
        company: 'SkyConnect',
        role: 'admin',
        phone: '',
        countryCode: '',
        address: '',
        city: '',
        country: '',
        postalCode: ''
      },
      {
        id: 'usr_demo1',
        email: 'demo@cliente.com',
        password: hashPassword('demo123'),
        name: 'Carlos Rodriguez',
        company: 'Minera del Norte',
        role: 'client',
        phone: '',
        countryCode: '',
        address: '',
        city: '',
        country: '',
        postalCode: ''
      }
    ],
    sims: [
      {
        id: 'sim_001', serial: '8988169328001000001', clientId: 'usr_demo1',
        status: 'inactive', iccid: '', imei: '', msisdn: '', puk: '', pin: '',
        puk2: '', pin2: '', network: '', telephony: '', simData: '',
        balance: 0, dataUsed: 0, dataTotal: 0, lastLocation: '',
        expiryDate: '', activationDate: '', lastConnection: '',
        planType: '', serviceType: '', cardType: 'Iridium 9555',
        minutesActive: 0, monthlyCharge: 0, name: '', reference: '',
        subClient: '',
        lastUpdated: new Date().toISOString(), operations: []
      },
      {
        id: 'sim_002', serial: '8988169328001000002', clientId: 'usr_demo1',
        status: 'inactive', iccid: '', imei: '', msisdn: '', puk: '', pin: '',
        puk2: '', pin2: '', network: '', telephony: '', simData: '',
        balance: 0, dataUsed: 0, dataTotal: 0, lastLocation: '',
        expiryDate: '', activationDate: '', lastConnection: '',
        planType: '', serviceType: '', cardType: 'Iridium 9575',
        minutesActive: 0, monthlyCharge: 0, name: '', reference: '',
        subClient: '',
        lastUpdated: new Date().toISOString(), operations: []
      },
      {
        id: 'sim_003', serial: '8988169328001000003', clientId: 'usr_demo1',
        status: 'active',
        iccid: '89881693280010000034F', imei: '300125060000030',
        msisdn: '+8816 2365 0003', puk: '12345678', pin: '1234',
        puk2: '', pin2: '', network: 'Iridium', telephony: '', simData: '',
        balance: 85, dataUsed: 12, dataTotal: 100,
        lastLocation: 'Lat: 19.4326, Lon: -99.1332',
        expiryDate: '2026-09-15', activationDate: '2026-01-10',
        lastConnection: '2026-04-29T18:30:00',
        planType: 'Voucher 100 minutes - Validity 30 days',
        serviceType: 'Pre-Pago', cardType: 'Iridium 9555',
        minutesActive: 15, monthlyCharge: 0,
        name: 'Unidad Planta Norte', reference: 'PN-001',
        subClient: '',
        lastUpdated: new Date().toISOString(), operations: []
      }
    ],
    subusers: [],
    requests: [],
    activityLog: [],
    accounts: [],
    notificationSettings: {
      adminEmail: 'vanessacarreno91@gmail.com',
      notifyAdmin: true,
      notifyClient: true,
      clientNotifications: true,
      adminNotifications: true,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: ''
    },
    emailTemplates: {
      activation_request_admin: {
        name: 'Nueva Activación — Admin',
        subject: 'Nueva solicitud de activación — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.activation_request_admin
      },
      deactivation_request_admin: {
        name: 'Nueva Desactivación — Admin',
        subject: 'Nueva solicitud de desactivación — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.deactivation_request_admin
      },
      recharge_request_admin: {
        name: 'Nueva Recarga — Admin',
        subject: 'Nueva solicitud de recarga — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.recharge_request_admin
      },
      subuser_pending_admin: {
        name: 'Nuevo Sub-Usuario Pendiente — Admin',
        subject: 'Nuevo sub-usuario pendiente de aprobación — {{subuserName}}',
        fromEmail: '',
        htmlBody: tplBodies.subuser_pending_admin
      },
      activation_inprocess_client: {
        name: 'Activación en Proceso — Cliente',
        subject: 'Su solicitud de activación está en proceso — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.activation_inprocess_client
      },
      deactivation_inprocess_client: {
        name: 'Desactivación en Proceso — Cliente',
        subject: 'Su solicitud de desactivación está en proceso — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.deactivation_inprocess_client
      },
      recharge_inprocess_client: {
        name: 'Recarga en Proceso — Cliente',
        subject: 'Su solicitud de recarga está en proceso — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.recharge_inprocess_client
      },
      activation_completed_client: {
        name: 'Activación Completada — Cliente',
        subject: 'SIM activada exitosamente — {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.activation_completed_client
      },
      deactivation_completed_client: {
        name: 'Desactivación Completada — Cliente',
        subject: 'SIM desactivada — {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.deactivation_completed_client
      },
      recharge_completed_client: {
        name: 'Recarga Completada — Cliente',
        subject: 'Recarga aplicada exitosamente — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.recharge_completed_client
      },
      request_rejected_client: {
        name: 'Solicitud Rechazada — Cliente',
        subject: 'Solicitud rechazada — SIM {{simSerial}}',
        fromEmail: '',
        htmlBody: tplBodies.request_rejected_client
      },
      subuser_approved: {
        name: 'Sub-Usuario Aprobado',
        subject: 'Su cuenta ha sido aprobada — SkyConnect',
        fromEmail: '',
        htmlBody: tplBodies.subuser_approved
      },
      subuser_rejected: {
        name: 'Sub-Usuario Rechazado',
        subject: 'Solicitud de cuenta rechazada — SkyConnect',
        fromEmail: '',
        htmlBody: tplBodies.subuser_rejected
      }
    }
  };
}

// =====================================================
// TEMPLATE-BASED EMAIL NOTIFICATION
// =====================================================
function sendTemplateEmail(templateId, variables, recipientEmail) {
  const db = loadDB();
  const settings = db.notificationSettings || {};
  const templates = db.emailTemplates || {};
  const template = templates[templateId];

  if (!template) {
    console.log(`⚠️ Email template "${templateId}" not found`);
    return;
  }

  // Replace variables in subject and body
  let subject = template.subject;
  let htmlBody = template.htmlBody;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, value || '');
    htmlBody = htmlBody.replace(regex, value || '');
  }

  // Also replace {{date}} with current date formatted
  const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  subject = subject.replace(/\{\{date\}\}/g, now);
  htmlBody = htmlBody.replace(/\{\{date\}\}/g, now);

  const fromEmail = template.fromEmail || settings.smtpFrom || settings.smtpUser || '';

  console.log(`\n📧 EMAIL [${templateId}] → ${recipientEmail}\n   From: ${fromEmail}\n   Subject: ${subject}\n`);

  // Send via nodemailer if configured
  const smtpHost = settings.smtpHost || process.env.SMTP_HOST;
  const smtpPort = settings.smtpPort || parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = settings.smtpUser || process.env.SMTP_USER;
  const smtpPass = settings.smtpPassword || settings.smtpPass || process.env.SMTP_PASS;
  const smtpSecure = (settings.smtpPort === 465) || process.env.SMTP_SECURE === 'true';

  try {
    const nodemailer = require('nodemailer');
    if (smtpHost && smtpUser) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      });
      transporter.sendMail({
        from: fromEmail || `"SkyConnect" <${smtpUser}>`,
        to: recipientEmail,
        subject,
        html: htmlBody
      }).then(() => {
        console.log(`   ✅ Email sent successfully to ${recipientEmail}`);
      }).catch((err) => {
        console.log(`   ⚠️ Email send failed: ${err.message}`);
      });
    }
  } catch (e) {
    // nodemailer not installed
  }
}

// Deprecated: kept for reference but no longer called
function sendNotification(subject, details, toClient) {
  console.log(`⚠️ sendNotification() is deprecated. Use sendTemplateEmail() instead.`);
  console.log(`   Subject: ${subject} | To: ${toClient || 'admin'}`);
}

function logActivity(db, clientId, action, details) {
  db.activityLog.unshift({ id: uuid(), clientId, action, details, timestamp: new Date().toISOString() });
  if (db.activityLog.length > 500) db.activityLog = db.activityLog.slice(0, 500);
}

// Helper: push an operation to a SIM's operations array (keep last 20)
function pushSimOperation(sim, op) {
  if (!sim.operations) sim.operations = [];
  sim.operations.unshift(op);
  if (sim.operations.length > 20) sim.operations = sim.operations.slice(0, 20);
}

// Helper: update a SIM operation status by request id
function updateSimOperationStatus(sim, requestId, newStatus) {
  if (!sim.operations) return;
  const op = sim.operations.find(o => o.id === requestId);
  if (op) op.status = newStatus;
}

// =====================================================
// PLAN DATA
// =====================================================
const PLANS = {
  services: ['Pre-Pago', 'Post-Pago'],
  plans: {
    'Pre-Pago': [
      '30 days Validity Extension',
      'Voucher 100 minutes - Validity 0 days - For Top-up',
      'Voucher 100 minutes - Validity 30 days',
      'Voucher 100 minutes - Validity 60 days',
      'Voucher 200 minutes - Validity 180 days',
      'Voucher 600 minutes - Validity 365 days',
      'Voucher 4000 minutes - Validity 730 days',
      'Voucher 300 minutes Global - Validity 365 days',
      'Voucher 500 minutes Middle East and Africa - Validity 365 days',
      'Voucher 200 minutes Latin America - Validity 180 days',
      'Voucher 500 minutes Latin America - Validity 365 days',
      'Voucher 200 minutes Northern Lights/Canada - Validity 180 days',
      'Voucher 500 minutes Northern Lights/Canada - Validity 365 days',
      '30 days Validity Extension for Iridium GO!',
      'Voucher 400 minutes for Iridium GO! - Validity 180 days',
      'Voucher 1000 minutes for Iridium GO! - Validity 365 days',
      'Voucher Text and Call for Iridium GO! (3000SMS or 120min) - Validity 180 days'
    ],
    'Post-Pago': [
      'Iridium Seasonal 10 min + 10 SMS - 3 month commitment',
      'Iridium Starter 25 min + 25 SMS - 1 month commitment',
      'Iridium Advanced 100 min + 100 SMS - 6 month commitment',
      'Iridium Power 250 min + 250 SMS - 6 month commitment'
    ]
  }
};

function getPlans(db) {
  return db.plans || PLANS;
}

// =====================================================
// HTTP HELPERS
// =====================================================
function json(res, data, status = 200, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
    });
  });
}

function parseRawBody(req, maxSize = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) { reject(new Error('File too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
  };
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

// =====================================================
// ROUTER
// =====================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // --- API ROUTES ---

  // POST /api/login
  if (method === 'POST' && pathname === '/api/login') {
    const { email, password } = await parseBody(req);
    const db = loadDB();

    // Check users array first (includes sub-users that have been promoted)
    let user = db.users.find(u => u.email === email);

    // If not found in users, check approved sub-users that have a password
    if (!user) {
      const subuser = (db.subusers || []).find(s => s.email === email && s.status === 'approved' && s.password);
      if (subuser) {
        // Approved sub-user with password can log in — create a virtual user object
        if (verifyPassword(password, subuser.password)) {
          const sid = createSession({
            userId: subuser.id,
            role: 'subuser',
            email: subuser.email,
            name: subuser.name,
            company: subuser.company || '',
            parentClientId: subuser.parentClientId,
            permissions: subuser.permissions || defaultPermissions()
          });
          return json(res, {
            id: subuser.id,
            name: subuser.name,
            email: subuser.email,
            company: subuser.company || '',
            role: 'subuser',
            parentClientId: subuser.parentClientId,
            permissions: subuser.permissions || defaultPermissions()
          }, 200, { 'Set-Cookie': sessionCookie(sid) });
        } else {
          return json(res, { error: 'Credenciales incorrectas' }, 401);
        }
      }
    }

    if (!user || !verifyPassword(password, user.password)) {
      return json(res, { error: 'Credenciales incorrectas' }, 401);
    }

    const sessionData = {
      userId: user.id, role: user.role, email: user.email, name: user.name, company: user.company
    };
    // If this is a subuser in the users array, include permissions and parentClientId
    if (user.role === 'subuser') {
      sessionData.parentClientId = user.parentClientId;
      sessionData.permissions = user.permissions || defaultPermissions();
    }
    const sid = createSession(sessionData);
    const responseData = { id: user.id, name: user.name, email: user.email, company: user.company, role: user.role };
    if (user.role === 'subuser') {
      responseData.parentClientId = user.parentClientId;
      responseData.permissions = user.permissions || defaultPermissions();
    }
    return json(res, responseData, 200, {
      'Set-Cookie': sessionCookie(sid)
    });
  }

  // POST /api/logout
  if (method === 'POST' && pathname === '/api/logout') {
    destroySession(req);
    return json(res, { ok: true }, 200, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  }

  // GET /api/me
  if (method === 'GET' && pathname === '/api/me') {
    const s = getSession(req);
    if (!s) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();

    // Check if session belongs to a subuser (could be in subusers array)
    if (s.role === 'subuser') {
      // Try users array first
      const user = db.users.find(u => u.id === s.userId);
      if (user) {
        return json(res, {
          id: user.id, name: user.name, email: user.email, company: user.company, role: user.role,
          phone: user.phone || '', countryCode: user.countryCode || '',
          address: user.address || '', city: user.city || '', country: user.country || '',
          postalCode: user.postalCode || '', notifEmail: user.notifEmail || '', contactPerson: user.contactPerson || '',
          parentClientId: user.parentClientId, permissions: user.permissions || defaultPermissions()
        });
      }
      // Fall back to subusers array
      const subuser = (db.subusers || []).find(su => su.id === s.userId);
      if (subuser) {
        return json(res, {
          id: subuser.id, name: subuser.name, email: subuser.email, company: subuser.company || '',
          role: 'subuser',
          phone: subuser.phone || '', countryCode: '',
          address: '', city: '', country: '', postalCode: '',
          notifEmail: '', contactPerson: '',
          parentClientId: subuser.parentClientId, permissions: subuser.permissions || defaultPermissions()
        });
      }
      return json(res, { error: 'Usuario no encontrado' }, 404);
    }

    const user = db.users.find(u => u.id === s.userId);
    if (!user) return json(res, { error: 'Usuario no encontrado' }, 404);
    return json(res, {
      id: user.id, name: user.name, email: user.email, company: user.company, role: user.role,
      phone: user.phone || '', countryCode: user.countryCode || '',
      address: user.address || '', city: user.city || '', country: user.country || '',
      postalCode: user.postalCode || '', notifEmail: user.notifEmail || '', contactPerson: user.contactPerson || ''
    });
  }

  // PATCH /api/me — client self-update (no name/company changes)
  if (method === 'PATCH' && pathname === '/api/me') {
    const s = getSession(req);
    if (!s) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const user = db.users.find(u => u.id === s.userId);
    if (!user) return json(res, { error: 'Usuario no encontrado' }, 404);
    const body = await parseBody(req);
    const allowed = ['email', 'phone', 'countryCode', 'address', 'city', 'country', 'postalCode', 'notifEmail', 'contactPerson'];
    for (const f of allowed) {
      if (body[f] !== undefined) user[f] = body[f];
    }
    if (body.notificationEmail !== undefined) user.notifEmail = body.notificationEmail;
    // Update session email if changed
    if (body.email) {
      s.email = body.email;
    }
    saveDB(db);
    return json(res, {
      ok: true,
      user: {
        id: user.id, name: user.name, email: user.email, company: user.company, role: user.role,
        phone: user.phone || '', countryCode: user.countryCode || '',
        address: user.address || '', city: user.city || '', country: user.country || '',
        postalCode: user.postalCode || '', notifEmail: user.notifEmail || '', contactPerson: user.contactPerson || ''
      }
    });
  }

  // GET /api/plans
  if (method === 'GET' && pathname === '/api/plans') {
    const db = loadDB();
    return json(res, getPlans(db));
  }

  // --- AUTH REQUIRED FROM HERE ---
  const session = getSession(req);

  // =====================================================
  // ACCOUNTS (client side)
  // =====================================================

  // POST /api/accounts
  if (method === 'POST' && pathname === '/api/accounts') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const body = await parseBody(req);
    if (!body.name) {
      return json(res, { error: 'Campo requerido: name' }, 400);
    }
    const db = loadDB();
    if (!db.accounts) db.accounts = [];
    const account = {
      id: uuid(),
      userId: session.userId,
      name: body.name,
      contact: body.contact || '',
      email: body.email || '',
      phone: body.phone || '',
      empresa: body.empresa || '',
      status: 'approved',
      createdAt: new Date().toISOString()
    };
    db.accounts.push(account);
    saveDB(db);
    return json(res, { ok: true, account });
  }

  // GET /api/accounts
  if (method === 'GET' && pathname === '/api/accounts') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    if (!db.accounts) db.accounts = [];
    const accounts = session.role === 'admin' ? db.accounts : db.accounts.filter(a => a.userId === session.userId);
    return json(res, accounts);
  }

  // POST /api/admin/accounts — admin creates and optionally assigns account
  if (method === 'POST' && pathname === '/api/admin/accounts') {
    if (!session || session.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
    const body = await parseBody(req);
    if (!body.name) return json(res, { error: 'Campo requerido: name' }, 400);
    const db = loadDB();
    if (!db.accounts) db.accounts = [];
    const account = {
      id: uuid(),
      userId: body.userId || '',
      name: body.name,
      contact: body.contact || '',
      email: body.email || '',
      phone: body.phone || '',
      status: 'approved',
      createdAt: new Date().toISOString()
    };
    db.accounts.push(account);
    saveDB(db);
    return json(res, { ok: true, account });
  }

  // POST /api/admin/accounts/:id/assign
  if (method === 'POST' && pathname.match(/^\/api\/admin\/accounts\/[^/]+\/assign$/)) {
    if (!session || session.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
    const accountId = pathname.split('/')[4];
    const body = await parseBody(req);
    const db = loadDB();
    if (!db.accounts) db.accounts = [];
    const account = db.accounts.find(a => a.id === accountId);
    if (!account) return json(res, { error: 'Cuenta no encontrada' }, 404);
    account.userId = body.userId || '';
    account.clientId = body.userId || '';
    saveDB(db);
    return json(res, { ok: true, account });
  }

  // DELETE /api/admin/accounts/:id
  if (method === 'DELETE' && pathname.match(/^\/api\/admin\/accounts\/[^/]+$/) && !pathname.includes('delete-requests')) {
    if (!session || session.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
    const accountId = pathname.split('/')[4];
    const db = loadDB();
    if (!db.accounts) db.accounts = [];
    db.accounts = db.accounts.filter(a => a.id !== accountId);
    saveDB(db);
    return json(res, { ok: true });
  }

  // POST /api/accounts/:id/delete-request — client requests deletion (admin must approve)
  if (method === 'POST' && pathname.match(/^\/api\/accounts\/[^/]+\/delete-request$/)) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const accountId = pathname.split('/')[3];
    const db = loadDB();
    if (!db.accounts) db.accounts = [];
    if (!db.accountDeleteRequests) db.accountDeleteRequests = [];
    const account = db.accounts.find(a => a.id === accountId);
    if (!account) return json(res, { error: 'Cuenta no encontrada' }, 404);
    const user = db.users.find(u => u.id === session.userId);
    db.accountDeleteRequests.push({
      id: uuid(),
      accountId: accountId,
      accountName: account.name,
      userId: session.userId,
      clientName: user ? user.name : '',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    saveDB(db);
    return json(res, { ok: true });
  }

  // GET /api/admin/account-delete-requests
  if (method === 'GET' && pathname === '/api/admin/account-delete-requests') {
    if (!session || session.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
    const db = loadDB();
    return json(res, db.accountDeleteRequests || []);
  }

  // POST /api/admin/account-delete-requests/:id/approve
  if (method === 'POST' && pathname.match(/^\/api\/admin\/account-delete-requests\/[^/]+\/approve$/)) {
    if (!session || session.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
    const reqId = pathname.split('/')[4];
    const db = loadDB();
    if (!db.accountDeleteRequests) db.accountDeleteRequests = [];
    const req2 = db.accountDeleteRequests.find(r => r.id === reqId);
    if (!req2) return json(res, { error: 'Solicitud no encontrada' }, 404);
    req2.status = 'approved';
    // Delete the actual account
    if (!db.accounts) db.accounts = [];
    db.accounts = db.accounts.filter(a => a.id !== req2.accountId);
    saveDB(db);
    return json(res, { ok: true });
  }

  // POST /api/admin/account-delete-requests/:id/reject
  if (method === 'POST' && pathname.match(/^\/api\/admin\/account-delete-requests\/[^/]+\/reject$/)) {
    if (!session || session.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
    const reqId = pathname.split('/')[4];
    const db = loadDB();
    if (!db.accountDeleteRequests) db.accountDeleteRequests = [];
    const req2 = db.accountDeleteRequests.find(r => r.id === reqId);
    if (!req2) return json(res, { error: 'Solicitud no encontrada' }, 404);
    req2.status = 'rejected';
    saveDB(db);
    return json(res, { ok: true });
  }

  // GET /api/sims
  if (method === 'GET' && pathname === '/api/sims') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    let sims;
    if (session.role === 'admin') {
      sims = db.sims;
    } else if (session.role === 'subuser') {
      // Sub-users see the same SIMs as their parent client
      sims = db.sims.filter(s => s.clientId === session.parentClientId || s.clientId === session.userId);
    } else {
      sims = db.sims.filter(s => s.clientId === session.userId);
    }
    return json(res, sims);
  }

  // GET /api/sims/:id
  const simMatch = pathname.match(/^\/api\/sims\/([^/]+)$/);
  if (method === 'GET' && simMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === simMatch[1]);
    if (!sim) return json(res, { error: 'SIM no encontrada' }, 404);
    if (session.role !== 'admin' && sim.clientId !== session.userId && (!session.parentClientId || sim.clientId !== session.parentClientId)) {
      return json(res, { error: 'Acceso denegado' }, 403);
    }
    return json(res, sim);
  }

  // POST /api/sims/:id/activate
  const actMatch = pathname.match(/^\/api\/sims\/([^/]+)\/activate$/);
  if (method === 'POST' && actMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === actMatch[1]);
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId && (!session.parentClientId || sim.clientId !== session.parentClientId))) return json(res, { error: 'SIM no encontrada' }, 404);
    if (sim.status !== 'inactive') return json(res, { error: 'La SIM no está inactiva' }, 400);

    const body = await parseBody(req);
    const request = {
      id: uuid(), type: 'activation', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, serviceType: body.serviceType, planType: body.planType,
      activationType: body.activationType, scheduledDate: body.scheduledDate || null,
      status: 'pending', createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
    sim.status = 'processing';
    sim.lastUpdated = new Date().toISOString();
    pushSimOperation(sim, { id: request.id, type: 'activation', status: 'pending', createdAt: request.createdAt });
    logActivity(db, session.userId, 'Solicitud de Activación', `SIM ${sim.serial} - ${body.serviceType} - ${body.planType}`);
    saveDB(db);
    const emailVars = { clientName: session.name, company: session.company, simSerial: sim.serial, simNumber: sim.msisdn, serviceType: body.serviceType || '', planType: body.planType || '', requestType: 'activation' };
    const adminEmail = (db.notificationSettings || {}).adminEmail || ADMIN_EMAIL;
    sendTemplateEmail('activation_request_admin', emailVars, adminEmail);
    sendTemplateEmail('activation_inprocess_client', emailVars, session.email);
    return json(res, { ok: true, message: 'Solicitud de activación enviada' });
  }

  // POST /api/sims/:id/deactivate
  const deactMatch = pathname.match(/^\/api\/sims\/([^/]+)\/deactivate$/);
  if (method === 'POST' && deactMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === deactMatch[1]);
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId && (!session.parentClientId || sim.clientId !== session.parentClientId))) return json(res, { error: 'SIM no encontrada' }, 404);
    if (sim.status !== 'active') return json(res, { error: 'La SIM no está activa' }, 400);

    const request = {
      id: uuid(), type: 'deactivation', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, status: 'pending', createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
    sim.status = 'processing';
    sim.lastUpdated = new Date().toISOString();
    pushSimOperation(sim, { id: request.id, type: 'deactivation', status: 'pending', createdAt: request.createdAt });
    logActivity(db, session.userId, 'Solicitud de Desactivación', `SIM ${sim.serial}`);
    saveDB(db);
    const deactVars = { clientName: session.name, company: session.company, simSerial: sim.serial, simNumber: sim.msisdn, requestType: 'deactivation' };
    const deactAdminEmail = (db.notificationSettings || {}).adminEmail || ADMIN_EMAIL;
    sendTemplateEmail('deactivation_request_admin', deactVars, deactAdminEmail);
    sendTemplateEmail('deactivation_inprocess_client', deactVars, session.email);
    return json(res, { ok: true, message: 'Solicitud de desactivación enviada' });
  }

  // POST /api/sims/:id/refresh-balance
  const balMatch = pathname.match(/^\/api\/sims\/([^/]+)\/refresh-balance$/);
  if (method === 'POST' && balMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === balMatch[1]);
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId && (!session.parentClientId || sim.clientId !== session.parentClientId))) return json(res, { error: 'SIM no encontrada' }, 404);

    const request = {
      id: uuid(), type: 'balance_update', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, status: 'pending', createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
    pushSimOperation(sim, { id: request.id, type: 'balance_update', status: 'pending', createdAt: request.createdAt });
    logActivity(db, session.userId, 'Actualización de Saldo', `SIM ${sim.serial}`);
    saveDB(db);
    // No email notification for balance refresh requests
    return json(res, { ok: true, message: 'Se ha solicitado la actualización de saldo' });
  }

  // POST /api/sims/:id/recharge
  const rechMatch = pathname.match(/^\/api\/sims\/([^/]+)\/recharge$/);
  if (method === 'POST' && rechMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === rechMatch[1]);
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId && (!session.parentClientId || sim.clientId !== session.parentClientId))) return json(res, { error: 'SIM no encontrada' }, 404);

    const body = await parseBody(req);
    const request = {
      id: uuid(), type: 'recharge', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, plan: body.plan, status: 'pending',
      createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
    pushSimOperation(sim, { id: request.id, type: 'recharge', plan: body.plan, status: 'pending', createdAt: request.createdAt });
    logActivity(db, session.userId, 'Solicitud de Recarga', `SIM ${sim.serial} - ${body.plan}`);
    saveDB(db);
    const rechVars = { clientName: session.name, company: session.company, simSerial: sim.serial, simNumber: sim.msisdn, planType: body.plan || '', requestType: 'recharge' };
    const rechAdminEmail = (db.notificationSettings || {}).adminEmail || ADMIN_EMAIL;
    sendTemplateEmail('recharge_request_admin', rechVars, rechAdminEmail);
    sendTemplateEmail('recharge_inprocess_client', rechVars, session.email);
    return json(res, { ok: true, message: 'Solicitud de recarga enviada' });
  }

  // PATCH /api/sims/:id/assign
  const assignMatch = pathname.match(/^\/api\/sims\/([^/]+)\/assign$/);
  if (method === 'PATCH' && assignMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === assignMatch[1]);
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId && (!session.parentClientId || sim.clientId !== session.parentClientId))) return json(res, { error: 'SIM no encontrada' }, 404);

    const body = await parseBody(req);
    if (body.name !== undefined) sim.name = body.name;
    if (body.reference !== undefined) sim.reference = body.reference;
    if (body.subClient !== undefined) sim.subClient = body.subClient;
    sim.lastUpdated = new Date().toISOString();
    logActivity(db, session.userId, 'Asignación Actualizada', `SIM ${sim.serial} - ${sim.name}`);
    saveDB(db);
    return json(res, { ok: true, sim });
  }

  // GET /api/subusers
  if (method === 'GET' && pathname === '/api/subusers') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const subs = session.role === 'admin' ? db.subusers : db.subusers.filter(s => s.parentClientId === session.userId);
    // Strip passwords from response
    return json(res, subs.map(s => ({ ...s, password: undefined })));
  }

  // POST /api/subusers
  if (method === 'POST' && pathname === '/api/subusers') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const body = await parseBody(req);
    if (!body.email) {
      return json(res, { error: 'Campo requerido: email' }, 400);
    }
    const db = loadDB();
    // Check email uniqueness across users and subusers
    if (db.users.find(u => u.email === body.email) || db.subusers.find(s => s.email === body.email)) {
      return json(res, { error: 'Email ya existe' }, 400);
    }
    const subuser = {
      id: uuid(), parentClientId: session.userId,
      name: body.name || '', email: body.email, phone: body.phone || '',
      empresa: body.empresa || '',
      company: body.company || session.company || '',
      password: body.password ? hashPassword(body.password) : '',
      permissions: body.permissions || defaultPermissions(),
      status: 'pending', createdAt: new Date().toISOString(), approvedAt: null
    };
    db.subusers.push(subuser);
    logActivity(db, session.userId, 'Nuevo Sub-usuario Solicitado', `${body.name || ''} (${body.email})`);
    saveDB(db);
    const subAdminEmail = (db.notificationSettings || {}).adminEmail || ADMIN_EMAIL;
    sendTemplateEmail('subuser_pending_admin', { clientName: session.name, company: session.company, subuserName: body.name || '', subuserEmail: body.email }, subAdminEmail);
    return json(res, { ok: true, subuser: { ...subuser, password: undefined } });
  }

  // DELETE /api/subusers/:id — client requests deletion of their own sub-user
  const deleteSubuserMatch = pathname.match(/^\/api\/subusers\/([^/]+)$/);
  if (method === 'DELETE' && deleteSubuserMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const su = db.subusers.find(s => s.id === deleteSubuserMatch[1] && s.parentClientId === session.userId);
    if (!su) return json(res, { error: 'Sub-usuario no encontrado' }, 404);
    // Create a deletion request (pending admin approval)
    const request = {
      id: uuid(), type: 'subuser_deletion', subuserId: su.id,
      subuserName: su.name, subuserEmail: su.email,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, status: 'pending',
      createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
    logActivity(db, session.userId, 'Solicitud de Eliminación de Sub-usuario', `${su.name} (${su.email})`);
    saveDB(db);
    // No specific template for subuser deletion — admin sees it in the requests panel
    return json(res, { ok: true, message: 'Solicitud de eliminación enviada' });
  }

  // GET /api/activity
  if (method === 'GET' && pathname === '/api/activity') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const logs = session.role === 'admin' ? db.activityLog : db.activityLog.filter(l => l.clientId === session.userId);
    return json(res, logs.slice(0, 50));
  }

  // =====================================================
  // ADMIN ROUTES
  // =====================================================

  // GET /api/admin/notifications
  if (method === 'GET' && pathname === '/api/admin/notifications') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const defaults = {
      adminEmail: ADMIN_EMAIL,
      notifyAdmin: true,
      notifyClient: true,
      clientNotifications: true,
      adminNotifications: true,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: ''
    };
    const settings = { ...defaults, ...(db.notificationSettings || {}) };
    return json(res, settings);
  }

  // PUT /api/admin/notifications
  if (method === 'PUT' && pathname === '/api/admin/notifications') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    const db = loadDB();
    const prev = db.notificationSettings || {};
    db.notificationSettings = {
      adminEmail: body.adminEmail !== undefined ? body.adminEmail : (prev.adminEmail || ADMIN_EMAIL),
      notifyAdmin: body.notifyAdmin !== undefined ? body.notifyAdmin : (prev.notifyAdmin !== undefined ? prev.notifyAdmin : true),
      notifyClient: body.notifyClient !== undefined ? body.notifyClient : (prev.notifyClient !== undefined ? prev.notifyClient : true),
      clientNotifications: body.clientNotifications !== undefined ? body.clientNotifications : (body.notifyClient !== undefined ? body.notifyClient : (prev.clientNotifications !== undefined ? prev.clientNotifications : true)),
      adminNotifications: body.adminNotifications !== undefined ? body.adminNotifications : (body.notifyAdmin !== undefined ? body.notifyAdmin : (prev.adminNotifications !== undefined ? prev.adminNotifications : true)),
      smtpHost: body.smtpHost !== undefined ? body.smtpHost : (prev.smtpHost || ''),
      smtpPort: body.smtpPort !== undefined ? body.smtpPort : (prev.smtpPort || 587),
      smtpUser: body.smtpUser !== undefined ? body.smtpUser : (prev.smtpUser || ''),
      smtpPass: body.smtpPass !== undefined ? body.smtpPass : (prev.smtpPass || ''),
      smtpFrom: body.smtpFrom !== undefined ? body.smtpFrom : (prev.smtpFrom || '')
    };
    saveDB(db);
    return json(res, { ok: true, notificationSettings: db.notificationSettings });
  }

  // GET /api/admin/requests
  if (method === 'GET' && pathname === '/api/admin/requests') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    return json(res, loadDB().requests);
  }

  // POST /api/admin/requests/:id/complete
  const compMatch = pathname.match(/^\/api\/admin\/requests\/([^/]+)\/complete$/);
  if (method === 'POST' && compMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const request = db.requests.find(r => r.id === compMatch[1]);
    if (!request) return json(res, { error: 'Solicitud no encontrada' }, 404);

    request.status = 'completed';
    request.completedAt = new Date().toISOString();

    if (request.type === 'subuser_deletion') {
      // Remove the sub-user
      db.subusers = db.subusers.filter(s => s.id !== request.subuserId);
      // Also remove from users array if they were promoted
      db.users = db.users.filter(u => u.id !== request.subuserId);
      logActivity(db, request.clientId, 'Sub-usuario Eliminado', `${request.subuserName} (${request.subuserEmail})`);
      saveDB(db);
      return json(res, { ok: true, request });
    }

    const sim = db.sims.find(s => s.id === request.simId);

    if (request.type === 'activation' && sim) {
      sim.status = 'active';
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'SIM Activada', `SIM ${sim.serial} - ${sim.msisdn}`);
      const client = db.users.find(u => u.id === request.clientId);
      if (client) {
        sendTemplateEmail('activation_completed_client', {
          clientName: client.name, company: client.company, simSerial: sim.serial,
          simNumber: sim.msisdn, planType: sim.planType || request.planType || '',
          serviceType: sim.serviceType || request.serviceType || '', requestType: 'activation'
        }, client.email);
      }
    } else if (request.type === 'deactivation' && sim) {
      sim.status = 'inactive';
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'SIM Desactivada', `SIM ${sim.serial}`);
      const client2 = db.users.find(u => u.id === request.clientId);
      if (client2) {
        sendTemplateEmail('deactivation_completed_client', {
          clientName: client2.name, company: client2.company, simSerial: sim.serial,
          simNumber: sim.msisdn, requestType: 'deactivation'
        }, client2.email);
      }
    } else if (request.type === 'balance_update' && sim) {
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'Saldo Actualizado', `SIM ${sim.serial} - ${sim.balance} min`);
    } else if (request.type === 'recharge' && sim) {
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'Recarga Completada', `SIM ${sim.serial} - ${request.plan}`);
      const client3 = db.users.find(u => u.id === request.clientId);
      if (client3) {
        sendTemplateEmail('recharge_completed_client', {
          clientName: client3.name, company: client3.company, simSerial: sim.serial,
          simNumber: sim.msisdn, planType: request.plan || '', requestType: 'recharge'
        }, client3.email);
      }
    }
    saveDB(db);
    return json(res, { ok: true, request });
  }

  // POST /api/admin/requests/:id/reject
  const rejMatch = pathname.match(/^\/api\/admin\/requests\/([^/]+)\/reject$/);
  if (method === 'POST' && rejMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const request = db.requests.find(r => r.id === rejMatch[1]);
    if (!request) return json(res, { error: 'Solicitud no encontrada' }, 404);
    request.status = 'rejected';
    request.completedAt = new Date().toISOString();

    if (request.type === 'subuser_deletion') {
      logActivity(db, request.clientId, 'Eliminación de Sub-usuario Rechazada', `${request.subuserName}`);
      saveDB(db);
      return json(res, { ok: true });
    }

    const sim = db.sims.find(s => s.id === request.simId);
    if (sim && sim.status === 'processing') {
      sim.status = request.type === 'activation' ? 'inactive' : 'active';
      sim.lastUpdated = new Date().toISOString();
    }
    if (sim) {
      updateSimOperationStatus(sim, request.id, 'failed');
    }
    logActivity(db, request.clientId, 'Solicitud Rechazada', `${request.type} - SIM ${request.simSerial}`);
    // Send rejection email to client
    const rejClient = db.users.find(u => u.id === request.clientId);
    if (rejClient) {
      sendTemplateEmail('request_rejected_client', {
        clientName: rejClient.name, company: rejClient.company,
        simSerial: request.simSerial || '', simNumber: (sim && sim.msisdn) || '',
        requestType: request.type || ''
      }, rejClient.email);
    }
    saveDB(db);
    return json(res, { ok: true });
  }

  // PATCH /api/admin/sims/:id
  const adminSimMatch = pathname.match(/^\/api\/admin\/sims\/([^/]+)$/);
  if (method === 'PATCH' && adminSimMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === adminSimMatch[1]);
    if (!sim) return json(res, { error: 'SIM no encontrada' }, 404);
    const body = await parseBody(req);
    const fields = ['serial','iccid','imei','msisdn','puk','pin','puk2','pin2','network','telephony','simData',
      'balance','dataUsed','dataTotal',
      'lastLocation','expiryDate','activationDate','lastConnection','planType','serviceType',
      'cardType','minutesActive','monthlyCharge','name','reference','subClient','status','clientId'];
    for (const f of fields) { if (body[f] !== undefined) sim[f] = body[f]; }
    sim.lastUpdated = new Date().toISOString();
    saveDB(db);
    return json(res, { ok: true, sim });
  }

  // POST /api/admin/sims (create)
  if (method === 'POST' && pathname === '/api/admin/sims') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    const db = loadDB();
    const sim = createDefaultSim({
      serial: body.serial || '',
      clientId: body.clientId !== undefined ? body.clientId : '',
      cardType: body.cardType || ''
    });
    db.sims.push(sim);
    saveDB(db);
    return json(res, { ok: true, sim });
  }

  // POST /api/admin/sims/bulk (bulk create)
  if (method === 'POST' && pathname === '/api/admin/sims/bulk') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    if (!body.sims || !Array.isArray(body.sims) || body.sims.length === 0) {
      return json(res, { error: 'Se requiere un array "sims" con al menos un elemento' }, 400);
    }
    const db = loadDB();
    const created = [];
    for (const item of body.sims) {
      const sim = createDefaultSim({
        serial: item.serial || '',
        cardType: item.cardType || '',
        clientId: ''
      });
      db.sims.push(sim);
      created.push(sim);
    }
    saveDB(db);
    return json(res, { ok: true, count: created.length, sims: created });
  }

  // DELETE /api/admin/sims/:id
  if (method === 'DELETE' && adminSimMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    db.sims = db.sims.filter(s => s.id !== adminSimMatch[1]);
    saveDB(db);
    return json(res, { ok: true });
  }

  // GET /api/admin/users
  if (method === 'GET' && pathname === '/api/admin/users') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    return json(res, db.users.map(u => ({ ...u, password: undefined })));
  }

  // POST /api/admin/users
  if (method === 'POST' && pathname === '/api/admin/users') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    const db = loadDB();
    if (db.users.find(u => u.email === body.email)) return json(res, { error: 'Email ya existe' }, 400);
    const role = (body.role === 'admin' || body.role === 'client' || body.role === 'subuser') ? body.role : 'client';
    const user = {
      id: 'usr_' + uuid().slice(0, 8),
      email: body.email,
      password: hashPassword(body.password),
      name: body.name,
      company: body.company,
      role: role,
      phone: body.phone || '',
      countryCode: body.countryCode || '',
      address: body.address || '',
      city: body.city || '',
      country: body.country || '',
      postalCode: body.postalCode || ''
    };
    if (role === 'subuser') {
      user.parentClientId = body.parentClientId || '';
      user.permissions = body.permissions || defaultPermissions();
    }
    db.users.push(user);
    saveDB(db);
    return json(res, { ok: true, user: { ...user, password: undefined } });
  }

  // PATCH /api/admin/users/:id
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (method === 'PATCH' && adminUserMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const user = db.users.find(u => u.id === adminUserMatch[1]);
    if (!user) return json(res, { error: 'Usuario no encontrado' }, 404);
    const body = await parseBody(req);
    const fields = ['email', 'name', 'company', 'phone', 'countryCode', 'address', 'city', 'country', 'postalCode'];
    for (const f of fields) {
      if (body[f] !== undefined) user[f] = body[f];
    }
    if (body.role === 'admin' || body.role === 'client' || body.role === 'subuser') {
      user.role = body.role;
    }
    if (body.password) {
      user.password = hashPassword(body.password);
    }
    if (body.permissions !== undefined) {
      user.permissions = body.permissions;
    }
    if (body.parentClientId !== undefined) {
      user.parentClientId = body.parentClientId;
    }
    saveDB(db);
    return json(res, { ok: true, user: { ...user, password: undefined } });
  }

  // =====================================================
  // ADMIN PLANS CRUD
  // =====================================================

  // GET /api/admin/plans
  if (method === 'GET' && pathname === '/api/admin/plans') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    return json(res, getPlans(db));
  }

  // PUT /api/admin/plans
  if (method === 'PUT' && pathname === '/api/admin/plans') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    const db = loadDB();
    db.plans = body;
    saveDB(db);
    return json(res, { ok: true, plans: db.plans });
  }

  // POST /api/admin/subusers/:id/approve
  const approveMatch = pathname.match(/^\/api\/admin\/subusers\/([^/]+)\/approve$/);
  if (method === 'POST' && approveMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const su = db.subusers.find(s => s.id === approveMatch[1]);
    if (!su) return json(res, { error: 'Sub-usuario no encontrado' }, 404);
    su.status = 'approved';
    su.approvedAt = new Date().toISOString();

    // If the sub-user has a password, also create them as a user in the users array
    if (su.password) {
      // Check if user already exists
      if (!db.users.find(u => u.email === su.email)) {
        const newUser = {
          id: su.id,
          email: su.email,
          password: su.password,
          name: su.name,
          company: su.company || '',
          role: 'subuser',
          parentClientId: su.parentClientId,
          permissions: su.permissions || defaultPermissions(),
          phone: su.phone || '',
          countryCode: '',
          address: '',
          city: '',
          country: '',
          postalCode: ''
        };
        db.users.push(newUser);
      }
    }

    logActivity(db, su.parentClientId, 'Sub-usuario Aprobado', su.name);
    saveDB(db);
    // Notify the sub-user that their account has been approved
    const parentClient = db.users.find(u => u.id === su.parentClientId);
    sendTemplateEmail('subuser_approved', {
      subuserName: su.name, subuserEmail: su.email,
      company: su.company || (parentClient && parentClient.company) || ''
    }, su.email);
    return json(res, { ok: true, subuser: { ...su, password: undefined } });
  }

  // POST /api/admin/subusers/:id/reject
  const rejSubMatch = pathname.match(/^\/api\/admin\/subusers\/([^/]+)\/reject$/);
  if (method === 'POST' && rejSubMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const su = db.subusers.find(s => s.id === rejSubMatch[1]);
    if (!su) return json(res, { error: 'Sub-usuario no encontrado' }, 404);
    su.status = 'rejected';
    logActivity(db, su.parentClientId, 'Sub-usuario Rechazado', su.name);
    saveDB(db);
    // Notify the sub-user that their account has been rejected
    sendTemplateEmail('subuser_rejected', {
      subuserName: su.name, subuserEmail: su.email,
      company: su.company || ''
    }, su.email);
    return json(res, { ok: true });
  }

  // POST /api/admin/subusers — admin creates sub-user directly
  if (method === 'POST' && pathname === '/api/admin/subusers') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    if (!body.email) return json(res, { error: 'Campo requerido: email' }, 400);
    const db = loadDB();
    if (db.users.find(u => u.email === body.email) || db.subusers.find(s => s.email === body.email)) {
      return json(res, { error: 'Email ya existe' }, 400);
    }
    const subuser = {
      id: uuid(),
      parentClientId: body.parentClientId || '',
      name: body.name || '',
      email: body.email,
      phone: body.phone || '',
      countryCode: body.countryCode || '',
      empresa: body.empresa || '',
      company: body.company || '',
      password: body.password ? hashPassword(body.password) : '',
      canViewSims: body.canViewSims !== undefined ? body.canViewSims : true,
      canActivate: body.canActivate || false,
      canDeactivate: body.canDeactivate || false,
      canRecharge: body.canRecharge || false,
      canViewBilling: body.canViewBilling || false,
      canViewReports: body.canViewReports || false,
      canManageAccounts: body.canManageAccounts || false,
      status: body.status || 'approved',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    };
    db.subusers.push(subuser);
    logActivity(db, 'admin', 'Sub-usuario Creado por Admin', `${body.name || ''} (${body.email})`);
    saveDB(db);
    return json(res, { ok: true, subuser: { ...subuser, password: undefined } });
  }

  // PATCH /api/admin/subusers/:id — edit sub-user (name, email, company, password, permissions)
  const adminPatchSubMatch = pathname.match(/^\/api\/admin\/subusers\/([^/]+)$/);
  if (method === 'PATCH' && adminPatchSubMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const su = db.subusers.find(s => s.id === adminPatchSubMatch[1]);
    if (!su) return json(res, { error: 'Sub-usuario no encontrado' }, 404);
    const body = await parseBody(req);

    const fields = ['name', 'email', 'company', 'phone', 'empresa'];
    for (const f of fields) {
      if (body[f] !== undefined) su[f] = body[f];
    }
    if (body.password) {
      su.password = hashPassword(body.password);
    }
    if (body.permissions !== undefined) {
      su.permissions = body.permissions;
    }

    // Also update the corresponding user in the users array if it exists
    const correspondingUser = db.users.find(u => u.id === su.id);
    if (correspondingUser) {
      for (const f of fields) {
        if (body[f] !== undefined) correspondingUser[f] = body[f];
      }
      if (body.password) {
        correspondingUser.password = su.password;
      }
      if (body.permissions !== undefined) {
        correspondingUser.permissions = body.permissions;
      }
    }

    logActivity(db, su.parentClientId, 'Sub-usuario Editado por Admin', `${su.name} (${su.email})`);
    saveDB(db);
    return json(res, { ok: true, subuser: { ...su, password: undefined } });
  }

  // DELETE /api/admin/subusers/:id — admin directly deletes a sub-user
  const adminDeleteSubMatch = pathname.match(/^\/api\/admin\/subusers\/([^/]+)$/);
  if (method === 'DELETE' && adminDeleteSubMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    const su = db.subusers.find(s => s.id === adminDeleteSubMatch[1]);
    if (!su) return json(res, { error: 'Sub-usuario no encontrado' }, 404);
    db.subusers = db.subusers.filter(s => s.id !== adminDeleteSubMatch[1]);
    // Also remove from users array if they were promoted
    db.users = db.users.filter(u => u.id !== adminDeleteSubMatch[1]);
    logActivity(db, su.parentClientId, 'Sub-usuario Eliminado por Admin', su.name);
    saveDB(db);
    return json(res, { ok: true });
  }

  // =====================================================
  // EMAIL TEMPLATE MANAGEMENT (admin)
  // =====================================================

  // GET /api/admin/email-templates — list all templates
  if (method === 'GET' && pathname === '/api/admin/email-templates') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const db = loadDB();
    // If no templates exist yet, initialize them from defaults
    if (!db.emailTemplates) {
      const defaults = createDefaultDB();
      db.emailTemplates = defaults.emailTemplates;
      saveDB(db);
    }
    return json(res, db.emailTemplates);
  }

  // PUT /api/admin/email-templates/:id — update a template
  const tplMatch = pathname.match(/^\/api\/admin\/email-templates\/([^/]+)$/);
  if (method === 'PUT' && tplMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const tplId = tplMatch[1];
    const db = loadDB();
    if (!db.emailTemplates) {
      const defaults = createDefaultDB();
      db.emailTemplates = defaults.emailTemplates;
    }
    if (!db.emailTemplates[tplId]) return json(res, { error: 'Plantilla no encontrada' }, 404);
    const body = await parseBody(req);
    if (body.subject !== undefined) db.emailTemplates[tplId].subject = body.subject;
    if (body.fromEmail !== undefined) db.emailTemplates[tplId].fromEmail = body.fromEmail;
    if (body.htmlBody !== undefined) db.emailTemplates[tplId].htmlBody = body.htmlBody;
    saveDB(db);
    return json(res, { ok: true, template: db.emailTemplates[tplId] });
  }

  // POST /api/admin/email-templates/:id/test — send a test email
  const tplTestMatch = pathname.match(/^\/api\/admin\/email-templates\/([^/]+)\/test$/);
  if (method === 'POST' && tplTestMatch) {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const tplId = tplTestMatch[1];
    const db = loadDB();
    if (!db.emailTemplates || !db.emailTemplates[tplId]) return json(res, { error: 'Plantilla no encontrada' }, 404);
    const testAdminEmail = (db.notificationSettings || {}).adminEmail || ADMIN_EMAIL;
    const sampleVars = {
      clientName: 'Juan Pérez (TEST)',
      company: 'Empresa Demo S.A.',
      simSerial: '8988169300000TEST',
      simNumber: '+8816 0000 0000',
      requestType: 'activación',
      planType: 'Voucher 100 minutes - Validity 30 days',
      serviceType: 'Pre-Pago',
      subuserName: 'María García (TEST)',
      subuserEmail: 'test@ejemplo.com',
      balance: '85'
    };
    sendTemplateEmail(tplId, sampleVars, testAdminEmail);
    return json(res, { ok: true, message: `Email de prueba enviado a ${testAdminEmail}` });
  }

  // =====================================================
  // LOGO ROUTES
  // =====================================================

  // GET /logo.png — serve uploaded logo (dark version for light backgrounds)
  if (method === 'GET' && pathname === '/logo.png') {
    if (fs.existsSync(LOGO_FILE)) {
      return serveFile(res, LOGO_FILE);
    }
    // No logo uploaded yet — return 404
    res.writeHead(404);
    return res.end();
  }

  // GET /logo-light.png — serve light version (for dark backgrounds like sidebar)
  if (method === 'GET' && pathname === '/logo-light.png') {
    if (fs.existsSync(LOGO_LIGHT_FILE)) {
      return serveFile(res, LOGO_LIGHT_FILE);
    }
    // Fallback to regular logo
    if (fs.existsSync(LOGO_FILE)) {
      return serveFile(res, LOGO_FILE);
    }
    res.writeHead(404);
    return res.end();
  }

  // GET /api/admin/logo — check if logos exist
  if (method === 'GET' && pathname === '/api/admin/logo') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    return json(res, {
      hasLogo: fs.existsSync(LOGO_FILE),
      hasLogoLight: fs.existsSync(LOGO_LIGHT_FILE)
    });
  }

  // POST /api/admin/logo — upload logo (accepts base64 JSON)
  if (method === 'POST' && pathname === '/api/admin/logo') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    // body.logo = base64 string of the dark/main logo
    // body.logoLight = base64 string of the light logo (for dark backgrounds)
    const dir = path.dirname(LOGO_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (body.logo) {
      const data = Buffer.from(body.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(LOGO_FILE, data);
    }
    if (body.logoLight) {
      const data = Buffer.from(body.logoLight.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(LOGO_LIGHT_FILE, data);
    }
    return json(res, { ok: true });
  }

  // DELETE /api/admin/logo — remove logos
  if (method === 'DELETE' && pathname === '/api/admin/logo') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    if (fs.existsSync(LOGO_FILE)) fs.unlinkSync(LOGO_FILE);
    if (fs.existsSync(LOGO_LIGHT_FILE)) fs.unlinkSync(LOGO_LIGHT_FILE);
    return json(res, { ok: true });
  }

  // =====================================================
  // SERVE STATIC FILES
  // =====================================================

  // Admin panel
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!session || session.role !== 'admin') {
      // Redirect to login
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    return serveFile(res, path.join(__dirname, 'views', 'admin.html'));
  }

  // Static files from /public
  if (pathname !== '/' && pathname.indexOf('..') === -1) {
    const filePath = path.join(__dirname, 'public', pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveFile(res, filePath);
    }
  }

  // Default: serve index.html (SPA)
  serveFile(res, path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\n🛰️  SkyConnect Platform running on http://localhost:${PORT}`);
  console.log(`📋 Client: http://localhost:${PORT}`);
  console.log(`🔧 Admin:  http://localhost:${PORT}/admin`);
  console.log(`\nDefault login: demo@cliente.com / demo123`);
  console.log(`Admin login:   admin@skyconnectsat.com / admin2026\n`);
});
