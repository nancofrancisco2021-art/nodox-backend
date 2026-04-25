const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "francisconanco85@gmail.com",
        pass: "mnvs obut qkis vmak"
    }
});

async function enviarCorreo(destino, asunto, texto, pdfPath) {

    await transporter.sendMail({
        from: '"NODOX" <francisconanco85@gmail.com>',
        to: destino,
        subject: asunto,
        text: texto,
        attachments: [
            {
                filename: "orden_trabajo.pdf",
                path: pdfPath
            }
        ]
    });

}

module.exports = enviarCorreo;
