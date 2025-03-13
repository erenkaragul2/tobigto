// Enhanced route details display
// This script improves the route information display in the results tab

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced route display functionality...");
    
    // Override the original displayRouteDetails function
    function displayRouteDetails(solution) {
        const routeDetailsContainer = document.getElementById('routeDetailsContainer');
        
        // Clear previous content
        routeDetailsContainer.innerHTML = '';
        
        // Create section header
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'mb-3';
        sectionHeader.innerHTML = `
            <h4 class="mb-3">
                <i class="fas fa-route me-2"></i>Detailed Route Information
            </h4>
        `;
        routeDetailsContainer.appendChild(sectionHeader);
        
        // Solution details
        const details = solution.details;
        const coordinates = solution.coordinates;
        const depot = solution.depot || 0;
        
        // Create route details cards
        const routesContainer = document.createElement('div');
        routesContainer.className = 'row';
        
        details.routes.forEach((route, index) => {
            const routeCard = document.createElement('div');
            routeCard.className = 'col-md-6 mb-4';
            
            // Get route color
            const routeColor = getRouteColor(index);
            
            // Create load percentage
            const loadPercentage = (route.load / route.capacity) * 100;
            const loadProgressColor = loadPercentage > 90 ? 'danger' : 
                                     loadPercentage > 75 ? 'warning' : 'success';
            
            // Convert route distance from meters to kilometers
            const routeDistanceKm = (route.distance / 1000).toFixed(2);
            
            // Build Google Maps URL for this route
            let googleMapsUrl = '';
            
            // Get depot coordinates
            const depotCoord = coordinates[depot];
            if (depotCoord && depotCoord.length >= 2) {
                const depotLatLng = `${depotCoord[0]},${depotCoord[1]}`;
                
                // Build waypoints for the route
                const waypoints = [];
                
                // Skip first and last stop (depot)
                const routeCustomers = route.stops.slice(1, -1);
                
                // Add each customer to waypoints
                routeCustomers.forEach(stop => {
                    const coord = coordinates[stop.index];
                    if (coord && coord.length >= 2) {
                        waypoints.push(`${coord[0]},${coord[1]}`);
                    }
                });
                
                // Create the Google Maps URL
                if (waypoints.length > 0) {
                    const waypointsParam = `&waypoints=${waypoints.join('|')}`;
                    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${depotLatLng}&destination=${depotLatLng}${waypointsParam}&travelmode=driving`;
                }
            }
            
            // Start building card content
            let cardContent = `
                <div class="card shadow-sm route-card route-${route.id}">
                    <div class="card-header d-flex justify-content-between align-items-center" 
                         style="background-color: ${routeColor}15; border-left: 5px solid ${routeColor};">
                        <h5 class="card-title mb-0">
                            <span class="badge rounded-pill" style="background-color: ${routeColor}">Route ${route.id}</span>
                            <span class="ms-2 text-dark">Distance: ${routeDistanceKm} km</span>
                        </h5>
                        <button type="button" class="btn btn-sm btn-outline-secondary route-detail-toggle" 
                                data-bs-toggle="collapse" data-bs-target="#routeDetails${index}">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <div class="card-body p-0">
                        <div class="p-3">
                            <div class="mb-3">
                                <div class="d-flex justify-content-between mb-1">
                                    <span><strong>Load:</strong> ${route.load}/${route.capacity}</span>
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
                            
                            <div class="d-flex justify-content-between mb-2">
                                <div>
                                    <strong>Stops:</strong> ${route.stops.length - 2} customers
                                </div>
                                <div>
                                    <strong>Total Load:</strong> ${route.load} units
                                </div>
                            </div>
                            
                            <!-- NEW: Google Maps Link -->
                            ${googleMapsUrl ? `
                            <div class="mt-2">
                                <a href="${googleMapsUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                                    <i class="fas fa-map-marker-alt me-1"></i> View in Google Maps
                                </a>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="collapse" id="routeDetails${index}">
                            <div class="table-responsive">
                                <table class="table table-striped table-sm m-0">
                                    <thead>
                                        <tr>
                                            <th>Order</th>
                                            <th>Stop</th>
                                            <th>Node</th>
                                            <th>Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `;
            
            // Add all stops in the route
            route.stops.forEach((stop, stopIndex) => {
                const isDepot = stopIndex === 0 || stopIndex === route.stops.length - 1;
                const stopType = isDepot ? 'Depot' : 'Customer';
                const iconClass = isDepot ? 'fa-warehouse text-danger' : 'fa-box text-primary';
                
                cardContent += `
                    <tr>
                        <td>${stopIndex}</td>
                        <td><i class="fas ${iconClass} me-2"></i>${stop.name}</td>
                        <td>${stop.index}</td>
                        <td>${stopType}</td>
                    </tr>
                `;
            });
            
            // Close table and add mini-map
            cardContent += `
                                    </tbody>
                                </table>
                            </div>
                            <div class="route-mini-map" id="routeMiniMap${index}" style="height: 200px; width: 100%;"></div>
                        </div>
                    </div>
                </div>
            `;
            
            routeCard.innerHTML = cardContent;
            routesContainer.appendChild(routeCard);
        });
        
        routeDetailsContainer.appendChild(routesContainer);
        
        // After adding all cards to the DOM, initialize mini-maps
        details.routes.forEach((route, index) => {
            // Wait for the collapse to be shown before initializing the map
            const collapseElement = document.getElementById(`routeDetails${index}`);
            if (collapseElement) {
                collapseElement.addEventListener('shown.bs.collapse', function () {
                    initMiniMap(route, index, solution.coordinates, solution.depot);
                });
            }
        });
        
        // Add toggle all button
        const toggleAllBtn = document.createElement('button');
        toggleAllBtn.className = 'btn btn-outline-secondary mb-3';
        toggleAllBtn.innerHTML = '<i class="fas fa-expand-alt me-2"></i>Expand/Collapse All Routes';
        toggleAllBtn.onclick = function() {
            const allCollapses = document.querySelectorAll('.route-detail-toggle');
            const anyExpanded = Array.from(allCollapses).some(btn => 
                btn.getAttribute('aria-expanded') === 'true');
            
            allCollapses.forEach(btn => {
                const target = document.querySelector(btn.getAttribute('data-bs-target'));
                if (anyExpanded) {
                    bootstrap.Collapse.getInstance(target)?.hide();
                } else {
                    new bootstrap.Collapse(target, {show: true});
                }
            });
        };
        
        // Insert toggle button at the top
        routeDetailsContainer.insertBefore(toggleAllBtn, routesContainer);
    }
    
    // Helper function to get route color (unchanged)
    function getRouteColor(index) {
        const routeColors = [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
            '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
        ];
        return routeColors[index % routeColors.length];
    }
    
    // Initialize mini-map for each route
    function initMiniMap(route, index, coordinates, depotIndex) {
        const mapId = `routeMiniMap${index}`;
        const mapElement = document.getElementById(mapId);
        
        if (!mapElement) {
            console.error(`Map element not found: ${mapId}`);
            return;
        }
        
        // Check if map is already initialized
        if (mapElement.getAttribute('data-initialized') === 'true') {
            return;
        }
        
        try {
            // Create mini-map
            const miniMap = L.map(mapId, {
                zoomControl: false,
                attributionControl: false
            });
            
            // Add base tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(miniMap);
            
            // Get route color
            const routeColor = getRouteColor(index);
            
            // Create path array
            const routePath = [];
            
            // Get depot coordinates
            const depotCoords = coordinates[depotIndex];
            
            // Add depot as first point
            routePath.push([parseFloat(depotCoords[0]), parseFloat(depotCoords[1])]);
            
            // Add route bounds for zooming
            const bounds = L.latLngBounds([parseFloat(depotCoords[0]), parseFloat(depotCoords[1])]);
            
            // Add customer markers and build path
            const routeStops = route.stops.slice(1, -1); // Skip first and last (depot)
            
            routeStops.forEach((stop) => {
                const customerCoords = coordinates[stop.index];
                const lat = parseFloat(customerCoords[0]);
                const lng = parseFloat(customerCoords[1]);
                
                // Add customer coordinates to path
                routePath.push([lat, lng]);
                
                // Add to bounds
                bounds.extend([lat, lng]);
                
                // Add customer marker
                L.circleMarker([lat, lng], {
                    radius: 5,
                    fillColor: '#4285F4',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(miniMap);
            });
            
            // Add depot as last point
            routePath.push([parseFloat(depotCoords[0]), parseFloat(depotCoords[1])]);
            
            // Add depot marker
            L.circleMarker([parseFloat(depotCoords[0]), parseFloat(depotCoords[1])], {
                radius: 7,
                fillColor: '#d9534f',
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(miniMap);
            
            // Create polyline for the route
            L.polyline(routePath, {
                color: routeColor,
                weight: 3,
                opacity: 0.7
            }).addTo(miniMap);
            
            // Fit map to bounds
            miniMap.fitBounds(bounds, {
                padding: [10, 10]
            });
            
            // Mark as initialized
            mapElement.setAttribute('data-initialized', 'true');
            
        } catch (error) {
            console.error(`Error initializing mini-map: ${error.message}`);
            mapElement.innerHTML = `<div class="alert alert-danger m-2">Error loading map: ${error.message}</div>`;
        }
    }
    
    // Add a modified display function to handle the solution results
    window.displaySolutionResults = function(data) {
        console.log("Displaying enhanced solution results");
        
        const solution = data.solution;
        
        // Display solution overview
        displaySolutionOverview(solution);
        
        // Display enhanced route details
        displayRouteDetails(solution);
        
        // Keep the map and convergence plot but make them collapsible
        makeSectionCollapsible("mapContainer", "Route Map");
        makeSectionCollapsible("convergencePlotContainer", "Convergence Plot");
        
        // Still initialize visualization if needed (but hidden by default)
        if (typeof visualizeSolutionOnMap === 'function') {
            visualizeSolutionOnMap(solution);
        }
        
        if (typeof showConvergencePlot === 'function' && data.cost_history && data.temp_history) {
            showConvergencePlot(data.cost_history, data.temp_history);
        }
    };
    
    // Helper function to make a section collapsible
    function makeSectionCollapsible(containerId, title) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Skip if already processed
        if (container.getAttribute('data-processed') === 'true') return;
        
        // Get parent elements
        const card = container.closest('.card');
        if (!card) return;
        
        const cardBody = container.closest('.card-body');
        if (!cardBody) return;
        
        // Add collapse functionality to card header
        const cardHeader = card.querySelector('.card-header');
        if (cardHeader) {
            // Add toggle button
            cardHeader.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">
                        <i class="fas fa-map-marked-alt me-2"></i>${title}
                    </h5>
                    <button class="btn btn-sm btn-outline-secondary" type="button" 
                            data-bs-toggle="collapse" data-bs-target="#${containerId}Collapse" 
                            aria-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            `;
            
            // Wrap container in collapse div
            const collapseDiv = document.createElement('div');
            collapseDiv.className = 'collapse';
            collapseDiv.id = `${containerId}Collapse`;
            
            // Move container into collapse div
            cardBody.insertBefore(collapseDiv, container);
            collapseDiv.appendChild(container);
            
            // Mark as processed
            container.setAttribute('data-processed', 'true');
        }
    }
    
    console.log("Enhanced route display functionality loaded");
});