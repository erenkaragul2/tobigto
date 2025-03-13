// Google Maps integration for CVRP Solver
console.log("Loading Google Maps integration...");

// Global variables for Google Maps
let map = null;
let markers = [];
let polylines = [];
let bounds = null;
let infoWindow = null;

// Route colors
const routeColors = [
    '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
    '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
];

// Initialize Google Maps
function initializeGoogleMap() {
    console.log("Initializing Google Maps...");
    
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
        console.error("Map container not found!");
        return false;
    }
    
    // Make sure map container has proper dimensions
    mapContainer.style.height = '400px';
    mapContainer.style.width = '100%';
    
    try {
        // Default center (will be overridden once we have coordinates)
        const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // New York City as default
        
        // Create a new map instance
        map = new google.maps.Map(mapContainer, {
            center: defaultCenter,
            zoom: 10,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            fullscreenControl: true,
            streetViewControl: false
        });
        
        // Create info window for markers
        infoWindow = new google.maps.InfoWindow();
        
        // Create bounds object for auto-zooming
        bounds = new google.maps.LatLngBounds();
        
        console.log("Google Maps initialized successfully");
        
        // Add initialization message
        const initMessage = document.createElement('div');
        initMessage.id = 'mapInitMessage';
        initMessage.style.position = 'absolute';
        initMessage.style.bottom = '10px';
        initMessage.style.left = '10px';
        initMessage.style.padding = '10px';
        initMessage.style.backgroundColor = 'white';
        initMessage.style.borderRadius = '5px';
        initMessage.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
        initMessage.style.zIndex = '1000';
        initMessage.innerHTML = '<i class="fas fa-check-circle text-success me-2"></i>Map initialized. Solution will appear here when ready.';
        
        mapContainer.appendChild(initMessage);
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
            if (initMessage.parentNode) {
                initMessage.style.opacity = '0';
                initMessage.style.transition = 'opacity 1s';
                setTimeout(() => {
                    if (initMessage.parentNode) {
                        initMessage.parentNode.removeChild(initMessage);
                    }
                }, 1000);
            }
        }, 5000);
        
        return true;
    } catch (error) {
        console.error("Error initializing Google Maps:", error);
        
        // Show error message in container
        mapContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                Error initializing Google Maps: ${error.message}
                <button id="retryMapBtn" class="btn btn-sm btn-danger ms-2">Retry</button>
            </div>
        `;
        
        // Add retry button handler
        const retryBtn = document.getElementById('retryMapBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', initializeGoogleMap);
        }
        
        return false;
    }
}

// Function to visualize solution on Google Maps
function visualizeSolutionOnGoogleMap(solution) {
    console.log("Visualizing solution on Google Maps:", solution);
    
    // Initialize map if it doesn't exist
    if (!map) {
        console.log("Map not initialized, creating it now");
        if (!initializeGoogleMap()) {
            console.error("Failed to initialize map");
            return;
        }
    }
    
    // Clear previous markers and routes
    clearMap();
    
    // Validate solution data
    if (!solution || !solution.coordinates || !solution.routes) {
        console.error("Invalid solution data", solution);
        showMapError("Invalid solution data");
        return;
    }
    
    // Extract necessary data
    const coordinates = solution.coordinates;
    const routes = solution.routes;
    const depot = solution.depot || 0;
    
    // Create bounds for auto-zooming
    bounds = new google.maps.LatLngBounds();
    
    // Add depot marker
    if (coordinates[depot] && coordinates[depot].length >= 2) {
        const depotPosition = {
            lat: parseFloat(coordinates[depot][0]),
            lng: parseFloat(coordinates[depot][1])
        };
        
        // Add to bounds
        bounds.extend(depotPosition);
        
        // Create depot marker
        const depotMarker = createCustomMarker(
            depotPosition,
            'D',
            '#d9534f',
            30
        );
        
        // Add click listener
        google.maps.event.addListener(depotMarker, 'click', function() {
            infoWindow.setContent(`<div><strong>Depot (Node ${depot})</strong></div>`);
            infoWindow.open(map, depotMarker);
        });
        
        markers.push(depotMarker);
    } else {
        console.error("Invalid depot coordinates", coordinates[depot]);
    }
    
    // Create markers and routes for each route
    routes.forEach((route, routeIndex) => {
        if (!Array.isArray(route) || route.length === 0) {
            console.warn(`Route ${routeIndex} is empty or invalid`);
            return;
        }
        
        const routeColor = routeColors[routeIndex % routeColors.length];
        
        // Create route path including depot -> customers -> depot
        const routePath = [];
        
        // Add depot as first point
        if (coordinates[depot] && coordinates[depot].length >= 2) {
            routePath.push({
                lat: parseFloat(coordinates[depot][0]),
                lng: parseFloat(coordinates[depot][1])
            });
        }
        
        // Add markers for each customer in the route
        route.forEach((customer, stopIndex) => {
            if (!coordinates[customer] || coordinates[customer].length < 2) {
                console.warn(`Invalid coordinates for customer ${customer}`);
                return;
            }
            
            const customerPosition = {
                lat: parseFloat(coordinates[customer][0]),
                lng: parseFloat(coordinates[customer][1])
            };
            
            // Add to bounds
            bounds.extend(customerPosition);
            
            // Create customer marker
            const customerMarker = createCustomMarker(
                customerPosition,
                customer.toString(),
                '#5bc0de',
                24
            );
            
            // Add click listener
            google.maps.event.addListener(customerMarker, 'click', function() {
                infoWindow.setContent(`
                    <div>
                        <strong>Customer ${customer}</strong><br>
                        Stop #${stopIndex + 1} on Route ${routeIndex + 1}
                    </div>
                `);
                infoWindow.open(map, customerMarker);
            });
            
            markers.push(customerMarker);
            
            // Add to route path
            routePath.push(customerPosition);
        });
        
        // Add depot as last point to close the route
        if (coordinates[depot] && coordinates[depot].length >= 2) {
            routePath.push({
                lat: parseFloat(coordinates[depot][0]),
                lng: parseFloat(coordinates[depot][1])
            });
        }
        
        // Create polyline for the route if we have enough points
        if (routePath.length > 1) {
            const routePolyline = new google.maps.Polyline({
                path: routePath,
                strokeColor: routeColor,
                strokeOpacity: 0.7,
                strokeWeight: 4
            });
            
            routePolyline.setMap(map);
            polylines.push(routePolyline);
            
            // Add route number at the middle point of the first segment
            if (routePath.length >= 2) {
                const midPoint = getMidpoint(routePath[0], routePath[1]);
                
                // Create route label marker
                const routeLabel = createCustomMarker(
                    midPoint,
                    (routeIndex + 1).toString(),
                    routeColor,
                    20,
                    true
                );
                
                markers.push(routeLabel);
            }
        }
    });
    
    // Fit map to bounds
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
        // Add some padding
        const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
            map.setZoom(Math.min(15, map.getZoom()));
        });
    }
}

// Helper function to create a custom marker
function createCustomMarker(position, label, color, size, isRouteLabel = false) {
    const bgColor = isRouteLabel ? 'white' : color;
    const textColor = isRouteLabel ? color : 'white';
    const border = isRouteLabel ? `2px solid ${color}` : 'none';
    
    // Create custom marker
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: size / 2,
            fillColor: bgColor,
            fillOpacity: 1,
            strokeColor: color,
            strokeWeight: isRouteLabel ? 2 : 0
        },
        label: {
            text: label,
            color: textColor,
            fontSize: `${size / 2}px`,
            fontWeight: 'bold'
        }
    });
    
    return marker;
}

// Helper function to get midpoint between two positions
function getMidpoint(pos1, pos2) {
    return {
        lat: (pos1.lat + pos2.lat) / 2,
        lng: (pos1.lng + pos2.lng) / 2
    };
}

// Function to clear all markers and routes
function clearMap() {
    // Clear markers
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    markers = [];
    
    // Clear polylines
    for (let i = 0; i < polylines.length; i++) {
        polylines[i].setMap(null);
    }
    polylines = [];
    
    // Reset bounds
    bounds = new google.maps.LatLngBounds();
}

// Function to refresh the map
function refreshGoogleMap() {
    if (map && typeof google !== 'undefined') {
        google.maps.event.trigger(map, 'resize');
        
        // Recenter map if we have bounds
        if (bounds && !bounds.isEmpty()) {
            map.fitBounds(bounds);
        }
        
        return "Map refreshed";
    }
    return "Map not available";
}

// Helper function to show map errors
function showMapError(message) {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger position-absolute m-3';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.bottom = '10px';
    errorDiv.style.left = '10px';
    errorDiv.style.right = '10px';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle me-2"></i>${message}
        <button type="button" class="btn-close float-end" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to map container
    mapContainer.appendChild(errorDiv);
    
    // Auto remove after 8 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 8000);
}

// Override the existing visualizeSolutionOnMap function
window.visualizeSolutionOnMap = visualizeSolutionOnGoogleMap;
window.initializeMap = initializeGoogleMap;
window.refreshMap = refreshGoogleMap;

// Add a listener for the results tab to ensure map is properly displayed
document.addEventListener('DOMContentLoaded', function() {
    const resultsTab = document.getElementById('results-tab');
    if (resultsTab) {
        resultsTab.addEventListener('shown.bs.tab', function() {
            console.log("Results tab shown - refreshing Google Map");
            setTimeout(() => {
                if (map) {
                    refreshGoogleMap();
                } else {
                    initializeGoogleMap();
                }
            }, 200);
        });
    }
    
    // Preload the map when the page loads
    setTimeout(initializeGoogleMap, 1000);
});