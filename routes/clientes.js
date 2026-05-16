const express = require("express");
const router = express.Router();
const db = require("../db");
const { registrarBitacora, obtenerUsuarioAccion } = require("../utils/bitacora");

// =========================================
//CODIGO DE CLIENTE AUTOMÁTICO
// =========================================
function generarCodigoCliente(callback) {
    const sql = `
        SELECT LPAD(
            COALESCE(MAX(CAST(codigo_cliente AS UNSIGNED)), 0) + 1,
            3,
            '0'
        ) AS nuevo_codigo
        FROM clientes
        WHERE codigo_cliente IS NOT NULL
          AND codigo_cliente <> ''
    `;

    db.query(sql, (err, rows) => {
        if (err) return callback(err);

        const codigo = rows[0]?.nuevo_codigo || "001";
        callback(null, codigo);
    });
}

// =========================================
// LISTAR CLIENTES
// =========================================
router.get("/listar/todos", (req, res) => {
    const sql = `
        SELECT
            id,
            codigo_cliente,
            cliente,
            contacto,
            telefono,
            mail,
            direccion,
            rfc,
            fecha_registro,
            fecha_actualizacion
        FROM clientes
        ORDER BY CAST(codigo_cliente AS UNSIGNED) ASC, fecha_registro DESC
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Error listando clientes:", err);
            return res.status(500).json({
                error: "Error al listar clientes",
                detalle: err.message
            });
        }

        res.json(rows);
    });
});

// =========================================
// BUSCAR CLIENTE
// =========================================
router.get("/:id", (req, res) => {
    const { id } = req.params;

    const sql = `
        SELECT *
        FROM clientes
        WHERE id = ?
           OR telefono = ?
           OR codigo_cliente = ?
        LIMIT 1
    `;

    db.query(sql, [id, id, id], (err, rows) => {
        if (err) {
            console.error("Error buscando cliente:", err);
            return res.status(500).json({
                error: "Error al buscar cliente",
                detalle: err.message
            });
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "Cliente no encontrado"
            });
        }

        res.json(rows[0]);
    });
});

// =========================================
// CREAR O ACTUALIZAR CLIENTE
// POST /clientes/guardar
// =========================================
router.post("/guardar", (req, res) => {
    const {
        id,
        codigo_cliente,
        cliente,
        contacto,
        telefono,
        mail,
        direccion,
        rfc,
        sucursal_id
    } = req.body;

    const telefonoFinal = telefono || id || "";

    if (!cliente || !String(cliente).trim()) {
        return res.status(400).json({
            error: "El nombre del cliente es obligatorio"
        });
    }

    if (!telefonoFinal || !String(telefonoFinal).trim()) {
        return res.status(400).json({
            error: "El teléfono del cliente es obligatorio"
        });
    }

    if (!sucursal_id) {
        return res.status(400).json({
            error: "Sucursal requerida para registrar bitácora"
        });
    }

    const sqlBuscar = `
        SELECT id, codigo_cliente
        FROM clientes
        WHERE id = ?
           OR telefono = ?
           OR codigo_cliente = ?
        LIMIT 1
    `;

    db.query(
        sqlBuscar,
        [id || "", telefonoFinal, codigo_cliente || ""],
        (err, rows) => {
            if (err) {
                console.error("Error buscando cliente existente:", err);
                return res.status(500).json({
                    error: "Error buscando cliente existente",
                    detalle: err.message
                });
            }

            // =========================================
            // SI EXISTE, ACTUALIZAR CLIENTE
            // =========================================
            if (rows.length > 0) {
                const clienteExistente = rows[0];

                const sqlUpdate = `
                    UPDATE clientes
                    SET
                        cliente = ?,
                        contacto = ?,
                        telefono = ?,
                        mail = ?,
                        direccion = ?,
                        rfc = ?,
                        fecha_actualizacion = NOW()
                    WHERE id = ?
                `;

                db.query(
                    sqlUpdate,
                    [
                        cliente.trim(),
                        contacto || "",
                        telefonoFinal,
                        mail || "",
                        direccion || "",
                        rfc || "",
                        clienteExistente.id
                    ],
                    async (err) => {
                        if (err) {
                            console.error("Error actualizando cliente:", err);
                            return res.status(500).json({
                                error: "Error al actualizar cliente",
                                detalle: err.message
                            });
                        }

                        try {
                            const usuarioAccion = obtenerUsuarioAccion(req);

                            await registrarBitacora({
                                sucursal_id,
                                ...usuarioAccion,
                                modulo: "Clientes",
                                accion: "Editar cliente",
                                descripcion: `Editó la información del cliente ${cliente.trim()}`,
                                referencia_tipo: "cliente",
                                referencia_id: clienteExistente.id,
                                datos_despues: {
                                    codigo_cliente: clienteExistente.codigo_cliente,
                                    cliente: cliente.trim(),
                                    contacto: contacto || "",
                                    telefono: telefonoFinal,
                                    mail: mail || "",
                                    direccion: direccion || "",
                                    rfc: rfc || ""
                                }
                            });

                        } catch (bitacoraError) {
                            console.error("Error registrando bitácora al editar cliente:", bitacoraError);
                        }

                        res.json({
                            msg: "ok",
                            mensaje: "Cliente actualizado correctamente",
                            id: clienteExistente.id,
                            codigo_cliente: clienteExistente.codigo_cliente
                        });
                    }
                );

                return;
            }

            // =========================================
            // SI NO EXISTE, CREAR CLIENTE
            // =========================================
            generarCodigoCliente((err, nuevoCodigo) => {
                if (err) {
                    console.error("Error generando código de cliente:", err);
                    return res.status(500).json({
                        error: "Error generando código de cliente",
                        detalle: err.message
                    });
                }

                const nuevoId = nuevoCodigo;

                const sqlInsert = `
                    INSERT INTO clientes
                    (
                        id,
                        codigo_cliente,
                        cliente,
                        contacto,
                        telefono,
                        mail,
                        direccion,
                        rfc,
                        fecha_registro,
                        fecha_actualizacion
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)
                `;

                db.query(
                    sqlInsert,
                    [
                        nuevoId,
                        nuevoCodigo,
                        cliente.trim(),
                        contacto || "",
                        telefonoFinal,
                        mail || "",
                        direccion || "",
                        rfc || ""
                    ],
                    async (err) => {
                        if (err) {
                            console.error("Error creando cliente:", err);
                            return res.status(500).json({
                                error: "Error al crear cliente",
                                detalle: err.message
                            });
                        }

                        try {
                            const usuarioAccion = obtenerUsuarioAccion(req);

                            await registrarBitacora({
                                sucursal_id,
                                ...usuarioAccion,
                                modulo: "Clientes",
                                accion: "Crear cliente",
                                descripcion: `Dio de alta al cliente ${cliente.trim()}`,
                                referencia_tipo: "cliente",
                                referencia_id: nuevoId,
                                datos_despues: {
                                    codigo_cliente: nuevoCodigo,
                                    cliente: cliente.trim(),
                                    contacto: contacto || "",
                                    telefono: telefonoFinal,
                                    mail: mail || "",
                                    direccion: direccion || "",
                                    rfc: rfc || ""
                                }
                            });

                        } catch (bitacoraError) {
                            console.error("Error registrando bitácora al crear cliente:", bitacoraError);
                        }

                        res.json({
                            msg: "ok",
                            mensaje: "Cliente creado correctamente",
                            id: nuevoId,
                            codigo_cliente: nuevoCodigo
                        });
                    }
                );
            });
        }
    );
});

// =========================================
// EDITAR CLIENTE
// =========================================
router.put("/editar/:id", (req, res) => {
    const { id } = req.params;

    const {
        cliente,
        contacto,
        telefono,
        mail,
        direccion,
        rfc
    } = req.body;

    if (!cliente || !String(cliente).trim()) {
        return res.status(400).json({
            error: "El nombre del cliente es obligatorio"
        });
    }

    const sql = `
        UPDATE clientes
        SET
            cliente = ?,
            contacto = ?,
            telefono = ?,
            mail = ?,
            direccion = ?,
            rfc = ?,
            fecha_actualizacion = NOW()
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            cliente.trim(),
            contacto || "",
            telefono || "",
            mail || "",
            direccion || "",
            rfc || "",
            id
        ],
        (err, result) => {
            if (err) {
                console.error("Error editando cliente:", err);
                return res.status(500).json({
                    error: "Error al editar cliente",
                    detalle: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Cliente no encontrado"
                });
            }

            res.json({
                msg: "ok",
                mensaje: "Cliente actualizado correctamente"
            });
        }
    );
});

// =========================================
// ELIMINAR CLIENTE
// =========================================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM clientes WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error("Error eliminando cliente:", err);
            return res.status(500).json({
                error: "Error al eliminar cliente",
                detalle: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Cliente no encontrado"
            });
        }

        res.json({
            msg: "ok",
            mensaje: "Cliente eliminado correctamente"
        });
    });
});

module.exports = router;