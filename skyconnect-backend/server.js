// SkyConnect Platform — Zero-dependency Node.js Server
// Uses only built-in modules: http, fs, path, crypto, url, querystring
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

function createDefaultDB() {
  return {
    users: [
      {
        id: 'usr_admin',
        email: 'admin@skyconnectsat.com',
        password: hashPassword('admin2026'),
        name: 'Vanessa Admin',
        company: 'SkyConnect',
        role: 'admin'
      },
      {
        id: 'usr_demo1',
        email: 'demo@cliente.com',
        password: hashPassword('demo123'),
        name: 'Carlos Rodriguez',
        company: 'Minera del Norte',
        role: 'client'
      }
    ],
    sims: [
      {
        id: 'sim_001', serial: '8988169328001000001', clientId: 'usr_demo1',
        status: 'inactive', iccid: '', imei: '', msisdn: '', puk: '', pin: '',
        balance: 0, dataUsed: 0, dataTotal: 0, lastLocation: '',
        expiryDate: '', activationDate: '', lastConnection: '',
        planType: '', serviceType: '', cardType: 'Iridium 9555',
        minutesActive: 0, monthlyCharge: 0, name: '', reference: '',
        subClient: '', vessel: ''
      },
      {
        id: 'sim_002', serial: '8988169328001000002', clientId: 'usr_demo1',
        status: 'inactive', iccid: '', imei: '', msisdn: '', puk: '', pin: '',
        balance: 0, dataUsed: 0, dataTotal: 0, lastLocation: '',
        expiryDate: '', activationDate: '', lastConnection: '',
        planType: '', serviceType: '', cardType: 'Iridium 9575',
        minutesActive: 0, monthlyCharge: 0, name: '', reference: '',
        subClient: '', vessel: ''
      },
      {
        id: 'sim_003', serial: '8988169328001000003', clientId: 'usr_demo1',
        status: 'active',
        iccid: '89881693280010000034F', imei: '300125060000030',
        msisdn: '+8816 2365 0003', puk: '12345678', pin: '1234',
        balance: 85, dataUsed: 12, dataTotal: 100,
        lastLocation: 'Lat: 19.4326, Lon: -99.1332',
        expiryDate: '2026-09-15', activationDate: '2026-01-10',
        lastConnection: '2026-04-29T18:30:00',
        planType: 'Voucher 100 minutes - Validity 30 days',
        serviceType: 'Pre-Pago', cardType: 'Iridium 9555',
        minutesActive: 15, monthlyCharge: 0,
        name: 'Unidad Planta Norte', reference: 'PN-001',
        subClient: '', vessel: ''
      }
    ],
    subusers: [],
    requests: [],
    activityLog: []
  };
}

// =====================================================
// NOTIFICATION (console log + optional email)
// =====================================================
function sendNotification(subject, details, toClient) {
  const to = toClient || ADMIN_EMAIL;
  console.log(`\n📧 NOTIFICATION → ${to}\n   Subject: ${subject}\n   ${details}\n`);
  // To enable real email, configure SMTP and use nodemailer (npm install nodemailer)
}

function logActivity(db, clientId, action, details) {
  db.activityLog.unshift({ id: uuid(), clientId, action, details, timestamp: new Date().toISOString() });
  if (db.activityLog.length > 500) db.activityLog = db.activityLog.slice(0, 500);
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
    const user = db.users.find(u => u.email === email);
    if (!user || !verifyPassword(password, user.password)) {
      return json(res, { error: 'Credenciales incorrectas' }, 401);
    }
    const sid = createSession({ userId: user.id, role: user.role, email: user.email, name: user.name, company: user.company });
    return json(res, { id: user.id, name: user.name, email: user.email, company: user.company, role: user.role }, 200, {
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
    return json(res, { id: s.userId, name: s.name, email: s.email, company: s.company, role: s.role });
  }

  // GET /api/plans
  if (method === 'GET' && pathname === '/api/plans') {
    return json(res, PLANS);
  }

  // --- AUTH REQUIRED FROM HERE ---
  const session = getSession(req);

  // GET /api/sims
  if (method === 'GET' && pathname === '/api/sims') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sims = session.role === 'admin' ? db.sims : db.sims.filter(s => s.clientId === session.userId);
    return json(res, sims);
  }

  // GET /api/sims/:id
  const simMatch = pathname.match(/^\/api\/sims\/([^/]+)$/);
  if (method === 'GET' && simMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === simMatch[1]);
    if (!sim) return json(res, { error: 'SIM no encontrada' }, 404);
    if (session.role !== 'admin' && sim.clientId !== session.userId) return json(res, { error: 'Acceso denegado' }, 403);
    return json(res, sim);
  }

  // POST /api/sims/:id/activate
  const actMatch = pathname.match(/^\/api\/sims\/([^/]+)\/activate$/);
  if (method === 'POST' && actMatch) {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const sim = db.sims.find(s => s.id === actMatch[1]);
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId)) return json(res, { error: 'SIM no encontrada' }, 404);
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
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId)) return json(res, { error: 'SIM no encontrada' }, 404);
    if (sim.status !== 'active') return json(res, { error: 'La SIM no está activa' }, 400);

    const request = {
      id: uuid(), type: 'deactivation', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, status: 'pending', createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
    sim.status = 'processing';
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
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId)) return json(res, { error: 'SIM no encontrada' }, 404);

    const request = {
      id: uuid(), type: 'balance_update', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, status: 'pending', createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
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
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId)) return json(res, { error: 'SIM no encontrada' }, 404);

    const body = await parseBody(req);
    const request = {
      id: uuid(), type: 'recharge', simId: sim.id, simSerial: sim.serial,
      clientId: session.userId, clientName: session.name, clientEmail: session.email,
      company: session.company, plan: body.plan, status: 'pending',
      createdAt: new Date().toISOString(), completedAt: null
    };
    db.requests.unshift(request);
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
    if (!sim || (session.role !== 'admin' && sim.clientId !== session.userId)) return json(res, { error: 'SIM no encontrada' }, 404);

    const body = await parseBody(req);
    if (body.name !== undefined) sim.name = body.name;
    if (body.reference !== undefined) sim.reference = body.reference;
    if (body.subClient !== undefined) sim.subClient = body.subClient;
    if (body.vessel !== undefined) sim.vessel = body.vessel;
    logActivity(db, session.userId, 'Asignación Actualizada', `SIM ${sim.serial} - ${sim.name}`);
    saveDB(db);
    return json(res, { ok: true, sim });
  }

  // GET /api/subusers
  if (method === 'GET' && pathname === '/api/subusers') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const db = loadDB();
    const subs = session.role === 'admin' ? db.subusers : db.subusers.filter(s => s.parentClientId === session.userId);
    return json(res, subs);
  }

  // POST /api/subusers
  if (method === 'POST' && pathname === '/api/subusers') {
    if (!session) return json(res, { error: 'No autorizado' }, 401);
    const body = await parseBody(req);
    const db = loadDB();
    const subuser = {
      id: uuid(), parentClientId: session.userId,
      name: body.name, email: body.email, phone: body.phone || '',
      status: 'pending', createdAt: new Date().toISOString(), approvedAt: null
    };
    db.subusers.push(subuser);
    logActivity(db, session.userId, 'Nuevo Sub-usuario Solicitado', `${body.name} (${body.email})`);
    saveDB(db);
    sendNotification(`Nuevo Sub-usuario - ${body.name}`, `Cliente: ${session.name} | Sub-usuario: ${body.name} (${body.email})`);
    return json(res, { ok: true, subuser });
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
    const sim = db.sims.find(s => s.id === request.simId);

    if (request.type === 'activation' && sim) {
      sim.status = 'active';
      logActivity(db, request.clientId, 'SIM Activada', `SIM ${sim.serial} - ${sim.msisdn}`);
      const client = db.users.find(u => u.id === request.clientId);
      if (client) {
        sendNotification(`SIM Activada - ${sim.serial}`, `Su SIM ${sim.serial} ha sido activada. Número: ${sim.msisdn}`, client.email);
      }
    } else if (request.type === 'deactivation' && sim) {
      sim.status = 'inactive';
      logActivity(db, request.clientId, 'SIM Desactivada', `SIM ${sim.serial}`);
    } else if (request.type === 'balance_update' && sim) {
      logActivity(db, request.clientId, 'Saldo Actualizado', `SIM ${sim.serial} - ${sim.balance} min`);
    } else if (request.type === 'recharge' && sim) {
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
    const sim = db.sims.find(s => s.id === request.simId);
    if (sim && sim.status === 'processing') {
      sim.status = request.type === 'activation' ? 'inactive' : 'active';
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
    const fields = ['serial','iccid','imei','msisdn','puk','pin','balance','dataUsed','dataTotal',
      'lastLocation','expiryDate','activationDate','lastConnection','planType','serviceType',
      'cardType','minutesActive','monthlyCharge','name','reference','subClient','vessel','status','clientId'];
    for (const f of fields) { if (body[f] !== undefined) sim[f] = body[f]; }
    saveDB(db);
    return json(res, { ok: true, sim });
  }

  // POST /api/admin/sims (create)
  if (method === 'POST' && pathname === '/api/admin/sims') {
    if (!session || session.role !== 'admin') return json(res, { error: 'Acceso denegado' }, 403);
    const body = await parseBody(req);
    const db = loadDB();
    const sim = {
      id: 'sim_' + uuid().slice(0, 8), serial: body.serial || '', clientId: body.clientId || '',
      status: 'inactive', iccid: '', imei: '', msisdn: '', puk: '', pin: '',
      balance: 0, dataUsed: 0, dataTotal: 0, lastLocation: '', expiryDate: '',
      activationDate: '', lastConnection: '', planType: '', serviceType: '',
      cardType: body.cardType || '', minutesActive: 0, monthlyCharge: 0,
      name: '', reference: '', subClient: '', vessel: ''
    };
    db.sims.push(sim);
    saveDB(db);
    return json(res, { ok: true, sim });
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
    const user = {
      id: 'usr_' + uuid().slice(0, 8), email: body.email,
      password: hashPassword(body.password), name: body.name,
      company: body.company, role: 'client'
    };
    db.users.push(user);
    saveDB(db);
    return json(res, { ok: true, user: { ...user, password: undefined } });
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
    logActivity(db, su.parentClientId, 'Sub-usuario Aprobado', su.name);
    saveDB(db);
    return json(res, { ok: true, subuser: su });
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
