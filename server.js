const express = require('express');
const cors = require('cors');
const pool = require("./db");

const app = express();
app.use(express.json());
app.use(cors());

const auth = require('./routes/auth');
app.use('/auth', auth);

const inventario = require('./routes/inventario');
app.use('/inventario', inventario);

const servicios = require('./routes/servicios');
app.use('/servicios', servicios);

const ordenes = require('./routes/ordenes');
app.use('/ordenes', ordenes);

const mensajes = require('./routes/mensajes');
app.use('/mensajes', mensajes);

const usuarios = require('./routes/usuarios');
app.use('/usuarios', usuarios);

const emailRoutes = require('./routes/email');
app.use('/email', emailRoutes);

const clientes = require('./routes/clientes');
app.use('/clientes', clientes);

const serviciosRoutes = require('./routes/servicios');
app.use('/servicios', serviciosRoutes);

console.log("SERVER USANDO ROUTES/OREDENES NUEVO");

app.listen(3000, () => {
    console.log("API NODOX corriendo en puerto 3000");
});

pool.query("SELECT 1", (err, res) => {
    if (err) {
        console.error("❌ Error conexión:", err);
    } else {
        console.log("✅ Conectado a Aiven");
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`API NODOX corriendo en puerto ${PORT}`);
});
