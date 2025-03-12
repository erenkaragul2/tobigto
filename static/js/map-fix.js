// Enhanced map visualization function
function visualizeSolutionOnMap(solution) {
    console.log("Visualizing solution on map:", solution);
    
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
        console.error("Map container not found!");
        return;
    }
    
    // Validate solution data
    if (!solution || !solution.coordinates || !solution.routes) {
        mapContainer.innerHTML = '<div class="alert alert-warning">No route data available to visualize</div>';
        return;
    }
    
    // Get coordinates and routes
    const coordinates = solution.coordinates;
    const routes = solution.routes;
    const depot = solution.depot || 0;
    
    // Ensure coordinates are valid
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        console.error("Invalid coordinates:", coordinates);
        mapContainer.innerHTML = '<div class="alert alert-danger">Invalid coordinate data</div>';
        return;
    }
    
    // Route colors
    const routeColors = [
        '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
        '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
    ];
    
    // Initialize map if not already
    if (!window.map) {
        // Calculate center of map
        let centerLat = 0;
        let centerLng = 0;
        coordinates.forEach(coord => {
            centerLat += coord[0];
            centerLng += coord[1];
        });
        centerLat /= coordinates.length;
        centerLng /= coordinates.length;
        
        // Create map with explicit dimensions
        mapContainer.style.height = '400px';
        mapContainer.style.width = '100%';
        
        console.log("Initializing new map at:", [centerLat, centerLng]);
        
        try {
            window.map = L.map(mapContainer).setView([centerLat, centerLng], 13);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(window.map);
            
            // Create layer group for routes
            window.routeLayerGroup = L.layerGroup().addTo(window.map);
        } catch (error) {
            console.error("Error initializing map:", error);
            mapContainer.innerHTML = `<div class="alert alert-danger">Error initializing map: ${error.message}</div>`;
            return;
        }
    } else {
        // Clear previous routes
        if (window.routeLayerGroup) {
            window.routeLayerGroup.clearLayers();
        } else {
            // Create layer group if it doesn't exist
            window.routeLayerGroup = L.layerGroup().addTo(window.map);
        }
        
        // Ensure map container is visible and sized correctly
        mapContainer.style.height = '400px';
        mapContainer.style.width = '100%';
        window.map.invalidateSize();
        
        console.log("Reusing existing map");
    }
    
    // Add depot marker
    try {
        const depotIcon = L.divIcon({
            html: `<div style="background-color: #d9534f; color: white; border-radius: 50%; width: 30px; height: 30px; 
                  display: flex; align-items: center; justify-content: center; font-weight: bold;">D</div>`,
            className: 'depot-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const depotCoords = coordinates[depot];
        console.log("Adding depot at coordinates:", depotCoords);
        
        if (Array.isArray(depotCoords) && depotCoords.length >= 2) {
            L.marker([depotCoords[0], depotCoords[1]], {icon: depotIcon})
                .bindTooltip(`Depot (Node ${depot})`, {permanent: false})
                .addTo(window.routeLayerGroup);
        } else {
            console.error("Invalid depot coordinates:", depotCoords);
        }
        
        // Add customer markers and routes
        routes.forEach((route, routeIndex) => {
            if (!Array.isArray(route) || route.length === 0) {
                console.warn(`Skipping empty route at index ${routeIndex}`);
                return;
            }
            
            console.log(`Processing route ${routeIndex + 1} with ${route.length} stops`);
            
            const routeColor = routeColors[routeIndex % routeColors.length];
            
            // Create route path including depot -> customers -> depot
            const routePath = [];
            
            // Add depot as first point
            routePath.push([coordinates[depot][0], coordinates[depot][1]]);
            
            // Add markers for each customer in the route
            route.forEach(customer => {
                if (customer < 0 || customer >= coordinates.length) {
                    console.warn(`Invalid customer index: ${customer}`);
                    return;
                }
                
                const customerCoords = coordinates[customer];
                
                // Add customer marker
                const customerIcon = L.divIcon({
                    html: `<div style="background-color: #5bc0de; color: white; border-radius: 50%; width: 24px; height: 24px; 
                          display: flex; align-items: center; justify-content: center; font-weight: bold;">${customer}</div>`,
                    className: 'customer-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                
                if (Array.isArray(customerCoords) && customerCoords.length >= 2) {
                    L.marker([customerCoords[0], customerCoords[1]], {icon: customerIcon})
                        .bindTooltip(`Customer ${customer}`, {permanent: false})
                        .addTo(window.routeLayerGroup);
                    
                    // Add to route path
                    routePath.push([customerCoords[0], customerCoords[1]]);
                } else {
                    console.warn(`Invalid coordinates for customer ${customer}:`, customerCoords);
                }
            });
            
            // Add depot as last point to close the route
            routePath.push([coordinates[depot][0], coordinates[depot][1]]);
            
            // Create polyline for the route
            if (routePath.length > 1) {
                const routePolyline = L.polyline(routePath, {
                    color: routeColor,
                    weight: 4,
                    opacity: 0.7,
                    className: 'route-path'
                }).addTo(window.routeLayerGroup);
                
                // Add route number at the middle point of the first segment
                if (routePath.length > 1) {
                    const midLat = (routePath[0][0] + routePath[1][0]) / 2;
                    const midLng = (routePath[0][1] + routePath[1][1]) / 2;
                    
                    const routeLabel = L.divIcon({
                        html: `<div style="background-color: white; color: ${routeColor}; border: 2px solid ${routeColor}; 
                              border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; 
                              justify-content: center; font-weight: bold; font-size: 12px;">${routeIndex + 1}</div>`,
                        className: 'route-label',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    
                    L.marker([midLat, midLng], {icon: routeLabel}).addTo(window.routeLayerGroup);
                }
            } else {
                console.warn(`Route ${routeIndex + 1} has insufficient points for a polyline`);
            }
        });
        
        // Fit map to bounds with a small timeout to ensure all layers are added
        setTimeout(() => {
            try {
                const bounds = window.routeLayerGroup.getBounds();
                window.map.fitBounds(bounds, {padding: [30, 30]});
                console.log("Map fitted to bounds");
            } catch (error) {
                console.error("Error fitting map to bounds:", error);
                // Try a fallback center point
                window.map.setView([coordinates[0][0], coordinates[0][1]], 10);
            }
        }, 100);
        
    } catch (error) {
        console.error("Error visualizing routes:", error);
        mapContainer.innerHTML += `<div class="alert alert-danger mt-2">Error visualizing routes: ${error.message}</div>`;
    }
}

// Ensure this function is available globally
window.visualizeSolutionOnMap = visualizeSolutionOnMap;

// Add event listener to handle tab switching and map resizing
document.addEventListener('DOMContentLoaded', function() {
    // When the results tab is shown, invalidate the map size
    const resultsTab = document.getElementById('results-tab');
    if (resultsTab) {
        resultsTab.addEventListener('shown.bs.tab', function() {
            setTimeout(() => {
                if (window.map) {
                    console.log("Results tab shown - invalidating map size");
                    window.map.invalidateSize();
                }
            }, 100);
        });
    }
});