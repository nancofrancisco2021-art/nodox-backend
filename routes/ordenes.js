const express = require("express");
const router = express.Router();
const db = require("../db");
const { registrarBitacora, obtenerUsuarioAccion } = require("../utils/bitacora");

console.log("🔥 VERSION ORDENES ACTUALIZADA 🔥");

function calcularConsumoStock(m) {
    const cantidad = Number(m.cantidad || 0);

    if (m.unidad === "m2") {
        const ancho = Number(m.ancho || 0);
        const alto = Number(m.alto || 0);
        return cantidad * ancho * alto;
    }

    return cantidad;
}

// ===============================
// CREAR ORDEN
// ===============================
router.post("/crear", async (req, res) => {
    const conn = await db.promise().getConnection();

    try {
        const {
            descripcion = "",
            notas_extra = "",
            cliente_info = {},
            materiales = [],
            subtotal = 0,
            iva = 0,
            total = 0,
            iva_porcentaje = 8,
            metodo_pago = "Efectivo",
            anticipo = 0,
            saldo = 0,
            sucursal_id,
            estado_inicial = "Pendiente"
        } = req.body;

        if (!sucursal_id) {
            return res.status(400).json({ error: "Sucursal requerida" });
        }

        if (!cliente_info.cliente || !cliente_info.tel) {
            return res.status(400).json({
                error: "Cliente y teléfono son obligatorios"
            });
        }

        if (!Array.isArray(materiales) || materiales.length === 0) {
            return res.status(400).json({
                error: "Debe agregar materiales"
            });
        }

        await conn.beginTransaction();

        // =============================
// GENERAR NÚMERO DE ORDEN AUTOMÁTICO
// =============================
const [numeroRows] = await conn.query(
    `
    SELECT 
        DATE_FORMAT(NOW(), '%d/%m/%y') AS fecha_actual,
        COALESCE(
            MAX(
                CAST(SUBSTRING_INDEX(numero_orden, '-', -1) AS UNSIGNED)
            ), 
            0
        ) + 1 AS siguiente
    FROM ordenes_trabajo
    WHERE sucursal_id = ?
      AND numero_orden LIKE CONCAT(DATE_FORMAT(NOW(), '%d/%m/%y'), '-%')
    `,
    [sucursal_id]
);

const fechaActual = numeroRows[0].fecha_actual;
const consecutivo = numeroRows[0].siguiente;

const numero_orden = `${fechaActual}-${consecutivo}`;

console.log("Número de orden generado:", numero_orden);

        // =============================
        // VALIDAR STOCK
        // =============================
        for (const m of materiales) {
        
            if (!m.id) continue;

            const consumo = calcularConsumoStock(m);

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

        const notas_produccion = {
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
        };

        // =============================
        // CREAR ORDEN
        // =============================
        const [ordenResult] = await conn.query(
            `
            INSERT INTO ordenes_trabajo
            (
                numero_orden,
                descripcion,
                notas_produccion,
                sucursal_id,
                estado,
                fecha_creacion,
                fecha_ultima_actualizacion
            )
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            `,
            [
                numero_orden,
                descripcion,
                JSON.stringify(notas_produccion),
                sucursal_id,
                estado_inicial
            ]
        );

        const ordenId = ordenResult.insertId;

        // =============================
        // DESCONTAR STOCK
        // =============================
        for (const m of materiales) {
            if (!m.id) continue;

            const consumo = calcularConsumoStock(m);

            console.log("DESCONTANDO STOCK:", {
                inventario_id: m.id,
                sucursal_id,
                consumo
            });

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
            msg: "ok",
            mensaje: "Orden creada correctamente",
            id: ordenId,
            numero_orden
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
    

    try {
    const usuarioAccion = obtenerUsuarioAccion(req);

    await registrarBitacora({
        sucursal_id,
        ...usuarioAccion,
        modulo: "Cotizaciones / Órdenes",
        accion: "Crear orden",
        descripcion: `Creó la orden de trabajo ${numero_orden}`,
        referencia_tipo: "orden_trabajo",
        referencia_id: ordenId,
        datos_despues: {
            numero_orden,
            descripcion,
            cliente: cliente_info.cliente,
            telefono: cliente_info.tel,
            total,
            estado: estado_inicial
        }
    });

} catch (bitacoraError) {
    console.error("Error registrando bitácora de orden:", bitacoraError);
}

res.json({
    msg: "ok",
    mensaje: "Orden creada correctamente",
    id: ordenId,
    numero_orden
});
});

// ===============================
// LISTAR ÓRDENES PENDIENTES POR SUCURSAL
// ===============================
router.get("/listar/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;

    const sql = `
        SELECT 
            id,
            numero_orden,
            descripcion,
            estado,
            fecha_creacion,
            fecha_ultima_actualizacion,
            fecha_confirmacion,
            sucursal_id
        FROM ordenes_trabajo
        WHERE sucursal_id = ?
          AND (
                estado IS NULL
                OR estado = ''
                OR estado = 'Pendiente'
                OR estado = 'Nueva'
              )
        ORDER BY id DESC
    `;

    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando órdenes pendientes:", err);

            return res.status(500).json({
                error: "Error al listar órdenes",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// ===============================
// LISTAR ÓRDENES CONFIRMADAS POR SUCURSAL
// ===============================
router.get("/confirmadas/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;

    const sql = `
        SELECT 
            id,
            numero_orden,
            descripcion,
            estado,
            fecha_creacion,
            fecha_ultima_actualizacion,
            fecha_confirmacion,
            sucursal_id
        FROM ordenes_trabajo
        WHERE sucursal_id = ?
          AND estado = 'Confirmada'
        ORDER BY fecha_confirmacion DESC, id DESC
    `;

    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando órdenes confirmadas:", err);

            return res.status(500).json({
                error: "Error al obtener órdenes confirmadas",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// ===============================
// DETALLE DE ORDEN
// ===============================
router.get("/detalle/:id", (req, res) => {
    const { id } = req.params;

    db.query(
        "SELECT * FROM ordenes_trabajo WHERE id = ?",
        [id],
        (err, rows) => {
            if (err) {
                console.error("Error obteniendo detalle:", err);

                return res.status(500).json({
                    error: "Error al obtener detalle",
                    detalle: err.message
                });
            }

            if (!rows.length) {
                return res.status(404).json({
                    error: "Orden no encontrada"
                });
            }

            const orden = rows[0];

            try {
                orden.notas_produccion = JSON.parse(
                    orden.notas_produccion || "{}"
                );
            } catch (e) {
                orden.notas_produccion = {};
            }

            res.json(orden);
        }
    );
});

// ===============================
// LISTAR CONFIRMADAS
// ===============================
router.get("/confirmadas/:sucursalId", (req, res) => {
    const { sucursalId } = req.params;

    const sql = `
        SELECT 
            id, 
            numero_orden, 
            descripcion, 
            estado, 
            fecha_creacion,
            fecha_ultima_actualizacion,
            fecha_confirmacion,
            sucursal_id
        FROM ordenes_trabajo
        WHERE sucursal_id = ? 
          AND estado = 'Confirmada'
        ORDER BY fecha_confirmacion DESC, id DESC
    `;

    db.query(sql, [sucursalId], (err, rows) => {
        if (err) {
            console.error("Error listando confirmadas:", err);
            return res.status(500).json({
                error: "Error al obtener órdenes confirmadas",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// ===============================
// REGRESAR A PENDIENTE
// ===============================
router.put("/regresar-pendiente/:id", (req, res) => {
    const { id } = req.params;

    const sql = `
        UPDATE ordenes_trabajo
        SET 
            estado = 'Pendiente',
            fecha_confirmacion = NULL,
            fecha_ultima_actualizacion = NOW()
        WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Error regresando orden:", err);

            return res.status(500).json({
                error: "Error al regresar la orden",
                detalle: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Orden no encontrada"
            });
        }

        res.json({
            msg: "ok",
            mensaje: "Orden regresada a pendiente correctamente"
        });
    });
});

// ===============================
// EDITAR ORDEN
// ===============================
router.put("/editar/:id", (req, res) => {
    const { id } = req.params;
    const { descripcion, notas_produccion, numero_orden } = req.body;

    const sql = `
        UPDATE ordenes_trabajo
        SET 
            descripcion = ?,
            notas_produccion = ?,
            numero_orden = ?,
            fecha_ultima_actualizacion = NOW()
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            descripcion || "",
            JSON.stringify(notas_produccion || {}),
            numero_orden || null,
            id
        ],
        (err, result) => {
            if (err) {
                console.error("Error editando orden:", err);

                return res.status(500).json({
                    error: "Error al editar orden",
                    detalle: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Orden no encontrada"
                });
            }

            res.json({
                msg: "ok",
                mensaje: "Orden actualizada correctamente"
            });
        }
    );
});

// ===============================
// ELIMINAR ORDEN
// ===============================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;

    db.query(
        "DELETE FROM ordenes_trabajo WHERE id = ?",
        [id],
        (err, result) => {
            if (err) {
                console.error("Error eliminando orden:", err);

                return res.status(500).json({
                    error: "Error al eliminar orden",
                    detalle: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Orden no encontrada"
                });
            }

            res.json({
                msg: "ok",
                mensaje: "Orden eliminada correctamente"
            });
        }
    );
});

// =======================================
// CONFIRMAR ORDEN DE TRABAJO
// =======================================
router.put("/confirmar/:id", (req, res) => {
    const { id } = req.params;

    db.query(
        "SELECT * FROM ordenes_trabajo WHERE id = ?",
        [id],
        (err, rows) => {
            if (err) {
                console.error("Error buscando orden antes de confirmar:", err);

                return res.status(500).json({
                    error: "Error buscando orden antes de confirmar",
                    detalle: err.message
                });
            }

            if (!rows.length) {
                return res.status(404).json({
                    error: "Orden no encontrada"
                });
            }

            const ordenAntes = rows[0];

            const sql = `
                UPDATE ordenes_trabajo
                SET 
                    estado = 'Confirmada',
                    fecha_confirmacion = NOW(),
                    fecha_ultima_actualizacion = NOW()
                WHERE id = ?
            `;

            db.query(sql, [id], async (err, result) => {
                if (err) {
                    console.error("Error confirmando orden:", err);

                    return res.status(500).json({
                        error: "Error al confirmar orden",
                        detalle: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Orden no encontrada"
                    });
                }

                // Registrar en bitácora
                try {
                    const usuarioAccion = obtenerUsuarioAccion(req);

                    await registrarBitacora({
                        sucursal_id: ordenAntes.sucursal_id,
                        ...usuarioAccion,
                        modulo: "Órdenes de trabajo",
                        accion: "Confirmar orden",
                        descripcion: `Confirmó la orden de trabajo ${ordenAntes.numero_orden || id}`,
                        referencia_tipo: "orden_trabajo",
                        referencia_id: id,
                        datos_antes: {
                            estado: ordenAntes.estado,
                            fecha_confirmacion: ordenAntes.fecha_confirmacion
                        },
                        datos_despues: {
                            estado: "Confirmada",
                            fecha_confirmacion: "NOW()"
                        }
                    });

                } catch (bitacoraError) {
                    console.error("Error registrando bitácora al confirmar orden:", bitacoraError);
                }

                res.json({
                    msg: "ok",
                    mensaje: "Orden confirmada correctamente"
                });
            });
        }
    );
});

module.exports = router;