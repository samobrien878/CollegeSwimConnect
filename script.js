// Global favorites array
var favorites = [];

// Initialize the map
var map = L.map('map').setView([39.8283, -98.5795], 3.5);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 18
}).addTo(map);

// Marker cluster setup
var markers = L.markerClusterGroup({
    maxClusterRadius: 50,
    disableClusteringAtZoom: 10,
    iconCreateFunction: function(cluster) {
        return L.divIcon({
            html: `<div style="width: 30px; height: 30px;">${cluster.getChildCount()}</div>`,
            className: 'marker-cluster',
            iconSize: L.point(30, 30)
        });
    }
});
map.addLayer(markers);

// Utility functions for filtering
function getSelectedDivisions() {
    const selected = Array.from(document.querySelectorAll('.toggle-btn[data-division].active'))
        .map(btn => btn.getAttribute('data-division'));
    return selected.length > 0 ? selected : ['D1', 'D2', 'D3'];
}

function getSelectedCampuses() {
    const selected = Array.from(document.querySelectorAll('.toggle-btn[data-campus].active'))
        .map(btn => btn.getAttribute('data-campus'));
    return selected.length > 0 ? selected : null;
}

// Load JSON data and set up markers and filter buttons
fetch('./schools_real_updated (1).json')
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        var allMarkers = [];
        
        // Create markers and bind popups
        data.forEach(school => {
            if (!school.lat || !school.lon) return;
            
            // Popup content
            var popupContent = `
                <b style="font-size: 14px;">${school.school}</b><br>
                <b>Location:</b> ${school.location}<br>
                <b>Campus:</b> ${school.campus_type}<br>
                <b>Population:</b> ${school.student_population.toLocaleString()}<br>
                <b>Division:</b> ${school.division}<br>
                <button onclick="addToFavorites('${school.school}', '${school.location}', '${school.campus_type}', '${school.division}')">⭐ Favorite</button>
            `;
            
            // Marker style based on division
            var marker = L.circleMarker([school.lat, school.lon], {
                radius: 10,
                className: 'custom-marker',
                fillColor: school.division === "D1" ? "#0073E6" : 
                           school.division === "D2" ? "#FFA500" : "#FFD700",
                color: "#FFFFFF",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).bindPopup(popupContent);
            
            allMarkers.push({ marker: marker, data: school });
        });

        // Dynamically populate Campus Type buttons
        var campusContainer = document.getElementById("campus-filter");
        var campusTypes = [...new Set(data.map(s => s.campus_type))];
        campusTypes.forEach(type => {
            var btn = document.createElement("button");
            btn.className = "toggle-btn";
            btn.setAttribute("data-campus", type);
            btn.textContent = type;
            btn.addEventListener('click', function() {
                this.classList.toggle('active');
                updateMap();
            });
            campusContainer.appendChild(btn);
        });

        // Event listeners for Division buttons
        document.querySelectorAll('.toggle-btn[data-division]').forEach(btn => {
            btn.addEventListener('click', function() {
                this.classList.toggle('active');
                updateMap();
            });
        });

        function updateMap() {
            var divisions = getSelectedDivisions();
            var campuses = getSelectedCampuses();
            var maxPop = parseInt(document.getElementById("population").value);
            document.getElementById("pop-value").textContent = maxPop.toLocaleString();

            markers.clearLayers();
            allMarkers.forEach(m => {
                const matchesDivision = divisions.includes(m.data.division);
                const matchesCampus = !campuses || campuses.includes(m.data.campus_type);
                const matchesPopulation = m.data.student_population <= maxPop;
                
                if (matchesDivision && matchesCampus && matchesPopulation) {
                    markers.addLayer(m.marker);
                }
            });
        }

        function resetFilters() {
            document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById("population").value = 70000;
            document.getElementById("pop-value").textContent = "70,000";
            updateMap();
        }

        document.getElementById("population").addEventListener("input", updateMap);
        document.getElementById("reset-btn").addEventListener("click", resetFilters);

        // Initial map update
        updateMap();
    })
    .catch(error => console.error('Error:', error));

// Favorites functions
function addToFavorites(name, location, campus, division) {
    if (!favorites.some(item => item.name === name)) {
        favorites.push({ name, location, campus, division });
        updateFavoritesList();
    }
}

function removeFromFavorites(name) {
    favorites = favorites.filter(item => item.name !== name);
    updateFavoritesList();
}

function updateFavoritesList() {
    var favList = document.getElementById("favorites-list");
    favList.innerHTML = "";
    favorites.forEach(item => {
        var div = document.createElement("div");
        div.className = "favorite-item";
        div.innerHTML = `<span><b>${item.name}</b> - ${item.location} (${item.division})</span>
                         <button class="remove-btn" onclick="removeFromFavorites('${item.name}')">❌</button>`;
        favList.appendChild(div);
    });
}

async function downloadPDF() {
    if (favorites.length === 0) {
        alert("No favorites to download!");
        return;
    }
    // Create temporary container for favorites list
    var tempContainer = document.createElement("div");
    tempContainer.style.padding = "20px";
    tempContainer.style.background = "white";
    tempContainer.innerHTML = `<h2 style="text-align:center; color:#0073E6;">Swim Connect Favorites</h2>`;
    favorites.forEach((item, index) => {
        tempContainer.innerHTML += `<p>${index+1}. <b>${item.name}</b> - ${item.location} (${item.division})</p>`;
    });
    document.body.appendChild(tempContainer);
    // Convert container to image using html2canvas
    const canvas = await html2canvas(tempContainer);
    const imgData = canvas.toDataURL('image/png');
    var { jsPDF } = window.jspdf;
    var pdf = new jsPDF();
    pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
    pdf.save("Swim_Connect_Favorites.pdf");
    document.body.removeChild(tempContainer);
}

// Modal logic
document.addEventListener("DOMContentLoaded", function() {
    // Show the SwimCloud modal on page load
    document.getElementById('swimcloud-modal').style.display = 'block';
});

// Process SwimCloud lookup form submission
document.getElementById('swimcloud-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const swimcloudLink = document.getElementById('swimcloud-link').value.trim();
    const gender = document.getElementById('gender').value.trim();

    // Show a loading message
    document.getElementById('swimcloud-results').innerHTML = '<p>Loading...</p>';

    try {
        const response = await fetch('/process-swimcloud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ swimmer_url: swimcloudLink, gender: gender })
        });
        if (!response.ok) throw new Error("Network error while fetching swimmer data.");
        const result = await response.json();

        // Display the returned JSON result
        document.getElementById('swimcloud-results').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
        
        // OPTIONAL: Hide the modal after successful lookup
        // document.getElementById('swimcloud-modal').style.display = 'none';
        
        // Store the JSON globally for later integration with map pop-ups
        window.swimcloudData = result;
    } catch (error) {
        document.getElementById('swimcloud-results').innerHTML = `<p>Error: ${error.message}</p>`;
    }
});
