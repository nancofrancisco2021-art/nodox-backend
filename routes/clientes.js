const express = require("express");
const router = express.Router();
const db = require("../db");
 
// =========================================
// 1) Buscar cliente por teléfono (ID)
// GET /clientes/:id
// =========================================
router.get("/:id", (req, res) => {
    const { id } = req.params;
 
    db.query("SELECT * FROM clientes WHERE id = ?", [id], (err, rows) => {
        if (err) {
            console.error("Error buscando cliente:", err);
            return res.status(500).json({ error: "Error al buscar cliente" });
        }
 
        if (!rows.length) {
            return res.status(404).json({ error: "Cliente no encontrado" });
        }
 
        res.json(rows[0]);
    });
});
 
// =========================================
// 2) Crear o actualizar cliente
// POST /clientes/guardar
// =========================================
router.post("/guardar", (req, res) => {
    const { id, cliente, contacto, mail, direccion, rfc } = req.body;
 
    if (!id || !cliente) {
        return res.status(400).json({ error: "Teléfono y nombre del cliente son obligatorios" });
    }
 
    const sql = `
        INSERT INTO clientes (id, cliente, contacto, mail, direccion, rfc)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            cliente = VALUES(cliente),
            contacto = VALUES(contacto),
            mail = VALUES(mail),
            direccion = VALUES(direccion),
            rfc = VALUES(rfc)
    `;
 
    db.query(sql, [id, cliente, contacto, mail, direccion, rfc], (err) => {
        if (err) {
            console.error("Error guardando cliente:", err);
            return res.status(500).json({ error: "Error al guardar cliente" });
        }
 
        res.json({ mensaje: "Cliente guardado correctamente", id });
    });
});
 
// =========================================
// 3) Listar clientes
// GET /clientes/listar
// =========================================
router.get("/listar/todos", (req, res) => {
    db.query("SELECT * FROM clientes ORDER BY fecha_registro DESC", (err, rows) => {
        if (err) {
            console.error("Error listando clientes:", err);
            return res.status(500).json({ error: "Error al listar clientes" });
        }
 
        res.json(rows);
    });
});

// =========================================
// 4) Eliminar cliente
// DELETE /clientes/eliminar/:id
// =========================================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;
 
    db.query("DELETE FROM clientes WHERE id = ?", [id], (err) => {
        if (err) {
            console.error("Error eliminando cliente:", err);
            return res.status(500).json({ error: "Error al eliminar cliente" });
        }
 
        res.json({ mensaje: "Cliente eliminado correctamente" });
    });
});
 
module.exports = router;