class WeatherApp {
    constructor() {
        this.socket = io();
        this.charts = {};
        this.sensorData = new Map();
        this.maxDataPoints = 20;
        
        this.init();
    }

    init() {
        this.initializeCharts();
        this.setupSocketListeners();
        this.loadSensors();
        this.loadHistoricalData();
    }

    initializeCharts() {
        const chartConfig = {
            type: 'line',
            options: {
                responsive: true,
                animation: {
                    duration: 0
                },
                scales: {
                    x: {
                        type: 'realtime',
                        realtime: {
                            duration: 60000,
                            refresh: 1000,
                            delay: 2000
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                }
            }
        };

        // Gráfica de temperatura
        this.charts.temperature = new Chart(
            document.getElementById('temperatureChart'),
            {
                ...chartConfig,
                data: {
                    datasets: []
                }
            }
        );

        // Gráfica de humedad
        this.charts.humidity = new Chart(
            document.getElementById('humidityChart'),
            {
                ...chartConfig,
                data: {
                    datasets: []
                }
            }
        );

        // Gráfica de presión
        this.charts.pressure = new Chart(
            document.getElementById('pressureChart'),
            {
                ...chartConfig,
                data: {
                    datasets: []
                }
            }
        );
    }

    setupSocketListeners() {
        this.socket.on('weather-update', (data) => {
            this.updateSensorDisplay(data);
            this.updateCharts(data);
            this.updateHeatmap(data);
        });
    }

    async loadSensors() {
        try {
            const response = await fetch('/api/sensors');
            const sensors = await response.json();
            
            const sensorsGrid = document.getElementById('sensorsGrid');
            sensorsGrid.innerHTML = '';

            sensors.forEach(sensor => {
                const sensorCard = this.createSensorCard(sensor);
                sensorsGrid.appendChild(sensorCard);
                this.sensorData.set(sensor.id, []);
            });
        } catch (error) {
            console.error('Error loading sensors:', error);
        }
    }

    createSensorCard(sensor) {
        const card = document.createElement('div');
        card.className = 'sensor-card';
        card.id = `card-${sensor.id}`;
        card.innerHTML = `
            <h3>${sensor.city}</h3>
            <div class="weather-data">
                <div class="data-item">
                    <span>Temperatura:</span>
                    <span class="data-value temperature">-- °C</span>
                </div>
                <div class="data-item">
                    <span>Humedad:</span>
                    <span class="data-value humidity">-- %</span>
                </div>
                <div class="data-item">
                    <span>Presión:</span>
                    <span class="data-value pressure">-- hPa</span>
                </div>
                <div class="data-item">
                    <span>Viento:</span>
                    <span class="data-value wind">-- km/h</span>
                </div>
            </div>
            <div class="last-update">Última actualización: --</div>
        `;
        return card;
    }

    updateSensorDisplay(data) {
        const card = document.getElementById(`card-${data.sensorId}`);
        if (card) {
            card.querySelector('.temperature').textContent = `${data.temperature} °C`;
            card.querySelector('.humidity').textContent = `${data.humidity} %`;
            card.querySelector('.pressure').textContent = `${data.pressure} hPa`;
            card.querySelector('.wind').textContent = `${data.windSpeed} km/h`;
            
            const now = new Date().toLocaleTimeString();
            card.querySelector('.last-update').textContent = 
                `Última actualización: ${now}`;
        }
    }

    updateCharts(data) {
        const timestamp = new Date(data.timestamp);
        
        // Actualizar datos del sensor
        if (!this.sensorData.has(data.sensorId)) {
            this.sensorData.set(data.sensorId, []);
        }

        const sensorReadings = this.sensorData.get(data.sensorId);
        sensorReadings.push({
            x: timestamp,
            temperature: data.temperature,
            humidity: data.humidity,
            pressure: data.pressure
        });

        // Mantener solo los últimos puntos de datos
        if (sensorReadings.length > this.maxDataPoints) {
            sensorReadings.shift();
        }

        this.updateChartDataset('temperature', data.sensorId, data.city, sensorReadings, 'temperature');
        this.updateChartDataset('humidity', data.sensorId, data.city, sensorReadings, 'humidity');
        this.updateChartDataset('pressure', data.sensorId, data.city, sensorReadings, 'pressure');
    }

    updateChartDataset(chartType, sensorId, city, readings, dataKey) {
        const chart = this.charts[chartType];
        const datasetIndex = chart.data.datasets.findIndex(ds => ds.label === city);

        const data = readings.map(reading => ({
            x: reading.x,
            y: reading[dataKey]
        }));

        const color = this.getColorForSensor(sensorId);

        if (datasetIndex === -1) {
            // Nuevo dataset
            chart.data.datasets.push({
                label: city,
                data: data,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3
            });
        } else {
            // Actualizar dataset existente
            chart.data.datasets[datasetIndex].data = data;
        }

        chart.update('none');
    }

    updateHeatmap(data) {
        const marker = document.getElementById(`sensor-${data.sensorId}-marker`);
        const tooltip = document.getElementById(`sensor-${data.sensorId}-tooltip`);

        if (marker && tooltip) {
            // Cambiar color basado en temperatura
            const temp = data.temperature;
            let color = '#3182ce'; // Azul para frío
            
            if (temp > 30) color = '#e53e3e'; // Rojo para calor
            else if (temp > 20) color = '#dd6b20'; // Naranja para templado
            else if (temp > 10) color = '#38a169'; // Verde para fresco

            marker.style.background = color;
            
            tooltip.textContent = 
                `${data.city}: ${data.temperature}°C, ${data.humidity}% hum`;
        }
    }

    getColorForSensor(sensorId) {
        const colors = {
            'sensor-1': '#e53e3e', // Rojo
            'sensor-2': '#3182ce', // Azul
            'sensor-3': '#38a169', // Verde
            'sensor-4': '#dd6b20', // Naranja
            'sensor-5': '#805ad5'  // Púrpura
        };
        return colors[sensorId] || '#718096';
    }

    async loadHistoricalData() {
        // Cargar datos históricos para cada sensor
        for (const sensorId of this.sensorData.keys()) {
            try {
                const response = await fetch(`/api/history/${sensorId}`);
                const historicalData = await response.json();
                
                this.sensorData.set(sensorId, historicalData.map(item => ({
                    x: new Date(item.timestamp),
                    temperature: item.temperature,
                    humidity: item.humidity,
                    pressure: item.pressure
                })));

                // Actualizar charts con datos históricos
                const sensorInfo = historicalData[0];
                if (sensorInfo) {
                    this.updateChartDataset('temperature', sensorId, sensorInfo.city, 
                        this.sensorData.get(sensorId), 'temperature');
                    this.updateChartDataset('humidity', sensorId, sensorInfo.city, 
                        this.sensorData.get(sensorId), 'humidity');
                    this.updateChartDataset('pressure', sensorId, sensorInfo.city, 
                        this.sensorData.get(sensorId), 'pressure');
                }
            } catch (error) {
                console.error(`Error loading historical data for ${sensorId}:`, error);
            }
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});