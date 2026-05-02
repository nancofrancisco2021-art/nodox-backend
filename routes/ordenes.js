const express = require("express");
const router = express.Router();
const db = require("../db");
 
function calcularConsumoStock(m) {
    const cantidad = Number(m.cantidad || 0);

    if (m.unidad === "m2") {
        const ancho = Number(m.ancho || 0);
        const alto = Number(m.alto || 0);
        return cantidad * ancho * alto;
    }

    return cantidad;
}


function num(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}
 
function str(v, def = "") {
    return (v === undefined || v === null) ? def : String(v);
}
 
function normalizeNotas(raw) {
    const np = raw || {};
 
    const subtotal = num(np.subtotal, 0);
    const iva = num(np.iva, 0);
    const total = num(np.total, 0);
    const anticipo = num(np.anticipo, 0);
    const saldo = (np.saldo !== undefined && np.saldo !== null)
        ? num(np.saldo, Math.max(total - anticipo, 0))
        : Math.max(total - anticipo, 0);
 
    return {
        cliente_id: str(np.cliente_id, ""),
        cliente_info: np.cliente_info || {},
        materiales: Array.isArray(np.materiales) ? np.materiales : [],
        subtotal,
        iva,
        total,
        notas_extra: str(np.notas_extra, ""),
        iva_porcentaje: num(np.iva_porcentaje, 8),
        metodo_pago: str(np.metodo_pago, "Efectivo"),
        anticipo,
        saldo
    };
}
 
// =========================================
// CREAR ORDEN
// =========================================
router.post("/crear", async (req, res) => {
    const conn = await db.promise().getConnection();

    try {
        const {
            descripcion,
            cliente,
            contacto,
            tel,
            subtotal,
            iva,
            total,
            metodo_pago,
            anticipo,
            saldo,
            sucursal_id,
            materiales = []
        } = req.body;

        if (!sucursal_id) {
            return res.status(400).json({ error: "Sucursal requerida" });
        }

        // ============================
        // FUNCION PARA CALCULAR CONSUMO
        // ============================
        const calcularConsumo = (m) => {
            const cantidad = Number(m.cantidad || 0);

            if (m.unidad === "m2") {
                const ancho = Number(m.ancho || 0);
                const alto = Number(m.alto || 0);
                return cantidad * ancho * alto;
            }

            return cantidad;
        };

        await conn.beginTransaction();

        // ============================
        // 1) VALIDAR STOCK
        // ============================
        for (const m of materiales) {
            if (!m.id) continue;

            const consumo = calcularConsumo(m);

            const [rows] = await conn.query(
                `
                SELECT cantidad 
                FROM inventario_sucursal
                WHERE inventario_id = ? AND sucursal_id = ?
                `,
                [m.id, sucursal_id]
            );

            const stockActual = Number(rows[0]?.cantidad || 0);

            if (stockActual < consumo) {
                await conn.rollback();

                return res.status(400).json({
                    error: `No hay suficiente material: ${m.nombre}`,
                    disponible: stockActual,
                    requerido: consumo
                });
            }
        }

        // ============================
        // 2) CREAR ORDEN
        // ============================
        const sql = `
    INSERT INTO ordenes_trabajo
    (descripcion, notas_produccion, sucursal_id, estado, fecha_creacion, numero_orden)
    VALUES (?, ?, ?, ?, NOW(), ?)
`;
 
const valores = [
    descripcion,
    JSON.stringify({
        cliente_info,
        materiales,
        subtotal,
        iva,
        total,
        iva_porcentaje,
        metodo_pago,
        anticipo,
        saldo,
        notas_extra
    }),
    sucursal_id,
    estado_inicial || "Pendiente",
    numero_orden
];
 
db.query(sql, valores, (err, result) => {
    if (err) {
        console.error("Error creando orden:", err);
        return res.status(500).json({
            error: "Error al crear orden",
            detalle: err.message
        });
    }
 
    res.json({
        mensaje: "Orden creada correctamente",
        id: result.insertId
    });
});

        // ============================
        // 3) INSERTAR MATERIALES
        // ============================
        for (const m of materiales) {
            await conn.query(
                `
                INSERT INTO ordenes_materiales
                (orden_id, inventario_id, nombre, unidad, cantidad, precio, descuento, ancho, alto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    ordenId,
                    m.id || null,
                    m.nombre,
                    m.unidad,
                    m.cantidad,
                    m.precio,
                    m.descuento || 0,
                    m.ancho || null,
                    m.alto || null
                ]
            );
        }

        // ============================
        // 4) DESCONTAR STOCK
        // ============================
        for (const m of materiales) {
            if (!m.id) continue;

            const consumo = calcularConsumo(m);

            await conn.query(
                `
                UPDATE inventario_sucursal
                SET cantidad = cantidad - ?
                WHERE inventario_id = ? AND sucursal_id = ?
                `,
                [consumo, m.id, sucursal_id]
            );
        }

        await conn.commit();

        res.json({
            mensaje: "Orden creada correctamente",
            id: ordenId
        });

    } catch (err) {
        await conn.rollback();

        console.error("Error creando orden:", err);

        res.status(500).json({
            error: "Error al crear orden",
            detalle: err.message
        });

    } finally {
        conn.release();
    }
});

// =========================================
// LISTAR ÓRDENES POR SUCURSAL
// =========================================
router.get("/listar/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;
 
    const sql = `
        SELECT id, numero_orden, descripcion, estado, fecha_creacion, sucursal_id
        FROM ordenes_trabajo
        WHERE sucursal_id = ?
        ORDER BY id DESC
    `;
 
    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando órdenes:", err);
            return res.status(500).json({ error: "Error al listar órdenes" });
        }
 
        res.json(rows);
    });
});
 
// =========================================
// DETALLE
// =========================================
router.get("/detalle/:id", (req, res) => {
    const { id } = req.params;
 
    db.query("SELECT * FROM ordenes_trabajo WHERE id = ?", [id], (err, rows) => {
        if (err) {
            console.error("Error obteniendo detalle:", err);
            return res.status(500).json({ error: "Error al obtener detalle" });
        }
 
        if (!rows.length) {
            return res.status(404).json({ error: "Orden no encontrada" });
        }
 
        const orden = rows[0];
 
        try {
            orden.notas_produccion = JSON.parse(orden.notas_produccion || "{}");
        } catch (e) {
            console.error("Error parseando notas_produccion:", e);
            orden.notas_produccion = {};
        }
 
        res.json(orden);
    });
});
 
// =========================================
// REGRESAR ORDEN A PENDIENTE
// PUT /ordenes/regresar-pendiente/:id
// =========================================
router.put("/regresar-pendiente/:id", (req, res) => {
    const { id } = req.params;
 
    const sql = `
        UPDATE ordenes_trabajo
        SET estado = 'Pendiente'
        WHERE id = ?
    `;
 
    db.query(sql, [id], (err) => {
        if (err) {
            console.error("Error regresando orden a pendiente:", err);
            return res.status(500).json({ error: "Error al regresar la orden a pendiente" });
        }
 
        res.json({ mensaje: "Orden regresada a pendiente correctamente" });
    });
});
 
// =========================================
// EDITAR ORDEN
// PUT /ordenes/editar/:id
// =========================================
router.put("/editar/:id", (req, res) => {
    const { id } = req.params;
    const { descripcion, notas_produccion, numero_orden } = req.body;
 
    const sql = `
        UPDATE ordenes_trabajo
        SET descripcion = ?, notas_produccion = ?, numero_orden = ?
        WHERE id = ?
    `;
 
    db.query(
        sql,
        [descripcion || "", JSON.stringify(notas_produccion || {}), numero_orden || null, id],
        (err) => {
            if (err) {
                console.error("Error editando orden:", err);
                return res.status(500).json({ error: "Error al editar orden" });
            }
 
            res.json({ mensaje: "Orden actualizada correctamente" });
        }
    );
});
 
 
 
// =========================================
// CONFIRMAR ORDEN
// =========================================
router.put("/confirmar/:id", (req, res) => {
    const { id } = req.params;
 
    const sql = `
        UPDATE ordenes_trabajo
        SET estado = 'Confirmada'
        WHERE id = ?
    `;
 
    db.query(sql, [id], (err) => {
        if (err) {
            console.error("Error confirmando orden:", err);
            return res.status(500).json({ error: "Error al confirmar la orden" });
        }
 
        res.json({ mensaje: "Orden confirmada correctamente" });
    });
});
 
// =========================================
// LISTAR CONFIRMADAS
// =========================================
router.get("/confirmadas/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;
 
    const sql = `
        SELECT id, numero_orden, descripcion, estado, fecha_creacion, sucursal_id
        FROM ordenes_trabajo
        WHERE sucursal_id = ? AND estado = 'Confirmada'
        ORDER BY id DESC
    `;
 
    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando órdenes confirmadas:", err);
            return res.status(500).json({ error: "Error al obtener órdenes confirmadas" });
        }
 
        res.json(rows);
    });
});
 
// =========================================
// ELIMINAR
// =========================================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;
 
    db.query("DELETE FROM ordenes_trabajo WHERE id = ?", [id], (err) => {
        if (err) {
            console.error("Error eliminando orden:", err);
            return res.status(500).json({ error: "Error al eliminar orden" });
        }
 
        res.json({ mensaje: "Orden eliminada correctamente" });
    });
});
 
module.exports = router;
 