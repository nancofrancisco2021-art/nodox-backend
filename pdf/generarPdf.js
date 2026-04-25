const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function asegurarCarpeta(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generarPDFOrden(orden) {
  return new Promise((resolve, reject) => {
    const pdfDir = path.join(__dirname, "../pdfs");
    asegurarCarpeta(pdfDir);

    const filePath = path.join(pdfDir, `OT_${orden.id}.pdf`);
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(18).text("NODOX - ORDEN DE TRABAJO", { align: "center" });
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Orden ID: ${orden.id}`);
    doc.text(`Estado: ${orden.estado || "—"}`);
    doc.moveDown();

    doc.text(`Cliente: ${orden.cliente || "—"}`);
    doc.text(`Contacto: ${orden.contacto || "—"}`);
    doc.text(`Mail: ${orden.mail || "—"}`);
    doc.text(`Tel: ${orden.tel || "—"}`);
    doc.text(`RFC: ${orden.rfc || "—"}`);
    doc.text(`Dirección: ${orden.direccion || "—"}`);
    doc.text(`Fecha de entrada: ${orden.fecha_entrada || "—"}`);
    doc.text(`Entrega estimada: ${orden.tiempo_entrega || "—"}`);
    doc.moveDown();

    doc.fontSize(12).text("Descripción / Detalles:");
    doc.fontSize(10).text(orden.descripcion || "—");
    doc.moveDown();

    doc.fontSize(12).text("Materiales / Artículos:");
    doc.moveDown(0.5);

    (orden.materiales || []).forEach(m => {
      const unidad = m.unidad === "m2" ? "m²" : (m.unidad === "hora" ? "Hora" : (m.unidad || "Pieza"));
      const medida = (m.unidad === "m2" && m.ancho && m.alto)
        ? `${Number(m.ancho).toFixed(2)} x ${Number(m.alto).toFixed(2)}`
        : "—";

      doc.fontSize(10).text(
        `• ${m.nombre || "—"} | Cant: ${m.cantidad || 0} | Unidad: ${unidad} | Medida: ${medida} | Importe: $${Number(m.total || 0).toFixed(2)}`
      );
    });

    doc.moveDown();
    doc.fontSize(11).text(`Subtotal: $${Number(orden.subtotal || 0).toFixed(2)}`);
    doc.text(`IVA (${Number(orden.iva_porcentaje || 8)}%): $${Number(orden.iva || 0).toFixed(2)}`);
    doc.fontSize(12).text(`Total: $${Number(orden.total || 0).toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(11).text(`Método de pago: ${orden.metodo_pago || "—"}`);
    doc.text(`Anticipo: $${Number(orden.anticipo || 0).toFixed(2)}`);
    doc.text(`Saldo: $${Math.max(Number(orden.saldo || 0), 0).toFixed(2)}`);

    doc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

module.exports = generarPDFOrden;