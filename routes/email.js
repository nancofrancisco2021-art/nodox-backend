const express = require("express");
const router = express.Router();
const db = require("../db");

const generarPDFOrden = require("../pdf/generarPdf");
const enviarCorreo = require("../email/mailer");
const { registrarBitacora, obtenerUsuarioAccion } = require("../utils/bitacora");

// =========================================
// ENVIAR ORDEN DE TRABAJO POR CORREO
// =========================================
router.post("/enviar-pdf", async (req, res) => {
    try {
        const orden = req.body;

        const correoCliente = orden.mail || orden.correo || orden.email;

        if (!correoCliente) {
            return res.status(400).json({
                error: "Cliente sin correo"
            });
        }

        if (!orden.sucursal_id) {
            return res.status(400).json({
                error: "No se recibió la sucursal de la orden"
            });
        }

        // Buscar datos de la sucursal para usar su correo como Reply-To
        const [sucursales] = await db.promise().query(
            `
            SELECT 
                id,
                nombre,
                correo_contacto,
                nombre_remitente
            FROM sucursales
            WHERE id = ?
            LIMIT 1
            `,
            [orden.sucursal_id]
        );

        const sucursal = sucursales[0];

        if (!sucursal) {
            return res.status(404).json({
                error: "Sucursal no encontrada"
            });
        }

        const pdfPath = await generarPDFOrden(orden);

        console.log("PDF GENERADO EN:", pdfPath);

        const nombreSucursal = sucursal.nombre_remitente || sucursal.nombre || "NODOX";
        const correoSucursal = sucursal.correo_contacto || "No configurado";

        await enviarCorreo(
            correoCliente,
            `Orden de trabajo NODOX #${orden.numero_orden || orden.id || ""}`,
            `Hola ${orden.cliente || ""}

Adjuntamos su orden de trabajo.

No. Orden: ${orden.numero_orden || orden.id || ""}
Total: $${Number(orden.total || 0).toFixed(2)}

Sucursal: ${nombreSucursal}
Correo de contacto: ${correoSucursal}

Si tiene alguna duda, puede responder a este correo.

Gracias.
${nombreSucursal}`,
            pdfPath,
            {
                nombre: sucursal.nombre,
                correo_contacto: sucursal.correo_contacto,
                nombre_remitente: sucursal.nombre_remitente
            }
        );

        // Registrar en bitácora
        try {
            const usuarioAccion = obtenerUsuarioAccion(req);

            await registrarBitacora({
                sucursal_id: orden.sucursal_id,
                ...usuarioAccion,
                modulo: "Correo",
                accion: "Enviar orden por correo",
                descripcion: `Envió la orden ${orden.numero_orden || orden.id || ""} al correo ${correoCliente}`,
                referencia_tipo: "orden_trabajo",
                referencia_id: orden.numero_orden || orden.id,
                datos_despues: {
                    numero_orden: orden.numero_orden || orden.id,
                    cliente: orden.cliente || "",
                    correo_destino: correoCliente,
                    sucursal: nombreSucursal,
                    correo_contacto_sucursal: sucursal.correo_contacto || "",
                    total: Number(orden.total || 0)
                }
            });

        } catch (bitacoraError) {
            console.error("Error registrando bitácora de correo:", bitacoraError);
        }

        res.json({
            ok: true,
            mensaje: "Correo enviado correctamente",
            correo_destino: correoCliente,
            sucursal: nombreSucursal,
            correo_contacto: sucursal.correo_contacto || null
        });

    } catch (error) {
        console.error("ERROR ENVIANDO CORREO:", error);

        res.status(500).json({
            error: error.message || "Error enviando correo"
        });
    }
});

module.exports = router;