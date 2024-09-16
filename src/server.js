const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const archiver = require('archiver');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*'  // Permitir todos los orígenes
}));

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static('public'));

// Configuración de multer para almacenar múltiples archivos PDF subidos
const upload = multer({
    dest: 'uploads/', 
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de tamaño de archivo 5MB por archivo
    fileFilter: (req, file, cb) => {
        // Solo aceptar archivos PDF
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF.'));
        }
    }
});

// Crear una estructura para llevar la cuenta de beneficiarios y CUIT
let archivoCounter = {};

// Ruta para manejar la subida de múltiples archivos
app.post('/upload', upload.array('pdfs'), async (req, res) => { 
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    let archivosProcesados = [];

    // Procesar cada archivo PDF subido
    for (let file of req.files) {
        const filePath = file.path;

        try {
            // Leer el archivo PDF y extraer el texto
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            const text = data.text;

            // Ajustar la expresión regular para capturar el nombre completo del beneficiario y el CUIT
            const regexBeneficiario = /Beneficiario\s*([\w\s&.,-]+)(?=\s*CUIT|$)/i;
            const regexCuit = /CUIT o CUIL\s*(\d{11})/; // Para capturar el CUIT o CUIL con formato de 11 dígitos

            const matchBeneficiario = text.match(regexBeneficiario);
            const matchCuit = text.match(regexCuit);

            if (matchBeneficiario && matchBeneficiario[1] && matchCuit && matchCuit[1]) {
                const beneficiario = matchBeneficiario[1].trim().replace(/\s+/g, ' ');
                const cuit = matchCuit[1];
                let newFileName = `${beneficiario}.pdf`;
                let newPath = path.join('uploads', newFileName);

                // Si ya hemos encontrado este beneficiario y CUIT
                if (!archivoCounter[beneficiario]) {
                    archivoCounter[beneficiario] = {};
                }

                if (archivoCounter[beneficiario][cuit]) {
                    // Si el beneficiario y CUIT son los mismos, numerar secuencialmente
                    archivoCounter[beneficiario][cuit] += 1;
                    newFileName = `${beneficiario} ${archivoCounter[beneficiario][cuit]}.pdf`;
                    newPath = path.join('uploads', newFileName);
                } else if (Object.keys(archivoCounter[beneficiario]).length > 0 && !archivoCounter[beneficiario][cuit]) {
                    // Si el beneficiario es el mismo pero el CUIT es diferente, agregar "distinto" y numerar
                    archivoCounter[beneficiario][cuit] = 1;
                    const distintoCount = Object.keys(archivoCounter[beneficiario]).length - 1; // Para contar el número "distinto"
                    newFileName = `${beneficiario} distinto ${distintoCount}.pdf`;
                    newPath = path.join('uploads', newFileName);
                } else {
                    // Si es la primera vez que encontramos este beneficiario y CUIT
                    archivoCounter[beneficiario][cuit] = 1;
                }

                // Renombrar el archivo
                fs.renameSync(filePath, newPath);

                archivosProcesados.push(newPath); // Guardamos la ruta del archivo procesado
            } else {
                fs.unlinkSync(filePath); // Eliminar archivo si no se encontró el beneficiario o CUIT
                return res.status(400).json({ error: `Beneficiario o CUIT no encontrado en el archivo: ${file.originalname}` });
            }
        } catch (err) {
            console.error('Error al procesar el archivo:', err);
            return res.status(500).json({ error: 'Error procesando los archivos PDF.' });
        }
    }

    // Si prefieres empaquetar todos los archivos en un ZIP:
    const zipFilePath = path.join('uploads', 'archivos_renombrados.zip');
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`Archivo ZIP creado: ${zipFilePath} (${archive.pointer()} bytes)`);
        res.download(zipFilePath, 'archivos_renombrados.zip');
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    // Añadir los archivos renombrados al archivo ZIP
    archivosProcesados.forEach((archivo) => {
        archive.file(archivo, { name: path.basename(archivo) });
    });

    archive.finalize(); // Finalizar el ZIP
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
