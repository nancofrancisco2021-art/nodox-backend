const express = require("express");
const router = express.Router();
const db = require("../db");

// OBTENER CONVERSACIÓN ENTRE 2 USUARIOS
router.get("/conversacion/:u1/:u2", (req, res) => {
    const { u1, u2 } = req.params;

    db.query(
        `
        SELECT * FROM mensajes 
        WHERE (remitente_id=? AND destinatario_id=?) 
           OR (remitente_id=? AND destinatario_id=?)
        ORDER BY fecha ASC
        `,
        [u1, u2, u2, u1],
        (err, results) => {
            if (err) return res.status(500).json({ error: "Error obteniendo mensajes" });
            res.json(results);
        }
    );
});

// ENVIAR MENSAJE
router.post("/enviar", (req, res) => {
    const { remitente_id, destinatario_id, mensaje } = req.body;

    db.query(
        "INSERT INTO mensajes (remitente_id, destinatario_id, mensaje) VALUES (?, ?, ?)",
        [remitente_id, destinatario_id, mensaje],
        (err, result) => {
            if (err) return res.status(500).json({ error: "Error enviando mensaje" });
            res.json({ msg: "ok", id: result.insertId });
        }
    );
});

router.put("/marcar-leidos", (req, res) => {
    const { mi_id, contra_id } = req.body;

    db.query(
        "UPDATE mensajes SET leido = 1 WHERE remitente_id = ? AND destinatario_id = ?",
        [contra_id, mi_id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ msg: "ok" });
        }
    );
});

router.get("/conversaciones/:id", (req, res) => {
    const id = req.params.id;

    const sql = `
        SELECT 
            u.id,
            u.nombre,
            u.rol,

            TIMESTAMPDIFF(SECOND, u.ultima_conexion, NOW()) < 10 AS online,

            (SELECT mensaje FROM mensajes 
             WHERE (remitente_id = u.id AND destinatario_id = ?) 
                OR (remitente_id = ? AND destinatario_id = u.id)
             ORDER BY fecha DESC LIMIT 1) AS ultimo_mensaje,

            (SELECT fecha FROM mensajes 
             WHERE (remitente_id = u.id AND destinatario_id = ?) 
                OR (remitente_id = ? AND destinatario_id = u.id)
             ORDER BY fecha DESC LIMIT 1) AS fecha_mensaje,

            (SELECT COUNT(*) FROM mensajes 
             WHERE remitente_id = u.id AND destinatario_id = ? AND leido = 0
            ) AS no_leidos

        FROM usuarios u
        WHERE u.id != ?
        ORDER BY fecha_mensaje DESC;
    `;

    db.query(sql, [id, id, id, id, id, id], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

module.exports = router;
