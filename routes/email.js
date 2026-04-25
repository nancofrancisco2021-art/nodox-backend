const express = require("express");
const router = express.Router();  

const generarPDFOrden = require("../pdf/generarPdf");
const enviarCorreo = require("../email/mailer");

router.post("/enviar-pdf", async (req, res) => {
  try {
    const orden = req.body;

    if (!orden.mail) {
      return res.status(400).json({ error: "Cliente sin correo" });
    }

    // ✅ AQUÍ SE CREA EL PDF
    const pdfPath = await generarPDFOrden(orden);
    console.log("PDF GENERADO EN:", pdfPath);

    // ✅ AQUÍ SE ENVÍA
    await enviarCorreo(
      orden.mail,
      `Orden de trabajo NODOX #${orden.id}`,
      `Hola ${orden.cliente || ""}\n\nAdjuntamos su orden de trabajo.\n\nTotal: $${Number(orden.total || 0).toFixed(2)}\n\nGracias.\nNODOX`,
      pdfPath
    );

    res.json({ ok: true, mensaje: "Correo enviado correctamente" });
  } catch (error) {
    console.error("ERROR ENVIANDO CORREO:", error);
    res.status(500).json({ error: error.message || "Error enviando correo" });
  }
});

module.exports = router;