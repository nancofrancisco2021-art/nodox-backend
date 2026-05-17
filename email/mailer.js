const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarCorreo(destinatario, asunto, mensaje, pdfPath, sucursal = {}) {
    try {
        if (!process.env.RESEND_API_KEY) {
            throw new Error("Falta RESEND_API_KEY en variables de entorno");
        }

        if (!destinatario) {
            throw new Error("Falta correo destinatario");
        }

        if (!pdfPath || !fs.existsSync(pdfPath)) {
            throw new Error("No se encontró el PDF para adjuntar");
        }

        // Correo general de envío
        // Sin dominio propio puedes usar onboarding@resend.dev para pruebas
        const correoGeneral = process.env.RESEND_FROM_EMAIL || "francisconanco85@gmail.com";
        const nombreGeneral = process.env.RESEND_FROM_NAME || "NODOX";

        // Correo de contacto de la sucursal
        const correoContactoSucursal = sucursal.correo_contacto || "";
        const nombreSucursal = sucursal.nombre_remitente || sucursal.nombre || "NODOX";

        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfBase64 = pdfBuffer.toString("base64");
        const nombreArchivo = path.basename(pdfPath) || "orden-trabajo.pdf";

        const payload = {
            from: `${nombreGeneral} <${correoGeneral}>`,
            to: [destinatario],
            subject: asunto,
            text: mensaje,
            attachments: [
                {
                    filename: nombreArchivo,
                    content: pdfBase64
                }
            ]
        };

        // Si el cliente responde, la respuesta irá al correo de la sucursal
        if (correoContactoSucursal) {
            payload.reply_to = correoContactoSucursal;
        }

        const { data, error } = await resend.emails.send(payload);

        if (error) {
            console.error("ERROR RESEND:", error);
            throw new Error(error.message || "Error enviando correo con Resend");
        }

        console.log("Correo enviado con Resend:", data);
        console.log("Remitente general:", `${nombreGeneral} <${correoGeneral}>`);
        console.log("Sucursal contacto:", nombreSucursal, correoContactoSucursal);

        return data;

    } catch (error) {
        console.error("ERROR EN enviarCorreo:", error);
        throw error;
    }
}

module.exports = enviarCorreo;