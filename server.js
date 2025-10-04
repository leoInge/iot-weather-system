const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('redis');
const cors = require('cors');
const path = require('path');

class WeatherSubscriber {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.redisClient = Redis.createClient({
            url: 'redis://localhost:6379'
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
        this.init();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Endpoint para obtener datos históricos
        this.app.get('/api/history/:sensorId', async (req, res) => {
            try {
                const { sensorId } = req.params;
                const readings = await this.redisClient.lRange(
                    `sensor:${sensorId}:readings`, 
                    0, 
                    -1
                );
                const parsedReadings = readings.map(reading => JSON.parse(reading));
                res.json(parsedReadings);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint para obtener todos los sensores
        this.app.get('/api/sensors', async (req, res) => {
            const sensors = [
                { id: 'sensor-1', city: 'New York', lat: 40.7128, lon: -74.0060 },
                { id: 'sensor-2', city: 'London', lat: 51.5074, lon: -0.1278 },
                { id: 'sensor-3', city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
                { id: 'sensor-4', city: 'Sydney', lat: -33.8688, lon: 151.2093 },
                { id: 'sensor-5', city: 'Mumbai', lat: 19.0760, lon: 72.8777 }
            ];
            res.json(sensors);
        });
    }

    setupSocket() {
        this.io.on('connection', (socket) => {
            console.log('Cliente conectado:', socket.id);

            socket.on('disconnect', () => {
                console.log('Cliente desconectado:', socket.id);
            });
        });
    }

    // En server.js, modifica la función subscribeToWeatherUpdates:
async subscribeToWeatherUpdates() {
    const subscriber = this.redisClient.duplicate();
    await subscriber.connect();

    console.log('🔍 Suscriptor Redis conectado, escuchando canal: weather-updates');

    await subscriber.subscribe('weather-updates', (message) => {
        try {
            const weatherData = JSON.parse(message);
            console.log('📤 Enviando datos a clientes:', weatherData.city, weatherData.temperature + '°C');
            
            // Emitir a todos los clientes conectados
            this.io.emit('weather-update', weatherData);
            
            // Log de clientes conectados
            const clientCount = this.io.engine.clientsCount;
            console.log(`👥 Clientes conectados: ${clientCount}`);
        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
        }
    });
}

    async init() {
        await this.redisClient.connect();
        await this.subscribeToWeatherUpdates();

        const PORT = process.env.PORT || 3000;
        this.server.listen(PORT, () => {
            console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
        });
    }
}

new WeatherSubscriber();