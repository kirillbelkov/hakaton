const apiBaseUrl = 'http://127.0.0.1:8000';

let map = L.map('map').setView([52.286974, 104.305018], 12);
let transportData = []; 
let marker = null;
let busMarker = null; 
let timeSlider = null; 
let animationInterval = null; 
const animationSpeed = 60; 
const animationDelay = 300; 

const busIcon = L.icon({
    iconUrl: 'bus.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32] // центр по горизонтали, низ по вертикали
});


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

async function fetchOptions(endpoint, selectId) {
    const response = await fetch(`${apiBaseUrl}${endpoint}`);
    const data = await response.json();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Выберите</option>';
    data.forEach(item => {
        let value = Object.values(item)[0];
        let option = document.createElement('option');
        option.value = value;
        option.text = value;
        select.add(option);
    });
}

fetchOptions('/cities', 'citySelect');
fetchOptions('/routes', 'routeSelect');
fetchOptions('/vehicle_types', 'vehicleTypeSelect');

function exportGTFS() {
    const link = document.createElement('a');
    link.href = `${apiBaseUrl}/stops/gtfs`;
    link.download = 'stops.txt';
    link.click();
}


async function findTransports() {
    const vehicleType = document.getElementById('vehicleTypeSelect').value;
    const route = document.getElementById('routeSelect').value;
    const city = document.getElementById('citySelect').value;

    if (vehicleType && route && city) {
        const url = `${apiBaseUrl}/transports?vehicle_type=${encodeURIComponent(vehicleType)}&route=${encodeURIComponent(route)}&city=${encodeURIComponent(city)}`;
        const response = await fetch(url);
        const data = await response.json();
        const transportSelect = document.getElementById('transportSelect');
        transportSelect.innerHTML = '<option value="">Выберите транспорт</option>';

        data.forEach(item => {
            const transportId = item[0];
            const option = document.createElement('option');
            option.value = transportId;
            option.text = transportId;
            transportSelect.add(option);
        });
    } else {
        alert('Выберите город, маршрут и тип транспорта');
    }
}

function secondsToHHMM(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

async function loadData() {
    const transportId = document.getElementById('transportSelect').value;
    const dateInput = document.getElementById('dateSelect').value;

    if (!transportId || !dateInput) {
        alert('Выберите транспорт и дату');
        return;
    }

    const url = `${apiBaseUrl}/data?transport=${encodeURIComponent(transportId)}&date=${encodeURIComponent(dateInput)}`;
    const response = await fetch(url);
    const data = await response.json();

    transportData = [];

    map.eachLayer(layer => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    data.forEach(row => {
        let [id, date, secondsFromMidnight, transport, city, lat, lon, speed, direction] = row;

        let shiftedSeconds = secondsFromMidnight + 5 * 3600;
        if (shiftedSeconds >= 86400) {
            shiftedSeconds -= 86400;
            let newDateObj = new Date(date);
            newDateObj.setDate(newDateObj.getDate() + 1);
            date = newDateObj.toISOString().split('T')[0];
        }

        transportData.push([id, date, shiftedSeconds, transport, city, lat, lon, speed, direction]);
    });

    if (transportData.length > 0) {
        createTimeSlider();
    }

    await showStops();

}

function createTimeSlider() {
    if (timeSlider) {
        timeSlider.noUiSlider.destroy();
    }

    timeSlider = document.getElementById('timeSlider');
    noUiSlider.create(timeSlider, {
        start: [0, 3600], // начальные 0 - 1 час
        connect: true,
        step: 60,
        range: {
            'min': 0,
            'max': 86400
        },
        format: {
            to: v => Math.round(v),
            from: v => Number(v)
        }
    });

    timeSlider.noUiSlider.on('update', updatePolylineFromSlider);
}

function updatePolylineFromSlider() {
    const [startTime, endTime] = timeSlider.noUiSlider.get().map(v => parseInt(v));
    document.getElementById('startTimeLabel').textContent = secondsToHHMM(startTime);
    document.getElementById('endTimeLabel').textContent = secondsToHHMM(endTime);

    map.eachLayer(layer => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    const filteredPoints = transportData.filter(row => row[2] >= startTime && row[2] <= endTime);

    if (filteredPoints.length < 2) {
        if (busMarker) {
            map.removeLayer(busMarker);
            busMarker = null;
        }
        return;
    }

    const speeds = filteredPoints.map(row => row[7]);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    function getColor(speed) {
        if (speed <= 1) return 'rgb(255,0,0)'; 
        if (speed >= 11) return 'rgb(0,255,0)';
    
        if (speed <= 5) {
            const ratio = (speed - 1) / (5 - 1);
            return `rgb(255,${Math.round(165 * ratio)},0)`; 
        }
    
        if (speed <= 10) {
            const ratio = (speed - 5) / (10 - 5);
            return `rgb(255,${Math.round(165 + (90 * ratio))},0)`;
        }
    
        const ratio = (speed - 10) / (15 - 10);
        const r = Math.round(255 - (255 * ratio));
        return `rgb(${r},255,0)`;
    }
    

    for (let i = 0; i < filteredPoints.length - 1; i++) {
        const p1 = filteredPoints[i];
        const p2 = filteredPoints[i + 1];

        const latlngs = [
            [p1[5], p1[6]],
            [p2[5], p2[6]]
        ];

        const speed = p1[7]; 
        const color = getColor(speed);

        L.polyline(latlngs, { color: color, weight: 5 }).addTo(map);
    }

    const lastPoint = filteredPoints[filteredPoints.length - 1];

    if (busMarker) {
        busMarker.setLatLng([lastPoint[5], lastPoint[6]]);
    } else {
        busMarker = L.marker([lastPoint[5], lastPoint[6]], { icon: busIcon }).addTo(map);
    }

    map.fitBounds(L.polyline(filteredPoints.map(row => [row[5], row[6]])).getBounds());
}


function findNearestPoint() {
    const timeInput = document.getElementById('timeSelect').value;
    if (!timeInput) {
        alert('Выберите время');
        return;
    }

    const parts = timeInput.split(':');
    const selectedSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60;

    let nearestRow = null;
    let minDiff = Infinity;

    transportData.forEach(row => {
        const rowTime = row[2];
        const diff = Math.abs(rowTime - selectedSeconds);

        if (diff < minDiff) {
            minDiff = diff;
            nearestRow = row;
        }
    });

    if (nearestRow) {
        const lat = nearestRow[5];
        const lon = nearestRow[6];
        const date = nearestRow[1];
        const time = nearestRow[2];
        const speed = nearestRow[7];
        const direction = nearestRow[8];

        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`
            <b>Дата:</b> ${date}<br>
            <b>Время:</b> ${secondsToHHMM(time)}<br>
            <b>Широта:</b> ${lat}<br>
            <b>Долгота:</b> ${lon}<br>
            <b>Скорость:</b> ${speed} км/ч<br>
            <b>Направление:</b> ${direction}°
        `).openPopup();

        map.setView([lat, lon], 16);
    } else {
        alert('Нет данных для выбранного времени');
    }
}

let stopMarkers = [];

async function showStops() {
    const response = await fetch(`${apiBaseUrl}/stops`);
    const data = await response.json();

    // Удалим старые маркеры, если есть
    stopMarkers.forEach(marker => map.removeLayer(marker));
    stopMarkers = [];

    data.forEach(stop => {
        const [id, name, lat, lon] = stop;
        const marker = L.circleMarker([lat, lon], {
            radius: 6,
            color: 'blue',
            fillColor: 'blue',
            fillOpacity: 0.8
        }).addTo(map);

        marker.bindPopup(`<b>Остановка:</b> ${name}`);
        stopMarkers.push(marker);
    });
}


function startAnimation() {
    if (animationInterval) return;

    animationInterval = setInterval(() => {
        if (!timeSlider) return;

        let [startTime, endTime] = timeSlider.noUiSlider.get().map(v => parseInt(v));

        startTime += animationSpeed;
        endTime += animationSpeed;

        if (endTime > 86400) {
            pauseAnimation();
            return;
        }

        timeSlider.noUiSlider.set([startTime, endTime]);
    }, animationDelay);
}

function pauseAnimation() {
    clearInterval(animationInterval);
    animationInterval = null;
}
