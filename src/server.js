const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const app = express();

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static('public'));

// Configuración de multer para almacenar el PDF subido
const upload = multer({
    dest: 'uploads/', 
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de tamaño de archivo 5MB
    fileFilter: (req, file, cb) => {
        // Solo aceptar archivos PDF
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF.'));
        }
    }
});

// Ruta para manejar la subida de archivos
app.post('/upload', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    const filePath = req.file.path;

    try {
        // Leer el archivo PDF y extraer el texto
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);

        const text = data.text;

        // Ajustar la expresión regular para capturar el nombre completo del beneficiario
        const regexBeneficiario = /Beneficiario\s*([A-ZÑÁÉÍÓÚ\s]+)(?=\s*CUIT|$)/i; // Capturar el nombre completo y detenerse en CUIT
        const match = text.match(regexBeneficiario);

        if (match && match[1]) {
            const beneficiario = match[1].trim().replace(/\s+/g, ' '); // Limpiar el nombre completo

            console.log('Beneficiario:', beneficiario); // Verificar si captura el nombre completo

            // Definir el nuevo nombre del archivo con el nombre completo del beneficiario
            const newFileName = `${beneficiario}.pdf`;
            console.log('Nuevo nombre de archivo:', newFileName);
            const newPath = path.join('uploads', newFileName);
            console.log('Nuevo path:', newPath);

            // Renombrar el archivo antes de descargarlo
            fs.rename(filePath, newPath, (err) => {
                if (err) {
                    console.error('Error al renombrar el archivo:', err);
                    return res.status(500).json({ error: 'Error al renombrar el archivo.' });
                }

                // Forzar la descarga desde la nueva ruta renombrada
                const absolutePath = path.resolve(newPath);  // Convertir a ruta absoluta
                res.setHeader('Content-Disposition', `attachment; filename="${newFileName}"`);
                res.setHeader('Content-Type', 'application/pdf');

                res.sendFile(absolutePath, (err) => {
                    if (err) {
                        console.error('Error al enviar el archivo renombrado:', err);
                        return res.status(500).json({ error: 'Error al enviar el archivo renombrado.' });
                    }
                    console.log(`Archivo renombrado y enviado como: ${newFileName}`);
                });
            });
        } else {
            // El beneficiario no fue encontrado en el archivo PDF
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error al eliminar el archivo original:', err);
            });
            return res.status(400).json({ error: 'Beneficiario no encontrado en el archivo PDF.' });
        }
    } catch (err) {
        console.error('Error al procesar el archivo:', err);
        res.status(500).json({ error: 'Error procesando el archivo PDF.' });
    }
});

// Middleware para manejar rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err.message);
    res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
