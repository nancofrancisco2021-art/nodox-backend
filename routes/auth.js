const express = require("express");
const router = express.Router();
const db = require("../db");
 
// POST /auth/login
router.post("/login", (req, res) => {
    const { usuario, contrasena, sucursal_id } = req.body;
 
    if (!usuario || !contrasena || !sucursal_id) {
        return res.status(400).json({ error: "Faltan datos para iniciar sesión." });
    }
 
    const sql = `
        SELECT
            u.id,
            u.nombre,
            u.usuario,
            u.contrasena,
            u.rol,
            u.sucursal_id,
            s.nombre AS sucursal_nombre
        FROM usuarios u
        INNER JOIN sucursales s ON s.id = u.sucursal_id
        WHERE u.usuario = ? AND u.sucursal_id = ?
        LIMIT 1
    `;
 
    db.query(sql, [usuario, sucursal_id], (err, rows) => {
        if (err) {
            console.error("Error en login:", err);
            return res.status(500).json({ error: "Error del servidor." });
        }
 
        if (!rows.length) {
            return res.status(401).json({
                error: "Este usuario no pertenece a la sucursal seleccionada o no existe."
            });
        }
 
        const user = rows[0];
 
        // Si manejas contraseña en texto plano:
        if (user.contrasena !== contrasena) {
            return res.status(401).json({ error: "Contraseña incorrecta." });
        }
 
        // Si después usas bcrypt, aquí cambiaría
 
        res.json({
            mensaje: "Login correcto",
            usuario: {
                id: user.id,
                nombre: user.nombre,
                usuario: user.usuario,
                rol: user.rol,
                sucursal_id: user.sucursal_id,
                sucursal_nombre: user.sucursal_nombre
            }
        });
    });
});
 
module.exports = router;