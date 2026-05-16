const express = require("express");
const router = express.Router();
const db = require("../db");
const { registrarBitacora, obtenerUsuarioAccion } = require("../utils/bitacora");

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
// POST /usuarios/crear
// ===============================
router.post("/crear", (req, res) => {
    const {
        nombre,
        usuario,
        contrasena,
        rol,
        sucursal_id
    } = req.body;

    if (!nombre || !usuario || !contrasena || !rol || !sucursal_id) {
        return res.status(400).json({
            error: "Faltan datos obligatorios"
        });
    }

    const sqlExiste = `
        SELECT id 
        FROM usuarios 
        WHERE usuario = ? 
        LIMIT 1
    `;

    db.query(sqlExiste, [usuario], (err, rows) => {
        if (err) {
            console.error("Error verificando usuario existente:", err);
            return res.status(500).json({
                error: "Error verificando usuario existente",
                detalle: err.message
            });
        }

        if (rows.length > 0) {
            return res.status(400).json({
                error: "Ese nombre de usuario ya existe"
            });
        }

        const sqlInsert = `
            INSERT INTO usuarios 
            (nombre, usuario, contrasena, rol, estado, sucursal_id) 
            VALUES (?, ?, ?, ?, 'Activo', ?)
        `;

        db.query(
            sqlInsert,
            [nombre, usuario, contrasena, rol, sucursal_id],
            async (err, result) => {
                if (err) {
                    console.error("Error creando usuario:", err);
                    return res.status(500).json({
                        msg: "Error al crear usuario",
                        detalle: err.message
                    });
                }

                try {
                    const usuarioAccion = obtenerUsuarioAccion(req);

                    await registrarBitacora({
                        sucursal_id,
                        ...usuarioAccion,
                        modulo: "Usuarios",
                        accion: "Crear usuario",
                        descripcion: `Creó el usuario ${usuario} con rol ${rol}`,
                        referencia_tipo: "usuario",
                        referencia_id: result.insertId,
                        datos_despues: {
                            id: result.insertId,
                            nombre,
                            usuario,
                            rol,
                            estado: "Activo",
                            sucursal_id
                        }
                    });

                } catch (bitacoraError) {
                    console.error("Error registrando bitácora al crear usuario:", bitacoraError);
                }

                res.json({
                    msg: "ok",
                    mensaje: "Usuario creado correctamente",
                    id: result.insertId
                });
            }
        );
    });
});

// ===============================
// EDITAR USUARIO
// PUT /usuarios/editar/:id
// ===============================
router.put("/editar/:id", (req, res) => {
    const { id } = req.params;

    const {
        nombre,
        usuario,
        contrasena,
        rol,
        sucursal_id
    } = req.body;

    if (!nombre || !usuario || !rol || !sucursal_id) {
        return res.status(400).json({
            error: "Faltan datos obligatorios"
        });
    }

    db.query(
        "SELECT id, nombre, usuario, rol, estado, sucursal_id FROM usuarios WHERE id = ? LIMIT 1",
        [id],
        (errAntes, rowsAntes) => {
            if (errAntes) {
                console.error("Error obteniendo usuario antes de editar:", errAntes);
                return res.status(500).json({
                    error: "Error obteniendo usuario antes de editar",
                    detalle: errAntes.message
                });
            }

            if (!rowsAntes.length) {
                return res.status(404).json({
                    error: "Usuario no encontrado"
                });
            }

            const usuarioAntes = rowsAntes[0];

            let query = "";
            let valores = [];

            if (contrasena && contrasena.trim() !== "") {
                query = `
                    UPDATE usuarios 
                    SET nombre = ?, usuario = ?, contrasena = ?, rol = ?, sucursal_id = ?
                    WHERE id = ?
                `;
                valores = [nombre, usuario, contrasena, rol, sucursal_id, id];
            } else {
                query = `
                    UPDATE usuarios 
                    SET nombre = ?, usuario = ?, rol = ?, sucursal_id = ?
                    WHERE id = ?
                `;
                valores = [nombre, usuario, rol, sucursal_id, id];
            }

            db.query(query, valores, async (err, result) => {
                if (err) {
                    console.error("Error actualizando usuario:", err);
                    return res.status(500).json({
                        msg: "Error al actualizar usuario",
                        detalle: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Usuario no encontrado"
                    });
                }

                try {
                    const usuarioAccion = obtenerUsuarioAccion(req);

                    await registrarBitacora({
                        sucursal_id,
                        ...usuarioAccion,
                        modulo: "Usuarios",
                        accion: "Editar usuario",
                        descripcion: `Editó el usuario ${usuario} con rol ${rol}`,
                        referencia_tipo: "usuario",
                        referencia_id: id,
                        datos_antes: usuarioAntes,
                        datos_despues: {
                            id,
                            nombre,
                            usuario,
                            rol,
                            sucursal_id,
                            cambio_contrasena: !!(contrasena && contrasena.trim() !== "")
                        }
                    });

                } catch (bitacoraError) {
                    console.error("Error registrando bitácora al editar usuario:", bitacoraError);
                }

                res.json({
                    msg: "ok",
                    mensaje: "Usuario actualizado correctamente"
                });
            });
        }
    );
});

// ===============================
// BLOQUEAR / DESBLOQUEAR USUARIO
// PUT /usuarios/bloquear/:id
// ===============================
router.put("/bloquear/:id", (req, res) => {
    const { id } = req.params;
    const { admin } = req.body;

    db.query(
        "SELECT id, nombre, usuario, rol, estado, sucursal_id FROM usuarios WHERE id = ? LIMIT 1",
        [id],
        (errAntes, rowsAntes) => {
            if (errAntes) {
                console.error("Error obteniendo usuario antes de bloquear:", errAntes);
                return res.status(500).json({
                    error: "Error obteniendo usuario antes de bloquear",
                    detalle: errAntes.message
                });
            }

            if (!rowsAntes.length) {
                return res.status(404).json({
                    error: "Usuario no encontrado"
                });
            }

            const usuarioAntes = rowsAntes[0];
            const nuevoEstado = usuarioAntes.estado === "Activo" ? "Bloqueado" : "Activo";

            const sql = `
                UPDATE usuarios 
                SET estado = ?,
                    ultima_modificacion = NOW(),
                    modificado_por = ?
                WHERE id = ?
            `;

            db.query(sql, [nuevoEstado, admin || "", id], async (err, result) => {
                if (err) {
                    console.error("Error bloqueando/desbloqueando usuario:", err);
                    return res.status(500).json({
                        msg: "error",
                        error: "Error al cambiar estado del usuario",
                        detalle: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Usuario no encontrado"
                    });
                }

                try {
                    const usuarioAccion = obtenerUsuarioAccion(req);

                    await registrarBitacora({
                        sucursal_id: usuarioAntes.sucursal_id,
                        ...usuarioAccion,
                        modulo: "Usuarios",
                        accion: nuevoEstado === "Activo" ? "Desbloquear usuario" : "Bloquear usuario",
                        descripcion: `${nuevoEstado === "Activo" ? "Desbloqueó" : "Bloqueó"} el usuario ${usuarioAntes.usuario}`,
                        referencia_tipo: "usuario",
                        referencia_id: id,
                        datos_antes: {
                            estado: usuarioAntes.estado
                        },
                        datos_despues: {
                            estado: nuevoEstado
                        }
                    });

                } catch (bitacoraError) {
                    console.error("Error registrando bitácora al bloquear/desbloquear usuario:", bitacoraError);
                }

                return res.json({
                    msg: "ok",
                    mensaje: "Estado del usuario actualizado correctamente"
                });
            });
        }
    );
});

// ===============================
// ELIMINAR USUARIO
// DELETE /usuarios/eliminar/:id
// ===============================
router.delete("/eliminar/:id", (req, res) => {
    const { id } = req.params;
    const { sucursal_id } = req.body || {};

    db.query(
        "SELECT id, nombre, usuario, rol, estado, sucursal_id FROM usuarios WHERE id = ? LIMIT 1",
        [id],
        (errAntes, rowsAntes) => {
            if (errAntes) {
                console.error("Error obteniendo usuario antes de eliminar:", errAntes);
                return res.status(500).json({
                    error: "Error obteniendo usuario antes de eliminar",
                    detalle: errAntes.message
                });
            }

            if (!rowsAntes.length) {
                return res.status(404).json({
                    error: "Usuario no encontrado"
                });
            }

            const usuarioAntes = rowsAntes[0];

            db.query("DELETE FROM usuarios WHERE id = ?", [id], async (err, result) => {
                if (err) {
                    console.error("Error eliminando usuario:", err);
                    return res.status(500).json({
                        msg: "error",
                        error: "Error al eliminar usuario",
                        detalle: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Usuario no encontrado"
                    });
                }

                try {
                    const usuarioAccion = obtenerUsuarioAccion(req);

                    await registrarBitacora({
                        sucursal_id: sucursal_id || usuarioAntes.sucursal_id,
                        ...usuarioAccion,
                        modulo: "Usuarios",
                        accion: "Eliminar usuario",
                        descripcion: `Eliminó el usuario ${usuarioAntes.usuario}`,
                        referencia_tipo: "usuario",
                        referencia_id: id,
                        datos_antes: usuarioAntes
                    });

                } catch (bitacoraError) {
                    console.error("Error registrando bitácora al eliminar usuario:", bitacoraError);
                }

                return res.json({
                    msg: "ok",
                    mensaje: "Usuario eliminado correctamente"
                });
            });
        }
    );
});

// ===============================
// PING / ACTUALIZAR ÚLTIMA CONEXIÓN
// GET /usuarios/ping/:id
// ===============================
router.get("/ping/:id", (req, res) => {
    const id = req.params.id;

    db.query(
        "UPDATE usuarios SET ultima_conexion = NOW() WHERE id = ?",
        [id],
        (err) => {
            if (err) {
                console.error("Error actualizando última conexión:", err);
                return res.json({ msg: "error" });
            }

            res.json({ msg: "ok" });
        }
    );
});

module.exports = router;