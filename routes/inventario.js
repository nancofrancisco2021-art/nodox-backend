const express = require("express");
const router = express.Router();
const db = require("../db");
 
// =========================================
// 1) Listar sucursales
// GET /inventario/sucursales
// =========================================
router.get("/sucursales", (req, res) => {
    db.query(
        "SELECT id, nombre FROM sucursales WHERE activo = 1 ORDER BY nombre ASC",
        (err, rows) => {
            if (err) {
                console.error("Error listando sucursales:", err);
                return res.status(500).json({ error: "Error al obtener sucursales" });
            }
            res.json(rows);
        }
    );
});
 
// =========================================
// 2) Listar inventario de la sucursal actual
// GET /inventario/listar/:sucursalId
// =========================================
router.get("/listar/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;
 
    const sql = `
        SELECT
            i.id,
            i.nombre,
            i.descripcion,
            i.unidad,
            i.precio,
            COALESCE(isu.cantidad, 0) AS cantidad,
            s.nombre AS sucursal_nombre
        FROM inventario i
        LEFT JOIN inventario_sucursal isu
            ON i.id = isu.inventario_id AND isu.sucursal_id = ?
        LEFT JOIN sucursales s
            ON s.id = ?
        ORDER BY i.id DESC
    `;
 
    db.query(sql, [sucursalId, sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando inventario:", err);
            return res.status(500).json({ error: "Error al obtener inventario" });
        }
        res.json(rows);
    });
});
 
// =========================================
// 3) Ver inventario de otras sucursales
// GET /inventario/otras-sucursales/:sucursalId
// =========================================
router.get("/otras-sucursales/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;
 
    const sql = `
        SELECT
            i.id,
            i.nombre,
            i.unidad,
            i.precio,
            COALESCE(isu.cantidad, 0) AS cantidad,
            s.nombre AS sucursal_nombre
        FROM inventario_sucursal isu
        INNER JOIN inventario i ON i.id = isu.inventario_id
        INNER JOIN sucursales s ON s.id = isu.sucursal_id
        WHERE isu.sucursal_id <> ?
        ORDER BY i.nombre ASC, s.nombre ASC
    `;
 
    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error obteniendo inventario de otras sucursales:", err);
            return res.status(500).json({ error: "Error al obtener otras sucursales" });
        }
        res.json(rows);
    });
});
 
// =========================================
// 4) Detalle de producto por sucursal
// GET /inventario/detalle/:id/:sucursalId
// =========================================
router.get("/detalle/:id/:sucursalId", (req, res) => {
    const { id, sucursalId } = req.params;

    const sql = `
        SELECT
            i.id,
            i.nombre,
            i.descripcion,
            i.unidad,
            i.precio,
            COALESCE(isu.cantidad, 0) AS cantidad
        FROM inventario i
        LEFT JOIN inventario_sucursal isu
            ON i.id = isu.inventario_id AND isu.sucursal_id = ?
        WHERE i.id = ?
        LIMIT 1
    `;

    db.query(sql, [sucursalId, id], (err, rows) => {
        if (err) {
            console.error("Error obteniendo detalle del producto:", err);
            return res.status(500).json({ error: "Error al obtener detalle" });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        res.json(rows[0]);
    });
});
 
// =========================================
// 5) Crear producto + stock inicial sucursal
// POST /inventario/crear
// =========================================
router.post("/crear", (req, res) => {
    const { nombre, descripcion, unidad, precio, cantidad, sucursal_id } = req.body;
 
    if (!nombre || !sucursal_id) {
        return res.status(400).json({ error: "Nombre y sucursal son obligatorios" });
    }
 
    const sqlProducto = `
        INSERT INTO inventario (nombre, descripcion, unidad, precio, cantidad)
        VALUES (?, ?, ?, ?, 0)
    `;
 
    db.query(sqlProducto, [nombre, descripcion, unidad, precio || 0], (err, result) => {
        if (err) {
            console.error("Error creando producto:", err);
            return res.status(500).json({ error: "Error al crear producto" });
        }
 
        const inventarioId = result.insertId;
 
        const sqlStock = `
            INSERT INTO inventario_sucursal (inventario_id, sucursal_id, cantidad, stock_minimo)
            VALUES (?, ?, ?, 0)
        `;
 
        db.query(sqlStock, [inventarioId, sucursal_id, cantidad || 0], (err2) => {
            if (err2) {
                console.error("Error guardando stock por sucursal:", err2);
                return res.status(500).json({ error: "Producto creado pero no se pudo guardar el stock" });
            }
 
            res.json({ mensaje: "Producto creado correctamente", id: inventarioId });
        });
    });
});
 
// =========================================
// 6) Actualizar producto + cantidad sucursal
// PUT /inventario/actualizar/:id
// =========================================
router.put("/actualizar/:id", (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, unidad, precio, cantidad, sucursal_id } = req.body;
 
    const sqlProducto = `
        UPDATE inventario
        SET nombre = ?, descripcion = ?, unidad = ?, precio = ?
        WHERE id = ?
    `;
 
    db.query(sqlProducto, [nombre, descripcion, unidad, precio || 0, id], (err) => {
        if (err) {
            console.error("Error actualizando producto:", err);
            return res.status(500).json({ error: "Error al actualizar producto" });
        }
 
        const sqlStock = `
            INSERT INTO inventario_sucursal (inventario_id, sucursal_id, cantidad, stock_minimo)
            VALUES (?, ?, ?, 0)
            ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad)
        `;
 
        db.query(sqlStock, [id, sucursal_id, cantidad || 0], (err2) => {
            if (err2) {
                console.error("Error actualizando stock de sucursal:", err2);
                return res.status(500).json({ error: "Producto actualizado pero falló el stock de sucursal" });
            }
 
            res.json({ mensaje: "Producto actualizado correctamente" });
        });
    });
});
 
// =========================================
// 7) Eliminar producto
// DELETE /inventario/eliminar/:id
// =========================================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;
 
    db.query("DELETE FROM inventario WHERE id = ?", [id], (err) => {
        if (err) {
            console.error("Error eliminando producto:", err);
            return res.status(500).json({ error: "Error al eliminar producto" });
        }
 
        res.json({ mensaje: "Producto eliminado correctamente" });
    });
});
 
module.exports = router;