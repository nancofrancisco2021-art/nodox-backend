const express = require("express");
const router = express.Router();
const db = require("../db");

// =========================================
// LISTAR USUARIOS POR SUCURSAL
// GET /usuarios/listar/:sucursalId
// =========================================
router.get("/listar/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;

    console.log("Listando usuarios de sucursal:", sucursalId);

    const sql = `
        SELECT id, nombre, usuario, rol, estado, sucursal_id
        FROM usuarios
        WHERE sucursal_id = ?
        ORDER BY id DESC
    `;

    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando usuarios:", err);
            return res.status(500).json({
                error: "Error al obtener usuarios",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// ===============================
// CREAR USUARIO
// ===============================
router.post("/crear", (req, res) => {
    const { nombre, usuario, contrasena, rol, sucursal_id } = req.body;

    db.query(
        "INSERT INTO usuarios (nombre, usuario, contrasena, rol, estado, sucursal_id) VALUES (?, ?, ?, ?, 'Activo', ?)",
        [nombre, usuario, contrasena, rol, sucursal_id],
        (err, result) => {
            if (err) {
                console.error("Error creando usuario:", err);
                return res.status(500).json({ msg: "Error al crear usuario", detalle: err.message });
            }
            res.json({ msg: "ok" });
        }
    );
});

// ===============================
// EDITAR USUARIO
// ===============================
router.put("/editar/:id", (req, res) => {
    const { id } = req.params;
    const { nombre, usuario, contrasena, rol, sucursal_id } = req.body;

    let query = "";
    let valores = [];

    if (contrasena && contrasena.trim() !== "") {
        query = "UPDATE usuarios SET nombre=?, usuario=?, contrasena=?, rol=?, sucursal_id=? WHERE id=?";
        valores = [nombre, usuario, contrasena, rol, sucursal_id, id];
    } else {
        query = "UPDATE usuarios SET nombre=?, usuario=?, rol=?, sucursal_id=? WHERE id=?";
        valores = [nombre, usuario, rol, sucursal_id, id];
    }

    db.query(query, valores, (err, result) => {
        if (err) {
            console.error("Error actualizando usuario:", err);
            return res.status(500).json({ msg: "Error al actualizar usuario", detalle: err.message });
        }
        res.json({ msg: "ok" });
    });
});

// ===============================
// BLOQUEAR / DESBLOQUEAR
// ===============================
router.put('/bloquear/:id', (req, res) => {
    const { admin } = req.body;
    const id = req.params.id;

    const sql = `
        UPDATE usuarios 
        SET estado = IF(estado='Activo','Bloqueado','Activo'),
            ultima_modificacion = NOW(),
            modificado_por = ?
        WHERE id = ?
    `;

    db.query(sql, [admin, id], (err) => {
        if (err) {
            console.error(err);
            return res.json({ msg: "error" });
        }
        return res.json({ msg: "ok" });
    });
});

router.delete('/eliminar/:id', (req, res) => {
    const id = req.params.id;
    db.query("DELETE FROM usuarios WHERE id = ?", [id], (err) => {
        if (err) return res.json({ msg: "error" });
        return res.json({ msg: "ok" });
    });
});

router.get("/ping/:id", (req, res) => {
    const id = req.params.id;

    db.query("DELETE FROM usuarios WHERE id = ?", [id], (err) => {
        if (err) return res.json({ msg: "error" });
        return res.json({ msg: "ok" });
    });
});

router.get("/ping/:id", (req, res) => {
    const id = req.params.id;

    db.query(
        "UPDATE usuarios SET ultima_conexion = NOW() WHERE id = ?",
        [id]
    );

    res.json({ msg: "ok" });
});

module.exports = router;