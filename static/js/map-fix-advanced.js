// Enhanced map visualization function with robust debugging and error handling
(function() {
    console.log("Loading advanced map visualization fix...");

    /**
     * The primary function to visualize solution routes on a map
     */
    function visualizeSolutionOnMapAdvanced(solution) {
        console.log("Advanced visualizeSolutionOnMap called with:", solution);
        
        // Helper function to safely log nested objects
        const safeLog = (label, obj) => {
            try {
                if (typeof obj === 'object' && obj !== null) {
                    console.log(label + ":", JSON.stringify(obj).substring(0, 500) + (JSON.stringify(obj).length > 500 ? "..." : ""));
                } else {
                    console.log(label + ":", obj);
                }
            } catch (e) {
                console.log(label + ": [Error logging object]", e);
            }
        };
        
        // Find map container
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error("Map container not found!");
            return;
        }
        
        // Early validation of solution data
        if (!solution) {
            console.error("No solution data provided");
            mapContainer.innerHTML = '<div class="alert alert-warning">No route data available to visualize</div>';
            return;
        }
        
        safeLog("Solution object", solution);
        
        // Validate required properties with detailed logging
        if (!solution.coordinates) {
            console.error("Solution missing coordinates data");
            mapContainer.innerHTML = '<div class="alert alert-warning">Missing coordinate data in solution</div>';
            return;
        }
        
        if (!solution.routes) {
            console.error("Solution missing routes data");
            mapContainer.innerHTML = '<div class="alert alert-warning">Missing route data in solution</div>';
            return;
        }
        
        // Extract necessary data
        const coordinates = solution.coordinates;
        const routes = solution.routes;
        const depot = solution.depot || 0;
        
        safeLog("Coordinates", coordinates);
        safeLog("Routes", routes);
        safeLog("Depot", depot);
        
        // Additional validation for data structures
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            console.error("Invalid coordinates:", coordinates);
            mapContainer.innerHTML = '<div class="alert alert-danger">Invalid coordinate data</div>';
            return;
        }
        
        if (!Array.isArray(routes)) {
            console.error("Invalid routes (not an array):", routes);
            mapContainer.innerHTML = '<div class="alert alert-danger">Invalid route data (not an array)</div>';
            return;
        }
        
        // Route colors
        const routeColors = [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
            '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
        ];
        
        // Define map initialization or reuse
        try {
            // Make sure mapContainer has explicit dimensions
            mapContainer.style.height = '400px';
            mapContainer.style.width = '100%';
            
            // Initialize map if not already
            if (!window.map) {
                console.log("Creating new map instance");
                
                // Calculate center of map
                let centerLat = 0;
                let centerLng = 0;
                coordinates.forEach(coord => {
                    if (Array.isArray(coord) && coord.length >= 2) {
                        centerLat += parseFloat(coord[0]);
                        centerLng += parseFloat(coord[1]);
                    }
                });
                centerLat /= coordinates.length;
                centerLng /= coordinates.length;
                
                console.log("Map center:", [centerLat, centerLng]);
                
                // Create map
                window.map = L.map(mapContainer).setView([centerLat, centerLng], 13);
                
                // Add tile layer
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(window.map);
                
                // Create layer group for routes
                window.routeLayerGroup = L.layerGroup().addTo(window.map);
            } else {
                console.log("Reusing existing map");
                
                // Clear previous routes
                if (window.routeLayerGroup) {
                    console.log("Clearing existing route layers");
                    window.routeLayerGroup.clearLayers();
                } else {
                    // Create layer group if it doesn't exist
                    console.log("Creating new route layer group");
                    window.routeLayerGroup = L.layerGroup().addTo(window.map);
                }
                
                // Force map to update its size
                window.map.invalidateSize();
            }
            
            // Add depot marker
            console.log("Adding depot marker at index:", depot);
            if (depot < 0 || depot >= coordinates.length) {
                console.error(`Invalid depot index: ${depot}. Must be between 0 and ${coordinates.length-1}`);
            } else {
                const depotCoords = coordinates[depot];
                
                if (!Array.isArray(depotCoords) || depotCoords.length < 2 ||
                    isNaN(parseFloat(depotCoords[0])) || isNaN(parseFloat(depotCoords[1]))) {
                    console.error("Invalid depot coordinates:", depotCoords);
                } else {
                    console.log("Depot coordinates:", depotCoords);
                    
                    const depotIcon = L.divIcon({
                        html: `<div style="background-color: #d9534f; color: white; border-radius: 50%; width: 30px; height: 30px; 
                              display: flex; align-items: center; justify-content: center; font-weight: bold;">D</div>`,
                        className: 'depot-marker',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    
                    L.marker([parseFloat(depotCoords[0]), parseFloat(depotCoords[1])], {icon: depotIcon})
                        .bindTooltip(`Depot (Node ${depot})`, {permanent: false})
                        .addTo(window.routeLayerGroup);
                }
            }
            
            // Process routes and add to map
            console.log(`Processing ${routes.length} routes`);
            
            // First - verify routes data
            if (routes.length === 0) {
                console.warn("No routes in solution");
                mapContainer.insertAdjacentHTML('beforeend', 
                    '<div class="alert alert-warning mt-2">No routes found in solution data.</div>');
            }
            
            // Process each route
            routes.forEach((route, routeIndex) => {
                console.log(`Processing route #${routeIndex+1}:`, route);
                
                if (!Array.isArray(route) || route.length === 0) {
                    console.warn(`Route ${routeIndex+1} is empty or invalid`);
                    return;
                }
                
                const routeColor = routeColors[routeIndex % routeColors.length];
                console.log(`Using color ${routeColor} for route ${routeIndex+1}`);
                
                // Create route path including depot -> customers -> depot
                const routePath = [];
                
                // Add depot as first point if valid
                if (depot >= 0 && depot < coordinates.length && 
                    Array.isArray(coordinates[depot]) && coordinates[depot].length >= 2) {
                    routePath.push([
                        parseFloat(coordinates[depot][0]), 
                        parseFloat(coordinates[depot][1])
                    ]);
                } else {
                    console.warn("Depot coordinates invalid, skipping in route path");
                }
                
                // Add markers for each customer in the route
                let validPoints = 0;
                route.forEach(customer => {
                    // Validate customer index
                    if (customer < 0 || customer >= coordinates.length) {
                        console.warn(`Invalid customer index: ${customer} (not in range 0-${coordinates.length-1})`);
                        return;
                    }
                    
                    const customerCoords = coordinates[customer];
                    
                    // Validate customer coordinates
                    if (!Array.isArray(customerCoords) || customerCoords.length < 2 ||
                        isNaN(parseFloat(customerCoords[0])) || isNaN(parseFloat(customerCoords[1]))) {
                        console.warn(`Invalid coordinates for customer ${customer}:`, customerCoords);
                        return;
                    }
                    
                    validPoints++;
                    
                    // Add customer marker
                    const customerIcon = L.divIcon({
                        html: `<div style="background-color: #5bc0de; color: white; border-radius: 50%; width: 24px; height: 24px; 
                              display: flex; align-items: center; justify-content: center; font-weight: bold;">${customer}</div>`,
                        className: 'customer-marker',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    
                    // Parse coordinates as floats to ensure numeric values
                    const lat = parseFloat(customerCoords[0]);
                    const lng = parseFloat(customerCoords[1]);
                    
                    // Add marker
                    L.marker([lat, lng], {icon: customerIcon})
                        .bindTooltip(`Customer ${customer}`, {permanent: false})
                        .addTo(window.routeLayerGroup);
                    
                    // Add to route path for the polyline
                    routePath.push([lat, lng]);
                });
                
                // Add depot as last point to close the route
                if (depot >= 0 && depot < coordinates.length && 
                    Array.isArray(coordinates[depot]) && coordinates[depot].length >= 2) {
                    routePath.push([
                        parseFloat(coordinates[depot][0]), 
                        parseFloat(coordinates[depot][1])
                    ]);
                }
                
                // Create polyline for the route if we have enough points
                if (routePath.length > 1) {
                    console.log(`Creating polyline for route ${routeIndex+1} with ${routePath.length} points:`, routePath);
                    
                    // Log each point in the path to check for invalid values
                    routePath.forEach((point, i) => {
                        if (!Array.isArray(point) || point.length < 2 || 
                            isNaN(point[0]) || isNaN(point[1])) {
                            console.error(`Invalid point at index ${i}:`, point);
                        }
                    });
                    
                    // Create polyline with error handling
                    try {
                        const routePolyline = L.polyline(routePath, {
                            color: routeColor,
                            weight: 4,
                            opacity: 0.7,
                            className: 'route-path'
                        }).addTo(window.routeLayerGroup);
                        
                        console.log(`Successfully added polyline for route ${routeIndex+1}`);
                    } catch (error) {
                        console.error(`Error creating polyline for route ${routeIndex+1}:`, error);
                    }
                    
                    // Add route number at the middle point of the first segment
                    if (routePath.length > 1) {
                        try {
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
                        } catch (error) {
                            console.error(`Error adding route label for route ${routeIndex+1}:`, error);
                        }
                    }
                } else {
                    console.warn(`Route ${routeIndex+1} has insufficient valid points (${validPoints}) for a polyline`);
                }
            });
            
            // Fit map to bounds with a small timeout to ensure all layers are added
            setTimeout(() => {
                try {
                    if (window.routeLayerGroup && window.routeLayerGroup.getLayers().length > 0) {
                        const bounds = window.routeLayerGroup.getBounds();
                        window.map.fitBounds(bounds, {padding: [30, 30]});
                        console.log("Map fitted to bounds");
                    } else {
                        console.warn("No layers to fit bounds to");
                        
                        // Default view if no fitting possible
                        if (coordinates.length > 0 && Array.isArray(coordinates[0]) && coordinates[0].length >= 2) {
                            window.map.setView([
                                parseFloat(coordinates[0][0]), 
                                parseFloat(coordinates[0][1])
                            ], 10);
                            console.log("Set default map view");
                        }
                    }
                } catch (error) {
                    console.error("Error fitting map to bounds:", error);
                    
                    // Try a fallback center point
                    if (coordinates.length > 0) {
                        try {
                            window.map.setView([
                                parseFloat(coordinates[0][0]), 
                                parseFloat(coordinates[0][1])
                            ], 10);
                        } catch (e) {
                            console.error("Error setting fallback view:", e);
                        }
                    }
                }
            }, 200);
            
        } catch (error) {
            console.error("Error visualizing routes:", error);
            mapContainer.innerHTML += `<div class="alert alert-danger mt-2">Error visualizing routes: ${error.message}</div>`;
        }
    }
    
    // Replace the original function with our enhanced version
    window.visualizeSolutionOnMap = visualizeSolutionOnMapAdvanced;
    
    // Add helper for manually triggering map update
    window.refreshMap = function() {
        if (window.map) {
            window.map.invalidateSize();
            console.log("Map size invalidated manually");
            return "Map refreshed";
        }
        return "Map not available";
    };
    
    // Add event listener to reprocess solution when tab is shown
    document.addEventListener('DOMContentLoaded', function() {
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                console.log("Results tab shown - refreshing map");
                setTimeout(() => {
                    if (window.map) {
                        window.map.invalidateSize();
                        
                        // Check if we have a current solution in the global state
                        if (window.appState && window.appState.jobId) {
                            console.log("Reloading solution data for map from server");
                            fetch(`/get_solution/${window.appState.jobId}`)
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success && data.solution) {
                                        console.log("Solution data retrieved for map refresh");
                                        visualizeSolutionOnMapAdvanced(data.solution);
                                    } else {
                                        console.warn("No valid solution data retrieved for map refresh");
                                    }
                                })
                                .catch(err => console.error("Error fetching solution data for map:", err));
                        }
                    }
                }, 200);
            });
        }
    });
    
    console.log("Advanced map visualization fix loaded successfully");
})();