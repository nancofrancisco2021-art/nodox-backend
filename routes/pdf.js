const express = require("express");
const router = express.Router();
const path = require("path");

const generarPDFOrden = require("../pdf/generarPdf");

// =========================================
// GENERAR PDF DE ORDEN
// =========================================
router.post("/generar-orden", async (req, res) => {
    try {
        const orden = req.body;

        const pdfPath = await generarPDFOrden(orden);

        res.download(pdfPath, path.basename(pdfPath));

    } catch (error) {
        console.error("Error generando PDF:", error);

        res.status(500).json({
            error: error.message || "Error generando PDF"
        });
    }
});

module.exports = router;