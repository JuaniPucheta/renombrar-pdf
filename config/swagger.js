const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Configuración de Swagger
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API de Renombramiento de Comprobantes',
            version: '1.0.0',
            description: 'API para renombrar comprobantes de pago y descargarlos en un archivo ZIP',
            contact: {
                name: 'Soporte de la API',
                email: 'tecnologia@globalempresaria.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000', // Cambia la URL según tu entorno
                description: 'Servidor local de desarrollo'
            }
        ]
    },
    apis: ['./src/server.js'], // Especifica la ubicación de tu archivo o archivos con rutas anotadas
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Exportar Swagger UI y Swagger Docs para usar en server.js
module.exports = {
    swaggerUi,
    swaggerDocs
};
