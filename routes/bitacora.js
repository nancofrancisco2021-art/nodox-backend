const express = require("express");
const router = express.Router();
const db = require("../db");

// =========================================
// LISTAR BITÁCORA POR SUCURSAL
// GET /bitacora/listar/:sucursalId
// =========================================
router.get("/listar/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;

    const sql = `
        SELECT
            id,
            sucursal_id,
            usuario_id,
            usuario_nombre,
            usuario_rol,
            modulo,
            accion,
            descripcion,
            referencia_tipo,
            referencia_id,
            datos_antes,
            datos_despues,
            fecha_hora
        FROM bitacora_sistema
        WHERE sucursal_id = ?
        ORDER BY fecha_hora DESC
    `;

    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando bitácora:", err);
            return res.status(500).json({
                error: "Error al listar bitácora",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// =========================================
// LISTAR BITÁCORA DE LOS FILTROS
// =========================================
router.get("/filtrar/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;
    const { modulo, accion, usuario } = req.query;

    let sql = `
        SELECT
            id,
            sucursal_id,
            usuario_id,
            usuario_nombre,
            usuario_rol,
            modulo,
            accion,
            descripcion,
            referencia_tipo,
            referencia_id,
            datos_antes,
            datos_despues,
            fecha_hora
        FROM bitacora_sistema
        WHERE sucursal_id = ?
    `;

    const params = [sucursalId];

    if (modulo) {
        sql += " AND modulo = ?";
        params.push(modulo);
    }

    if (accion) {
        sql += " AND accion = ?";
        params.push(accion);
    }

    if (usuario) {
        sql += " AND usuario_nombre LIKE ?";
        params.push(`%${usuario}%`);
    }

    sql += " ORDER BY fecha_hora DESC";

    db.query(sql, params, (err, rows) => {
        if (err) {
            console.error("Error filtrando bitácora:", err);
            return res.status(500).json({
                error: "Error al filtrar bitácora",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

module.exports = router;