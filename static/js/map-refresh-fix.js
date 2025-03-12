// Enhanced map functionality with refresh button and solve integration
(function() {
    console.log("Loading map refresh fix and solve integration...");
    
    // Make sure we have a global app state
    window.appState = window.appState || {
        dataLoaded: false,
        dataProcessed: false,
        solving: false,
        solutionReady: false,
        jobId: null,
        coordinates: null,
        company_names: null,
        demands: null,
        lastSolution: null
    };
    
    document.addEventListener('DOMContentLoaded', function() {
        // Add map refresh button to the map container
        const addMapRefreshButton = function() {
            const mapContainer = document.getElementById('mapContainer');
            if (!mapContainer) return;
            
            // Check if button already exists
            if (document.getElementById('refreshMapBtn')) return;
            
            // Create refresh button
            const refreshButton = document.createElement('button');
            refreshButton.id = 'refreshMapBtn';
            refreshButton.className = 'btn btn-sm btn-light position-absolute m-2';
            refreshButton.style.zIndex = '1000';
            refreshButton.style.right = '10px';
            refreshButton.style.top = '10px';
            refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Map';
            
            // Add click handler
            refreshButton.addEventListener('click', function() {
                refreshMap();
                alert("Map refreshed. If you still don't see the map properly, please try switching tabs and coming back.");
            });
            
            // Add button to map container
            mapContainer.style.position = 'relative'; // Ensure positioning context
            mapContainer.appendChild(refreshButton);
            
            console.log("Map refresh button added");
        };
        
        // Add the refresh button when results tab is shown
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                console.log("Results tab shown - adding refresh button");
                setTimeout(addMapRefreshButton, 300);
                
                // Also attempt to initialize/refresh the map
                setTimeout(refreshMap, 500);
            });
        }
        
        // Enhance the solve button to ensure map initialization
        const solveBtn = document.getElementById('solveBtn');
        if (solveBtn) {
            // Store original onclick handler
            const originalOnClick = solveBtn.onclick;
            
            // Replace with our enhanced version
            solveBtn.onclick = function(event) {
                console.log("Enhanced solve button clicked");
                
                // Call original handler if it exists
                if (typeof originalOnClick === 'function') {
                    originalOnClick.call(this, event);
                }
                
                // Make sure map container is ready before results are shown
                const mapContainer = document.getElementById('mapContainer');
                if (mapContainer) {
                    mapContainer.style.height = '400px';
                    mapContainer.style.width = '100%';
                    
                    // Pre-initialize the map if it doesn't exist
                    if (!window.map) {
                        console.log("Pre-initializing map for solve");
                        initializeMap();
                    }
                }
            };
        }
    });
    
    // Function to refresh the map
    function refreshMap() {
        console.log("Refreshing map...");
        
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error("Map container not found!");
            return;
        }
        
        // Ensure map container has proper dimensions
        mapContainer.style.height = '400px';
        mapContainer.style.width = '100%';
        
        // Initialize map if it doesn't exist
        if (!window.map) {
            console.log("Map doesn't exist, initializing...");
            initializeMap();
            return;
        }
        
        // If map exists, invalidate its size to force redraw
        try {
            window.map.invalidateSize();
            console.log("Map size invalidated");
            
            // Reload visualization if we have a solution
            if (window.appState.lastSolution) {
                console.log("Redrawing routes with existing solution");
                visualizeSolutionOnMap(window.appState.lastSolution);
            } else if (window.appState.jobId) {
                // Try to fetch the solution again
                console.log("Fetching solution data to redraw map");
                fetch(`/get_solution/${window.appState.jobId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.solution) {
                            window.appState.lastSolution = data.solution;
                            visualizeSolutionOnMap(data.solution);
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching solution:", error);
                    });
            }
        } catch (error) {
            console.error("Error refreshing map:", error);
            
            // If refresh fails, try to reinitialize
            initializeMap();
        }
    }
    
    // Function to initialize the map from scratch
    function initializeMap() {
        console.log("Initializing map from scratch");
        
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) {
            console.error("Map container not found!");
            return;
        }
        
        // Clear existing content
        mapContainer.innerHTML = '';
        
        // Reset dimensions
        mapContainer.style.height = '400px';
        mapContainer.style.width = '100%';
        
        try {
            // First remove existing map if any
            if (window.map) {
                try {
                    window.map.remove();
                    console.log("Removed existing map instance");
                } catch (error) {
                    console.warn("Error removing existing map:", error);
                }
                window.map = null;
            }
            
            // Initialize new map with default view
            window.map = L.map(mapContainer).setView([0, 0], 2);
            
            // Try multiple map providers in case one fails
            try {
                // Option 1: Carto Positron (light)
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 19
                }).addTo(window.map);
                console.log("Carto map provider successfully loaded");
            } catch (e) {
                console.error("Error loading Carto provider:", e);
                
                try {
                    // Option 2: Stadia Maps (fallback)
                    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
                        maxZoom: 20
                    }).addTo(window.map);
                    console.log("Stadia Maps provider successfully loaded");
                } catch (e2) {
                    console.error("Error loading Stadia Maps provider:", e2);
                    
                    // Option 3: Fallback to OpenStreetMap as last resort
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(window.map);
                    console.log("Falling back to OpenStreetMap provider");
                }
            }
            
            // Create layer group for routes
            window.routeLayerGroup = L.layerGroup().addTo(window.map);
            
            // Add refresh button and map provider selector
            const refreshButton = document.getElementById('refreshMapBtn');
            if (!refreshButton) {
                // Create map controls container
                const mapControlsDiv = document.createElement('div');
                mapControlsDiv.className = 'position-absolute m-2 d-flex flex-column gap-2';
                mapControlsDiv.style.zIndex = '1000';
                mapControlsDiv.style.right = '10px';
                mapControlsDiv.style.top = '10px';
                
                // Create refresh button
                const refreshButtonNew = document.createElement('button');
                refreshButtonNew.id = 'refreshMapBtn';
                refreshButtonNew.className = 'btn btn-sm btn-light';
                refreshButtonNew.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Map';
                
                // Create map provider selector
                const providerSelect = document.createElement('select');
                providerSelect.id = 'mapProviderSelect';
                providerSelect.className = 'form-select form-select-sm';
                providerSelect.innerHTML = `
                    <option value="carto">Carto (Light)</option>
                    <option value="cartoDark">Carto (Dark)</option>
                    <option value="stadia">Stadia Maps</option>
                    <option value="osm">OpenStreetMap</option>
                `;
                
                // Add change event to switch map provider
                providerSelect.addEventListener('change', function() {
                    changeMapProvider(this.value);
                });
                
                // Add controls to container
                mapControlsDiv.appendChild(refreshButtonNew);
                mapControlsDiv.appendChild(providerSelect);
                
                refreshButtonNew.addEventListener('click', function() {
                    refreshMap();
                });
                
                mapContainer.style.position = 'relative';
                mapContainer.appendChild(mapControlsDiv);
                
                // Function to change map provider
                window.changeMapProvider = function(provider) {
                    if (!window.map) return;
                    
                    // Remove current tile layer
                    window.map.eachLayer(function(layer) {
                        if (layer instanceof L.TileLayer) {
                            window.map.removeLayer(layer);
                        }
                    });
                    
                    // Add new tile layer based on selection
                    switch(provider) {
                        case 'cartoDark':
                            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                                subdomains: 'abcd',
                                maxZoom: 19
                            }).addTo(window.map);
                            break;
                        case 'stadia':
                            L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
                                attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
                                maxZoom: 20
                            }).addTo(window.map);
                            break;
                        case 'osm':
                            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            }).addTo(window.map);
                            break;
                        case 'carto':
                        default:
                            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                                subdomains: 'abcd',
                                maxZoom: 19
                            }).addTo(window.map);
                    }
                    
                    // Re-add route layer if it exists
                    if (window.routeLayerGroup) {
                        window.routeLayerGroup.addTo(window.map);
                    }
                };
            }
            
            // Show initialization message
            mapContainer.insertAdjacentHTML('beforeend', 
                '<div id="mapInitMessage" style="position: absolute; bottom: 10px; left: 10px; z-index: 1000; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 5px rgba(0,0,0,0.3);">' +
                '<i class="fas fa-check-circle text-success me-2"></i>Map initialized. Solution will appear here when ready.</div>');
            
            // Auto-hide message after 5 seconds
            setTimeout(() => {
                const initMessage = document.getElementById('mapInitMessage');
                if (initMessage) {
                    initMessage.style.opacity = '0';
                    initMessage.style.transition = 'opacity 1s';
                    setTimeout(() => {
                        if (initMessage.parentNode) {
                            initMessage.parentNode.removeChild(initMessage);
                        }
                    }, 1000);
                }
            }, 5000);
            
            console.log("Map initialized successfully");
            
            // If we have a solution, visualize it
            if (window.appState.lastSolution) {
                console.log("Visualizing existing solution");
                visualizeSolutionOnMap(window.appState.lastSolution);
            }
            
            return true;
        } catch (error) {
            console.error("Error initializing map:", error);
            
            // Show error message in container
            mapContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error initializing map: ${error.message}
                    <button id="retryMapBtn" class="btn btn-sm btn-danger ms-2">Retry</button>
                </div>
            `;
            
            // Add retry button handler
            const retryBtn = document.getElementById('retryMapBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', initializeMap);
            }
            
            return false;
        }
    }
    
    // Make these functions available globally
    window.refreshMap = refreshMap;
    window.initializeMap = initializeMap;
    
    // Add a more robust error handling for the visualization function
    const originalVisualizeSolutionOnMap = window.visualizeSolutionOnMap;
    window.visualizeSolutionOnMap = function(solution) {
        console.log("Enhanced visualizeSolutionOnMap called");
        
        // Check if map exists, if not initialize it
        if (!window.map) {
            console.log("Map not initialized, creating it now");
            initializeMap();
            
            // Add a small delay to allow map to initialize
            setTimeout(function() {
                try {
                    if (originalVisualizeSolutionOnMap) {
                        originalVisualizeSolutionOnMap(solution);
                    }
                } catch (e) {
                    console.error("Error in delayed visualization:", e);
                    showMapError("Error visualizing routes: " + e.message);
                }
            }, 500);
            return;
        }
        
        try {
            // Ensure routes layer exists
            if (!window.routeLayerGroup) {
                window.routeLayerGroup = L.layerGroup().addTo(window.map);
            } else {
                // Clear existing routes
                window.routeLayerGroup.clearLayers();
            }
            
            // Call original function
            if (originalVisualizeSolutionOnMap) {
                originalVisualizeSolutionOnMap(solution);
            }
        } catch (e) {
            console.error("Error visualizing solution:", e);
            showMapError("Error visualizing routes: " + e.message);
        }
    };
    
    // Helper function to show map errors
    function showMapError(message) {
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) return;
        
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger position-absolute m-3';
        errorDiv.style.zIndex = '1000';
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
    
    // Make sure solution is saved in app state after solving
    const originalDisplaySolutionResults = window.displaySolutionResults;
    window.displaySolutionResults = function(data) {
        console.log("Enhanced displaySolutionResults called");
        
        if (data && data.solution) {
            window.appState.lastSolution = data.solution;
            window.appState.solutionReady = true;
        }
        
        if (typeof originalDisplaySolutionResults === 'function') {
            originalDisplaySolutionResults(data);
        }
    };
    
    console.log("Map refresh fix and solve integration loaded successfully");
})();