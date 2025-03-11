// Visualization functions for CVRP Solver web app

// Map related variables
let map = null;
let routeLayerGroup = null;

// Route colors
const routeColors = [
    '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
    '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
];

// Function to display solution overview
function displaySolutionOverview(solution) {
    const solutionContainer = document.getElementById('solutionContainer');
    
    // Clear previous content
    solutionContainer.innerHTML = '';
    
    // Solution details
    const details = solution.details;
    
    // Create solution overview card
    const overviewCard = document.createElement('div');
    overviewCard.classList.add('row');
    
    overviewCard.innerHTML = `
        <div class="col-md-6">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Solution Summary</h5>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Total Distance 
                            <span class="badge bg-primary rounded-pill">${details.total_distance.toFixed(2)}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Number of Routes 
                            <span class="badge bg-primary rounded-pill">${details.routes.length}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Vehicle Capacity 
                            <span class="badge bg-primary rounded-pill">${details.routes[0].capacity}</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Routes Overview</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Route</th>
                                    <th>Stops</th>
                                    <th>Load</th>
                                    <th>Distance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.routes.map((route, index) => `
                                    <tr>
                                        <td>
                                            <span class="badge" style="background-color: ${routeColors[index % routeColors.length]}">
                                                ${route.id}
                                            </span>
                                        </td>
                                        <td>${route.stops.length - 2}</td>
                                        <td>${route.load}/${route.capacity}</td>
                                        <td>${route.distance.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    solutionContainer.appendChild(overviewCard);
}

// Function to display route details
function displayRouteDetails(solution) {
    const routeDetailsContainer = document.getElementById('routeDetailsContainer');
    
    // Clear previous content
    routeDetailsContainer.innerHTML = '';
    
    // Solution details
    const details = solution.details;
    
    // Create route details cards
    const routesContainer = document.createElement('div');
    routesContainer.classList.add('row');
    
    details.routes.forEach((route, index) => {
        const routeCard = document.createElement('div');
        routeCard.classList.add('col-md-6', 'mb-3');
        
        // Get route color
        const routeColor = routeColors[index % routeColors.length];
        
        // Create load percentage
        const loadPercentage = (route.load / route.capacity) * 100;
        const loadProgressColor = loadPercentage > 90 ? 'danger' : 
                                 loadPercentage > 75 ? 'warning' : 'success';
        
        routeCard.innerHTML = `
            <div class="card route-card route-${route.id}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="card-title mb-0">
                        <span class="badge" style="background-color: ${routeColor}">Route ${route.id}</span>
                    </h6>
                    <span class="text-muted small">Distance: ${route.distance.toFixed(2)}</span>
                </div>
                <div class="card-body">
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1">
                            <span>Load: ${route.load}/${route.capacity}</span>
                            <span>${loadPercentage.toFixed(0)}%</span>
                        </div>
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar bg-${loadProgressColor}" 
                                role="progressbar" 
                                style="width: ${loadPercentage}%"
                                aria-valuenow="${loadPercentage}" 
                                aria-valuemin="0" 
                                aria-valuemax="100"></div>
                        </div>
                    </div>
                    
                    <h6 class="card-subtitle mb-2 text-muted">Stops:</h6>
                    <ol class="list-group list-group-numbered">
                        ${route.stops.map((stop, stopIndex) => {
                            // Skip first and last stop (depot) in the numbered list
                            if (stopIndex === 0 || stopIndex === route.stops.length - 1) {
                                return '';
                            }
                            return `
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    ${stop.name}
                                    <span class="badge bg-secondary rounded-pill">Node ${stop.index}</span>
                                </li>
                            `;
                        }).join('')}
                    </ol>
                    <div class="text-center mt-2">
                        <span class="badge bg-light text-dark">
                            <i class="fas fa-arrow-right me-1"></i> Return to ${route.stops[0].name}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        routesContainer.appendChild(routeCard);
    });
    
    routeDetailsContainer.appendChild(routesContainer);
}

// Function to visualize solution on map
function visualizeSolutionOnMap(solution) {
    const mapContainer = document.getElementById('mapContainer');
    
    // Clear previous content
    mapContainer.innerHTML = '';
    
    // Get coordinates and routes
    const coordinates = solution.coordinates;
    const routes = solution.routes;
    const depot = solution.depot;
    
    // Initialize map if not already
    if (!map) {
        // Calculate center of map
        let centerLat = 0;
        let centerLng = 0;
        coordinates.forEach(coord => {
            centerLat += coord[0];
            centerLng += coord[1];
        });
        centerLat /= coordinates.length;
        centerLng /= coordinates.length;
        
        // Create map
        map = L.map(mapContainer).setView([centerLat, centerLng], 13);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Create layer group for routes
        routeLayerGroup = L.layerGroup().addTo(map);
    } else {
        // Clear previous routes
        routeLayerGroup.clearLayers();
        
        // Ensure map container is visible
        map.invalidateSize();
    }
    
    // Add depot marker
    const depotIcon = L.divIcon({
        html: `<div style="background-color: #d9534f; color: white; border-radius: 50%; width: 30px; height: 30px; 
              display: flex; align-items: center; justify-content: center; font-weight: bold;">D</div>`,
        className: 'depot-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    L.marker([coordinates[depot][0], coordinates[depot][1]], {icon: depotIcon})
        .bindTooltip(`Depot (Node ${depot})`, {permanent: false})
        .addTo(routeLayerGroup);
    
    // Add customer markers and routes
    routes.forEach((route, routeIndex) => {
        const routeColor = routeColors[routeIndex % routeColors.length];
        
        // Create route path including depot -> customers -> depot
        const routePath = [];
        
        // Add depot as first point
        routePath.push([coordinates[depot][0], coordinates[depot][1]]);
        
        // Add markers for each customer in the route
        route.forEach(customer => {
            // Add customer marker
            const customerIcon = L.divIcon({
                html: `<div style="background-color: #5bc0de; color: white; border-radius: 50%; width: 24px; height: 24px; 
                      display: flex; align-items: center; justify-content: center; font-weight: bold;">${customer}</div>`,
                className: 'customer-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            L.marker([coordinates[customer][0], coordinates[customer][1]], {icon: customerIcon})
                .bindTooltip(`Customer ${customer}`, {permanent: false})
                .addTo(routeLayerGroup);
            
            // Add to route path
            routePath.push([coordinates[customer][0], coordinates[customer][1]]);
        });
        
        // Add depot as last point to close the route
        routePath.push([coordinates[depot][0], coordinates[depot][1]]);
        
        // Create polyline for the route
        const routePolyline = L.polyline(routePath, {
            color: routeColor,
            weight: 4,
            opacity: 0.7,
            className: 'route-path'
        }).addTo(routeLayerGroup);
        
        // Add route number at the middle point of the first segment
        if (route.length > 0) {
            const midLat = (coordinates[depot][0] + coordinates[route[0]][0]) / 2;
            const midLng = (coordinates[depot][1] + coordinates[route[0]][1]) / 2;
            
            const routeLabel = L.divIcon({
                html: `<div style="background-color: white; color: ${routeColor}; border: 2px solid ${routeColor}; 
                      border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; 
                      justify-content: center; font-weight: bold; font-size: 12px;">${routeIndex + 1}</div>`,
                className: 'route-label',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            L.marker([midLat, midLng], {icon: routeLabel}).addTo(routeLayerGroup);
        }
    });
    
    // Fit map to bounds
    const bounds = routeLayerGroup.getBounds();
    map.fitBounds(bounds, {padding: [30, 30]});
}

// Function to show convergence plot
function showConvergencePlot(costHistory, tempHistory) {
    const convergencePlotContainer = document.getElementById('convergencePlotContainer');
    
    // Clear previous content and create canvas
    convergencePlotContainer.innerHTML = '<canvas id="convergenceChart"></canvas>';
    
    // Create chart
    const ctx = document.getElementById('convergenceChart').getContext('2d');
    
    // Prepare data
    const iterations = Array.from({length: costHistory.length}, (_, i) => i);
    
    // Create chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: iterations,
            datasets: [
                {
                    label: 'Best Cost',
                    data: costHistory,
                    borderColor: '#36a2eb',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: 'Temperature',
                    data: tempHistory,
                    borderColor: '#ff6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Convergence of Simulated Annealing'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Iteration'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Best Cost'
                    }
                },
                y1: {
                    type: 'logarithmic',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Temperature'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}