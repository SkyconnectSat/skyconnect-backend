# SkyConnect Platform

Plataforma de gestión de SIM satelitales Iridium.

## Requisitos

- Node.js 18+ (no requiere npm install - cero dependencias)

## Iniciar

```bash
node server.js
```

El servidor inicia en http://localhost:3000

## Credenciales por defecto

- **Cliente:** demo@cliente.com / demo123
- **Admin:** admin@skyconnectsat.com / admin2026

## URLs

- **Cliente:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

## Estructura

```
skyconnect-backend/
├── server.js          # Servidor (toda la lógica)
├── public/
│   └── index.html     # Frontend del cliente
├── views/
│   └── admin.html     # Panel de administración
├── data/
│   └── db.json        # Base de datos (se crea automáticamente)
└── README.md
```

## Deploy en producción

### Railway / Render
1. Subir el proyecto a GitHub
2. Conectar con Railway o Render
3. Configurar variables de entorno (PORT se asigna automáticamente)

### VPS (DigitalOcean, etc.)
1. Subir archivos al servidor
2. Instalar Node.js
3. Ejecutar con PM2: `pm2 start server.js --name skyconnect`
4. Configurar Nginx como proxy reverso al puerto 3000
5. Apuntar app.skyconnectsat.com al servidor

## Notas de seguridad

- Las contraseñas se hashean con scrypt (crypto nativo de Node.js)
- Las sesiones son HttpOnly cookies
- El panel admin solo es accesible con rol admin
- Los datos del cliente están aislados por sesión
- El código fuente NO es visible para el cliente
