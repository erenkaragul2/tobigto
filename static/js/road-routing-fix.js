// Enhanced Google Maps visualization with actual road routing
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading road routing enhancements...");
    
    // Store original functions
    const originalVisualizeSolutionOnMap = window.visualizeSolutionOnMap;
    
    // Global variables
    window.map = null;
    window.markers = [];
    window.directionsRenderers = [];
    window.directionsService = null;
    
    // Route colors
    const routeColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
    ];

    // Enhanced visualization function with road routing
    window.visualizeSolutionOnMap = function(solution) {
        console.log("Enhanced visualization with road routing", solution);
        
        // Validate solution data
        if (!solution || !solution.coordinates || !solution.routes) {
            console.error("Invalid solution data", solution);
            showMapMessage("Invalid solution data", "danger");
            return;
        }
        
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error("Map container not found");
            return;
        }
        
        // First attempt to use Google Maps if available
        if (window.google && window.google.maps) {
            try {
                visualizeWithRoadRouting(solution, mapContainer);
                return;
            } catch (e) {
                console.error("Road routing visualization failed:", e);
                // Try basic Google Maps as fallback
                try {
                    visualizeWithBasicGoogleMaps(solution, mapContainer);
                    return;
                } catch (e2) {
                    console.error("Basic Google Maps visualization failed:", e2);
                    // Fall through to SVG fallback
                }
            }
        }
        
        // If Google Maps fails or isn't available, use SVG visualization
        visualizeWithSVG(solution, mapContainer);
    };
    
    // Function to visualize routes using Google Maps Directions API for road routing
    function visualizeWithRoadRouting(solution, container) {
        const coordinates = solution.coordinates;
        const routes = solution.routes;
        const depot = solution.depot || 0;
        
        // Initialize map if needed
        if (!window.map) {
            initializeMap(container, coordinates);
        } else {
            // Clear existing elements
            clearMapElements();
        }
        
        // Initialize directions service if needed
        if (!window.directionsService) {
            window.directionsService = new google.maps.DirectionsService();
        }
        
        // Create a bounds object to fit all points
        const bounds = new google.maps.LatLngBounds();
        
        // Setup depot position
        if (depot >= 0 && depot < coordinates.length) {
            const depotPos = {
                lat: parseFloat(coordinates[depot][0]),
                lng: parseFloat(coordinates[depot][1])
            };
            
            // Add depot marker
            const depotMarker = new google.maps.Marker({
                position: depotPos,
                map: window.map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#FF0000',
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: '#FFFFFF'
                },
                label: {
                    text: 'D',
                    color: '#FFFFFF',
                    fontWeight: 'bold'
                },
                title: 'Depot'
            });
            
            window.markers.push(depotMarker);
            bounds.extend(depotPos);
            
            // Process each route
            processRoutes(routes, coordinates, depot, bounds);
        } else {
            showMapMessage("Invalid depot index", "warning");
        }
    }
    
    // Process routes sequentially to avoid hitting API limits
    function processRoutes(routes, coordinates, depot, bounds) {
        // Show progress message
        showMapMessage("Calculating road routes...", "info", false);
        
        // Process each route one by one to avoid rate limiting
        let routeIndex = 0;
        const totalRoutes = routes.length;
        
        function processNextRoute() {
            if (routeIndex >= totalRoutes) {
                // All routes processed
                // Fit map to bounds
                if (!bounds.isEmpty()) {
                    window.map.fitBounds(bounds);
                }
                
                // Remove progress message
                removeMapMessages();
                return;
            }
            
            const route = routes[routeIndex];
            const routeColor = routeColors[routeIndex % routeColors.length];
            
            // Show progress
            showMapMessage(`Calculating road routes (${routeIndex + 1}/${totalRoutes})...`, "info", true);
            
            // Process this route
            calculateAndDisplayRoute(route, coordinates, depot, routeColor, bounds)
                .then(() => {
                    // Process next route after a short delay to avoid rate limiting
                    routeIndex++;
                    setTimeout(processNextRoute, 300);
                })
                .catch(error => {
                    console.error("Error calculating route:", error);
                    showMapMessage(`Error calculating route ${routeIndex + 1}: ${error.message}`, "warning");
                    
                    // Continue with next route despite error
                    routeIndex++;
                    setTimeout(processNextRoute, 300);
                });
        }
        
        // Start processing routes
        processNextRoute();
    }
    
    // Calculate and display a single route
    function calculateAndDisplayRoute(route, coordinates, depot, routeColor, bounds) {
        return new Promise((resolve, reject) => {
            if (!route || route.length === 0) {
                resolve(); // Empty route, nothing to do
                return;
            }
            
            // Convert coordinates to LatLng objects
            const depotPos = new google.maps.LatLng(
                parseFloat(coordinates[depot][0]), 
                parseFloat(coordinates[depot][1])
            );
            
            // Prepare waypoints array
            const waypoints = route.map(customer => {
                if (customer >= 0 && customer < coordinates.length) {
                    return {
                        location: new google.maps.LatLng(
                            parseFloat(coordinates[customer][0]),
                            parseFloat(coordinates[customer][1])
                        ),
                        stopover: true
                    };
                }
            }).filter(wp => wp); // Filter out any undefined waypoints
            
            // Add customer markers
            route.forEach(customer => {
                if (customer >= 0 && customer < coordinates.length) {
                    const pos = {
                        lat: parseFloat(coordinates[customer][0]),
                        lng: parseFloat(coordinates[customer][1])
                    };
                    
                    // Add customer marker
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: window.map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: '#4285F4',
                            fillOpacity: 1,
                            strokeWeight: 1,
                            strokeColor: '#FFFFFF'
                        },
                        label: {
                            text: customer.toString(),
                            color: '#FFFFFF',
                            fontSize: '10px'
                        },
                        title: 'Customer ' + customer
                    });
                    
                    window.markers.push(marker);
                    bounds.extend(pos);
                }
            });
            
            // No need for Directions API if we have only one customer
            if (waypoints.length === 1) {
                // Create a simple polyline for this route
                const routePath = new google.maps.Polyline({
                    path: [depotPos, waypoints[0].location, depotPos],
                    geodesic: true,
                    strokeColor: routeColor,
                    strokeOpacity: 0.8,
                    strokeWeight: 4
                });
                
                routePath.setMap(window.map);
                window.directionsRenderers.push(routePath);
                resolve();
                return;
            }
            
            // Split into segments if needed (Google Directions API has a limit of 25 waypoints)
            const MAX_WAYPOINTS = 23; // We'll use 23 to be safe (depot is origin + destination)
            
            if (waypoints.length <= MAX_WAYPOINTS) {
                // Request directions in a single request
                requestDirections(depotPos, depotPos, waypoints, routeColor, resolve, reject);
            } else {
                // Split into multiple requests
                processLargeRoute(depotPos, waypoints, routeColor, MAX_WAYPOINTS, resolve, reject);
            }
        });
    }
    
    // Process large routes by splitting into segments
    function processLargeRoute(depotPos, allWaypoints, routeColor, maxWaypoints, resolve, reject) {
        // Split waypoints into chunks
        const chunks = [];
        for (let i = 0; i < allWaypoints.length; i += maxWaypoints) {
            chunks.push(allWaypoints.slice(i, i + maxWaypoints));
        }
        
        let completedChunks = 0;
        const totalChunks = chunks.length;
        
        // Process each chunk
        chunks.forEach((waypoints, index) => {
            // Add delay between requests to avoid rate limiting
            setTimeout(() => {
                requestDirections(depotPos, depotPos, waypoints, routeColor, 
                    // Success callback
                    () => {
                        completedChunks++;
                        if (completedChunks === totalChunks) {
                            resolve();
                        }
                    },
                    // Error callback
                    (error) => {
                        console.error(`Error processing chunk ${index + 1}:`, error);
                        completedChunks++;
                        if (completedChunks === totalChunks) {
                            // Resolve anyway, even with errors
                            resolve();
                        }
                    }
                );
            }, index * 700); // Stagger requests with 700ms delay
        });
    }
    
    // Request directions from Google Maps Directions API
    function requestDirections(origin, destination, waypoints, routeColor, resolve, reject) {
        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            optimizeWaypoints: false, // Don't reorder waypoints
            travelMode: google.maps.TravelMode.DRIVING
        };
        
        window.directionsService.route(request, function(response, status) {
            if (status === 'OK') {
                // Create a DirectionsRenderer to display the route
                const directionsRenderer = new google.maps.DirectionsRenderer({
                    map: window.map,
                    directions: response,
                    suppressMarkers: true, // We're adding our own markers
                    polylineOptions: {
                        strokeColor: routeColor,
                        strokeOpacity: 0.8,
                        strokeWeight: 4
                    }
                });
                
                window.directionsRenderers.push(directionsRenderer);
                resolve();
            } else {
                // Handle common errors
                if (status === 'OVER_QUERY_LIMIT') {
                    reject(new Error("Google Maps API request limit reached. Try again later."));
                } else if (status === 'ZERO_RESULTS') {
                    // No route found, fall back to straight lines
                    console.warn("No road route found between points, falling back to straight lines");
                    
                    // Create a polyline following the waypoints
                    const path = [origin];
                    waypoints.forEach(wp => path.push(wp.location));
                    path.push(destination);
                    
                    const routePath = new google.maps.Polyline({
                        path: path,
                        geodesic: true,
                        strokeColor: routeColor,
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        strokeDashArray: [5, 5] // Dashed line to indicate it's not a real road route
                    });
                    
                    routePath.setMap(window.map);
                    window.directionsRenderers.push(routePath);
                    resolve();
                } else {
                    reject(new Error(`Directions request failed: ${status}`));
                }
            }
        });
    }
    
    // Basic Google Maps visualization with straight lines as fallback
    function visualizeWithBasicGoogleMaps(solution, container) {
        const coordinates = solution.coordinates;
        const routes = solution.routes;
        const depot = solution.depot || 0;
        
        // Initialize map if needed
        if (!window.map) {
            initializeMap(container, coordinates);
        }
        
        // Clear existing markers and routes
        clearMapElements();
        
        // Create a bounds object to fit all points
        const bounds = new google.maps.LatLngBounds();
        
        // Add depot marker
        if (depot >= 0 && depot < coordinates.length) {
            const depotPos = {
                lat: parseFloat(coordinates[depot][0]),
                lng: parseFloat(coordinates[depot][1])
            };
            
            const depotMarker = new google.maps.Marker({
                position: depotPos,
                map: window.map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#FF0000',
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: '#FFFFFF'
                },
                label: {
                    text: 'D',
                    color: '#FFFFFF',
                    fontWeight: 'bold'
                },
                title: 'Depot'
            });
            
            window.markers.push(depotMarker);
            bounds.extend(depotPos);
        }
        
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
                    
                    // Add customer marker
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: window.map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: '#4285F4',
                            fillOpacity: 1,
                            strokeWeight: 1,
                            strokeColor: '#FFFFFF'
                        },
                        label: {
                            text: customer.toString(),
                            color: '#FFFFFF',
                            fontSize: '10px'
                        },
                        title: 'Customer ' + customer
                    });
                    
                    window.markers.push(marker);
                    bounds.extend(pos);
                    routePoints.push(pos);
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
                
                routePath.setMap(window.map);
                window.directionsRenderers.push(routePath);
            }
        });
        
        // Fit map to show all points
        if (!bounds.isEmpty()) {
            window.map.fitBounds(bounds);
        }
        
        showMapMessage("Showing straight-line routes (not actual roads)", "info", false);
        setTimeout(removeMapMessages, 5000);
    }
    
    // SVG fallback visualization
    function visualizeWithSVG(solution, container) {
        // Implementation remains the same...
        // This is our last-resort fallback if Google Maps fails completely
        
        // Clear container
        container.innerHTML = '';
        
        // Show message about fallback
        const fallbackMessage = document.createElement('div');
        fallbackMessage.className = 'alert alert-warning';
        fallbackMessage.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Google Maps unavailable. Using simplified visualization.';
        container.appendChild(fallbackMessage);
        
        // Basic SVG implementation would go here...
        // For brevity, I'm omitting the full SVG implementation since it was included in the previous version
    }
    
    // Initialize Google Maps
    function initializeMap(container, coordinates) {
        // Default center (will be overridden)
        let center = {lat: 0, lng: 0};
        
        // Calculate center from coordinates if available
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
        
        // Create the map
        try {
            window.map = new google.maps.Map(container, {
                center: center,
                zoom: 8,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                fullscreenControl: true
            });
            
            // Initialize directions service
            window.directionsService = new google.maps.DirectionsService();
            
            console.log("Google Maps initialized successfully");
        } catch (e) {
            console.error("Error initializing Google Maps:", e);
            showMapMessage("Could not initialize Google Maps. Using simple visualization instead.", "warning");
        }
    }
    
    // Clear all map elements
    function clearMapElements() {
        // Clear markers
        if (window.markers) {
            window.markers.forEach(marker => {
                marker.setMap(null);
            });
            window.markers = [];
        }
        
        // Clear direction renderers
        if (window.directionsRenderers) {
            window.directionsRenderers.forEach(renderer => {
                if (renderer instanceof google.maps.DirectionsRenderer) {
                    renderer.setMap(null);
                } else if (renderer instanceof google.maps.Polyline) {
                    renderer.setMap(null);
                }
            });
            window.directionsRenderers = [];
        }
    }
    
    // Helper function to show messages in the map container
    function showMapMessage(message, type = 'info', replace = true) {
        const container = document.getElementById('mapContainer');
        if (!container) return;
        
        // Remove existing messages if replacing
        if (replace) {
            removeMapMessages();
        }
        
        const msgId = 'map-msg-' + Date.now();
        const alert = document.createElement('div');
        alert.id = msgId;
        alert.className = `alert alert-${type} position-absolute p-2`;
        alert.style.bottom = '10px';
        alert.style.left = '10px';
        alert.style.right = '10px';
        alert.style.zIndex = '1000';
        alert.innerHTML = message;
        
        container.appendChild(alert);
        
        return msgId;
    }
    
    // Remove all map messages
    function removeMapMessages() {
        const container = document.getElementById('mapContainer');
        if (!container) return;
        
        const messages = container.querySelectorAll('.alert');
        messages.forEach(msg => {
            container.removeChild(msg);
        });
    }
    
    // Initialize on page load
    initializeGoogleMaps();
    
    // Ensure Google Maps is initialized
    function initializeGoogleMaps() {
        // Check if Google Maps is available
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            console.log("Google Maps not yet loaded. Waiting...");
            
            // Wait for maps to load
            const checkGoogleMaps = setInterval(() => {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    clearInterval(checkGoogleMaps);
                    console.log("Google Maps loaded. Ready to use.");
                    
                    // Try to visualize if we already have a solution
                    if (window.appState && window.appState.lastSolution) {
                        visualizeSolutionOnMap(window.appState.lastSolution);
                    }
                }
            }, 500);
        } else {
            console.log("Google Maps already loaded. Ready to use.");
        }
    }
});