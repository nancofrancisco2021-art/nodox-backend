const db = require("../db");

function safeStringify(data) {
    try {
        if (data === undefined || data === null) return null;
        return JSON.stringify(data);
    } catch (error) {
        return null;
    }
}

function registrarBitacora({
    sucursal_id,
    usuario_id = null,
    usuario_nombre = "",
    usuario_rol = "",
    modulo,
    accion,
    descripcion,
    referencia_tipo = null,
    referencia_id = null,
    datos_antes = null,
    datos_despues = null
}) {
    return new Promise((resolve, reject) => {
        if (!sucursal_id || !modulo || !accion || !descripcion) {
            console.warn("Bitácora incompleta, no se registró:", {
                sucursal_id,
                modulo,
                accion,
                descripcion
            });
            return resolve(false);
        }

        const sql = `
            INSERT INTO bitacora_sistema
            (
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
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        db.query(
            sql,
            [
                sucursal_id,
                usuario_id,
                usuario_nombre,
                usuario_rol,
                modulo,
                accion,
                descripcion,
                referencia_tipo,
                referencia_id,
                safeStringify(datos_antes),
                safeStringify(datos_despues)
            ],
            (err, result) => {
                if (err) {
                    console.error("Error registrando bitácora:", err);
                    return reject(err);
                }

                resolve(result);
            }
        );
    });
}

function obtenerUsuarioAccion(req) {
    const usuario = req.body.usuario_accion || {};

    return {
        usuario_id: usuario.id || null,
        usuario_nombre: usuario.nombre || usuario.usuario || "Usuario no identificado",
        usuario_rol: usuario.rol || ""
    };
}

module.exports = {
    registrarBitacora,
    obtenerUsuarioAccion
};