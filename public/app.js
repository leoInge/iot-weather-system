class WeatherApp {
    constructor() {
        this.socket = io({
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        this.charts = {};
        this.sensorData = new Map();
        this.maxDataPoints = 20;
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        console.log('🚀 Inicializando aplicación de clima...');
        
        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor WebSocket. ID:', this.socket.id);
            this.loadSensors();
        });

        this.socket.on('weather-update', (data) => {
            console.log('📡 Datos recibidos via WebSocket:', data);
            if (!this.isInitialized) {
                this.initializeCharts();
                this.isInitialized = true;
            }
            this.updateSensorDisplay(data);
            this.updateCharts(data);
            this.updateHeatmap(data);
        });

        // Inicializar mapa centrado en el mundo
        this.map = L.map('map').setView([20, 0], 2);

        // Capa base
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors/OpenWeather'
        }).addTo(this.map);

        // Capa de calor global de OpenWeather (temperatura)
        this.heatmapLayer = L.tileLayer(
            `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=API_KEY`,
            { opacity: 0.9 }
        ).addTo(this.map);

        // Marcadores de sensores
        this.sensorMarkers = {};

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Desconectado del servidor:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('💥 Error de conexión WebSocket:', error);
        });

        // Forzar reconexión si no hay datos después de 10 segundos
        setTimeout(() => {
            if (!this.isInitialized) {
                console.log('🕒 Sin datos después de 10s, verificando conexión...');
                // Simular datos de prueba
                this.simulateTestData();
            }
        }, 10000);
    }

    simulateTestData() {
        console.log('🧪 Mostrando datos de prueba...');
        const testData = {
            sensorId: 'sensor-1',
            city: 'New York',
            temperature: 22.5,
            humidity: 65,
            pressure: 1013.2,
            windSpeed: 12.3,
            timestamp: new Date().toISOString()
        };
        this.updateSensorDisplay(testData);
    }

    initializeCharts() {
        console.log('📊 Inicializando gráficas...');
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Tiempo (puntos)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        };

        // Temperatura
        const tempCtx = document.getElementById('temperatureChart');
        if (tempCtx) {
            this.charts.temperature = new Chart(tempCtx, {
                type: 'line',
                data: { datasets: [] },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            title: { display: true, text: 'Temperatura (°C)' }
                        }
                    }
                }
            });
        }

        // Humedad
        const humidityCtx = document.getElementById('humidityChart');
        if (humidityCtx) {
            this.charts.humidity = new Chart(humidityCtx, {
                type: 'line',
                data: { datasets: [] },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            title: { display: true, text: 'Humedad (%)' },
                            min: 0,
                            max: 100
                        }
                    }
                }
            });
        }

        // Presión
        const pressureCtx = document.getElementById('pressureChart');
        if (pressureCtx) {
            this.charts.pressure = new Chart(pressureCtx, {
                type: 'line',
                data: { datasets: [] },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            title: { display: true, text: 'Presión (hPa)' }
                        }
                    }
                }
            });
        }

        console.log('✅ Gráficas inicializadas');
    }

    async loadSensors() {
        try {
            const response = await fetch('/api/sensors');
            const sensors = await response.json();
            
            const sensorsGrid = document.getElementById('sensorsGrid');
            if (sensorsGrid) {
                sensorsGrid.innerHTML = '';
                sensors.forEach(sensor => {
                    const sensorCard = this.createSensorCard(sensor);
                    sensorsGrid.appendChild(sensorCard);
                    this.sensorData.set(sensor.id, []);
                });
                console.log('📍 Sensores cargados:', sensors.length);
            }
        } catch (error) {
            console.error('❌ Error loading sensors:', error);
        }
    }

    createSensorCard(sensor) {
        const card = document.createElement('div');
        card.className = 'sensor-card';
        card.id = `card-${sensor.id}`;
        card.innerHTML = `
            <h3>🏙️ ${sensor.city}</h3>
            <div class="weather-data">
                <div class="data-item">
                    <span>🌡️ Temperatura:</span>
                    <span class="data-value temperature">-- °C</span>
                </div>
                <div class="data-item">
                    <span>💧 Humedad:</span>
                    <span class="data-value humidity">-- %</span>
                </div>
                <div class="data-item">
                    <span>📊 Presión:</span>
                    <span class="data-value pressure">-- hPa</span>
                </div>
                <div class="data-item">
                    <span>💨 Viento:</span>
                    <span class="data-value wind">-- km/h</span>
                </div>
            </div>
            <div class="last-update">Esperando datos...</div>
        `;
        return card;
    }

    updateSensorDisplay(data) {
        console.log('🔄 Actualizando display para:', data.city);
        const card = document.getElementById(`card-${data.sensorId}`);
        if (card) {
            card.querySelector('.temperature').textContent = `${data.temperature} °C`;
            card.querySelector('.humidity').textContent = `${data.humidity} %`;
            card.querySelector('.pressure').textContent = `${data.pressure} hPa`;
            card.querySelector('.wind').textContent = `${data.windSpeed} km/h`;
            
            const now = new Date().toLocaleTimeString();
            card.querySelector('.last-update').textContent = `Actualizado: ${now}`;
            
            // Efecto visual
            card.style.background = '#f0fff4';
            setTimeout(() => {
                card.style.background = 'white';
            }, 1000);
        }
    }

    updateCharts(data) {
        if (!this.sensorData.has(data.sensorId)) {
            this.sensorData.set(data.sensorId, []);
        }

        const sensorReadings = this.sensorData.get(data.sensorId);
        const timePoint = sensorReadings.length;
        
        sensorReadings.push({
            x: timePoint,
            temperature: data.temperature,
            humidity: data.humidity,
            pressure: data.pressure
        });

        if (sensorReadings.length > this.maxDataPoints) {
            sensorReadings.shift();
        }

        this.updateChart('temperature', data.sensorId, data.city, sensorReadings, 'temperature');
        this.updateChart('humidity', data.sensorId, data.city, sensorReadings, 'humidity');
        this.updateChart('pressure', data.sensorId, data.city, sensorReadings, 'pressure');
    }

    updateChart(chartType, sensorId, city, readings, dataKey) {
        if (!this.charts[chartType]) return;

        const chart = this.charts[chartType];
        const datasetIndex = chart.data.datasets.findIndex(ds => ds.label === city);

        const dataPoints = readings.map((reading, index) => ({
            x: index,
            y: reading[dataKey]
        }));

        const colors = this.getColorsForSensor(sensorId);

        if (datasetIndex === -1) {
            chart.data.datasets.push({
                label: city,
                data: dataPoints,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: colors.border,
                fill: false
            });
        } else {
            chart.data.datasets[datasetIndex].data = dataPoints;
        }

        chart.update();
    }

    getColorsForSensor(sensorId) {
        const colors = {
            'sensor-1': { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.1)' },
            'sensor-2': { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.1)' },
            'sensor-3': { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.1)' },
            'sensor-4': { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.1)' },
            'sensor-5': { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.1)' }
        };
        return colors[sensorId] || { border: 'rgb(201, 203, 207)', background: 'rgba(201, 203, 207, 0.1)' };
    }

    updateHeatmap(data) {
        const marker = document.getElementById(`sensor-${data.sensorId}-marker`);
        const tooltip = document.getElementById(`sensor-${data.sensorId}-tooltip`);

        if (marker && tooltip) {
            const temp = data.temperature;
            let color;
            
            if (temp < 10) color = '#3b82f6';
            else if (temp < 20) color = '#10b981';
            else if (temp < 30) color = '#f59e0b';
            else color = '#ef4444';

            marker.style.background = color;
            marker.style.boxShadow = `0 0 20px ${color}`;
            
            tooltip.innerHTML = `
                <strong>${data.city}</strong><br>
                🌡️ ${data.temperature}°C<br>
                💧 ${data.humidity}%<br>
                📊 ${data.pressure}hPa
            `;
        }
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
})

// Agregar esta función al final del archivo app.js
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateString = now.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = `${dateString} - ${timeString}`;
    }
}

// Actualizar la hora cada segundo
setInterval(updateCurrentTime, 1000);
updateCurrentTime();;