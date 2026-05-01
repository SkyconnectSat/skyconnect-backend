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

function createDefaultDB() {
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
    }
  };
}

// =====================================================
// NOTIFICATION (console log + optional nodemailer)
// =====================================================
function sendNotification(subject, details, toClient) {
  const db = loadDB();
  const settings = db.notificationSettings || {
    adminEmail: ADMIN_EMAIL,
    clientNotifications: true,
    adminNotifications: true,
    notifyAdmin: true,
    notifyClient: true
  };

  // Determine recipient
  const to = toClient || settings.adminEmail || ADMIN_EMAIL;

  // Check if notifications are enabled
  const clientEnabled = settings.notifyClient !== undefined ? settings.notifyClient : settings.clientNotifications;
  const adminEnabled = settings.notifyAdmin !== undefined ? settings.notifyAdmin : settings.adminNotifications;

  if (toClient && !clientEnabled) {
    console.log(`\n📧 NOTIFICATION SKIPPED (client notifications disabled) → ${to}\n   Subject: ${subject}\n`);
    return;
  }
  if (!toClient && !adminEnabled) {
    console.log(`\n📧 NOTIFICATION SKIPPED (admin notifications disabled) → ${to}\n   Subject: ${subject}\n`);
    return;
  }

  console.log(`\n📧 NOTIFICATION → ${to}\n   Subject: ${subject}\n   ${details}\n`);

  // Determine SMTP config: prefer db settings, fall back to env vars
  const smtpHost = settings.smtpHost || process.env.SMTP_HOST;
  const smtpPort = settings.smtpPort || parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = settings.smtpUser || process.env.SMTP_USER;
  const smtpPass = settings.smtpPass || process.env.SMTP_PASS;
  const smtpFrom = settings.smtpFrom || process.env.SMTP_FROM || (smtpUser ? `"SkyConnect" <${smtpUser}>` : '');
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // Attempt to send real email via nodemailer if installed and configured
  try {
    const nodemailer = require('nodemailer');
    if (smtpHost) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text: details
      }).then(() => {
        console.log(`   ✅ Email sent successfully to ${to}`);
      }).catch((err) => {
        console.log(`   ⚠️  Email send failed: ${err.message}`);
      });
    }
  } catch (e) {
    // nodemailer not installed — that's fine, console.log above already logged it
  }
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
    sendNotification(`Nueva Activación - ${sim.serial}`, `Cliente: ${session.name} (${session.company}) | Servicio: ${body.serviceType} | Plan: ${body.planType} | Tipo: ${body.activationType}`);
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
    sendNotification(`Desactivación - ${sim.serial}`, `Cliente: ${session.name} | SIM: ${sim.serial} (${sim.msisdn})`);
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
    sendNotification(`Actualizar Saldo - ${sim.serial}`, `Cliente: ${session.name} | SIM: ${sim.serial} | Saldo actual: ${sim.balance} min`);
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
    sendNotification(`Recarga - ${sim.serial}`, `Cliente: ${session.name} | Plan: ${body.plan}`);
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
    sendNotification(`Nuevo Sub-usuario - ${body.name || body.email}`, `Cliente: ${session.name} | Sub-usuario: ${body.name || ''} (${body.email})`);
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
    sendNotification(`Eliminar Sub-usuario - ${su.name}`, `Cliente: ${session.name} | Sub-usuario: ${su.name} (${su.email})`);
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
        sendNotification(`SIM Activada - ${sim.serial}`, `Su SIM ${sim.serial} ha sido activada. Número: ${sim.msisdn}`, client.email);
      }
    } else if (request.type === 'deactivation' && sim) {
      sim.status = 'inactive';
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'SIM Desactivada', `SIM ${sim.serial}`);
    } else if (request.type === 'balance_update' && sim) {
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'Saldo Actualizado', `SIM ${sim.serial} - ${sim.balance} min`);
    } else if (request.type === 'recharge' && sim) {
      sim.lastUpdated = new Date().toISOString();
      updateSimOperationStatus(sim, request.id, 'completed');
      logActivity(db, request.clientId, 'Recarga Completada', `SIM ${sim.serial} - ${request.plan}`);
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
    return json(res, { ok: true });
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
