// Fixed Google Maps implementation that avoids duplicate loading errors
// Save this as static/js/fixed-maps.js

// Global variables
let map = null;
let directionsService = null;
let directionsRenderers = [];
let markers = [];
let mapInitialized = false;
let mapInitializationInProgress = false;

// Route colors (for consistent coloring)
const routeColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
];

/**
 * Initialize the map once when needed
 */
function initializeMap(container, coordinates) {
    // Prevent multiple initializations
    if (mapInitialized || mapInitializationInProgress) {
        return;
    }
    
    mapInitializationInProgress = true;
    console.log("Initializing map");
    
    try {
        // Calculate map center from coordinates if available
        let center = {lat: 0, lng: 0};
        
        if (coordinates && coordinates.length > 0) {
            let totalLat = 0, totalLng = 0;
            let validPoints = 0;
            
            coordinates.forEach(coord => {
                if (coord && coord.length >= 2) {
                    let lat = parseFloat(coord[0]);
                    let lng = parseFloat(coord[1]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        totalLat += lat;
                        totalLng += lng;
                        validPoints++;
                    }
                }
            });
            
            if (validPoints > 0) {
                center = {
                    lat: totalLat / validPoints,
                    lng: totalLng / validPoints
                };
            }
        }
        
        // Get map container element
        const mapContainer = container || document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error("Map container not found");
            return;
        }
        
        // Create the map
        map = new google.maps.Map(mapContainer, {
            center: center,
            zoom: 10,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            fullscreenControl: true
        });
        
        // Create directions service
        directionsService = new google.maps.DirectionsService();
        
        mapInitialized = true;
        mapInitializationInProgress = false;
        console.log("Map initialization complete");
    } catch (error) {
        console.error("Error initializing map:", error);
        mapInitializationInProgress = false;
        
        // Show error in map container
        const mapContainer = container || document.getElementById('mapContainer');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="alert alert-danger m-3">
                    <strong>Error initializing map:</strong> ${error.message}
                </div>
            `;
        }
    }
}

/**
 * Clear all map elements (markers and routes)
 */
function clearMapElements() {
    // Clear markers
    markers.forEach(marker => {
        marker.setMap(null);
    });
    markers = [];
    
    // Clear direction renderers
    directionsRenderers.forEach(renderer => {
        if (renderer instanceof google.maps.DirectionsRenderer) {
            renderer.setMap(null);
        } else if (renderer instanceof google.maps.Polyline) {
            renderer.setMap(null);
        }
    });
    directionsRenderers = [];
}

/**
 * Main function to visualize solution on map
 */
function visualizeSolutionOnMap(solution) {
    console.log("Visualizing solution");
    
    // Check if we have Google Maps loaded
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error("Google Maps not loaded");
        showMapMessage("Google Maps could not be loaded. Check your internet connection and try again.", "danger");
        return;
    }
    
    // Validate solution data
    if (!solution || !solution.coordinates || !solution.routes) {
        console.error("Invalid solution data");
        showMapMessage("Invalid solution data", "danger");
        return;
    }
    
    const coordinates = solution.coordinates;
    const routes = solution.routes;
    const depot = solution.depot || 0;
    
    // Get map container
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
        console.error("Map container not found");
        return;
    }
    
    // Initialize map if needed
    if (!mapInitialized) {
        initializeMap(mapContainer, coordinates);
    }
    
    // Clear existing elements
    clearMapElements();
    
    // Create bounds for auto-zooming
    const bounds = new google.maps.LatLngBounds();
    
    // Add depot marker
    if (depot >= 0 && depot < coordinates.length) {
        const depotPos = {
            lat: parseFloat(coordinates[depot][0]),
            lng: parseFloat(coordinates[depot][1])
        };
        
        // Add depot to bounds
        bounds.extend(depotPos);
        
        // Create depot marker
        const depotMarker = new google.maps.Marker({
            position: depotPos,
            map: map,
            icon: {
                url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23d9534f' stroke='white' stroke-width='2'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='10' font-weight='bold'%3ED%3C/text%3E%3C/svg%3E",
                size: new google.maps.Size(24, 24),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
            },
            title: `Depot (Node ${depot})`
        });
        
        markers.push(depotMarker);
    }
    
    // Show loading message
    showMapMessage("Calculating routes...", "info");
    
    // Use simple straight lines if requested
    const useSimpleRoutes = document.getElementById('useSimpleRoutes')?.checked || false;
    
    if (useSimpleRoutes) {
        // Draw straight line routes
        drawStraightLineRoutes(routes, coordinates, depot, bounds);
    } else {
        // Draw actual road routes
        drawRoadRoutes(routes, coordinates, depot, bounds);
    }
}

/**
 * Draw straight line routes (simple polylines)
 */
function drawStraightLineRoutes(routes, coordinates, depot, bounds) {
    console.log("Drawing straight line routes");
    
    // Process each route
    routes.forEach((route, routeIndex) => {
        const routeColor = routeColors[routeIndex % routeColors.length];
        const routePoints = [];
        
        // Add depot as first point
        if (depot >= 0 && depot < coordinates.length) {
            routePoints.push({
                lat: parseFloat(coordinates[depot][0]),
                lng: parseFloat(coordinates[depot][1])
            });
        }
        
        // Add all customer points
        route.forEach(customer => {
            if (customer >= 0 && customer < coordinates.length) {
                const pos = {
                    lat: parseFloat(coordinates[customer][0]),
                    lng: parseFloat(coordinates[customer][1])
                };
                
                // Add to bounds
                bounds.extend(pos);
                
                // Add to route points
                routePoints.push(pos);
                
                // Create customer marker
                const customerMarker = new google.maps.Marker({
                    position: pos,
                    map: map,
                    icon: {
                        url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='%234285F4' stroke='white' stroke-width='1'/%3E%3Ctext x='10' y='13' text-anchor='middle' fill='white' font-size='9' font-weight='bold'%3E${customer}%3C/text%3E%3C/svg%3E`,
                        size: new google.maps.Size(20, 20),
                        scaledSize: new google.maps.Size(20, 20),
                        anchor: new google.maps.Point(10, 10)
                    },
                    title: `Customer ${customer}`
                });
                
                markers.push(customerMarker);
            }
        });
        
        // Add depot as last point to close the route
        if (depot >= 0 && depot < coordinates.length) {
            routePoints.push({
                lat: parseFloat(coordinates[depot][0]),
                lng: parseFloat(coordinates[depot][1])
            });
        }
        
        // Draw the route
        if (routePoints.length > 1) {
            const routePath = new google.maps.Polyline({
                path: routePoints,
                geodesic: true,
                strokeColor: routeColor,
                strokeOpacity: 0.8,
                strokeWeight: 3
            });
            
            routePath.setMap(map);
            directionsRenderers.push(routePath);
        }
        
        // Add route label near the first segment
        if (routePoints.length >= 2) {
            // Calculate position for label (middle of first segment)
            const p1 = routePoints[0];
            const p2 = routePoints[1];
            const labelPos = {
                lat: (p1.lat + p2.lat) / 2,
                lng: (p1.lng + p2.lng) / 2
            };
            
            // Create the label
            const routeLabel = new google.maps.Marker({
                position: labelPos,
                map: map,
                icon: {
                    url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='white' stroke='${encodeURIComponent(routeColor)}' stroke-width='2'/%3E%3Ctext x='10' y='13' text-anchor='middle' fill='${encodeURIComponent(routeColor)}' font-size='9' font-weight='bold'%3E${routeIndex + 1}%3C/text%3E%3C/svg%3E`,
                    size: new google.maps.Size(20, 20),
                    scaledSize: new google.maps.Size(20, 20),
                    anchor: new google.maps.Point(10, 10)
                },
                title: `Route ${routeIndex + 1}`
            });
            
            markers.push(routeLabel);
        }
    });
    
    // Fit map to bounds
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
    }
    
    // Clear loading message
    removeMapMessages();
    showMapMessage("Routes visualized using straight lines", "success", 3000);
}

/**
 * Draw road routes using Google Directions API
 */
function drawRoadRoutes(routes, coordinates, depot, bounds) {
    console.log("Drawing road routes");
    
    // Process routes sequentially to avoid hitting API limits
    let routeIndex = 0;
    
    function processNextRoute() {
        if (routeIndex >= routes.length) {
            // All routes processed
            // Fit map to bounds
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds);
            }
            
            // Remove progress message
            removeMapMessages();
            showMapMessage("Routes visualized using actual roads", "success", 3000);
            return;
        }
        
        const route = routes[routeIndex];
        const routeColor = routeColors[routeIndex % routeColors.length];
        
        // Show progress
        showMapMessage(`Calculating road routes (${routeIndex + 1}/${routes.length})...`, "info");
        
        // Add customer markers for this route
        route.forEach(customer => {
            if (customer >= 0 && customer < coordinates.length) {
                const pos = {
                    lat: parseFloat(coordinates[customer][0]),
                    lng: parseFloat(coordinates[customer][1])
                };
                
                // Add to bounds
                bounds.extend(pos);
                
                // Create customer marker
                const customerMarker = new google.maps.Marker({
                    position: pos,
                    map: map,
                    icon: {
                        url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='%234285F4' stroke='white' stroke-width='1'/%3E%3Ctext x='10' y='13' text-anchor='middle' fill='white' font-size='9' font-weight='bold'%3E${customer}%3C/text%3E%3C/svg%3E`,
                        size: new google.maps.Size(20, 20),
                        scaledSize: new google.maps.Size(20, 20),
                        anchor: new google.maps.Point(10, 10)
                    },
                    title: `Customer ${customer}`
                });
                
                markers.push(customerMarker);
            }
        });
        
        // If we have no customers in this route, skip to next route
        if (route.length === 0) {
            routeIndex++;
            setTimeout(processNextRoute, 10);
            return;
        }
        
        // Get depot position
        const depotPos = {
            lat: parseFloat(coordinates[depot][0]),
            lng: parseFloat(coordinates[depot][1])
        };
        
        // For a single customer, just draw a simple route
        if (route.length === 1) {
            const customerPos = {
                lat: parseFloat(coordinates[route[0]][0]),
                lng: parseFloat(coordinates[route[0]][1])
            };
            
            // Draw a straight line from depot to customer and back
            const routePath = new google.maps.Polyline({
                path: [depotPos, customerPos, depotPos],
                geodesic: true,
                strokeColor: routeColor,
                strokeOpacity: 0.8,
                strokeWeight: 3
            });
            
            routePath.setMap(map);
            directionsRenderers.push(routePath);
            
            // Add route label near the first segment
            const labelPos = {
                lat: (depotPos.lat + customerPos.lat) / 2,
                lng: (depotPos.lng + customerPos.lng) / 2
            };
            
            // Create the label
            const routeLabel = new google.maps.Marker({
                position: labelPos,
                map: map,
                icon: {
                    url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='white' stroke='${encodeURIComponent(routeColor)}' stroke-width='2'/%3E%3Ctext x='10' y='13' text-anchor='middle' fill='${encodeURIComponent(routeColor)}' font-size='9' font-weight='bold'%3E${routeIndex + 1}%3C/text%3E%3C/svg%3E`,
                    size: new google.maps.Size(20, 20),
                    scaledSize: new google.maps.Size(20, 20),
                    anchor: new google.maps.Point(10, 10)
                },
                title: `Route ${routeIndex + 1}`
            });
            
            markers.push(routeLabel);
            
            // Move to next route
            routeIndex++;
            setTimeout(processNextRoute, 300);
            return;
        }
        
        // Create waypoints for all customers in the route
        const waypoints = route.map(customer => {
            return {
                location: new google.maps.LatLng(
                    parseFloat(coordinates[customer][0]),
                    parseFloat(coordinates[customer][1])
                ),
                stopover: true
            };
        });
        
        // Create route request
        const request = {
            origin: depotPos,
            destination: depotPos,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
        };
        
        // Make the request to the Directions service
        directionsService.route(request, function(response, status) {
            if (status === 'OK') {
                // Create a directions renderer with custom options
                const directionsRenderer = new google.maps.DirectionsRenderer({
                    map: map,
                    directions: response,
                    suppressMarkers: true, // Use our own markers
                    polylineOptions: {
                        strokeColor: routeColor,
                        strokeOpacity: 0.8,
                        strokeWeight: 4
                    }
                });
                
                directionsRenderers.push(directionsRenderer);
                
                // Add route label near the start of the route
                if (response.routes[0] && response.routes[0].legs[0]) {
                    const leg = response.routes[0].legs[0];
                    
                    // Try to position the label along the first leg
                    let labelPos;
                    if (leg.steps && leg.steps.length > 0 && leg.steps[0].path && leg.steps[0].path.length > 1) {
                        // Use the middle of the first path segment
                        const path = leg.steps[0].path;
                        const pos1 = path[0];
                        const pos2 = path[Math.min(Math.floor(path.length / 4), path.length - 1)];
                        labelPos = {
                            lat: (pos1.lat() + pos2.lat()) / 2,
                            lng: (pos1.lng() + pos2.lng()) / 2
                        };
                    } else {
                        // Fallback to leg start/end midpoint
                        labelPos = {
                            lat: (leg.start_location.lat() + leg.end_location.lat()) / 2,
                            lng: (leg.start_location.lng() + leg.end_location.lng()) / 2
                        };
                    }
                    
                    // Create the label
                    const routeLabel = new google.maps.Marker({
                        position: labelPos,
                        map: map,
                        icon: {
                            url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='white' stroke='${encodeURIComponent(routeColor)}' stroke-width='2'/%3E%3Ctext x='10' y='13' text-anchor='middle' fill='${encodeURIComponent(routeColor)}' font-size='9' font-weight='bold'%3E${routeIndex + 1}%3C/text%3E%3C/svg%3E`,
                            size: new google.maps.Size(20, 20),
                            scaledSize: new google.maps.Size(20, 20),
                            anchor: new google.maps.Point(10, 10)
                        },
                        title: `Route ${routeIndex + 1}`
                    });
                    
                    markers.push(routeLabel);
                }
            } else {
                console.warn(`Directions request failed for route ${routeIndex + 1}: ${status}`);
                
                // Fall back to a straight line route
                const routePoints = [depotPos];
                
                // Add all customer points
                route.forEach(customer => {
                    if (customer >= 0 && customer < coordinates.length) {
                        routePoints.push({
                            lat: parseFloat(coordinates[customer][0]),
                            lng: parseFloat(coordinates[customer][1])
                        });
                    }
                });
                
                // Add depot as last point to close the route
                routePoints.push(depotPos);
                
                // Draw a dashed line to indicate it's a fallback
                const routePath = new google.maps.Polyline({
                    path: routePoints,
                    geodesic: true,
                    strokeColor: routeColor,
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    strokePattern: [
                        { offset: '0%', repeat: '10px', symbol: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 } }
                    ] // This creates a dashed line
                });
                
                routePath.setMap(map);
                directionsRenderers.push(routePath);
                
                // Add a warning message
                showMapMessage(`Could not calculate road route for Route ${routeIndex + 1}. Using straight line instead.`, "warning", 5000);
            }
            
            // Move to next route
            routeIndex++;
            setTimeout(processNextRoute, 500); // Add delay to avoid rate limits
        });
    }
    
    // Start processing routes
    processNextRoute();
}

/**
 * Show a message in the map container
 */
function showMapMessage(message, type = 'info', autoHideAfter = null) {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    
    // Create unique ID for this message
    const msgId = 'map-msg-' + Date.now();
    
    // Create message element
    const msgElement = document.createElement('div');
    msgElement.id = msgId;
    msgElement.className = `alert alert-${type} map-message`;
    msgElement.innerHTML = message;
    
    // Find existing messages container or create one
    let messagesContainer = document.getElementById('map-messages-container');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.id = 'map-messages-container';
        messagesContainer.className = 'map-messages-container';
        messagesContainer.style.position = 'absolute';
        messagesContainer.style.bottom = '10px';
        messagesContainer.style.left = '10px';
        messagesContainer.style.right = '10px';
        messagesContainer.style.zIndex = '1000';
        mapContainer.appendChild(messagesContainer);
    }
    
    // Add message to container
    messagesContainer.appendChild(msgElement);
    
    // Auto-hide if requested
    if (autoHideAfter) {
        setTimeout(() => {
            if (document.getElementById(msgId)) {
                messagesContainer.removeChild(msgElement);
                
                // Remove container if empty
                if (messagesContainer.children.length === 0) {
                    mapContainer.removeChild(messagesContainer);
                }
            }
        }, autoHideAfter);
    }
    
    return msgId;
}

/**
 * Remove all map messages
 */
function removeMapMessages() {
    const messagesContainer = document.getElementById('map-messages-container');
    if (messagesContainer) {
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            mapContainer.removeChild(messagesContainer);
        }
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("Fixed maps script loaded");
    
    // Add toggle for route type
    const resultsTab = document.getElementById('results-tab');
    if (resultsTab) {
        resultsTab.addEventListener('shown.bs.tab', function() {
            console.log("Results tab shown");
            
            // If we have an existing solution, try to visualize it
            if (window.appState && window.appState.lastSolution) {
                visualizeSolutionOnMap(window.appState.lastSolution);
            }
        });
    }
    
    // Add checkbox for route type if needed
    const mapControls = document.getElementById('map-controls');
    if (!mapControls && document.getElementById('mapContainer')) {
        // Create controls container
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'map-controls';
        controlsDiv.className = 'map-controls position-absolute top-0 end-0 m-2';
        controlsDiv.style.zIndex = '1000';
        
        // Create the toggle
        controlsDiv.innerHTML = `
            <div class="form-check form-switch bg-white p-2 rounded shadow-sm">
                <input class="form-check-input" type="checkbox" id="useSimpleRoutes">
                <label class="form-check-label small" for="useSimpleRoutes">Use straight lines</label>
            </div>
        `;
        
        // Add event listener to redraw when toggled
        setTimeout(() => {
            const toggle = document.getElementById('useSimpleRoutes');
            if (toggle) {
                toggle.addEventListener('change', function() {
                    if (window.appState && window.appState.lastSolution) {
                        visualizeSolutionOnMap(window.appState.lastSolution);
                    }
                });
            }
        }, 100);
        
        // Add to map container
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(controlsDiv);
        }
    }
});

// Export functions for global use
window.initializeMap = initializeMap;
window.visualizeSolutionOnMap = visualizeSolutionOnMap;
window.clearMapElements = clearMapElements;
window.showMapMessage = showMapMessage;
window.removeMapMessages = removeMapMessages;