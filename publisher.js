const Redis = require('redis');
const axios = require('axios');

class WeatherPublisher {
    constructor() {
        this.redisClient = Redis.createClient({
            url: 'redis://localhost:6379'
        });
        this.sensors = [
            { id: 'sensor-1', city: 'New York', lat: 40.7128, lon: -74.0060 },
            { id: 'sensor-2', city: 'London', lat: 51.5074, lon: -0.1278 },
            { id: 'sensor-3', city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
            { id: 'sensor-4', city: 'Sydney', lat: -33.8688, lon: 151.2093 },
            { id: 'sensor-5', city: 'Mumbai', lat: 19.0760, lon: 72.8777 }
        ];
        this.init();
    }

    async init() {
        await this.redisClient.connect();
        console.log('Publisher conectado a Redis');
        this.startPublishing();
    }

    async fetchWeatherData(sensor) {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${sensor.lat}&longitude=${sensor.lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m`
            );

            const data = response.data.current;
            return {
                sensorId: sensor.id,
                city: sensor.city,
                latitude: sensor.lat,
                longitude: sensor.lon,
                temperature: data.temperature_2m,
                humidity: data.relative_humidity_2m,
                pressure: data.surface_pressure,
                windSpeed: data.wind_speed_10m,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`Error fetching data for ${sensor.city}:`, error.message);
            return null;
        }
    }

    async publishWeatherData() {
        for (const sensor of this.sensors) {
            const weatherData = await this.fetchWeatherData(sensor);
            
            if (weatherData) {
                // Publicar en canal Redis
                await this.redisClient.publish('weather-updates', JSON.stringify(weatherData));
                
                // Almacinar en Redis para histórico
                await this.redisClient.lPush(
                    `sensor:${sensor.id}:readings`, 
                    JSON.stringify(weatherData)
                );
                
                // Mantener solo los últimos 100 registros
                await this.redisClient.lTrim(`sensor:${sensor.id}:readings`, 0, 99);
                
                console.log(`Datos publicados para ${sensor.city}:`, {
                    temp: weatherData.temperature,
                    humidity: weatherData.humidity,
                    pressure: weatherData.pressure
                });
            }
        }
    }

    startPublishing() {
        // Publicar cada 10 segundos
        setInterval(() => {
            this.publishWeatherData();
        }, 10000);

        // Publicar inmediatamente al inicio
        this.publishWeatherData();
    }
}

new WeatherPublisher();