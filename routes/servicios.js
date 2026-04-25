const express = require("express");
const router = express.Router();
const db = require("../db");

// Detecta si tu tabla servicios usa precio o precio_base
function getPrecioColumn(callback) {
    db.query("SHOW COLUMNS FROM servicios", (err, cols) => {
        if (err) return callback(err);

        const nombres = cols.map(c => c.Field);
        if (nombres.includes("precio_base")) return callback(null, "precio_base");
        if (nombres.includes("precio")) return callback(null, "precio");

        callback(new Error("La tabla servicios no tiene columna precio ni precio_base"));
    });
}

// ===============================
// LISTAR SERVICIOS
// GET /servicios/listar
// ===============================
router.get("/listar", (req, res) => {
    const sql = `
        SELECT 
            s.id,
            s.nombre,
            s.descripcion,
            s.unidad,
            MIN(ps.precio) AS precio_base
        FROM servicios s
        INNER JOIN precios_servicios ps 
            ON ps.servicio_id = s.id
        GROUP BY 
            s.id,
            s.nombre,
            s.descripcion,
            s.unidad
        ORDER BY s.id DESC
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Error listando servicios:", err);
            return res.status(500).json({
                error: "Error al obtener servicios",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// ===============================
// LISTAR RANGOS
// GET /servicios/rangos/:servicioId
// ===============================
router.get("/rangos/:servicioId", (req, res) => {
    const { servicioId } = req.params;

    const sql = `
        SELECT 
            id,
            servicio_id,
            cantidad_min AS minimo,
            cantidad_max AS maximo,
            precio
        FROM precios_servicios
        WHERE servicio_id = ?
        ORDER BY cantidad_min ASC
    `;

    db.query(sql, [servicioId], (err, rows) => {
        if (err) {
            console.error("Error listando rangos:", err);
            return res.status(500).json({
                error: "Error al listar rangos",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// ===============================
// CREAR RANGO
// POST /servicios/rangos/crear
// ===============================
router.post("/rangos/crear", (req, res) => {
    const { servicio_id, minimo, maximo, precio } = req.body;

    const sql = `
        INSERT INTO precios_servicios 
        (servicio_id, cantidad_min, cantidad_max, precio)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [servicio_id, minimo || 0, maximo || 0, precio || 0], (err, result) => {
        if (err) {
            console.error("Error creando rango:", err);
            return res.status(500).json({
                error: "Error al crear rango",
                detalle: err.message
            });
        }

        res.json({ mensaje: "Rango creado correctamente", id: result.insertId });
    });
});

// ===============================
// EDITAR RANGO
// PUT /servicios/rangos/editar/:id
// ===============================
router.put("/rangos/editar/:id", (req, res) => {
    const { id } = req.params;
    const { minimo, maximo, precio } = req.body;

    const sql = `
        UPDATE precios_servicios
        SET cantidad_min = ?, cantidad_max = ?, precio = ?
        WHERE id = ?
    `;

    db.query(sql, [minimo || 0, maximo || 0, precio || 0, id], (err) => {
        if (err) {
            console.error("Error editando rango:", err);
            return res.status(500).json({
                error: "Error al editar rango",
                detalle: err.message
            });
        }

        res.json({ mensaje: "Rango actualizado correctamente" });
    });
});

// ===============================
// ELIMINAR RANGO
// DELETE /servicios/rangos/eliminar/:id
// ===============================
router.delete("/rangos/eliminar/:id", (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM precios_servicios WHERE id = ?", [id], (err) => {
        if (err) {
            console.error("Error eliminando rango:", err);
            return res.status(500).json({
                error: "Error al eliminar rango",
                detalle: err.message
            });
        }

        res.json({ mensaje: "Rango eliminado correctamente" });
    });
});

// ===============================
// CREAR SERVICIO
// POST /servicios/crear
// ===============================
router.post("/crear", (req, res) => {
    const { nombre, descripcion, unidad, precio_base } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: "El nombre del servicio es obligatorio" });
    }

    getPrecioColumn((err, precioCol) => {
        if (err) {
            console.error("Error detectando columna precio:", err);
            return res.status(500).json({ error: err.message });
        }

        const sql = `
            INSERT INTO servicios (nombre, descripcion, unidad, ${precioCol})
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [nombre, descripcion || "", unidad || "", precio_base || 0], (err2, result) => {
            if (err2) {
                console.error("Error creando servicio:", err2);
                return res.status(500).json({
                    error: "Error al crear servicio",
                    detalle: err2.message
                });
            }

            res.json({ mensaje: "Servicio creado correctamente", id: result.insertId });
        });
    });
});

// ===============================
// ACTUALIZAR SERVICIO
// PUT /servicios/actualizar/:id
// ===============================
router.put("/actualizar/:id", (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, unidad, precio_base } = req.body;

    getPrecioColumn((err, precioCol) => {
        if (err) {
            console.error("Error detectando columna precio:", err);
            return res.status(500).json({ error: err.message });
        }

        const sql = `
            UPDATE servicios
            SET nombre = ?, descripcion = ?, unidad = ?, ${precioCol} = ?
            WHERE id = ?
        `;

        db.query(sql, [nombre, descripcion || "", unidad || "", precio_base || 0, id], (err2) => {
            if (err2) {
                console.error("Error actualizando servicio:", err2);
                return res.status(500).json({
                    error: "Error al actualizar servicio",
                    detalle: err2.message
                });
            }

            res.json({ mensaje: "Servicio actualizado correctamente" });
        });
    });
});

// ===============================
// ELIMINAR SERVICIO
// DELETE /servicios/eliminar/:id
// ===============================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM servicios WHERE id = ?", [id], (err) => {
        if (err) {
            console.error("Error eliminando servicio:", err);
            return res.status(500).json({
                error: "Error al eliminar servicio",
                detalle: err.message
            });
        }

        res.json({ mensaje: "Servicio eliminado correctamente" });
    });
});

// ===============================
// OBTENER SERVICIO POR ID
// IMPORTANTE: va al final
// GET /servicios/:id
// ===============================
router.get("/:id", (req, res) => {
    const { id } = req.params;

    db.query("SELECT * FROM servicios WHERE id = ?", [id], (err, rows) => {
        if (err) {
            console.error("Error obteniendo servicio:", err);
            return res.status(500).json({
                error: "Error al obtener servicio",
                detalle: err.message
            });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "Servicio no encontrado" });
        }

        const s = rows[0];
        s.precio_base = s.precio_base ?? s.precio ?? 0;

        res.json(s);
    });
});

module.exports = router;