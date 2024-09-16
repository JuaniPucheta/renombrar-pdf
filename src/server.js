const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const archiver = require('archiver') // Si decides empaquetar en ZIP
const cors = require('cors')

const app = express()

app.use(cors({
    origin: '*'  // O indica el dominio específico si no deseas permitir todos
}))

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static('public'))

// Configuración de multer para almacenar múltiples archivos PDF subidos
const upload = multer({
    dest: 'uploads/', 
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de tamaño de archivo 5MB por archivo
    fileFilter: (req, file, cb) => {
        // Solo aceptar archivos PDF
        if (file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Solo se permiten archivos PDF.'))
        }
    }
})

// Ruta para manejar la subida de múltiples archivos
app.post('/upload', upload.array('pdfs'), async (req, res) => { // 'pdfs' es el nombre del input en el formulario
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' })
    }

    let archivosProcesados = []

    // Procesar cada archivo PDF subido
    for (let file of req.files) {
        const filePath = file.path

        try {
            // Leer el archivo PDF y extraer el texto
            const dataBuffer = fs.readFileSync(filePath)
            const data = await pdfParse(dataBuffer)
            const text = data.text

            // Ajustar la expresión regular para capturar el nombre completo del beneficiario
            const regexBeneficiario = /Beneficiario\s*([\w\s&.,-]+)(?=\s*CUIT|$)/i;
            const match = text.match(regexBeneficiario)

            if (match && match[1]) {
                const beneficiario = match[1].trim().replace(/\s+/g, ' ')
                const newFileName = `${beneficiario}.pdf`
                const newPath = path.join('uploads', newFileName)

                // Renombrar el archivo
                fs.renameSync(filePath, newPath)

                archivosProcesados.push(newPath) // Guardamos la ruta del archivo procesado
            } else {
                fs.unlinkSync(filePath) // Eliminar archivo si no se encontró el beneficiario
                return res.status(400).json({ error: `Beneficiario no encontrado en el archivo: ${file.originalname}` })
            }
        } catch (err) {
            console.error('Error al procesar el archivo:', err)
            return res.status(500).json({ error: 'Error procesando los archivos PDF.' })
        }
    }

    // Si prefieres descargar uno por uno (descomenta esto si no deseas usar ZIP)
    /*
    for (let archivo of archivosProcesados) {
        res.download(archivo)  // Descarga cada archivo renombrado
    }
    */

    // Si prefieres empaquetar todos los archivos en un ZIP:
    const zipFilePath = path.join('uploads', 'archivos_renombrados.zip')
    const output = fs.createWriteStream(zipFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
        console.log(`Archivo ZIP creado: ${zipFilePath} (${archive.pointer()} bytes)`)
        res.download(zipFilePath, 'archivos_renombrados.zip')
    })

    archive.on('error', (err) => {
        throw err
    })

    archive.pipe(output)

    // Añadir los archivos renombrados al archivo ZIP
    archivosProcesados.forEach((archivo) => {
        archive.file(archivo, { name: path.basename(archivo) })
    })

    archive.finalize() // Finalizar el ZIP
})

// Middleware para manejar rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' })
})

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err.message)
    res.status(500).json({ error: 'Ocurrió un error en el servidor.' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
