const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function asegurarCarpeta(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function dinero(valor) {
    return `$${Number(valor || 0).toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function fechaLargaMX(fecha = new Date()) {
    const f = fecha ? new Date(fecha) : new Date();

    if (isNaN(f)) return "";

    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return `${String(f.getDate()).padStart(2, "0")} de ${meses[f.getMonth()]} de ${f.getFullYear()}`;
}

function textoSeguro(valor, fallback = "—") {
    if (valor === null || valor === undefined || valor === "") return fallback;
    return String(valor);
}

function calcularMontoLinea(m) {
    if (m.total !== undefined && m.total !== null) return Number(m.total || 0);
    if (m.importe !== undefined && m.importe !== null) return Number(m.importe || 0);

    const cantidad = Number(m.cantidad || 0);
    const precio = Number(m.precio || m.precio_unitario || 0);
    const descuento = Number(m.descuento || 0);

    return cantidad * precio * (1 - descuento / 100);
}

function obtenerPrecioUnitario(m) {
    return Number(m.precio || m.precio_unitario || m.p_unitario || 0);
}

function generarPDFOrden(orden) {
    return new Promise((resolve, reject) => {
        const pdfDir = path.join(__dirname, "../pdfs");
        asegurarCarpeta(pdfDir);

        const numeroOrden = orden.numero_orden || orden.id || "SIN_NUMERO";
        const nombreArchivoSeguro = String(numeroOrden).replace(/[\/\\:*?"<>|]/g, "-");

        const filePath = path.join(pdfDir, `Presupuesto_${nombreArchivoSeguro}.pdf`);

        const doc = new PDFDocument({
            size: "LETTER",
            margin: 26
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const margin = 26;
        const verde = "#9ACD32";
        const gris = "#8A8A8A";
        const negro = "#111111";

        // =============================
        // LOGO / ENCABEZADO
        // =============================
        const logoPath = path.join(__dirname, "../assets/nodox_logo_pdf.jpeg");

        if (fs.existsSync(logoPath)) {
        doc.image(logoPath, pageW / 2 - 185, 18, {
            width: 370
        });
    } else {
        doc
            .font("Helvetica-Bold")
            .fontSize(44)
            .fillColor(negro)
            .text("NODOX", 0, 24, { align: "center" });

        doc
            .font("Helvetica")
            .fontSize(16)
            .fillColor(gris)
            .text("Publicidad & Producción", 0, 72, { align: "center" });
    }

        doc
          .moveTo(margin, 112)
          .lineTo(pageW - margin, 112)
          .lineWidth(4)
          .strokeColor(verde)
          .stroke();

        // =============================
        // DATOS SUPERIORES
        // =============================
        const fechaTexto = fechaLargaMX(orden.fecha_creacion || new Date());

        doc.fillColor(negro).font("Helvetica").fontSize(10);

        const clienteTexto = orden.cliente || orden.razon_social || "—";
        const tiempoEntrega = orden.tiempo_entrega || orden.tiempo_estimado || orden.entrega_estimada || "—";

        doc
            .font("Helvetica-Bold")
            .text(`Presupuesto ${numeroOrden}`, margin, 130);

        doc
            .font("Helvetica")
            .text(clienteTexto, margin, 145)
            .text(`Tiempo estimado de entrega: ${tiempoEntrega}`, margin, 160);

        doc
            .font("Helvetica")
            .text("Cd. Reynosa, Tamaulipas", pageW - 240, 130, {
                width: 210,
                align: "right"
            })
            .text(`a ${fechaTexto}`, pageW - 240, 145, {
                width: 210,
                align: "right"
            })
            .text("Página 1 de 1", pageW - 240, 160, {
                width: 210,
                align: "right"
            });

        // =============================
        // TABLA DE PRODUCTOS
        // =============================
        const tableX = margin;
        const tableY = 200;
        const colCantidad = 60;
        const colDescripcion = 390;
        const colUnitario = 75;
        const colMonto = 78;
        const rowH = 72;

        const tableW = colCantidad + colDescripcion + colUnitario + colMonto;

        // Header tabla
        doc
            .lineWidth(0.7)
            .strokeColor("#CCCCCC")
            .rect(tableX, tableY, tableW, 20)
            .stroke();

        doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#9A9A9A")
            .text("Cantidad", tableX, tableY + 6, {
                width: colCantidad,
                align: "center"
            })
            .text("Descripción", tableX + colCantidad, tableY + 6, {
                width: colDescripcion,
                align: "center"
            })
            .text("P.Unitario", tableX + colCantidad + colDescripcion, tableY + 6, {
                width: colUnitario,
                align: "center"
            })
            .text("Monto", tableX + colCantidad + colDescripcion + colUnitario, tableY + 6, {
                width: colMonto,
                align: "center"
            });

        const materiales = Array.isArray(orden.materiales) ? orden.materiales : [];
        let y = tableY + 20;

        if (materiales.length === 0) {
            doc
                .lineWidth(0.7)
                .strokeColor("#CCCCCC")
                .rect(tableX, y, tableW, rowH)
                .stroke();

            doc
                .font("Helvetica")
                .fontSize(9)
                .fillColor(negro)
                .text("—", tableX + colCantidad + 8, y + 12, {
                    width: colDescripcion - 16
                });

            y += rowH;
        } else {
            materiales.forEach((m) => {
                const cantidad = Number(m.cantidad || 0);
                const nombre = m.nombre || m.descripcion || "—";
                const descripcionLinea = m.detalle || m.descripcion_extra || "";
                const precioUnitario = obtenerPrecioUnitario(m);
                const monto = calcularMontoLinea(m);

                doc
                    .lineWidth(0.7)
                    .strokeColor("#CCCCCC")
                    .rect(tableX, y, tableW, rowH)
                    .stroke();

                // Líneas verticales
                doc
                    .moveTo(tableX + colCantidad, y)
                    .lineTo(tableX + colCantidad, y + rowH)
                    .stroke();

                doc
                    .moveTo(tableX + colCantidad + colDescripcion, y)
                    .lineTo(tableX + colCantidad + colDescripcion, y + rowH)
                    .stroke();

                doc
                    .moveTo(tableX + colCantidad + colDescripcion + colUnitario, y)
                    .lineTo(tableX + colCantidad + colDescripcion + colUnitario, y + rowH)
                    .stroke();

                doc
                    .font("Helvetica-Bold")
                    .fontSize(9)
                    .fillColor(negro)
                    .text(cantidad, tableX, y + 12, {
                        width: colCantidad,
                        align: "center"
                    });

                doc
                    .font("Helvetica-Bold")
                    .fontSize(9)
                    .text(nombre, tableX + colCantidad + 8, y + 12, {
                        width: colDescripcion - 16
                    });

                if (descripcionLinea) {
                    doc
                        .font("Helvetica")
                        .fontSize(8)
                        .fillColor("#555555")
                        .text(descripcionLinea, tableX + colCantidad + 8, y + 28, {
                            width: colDescripcion - 16
                        });
                }

                doc
                    .font("Helvetica-Bold")
                    .fontSize(9)
                    .fillColor(negro)
                    .text(dinero(precioUnitario), tableX + colCantidad + colDescripcion, y + 12, {
                        width: colUnitario,
                        align: "right"
                    });

                doc
                    .font("Helvetica-Bold")
                    .fontSize(9)
                    .text(dinero(monto), tableX + colCantidad + colDescripcion + colUnitario, y + 12, {
                        width: colMonto - 8,
                        align: "right"
                    });

                y += rowH;
            });
        }

        // =============================
        // TOTALES
        // =============================
        const totalBoxX = tableX + colCantidad + colDescripcion;
        const totalBoxY = y;
        const labelW = colUnitario;
        const valueW = colMonto;

        const subtotal = Number(orden.subtotal || 0);
        const iva = Number(orden.iva || 0);
        const total = Number(orden.total || subtotal + iva);
        const ivaPct = Number(orden.iva_porcentaje || 8);

        const totalRows = [
            ["SUB TOTAL", dinero(subtotal)],
            ["I.V.A.", `${ivaPct}%`],
            ["TOTAL", dinero(total)]
        ];

        totalRows.forEach((r, i) => {
            const ry = totalBoxY + i * 32;

            doc
                .rect(totalBoxX, ry, labelW + valueW, 32)
                .strokeColor("#CCCCCC")
                .lineWidth(0.7)
                .stroke();

            doc
                .moveTo(totalBoxX + labelW, ry)
                .lineTo(totalBoxX + labelW, ry + 32)
                .stroke();

            doc
                .font("Helvetica")
                .fontSize(10)
                .fillColor(negro)
                .text(r[0], totalBoxX + 5, ry + 11, {
                    width: labelW - 10,
                    align: "right"
                });

            doc
                .font("Helvetica-Bold")
                .text(r[1], totalBoxX + labelW + 5, ry + 11, {
                    width: valueW - 10,
                    align: "right"
                });
        });

        // =============================
        // IMAGEN DE REFERENCIA
        // =============================
        const imageTitleY = totalBoxY + 115;

        doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(negro)
            .text("Imagen de Referencia", margin + 5, imageTitleY);

        const imagenRef =
            orden.imagen_referencia ||
            orden.imagenReferencia ||
            orden.imagen ||
            null;

        if (imagenRef && fs.existsSync(imagenRef)) {
            try {
                doc.image(imagenRef, margin + 120, imageTitleY + 20, {
                    width: 210,
                    height: 160,
                    fit: [210, 160]
                });
            } catch (e) {
                doc
                    .fontSize(9)
                    .fillColor("#777777")
                    .text("No se pudo cargar la imagen de referencia.", margin + 5, imageTitleY + 20);
            }
        } else {
            doc
                .fontSize(9)
                .fillColor("#777777")
                .text("Sin imagen de referencia.", margin + 5, imageTitleY + 20);
        }

        // =============================
        // CLÁUSULAS
        // =============================
        const clausulasY = 575;

        doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(negro)
            .text("CLAUSULAS:", margin + 5, clausulasY);

        const clausulas = [
            "1) Precios incluyen I.V.A. a razón del 8%. Por el tipo de producto se cotiza en Dólares estadounidenses y se hace la conversión a pesos el día del pedido.",
            "2) Se acepta pago en efectivo, depósito, transferencia electrónica o pago con tarjeta de débito o de crédito.",
            "3) Es requerido 50% pago por anticipado y 50% al entregar el material o antes de enviar / instalar.",
            "4) Los tiempos de entrega se establecen al firmar contrato y empiezan a contar una vez que se tiene el pago del anticipo en firme y los diseños autorizados, los tiempos son estimados y pueden variar por causas ajenas a la empresa.",
            "5) El cliente deberá entregar una copia firmada de este documento para hacer el pedido, o confirmar vía e-mail o enviar orden de compra con este anexo.",
            "6) En caso de cancelaciones no hay devolución de anticipos bajo ninguna circunstancia.",
            "7) Es responsabilidad del cliente revisar que toda la información y diseño estén correctos, ya que una vez que se autoriza algún proceso de producción no nos haremos responsables por estos inconvenientes.",
            "8) Cualquier cambio después de autorizado el proyecto se generan costos adicionales que el cliente deberá pagar.",
            "9) Si hay una falla por parte de la Empresa, esta se compromete a la reparación o reemplazo según sea más conveniente a opinión de la empresa.",
            "10) Una vez que el cliente o su representante autoriza este proyecto acepta y se apega a estas cláusulas."
        ];

        doc
            .font("Helvetica")
            .fontSize(6.2)
            .fillColor(negro)
            .text(clausulas.join("\n"), margin + 5, clausulasY + 12, {
                width: pageW - margin * 2 - 10,
                lineGap: 0.5
            });

        // =============================
        // PIE
        // =============================
        doc
            .moveTo(margin, pageH - 45)
            .lineTo(pageW - margin, pageH - 45)
            .lineWidth(4)
            .strokeColor(verde)
            .stroke();

        doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#333333")
            .text(
                "Lerdo de Tejada 425 Col. Bella Vista Cd. Reynosa, Tamaulipas. C.P. 88600",
                margin,
                pageH - 34,
                {
                    width: pageW - margin * 2,
                    align: "center"
                }
            )
            .text(
                "Tel. +52 (899) 262.8456   www.nodox.mx   info@nodox.mx",
                margin,
                pageH - 21,
                {
                    width: pageW - margin * 2,
                    align: "center"
                }
            );

        doc.end();

        stream.on("finish", () => resolve(filePath));
        stream.on("error", reject);
    });
}

module.exports = generarPDFOrden;