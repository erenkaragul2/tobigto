// Specialized fix for map initialization issues
(function() {
    console.log("Loading map initialization fix...");
    
    // Create a function to force map initialization
    function initializeMap() {
        console.log("Forcing map initialization");
        
        // Find the map container
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error("Map container not found!");
            return false;
        }
        
        // Make sure mapContainer has explicit dimensions
        mapContainer.style.height = '400px';
        mapContainer.style.width = '100%';
        
        // Clear any existing content
        mapContainer.innerHTML = '';
        
        try {
            // Check if we already have a map instance and destroy it if needed
            if (window.map) {
                try {
                    window.map.remove();
                    console.log("Removed existing map instance");
                } catch (e) {
                    console.warn("Error removing existing map:", e);
                }
                window.map = null;
            }
            
            // Create default center point (will be changed later when fitting bounds)
            const defaultCenter = [50, 0]; // Default coordinates
            const defaultZoom = 3;
            
            // Create new map
            window.map = L.map(mapContainer).setView(defaultCenter, defaultZoom);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(window.map);
            
            // Create layer group for routes
            window.routeLayerGroup = L.layerGroup().addTo(window.map);
            
            console.log("Map initialized successfully");
            
            // Add a text overlay to indicate the map is ready
            mapContainer.insertAdjacentHTML('beforeend', 
                '<div style="position: absolute; top: 10px; left: 10px; z-index: 1000; background: white; padding: 5px; border-radius: 3px; box-shadow: 0 0 5px rgba(0,0,0,0.3);">Map initialized - waiting for route data</div>');
            
            return true;
        } catch (err) {
            console.error("Error initializing map:", err);
            mapContainer.innerHTML = `<div class="alert alert-danger">Error initializing map: ${err.message}</div>`;
            return false;
        }
    }
    
    // Enhance the visualizeSolutionOnMap function to ensure map is initialized
    const originalVisualizeSolutionOnMap = window.visualizeSolutionOnMap;
    window.visualizeSolutionOnMap = function(solution) {
        console.log("Enhanced visualizeSolutionOnMap called");
        
        // Initialize map if it doesn't exist
        if (!window.map) {
            console.log("Map not initialized, initializing now");
            if (!initializeMap()) {
                console.error("Failed to initialize map");
                return;
            }
        }
        
        // Make sure map is valid
        try {
            window.map.invalidateSize();
        } catch (e) {
            console.error("Error with map, re-initializing:", e);
            if (!initializeMap()) {
                console.error("Failed to re-initialize map");
                return;
            }
        }
        
        // Check solution data
        if (!solution) {
            console.warn("No solution data provided to visualizeSolutionOnMap");
            // Initialize map but don't try to visualize routes
            return;
        }
        
        // Call original function if it exists
        if (typeof originalVisualizeSolutionOnMap === 'function') {
            try {
                originalVisualizeSolutionOnMap(solution);
            } catch (err) {
                console.error("Error in original visualizeSolutionOnMap:", err);
                
                // Fallback implementation to show at least something
                try {
                    // Clear any existing routes
                    if (window.routeLayerGroup) {
                        window.routeLayerGroup.clearLayers();
                    }
                    
                    // Draw routes if we have valid data
                    if (solution.coordinates && solution.routes) {
                        renderRoutesDirectly(solution);
                    }
                } catch (fallbackErr) {
                    console.error("Error in fallback route rendering:", fallbackErr);
                }
            }
        } else {
            // No original function, use our own implementation
            renderRoutesDirectly(solution);
        }
    };
    
    // Direct route rendering function as a fallback
    function renderRoutesDirectly(solution) {
        // Make sure we have the necessary data
        if (!solution.coordinates || !solution.routes || !solution.depot) {
            console.error("Missing required solution data for route rendering");
            return;
        }
        
        // Clear existing routes
        if (window.routeLayerGroup) {
            window.routeLayerGroup.clearLayers();
        } else {
            window.routeLayerGroup = L.layerGroup().addTo(window.map);
        }
        
        const coordinates = solution.coordinates;
        const routes = solution.routes;
        const depot = solution.depot || 0;
        
        console.log(`Rendering ${routes.length} routes with ${coordinates.length} coordinates`);
        
        // Route colors
        const routeColors = [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
            '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
        ];
        
        // Add depot marker if coordinates are valid
        if (coordinates[depot] && coordinates[depot].length >= 2) {
            const depotIcon = L.divIcon({
                html: `<div style="background-color: #d9534f; color: white; border-radius: 50%; width: 30px; height: 30px; 
                    display: flex; align-items: center; justify-content: center; font-weight: bold;">D</div>`,
                className: 'depot-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            L.marker([coordinates[depot][0], coordinates[depot][1]], {icon: depotIcon})
                .bindTooltip(`Depot (Node ${depot})`, {permanent: false})
                .addTo(window.routeLayerGroup);
        }
        
        // Add routes
        let allPoints = [];
        
        routes.forEach((route, routeIndex) => {
            if (!Array.isArray(route) || route.length === 0) {
                return;
            }
            
            const routeColor = routeColors[routeIndex % routeColors.length];
            const routePath = [];
            
            // Add depot as starting point
            if (coordinates[depot] && coordinates[depot].length >= 2) {
                routePath.push([coordinates[depot][0], coordinates[depot][1]]);
                allPoints.push([coordinates[depot][0], coordinates[depot][1]]);
            }
            
            // Add each customer
            route.forEach(customer => {
                if (customer >= 0 && customer < coordinates.length && 
                    coordinates[customer] && coordinates[customer].length >= 2) {
                    
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
                        .addTo(window.routeLayerGroup);
                    
                    // Add to route path
                    routePath.push([coordinates[customer][0], coordinates[customer][1]]);
                    allPoints.push([coordinates[customer][0], coordinates[customer][1]]);
                }
            });
            
            // Add depot as ending point
            if (coordinates[depot] && coordinates[depot].length >= 2) {
                routePath.push([coordinates[depot][0], coordinates[depot][1]]);
            }
            
            // Create polyline if we have at least two points
            if (routePath.length >= 2) {
                const routePolyline = L.polyline(routePath, {
                    color: routeColor,
                    weight: 4,
                    opacity: 0.7,
                    className: 'route-path'
                }).addTo(window.routeLayerGroup);
                
                // Add route number label
                if (routePath.length >= 2) {
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
            }
        });
        
        // Fit map to bounds if we have any points
        if (allPoints.length > 0) {
            try {
                const bounds = L.latLngBounds(allPoints);
                window.map.fitBounds(bounds, {padding: [30, 30]});
            } catch (e) {
                console.error("Error fitting bounds:", e);
            }
        }
    }
    
    // Add a function to immediately initialize the map
    window.initializeMap = initializeMap;
    
    // Update the refreshMap debug function
    window.cvrpDebug = window.cvrpDebug || {};
    window.cvrpDebug.refreshMap = function() {
        // Initialize map if it doesn't exist
        if (!window.map) {
            console.log("Map not initialized, initializing now");
            if (!initializeMap()) {
                return "Failed to initialize map";
            }
            return "Map initialized";
        }
        
        // Otherwise just refresh the existing map
        try {
            window.map.invalidateSize();
            return "Map refreshed";
        } catch (e) {
            console.error("Error refreshing map:", e);
            
            // Try to re-initialize
            if (initializeMap()) {
                return "Map re-initialized after error";
            } else {
                return "Failed to re-initialize map";
            }
        }
    };
    
    // Initialize map immediately when results tab is shown
    document.addEventListener('DOMContentLoaded', function() {
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                console.log("Results tab shown - ensuring map is initialized");
                
                // Initialize map if it doesn't exist
                if (!window.map) {
                    setTimeout(initializeMap, 200);
                } else {
                    // Otherwise just resize the existing map
                    setTimeout(() => {
                        try {
                            window.map.invalidateSize();
                        } catch (e) {
                            console.error("Error in map invalidateSize:", e);
                            initializeMap();
                        }
                    }, 200);
                }
            });
        }
        
        // Force map initialization after a short delay
        setTimeout(initializeMap, 1000);
    });
    
    console.log("Map initialization fix loaded successfully");
})();