document.getElementById('addStopForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('stopName').value;
    const lat = parseFloat(document.getElementById('stopLat').value);
    const lon = parseFloat(document.getElementById('stopLon').value);

    const params = new URLSearchParams({ name, latitude: lat, longitude: lon });

    try {
        const response = await fetch(`${apiBaseUrl}/stops/add?${params.toString()}`, {
            method: 'POST'
        });

        const result = await response.json();
        if (response.ok) {
            alert('Остановка добавлена!');
            document.getElementById('addStopForm').reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById('addStopModal'));
            modal.hide();
            await showStops(); // обновим остановки на карте
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка при запросе: ' + error);
    }
});
