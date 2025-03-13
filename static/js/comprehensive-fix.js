// Comprehensive fix for both Google Maps and Convergence Plot
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading comprehensive fix for maps and convergence plot");
    
    // Store original functions we might need to reference
    const originalShowConvergencePlot = window.showConvergencePlot;
    
    // ====================================================
    // PART 1: MAP FUNCTIONALITY FIXES
    // ====================================================
    
    // Use a simple fallback map if Google Maps fails to load
    let mapInitialized = false;
    let mapInitAttempts = 0;
    const MAX_MAP_INIT_ATTEMPTS = 3;
    
    // Global map variables
    window.map = null;
    window.markers = [];
    window.routes = [];
    
    // Fix the visualization function to work with or without Google Maps
    window.visualizeSolutionOnMap = function(solution) {
        console.log("Visualizing solution", solution);
        
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
                visualizeWithGoogleMaps(solution, mapContainer);
                return;
            } catch (e) {
                console.error("Google Maps visualization failed:", e);
                // Fall through to backup visualization
            }
        }
        
        // If Google Maps fails or isn't available, use a simple SVG visualization
        visualizeWithSVG(solution, mapContainer);
    };
    
    // Function to visualize routes using Google Maps
    function visualizeWithGoogleMaps(solution, container) {
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
        
        // Route colors
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
        ];
        
        // Process each route
        routes.forEach((route, routeIndex) => {
            const routeColor = colors[routeIndex % colors.length];
            const routePoints = [];
            
            // Add depot as first point
            if (depot >= 0 && depot < coordinates.length) {
                routePoints.push({
                    lat: parseFloat(coordinates[depot][0]),
                    lng: parseFloat(coordinates[depot][1])
                });
            }
            
            // Add customer points
            route.forEach((customer) => {
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
                window.routes.push(routePath);
            }
        });
        
        // Fit map to show all points
        if (!bounds.isEmpty()) {
            window.map.fitBounds(bounds);
            
            // Add a small delay before fitting bounds to ensure map is ready
            setTimeout(() => {
                window.map.fitBounds(bounds);
            }, 100);
        }
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
            
            mapInitialized = true;
            console.log("Google Maps initialized successfully");
        } catch (e) {
            console.error("Error initializing Google Maps:", e);
            showMapMessage("Could not initialize Google Maps. Using simple visualization instead.", "warning");
            mapInitialized = false;
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
        
        // Clear routes
        if (window.routes) {
            window.routes.forEach(route => {
                route.setMap(null);
            });
            window.routes = [];
        }
    }
    
    // Fallback visualization using SVG
    function visualizeWithSVG(solution, container) {
        const coordinates = solution.coordinates;
        const routes = solution.routes;
        const depot = solution.depot || 0;
        
        console.log("Using SVG fallback visualization");
        
        // Clear container
        container.innerHTML = '';
        
        // Calculate bounds to normalize coordinates
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        coordinates.forEach(coord => {
            if (coord && coord.length >= 2) {
                const x = parseFloat(coord[1]); // Longitude is X
                const y = parseFloat(coord[0]); // Latitude is Y
                
                if (!isNaN(x) && !isNaN(y)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        });
        
        // If we don't have valid bounds, show an error
        if (minX === Infinity || minY === Infinity) {
            showMapMessage("Could not visualize routes - invalid coordinates", "danger");
            return;
        }
        
        // Add padding
        const padding = 0.1;
        const rangeX = (maxX - minX) || 1;
        const rangeY = (maxY - minY) || 1;
        
        minX -= rangeX * padding;
        maxX += rangeX * padding;
        minY -= rangeY * padding;
        maxY += rangeY * padding;
        
        // SVG dimensions
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 400;
        
        // Route colors
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
        ];
        
        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.backgroundColor = '#f8f9fa';
        
        // Helper function to convert coordinates to SVG points
        function toSVGPoint(coord) {
            if (!coord || coord.length < 2) return null;
            
            const x = parseFloat(coord[1]); // Longitude is X
            const y = parseFloat(coord[0]); // Latitude is Y
            
            if (isNaN(x) || isNaN(y)) return null;
            
            // Normalize and invert Y (SVG Y is top-down)
            const svgX = ((x - minX) / (maxX - minX)) * width;
            const svgY = height - ((y - minY) / (maxY - minY)) * height;
            
            return { x: svgX, y: svgY };
        }
        
        // Draw routes
        routes.forEach((route, routeIndex) => {
            const routeColor = colors[routeIndex % colors.length];
            const points = [];
            
            // Add depot as first point
            const depotPoint = toSVGPoint(coordinates[depot]);
            if (depotPoint) {
                points.push(depotPoint);
            }
            
            // Add all customer points
            route.forEach(customer => {
                if (customer >= 0 && customer < coordinates.length) {
                    const point = toSVGPoint(coordinates[customer]);
                    if (point) {
                        points.push(point);
                    }
                }
            });
            
            // Add depot as last point to close the loop
            if (depotPoint) {
                points.push(depotPoint);
            }
            
            // Draw polyline if we have enough points
            if (points.length > 1) {
                const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');
                
                polyline.setAttribute('points', pointsString);
                polyline.setAttribute('fill', 'none');
                polyline.setAttribute('stroke', routeColor);
                polyline.setAttribute('stroke-width', '3');
                polyline.setAttribute('stroke-linejoin', 'round');
                polyline.setAttribute('stroke-linecap', 'round');
                
                svg.appendChild(polyline);
            }
        });
        
        // Add customer markers
        coordinates.forEach((coord, index) => {
            if (index === depot) return; // Skip depot, we'll add it separately
            
            const point = toSVGPoint(coord);
            if (!point) return;
            
            // Create marker
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.setAttribute('cx', point.x);
            marker.setAttribute('cy', point.y);
            marker.setAttribute('r', '6');
            marker.setAttribute('fill', '#4285F4');
            marker.setAttribute('stroke', 'white');
            marker.setAttribute('stroke-width', '1');
            
            // Add label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', point.x);
            label.setAttribute('y', point.y);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('fill', 'white');
            label.setAttribute('font-size', '10px');
            label.setAttribute('font-weight', 'bold');
            label.textContent = index.toString();
            
            svg.appendChild(marker);
            svg.appendChild(label);
        });
        
        // Add depot marker (special)
        if (depot >= 0 && depot < coordinates.length) {
            const depotPoint = toSVGPoint(coordinates[depot]);
            if (depotPoint) {
                // Marker
                const depotMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                depotMarker.setAttribute('cx', depotPoint.x);
                depotMarker.setAttribute('cy', depotPoint.y);
                depotMarker.setAttribute('r', '10');
                depotMarker.setAttribute('fill', '#FF0000');
                depotMarker.setAttribute('stroke', 'white');
                depotMarker.setAttribute('stroke-width', '1');
                
                // Label
                const depotLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                depotLabel.setAttribute('x', depotPoint.x);
                depotLabel.setAttribute('y', depotPoint.y);
                depotLabel.setAttribute('text-anchor', 'middle');
                depotLabel.setAttribute('dominant-baseline', 'middle');
                depotLabel.setAttribute('fill', 'white');
                depotLabel.setAttribute('font-size', '10px');
                depotLabel.setAttribute('font-weight', 'bold');
                depotLabel.textContent = 'D';
                
                svg.appendChild(depotMarker);
                svg.appendChild(depotLabel);
            }
        }
        
        // Add caption
        const caption = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        caption.setAttribute('x', 10);
        caption.setAttribute('y', 20);
        caption.setAttribute('fill', '#666');
        caption.setAttribute('font-size', '14px');
        caption.textContent = 'Route Visualization (SVG Fallback)';
        
        svg.appendChild(caption);
        
        // Add the SVG to the container
        container.appendChild(svg);
    }
    
    // Helper function to show messages in the map container
    function showMapMessage(message, type = 'info') {
        const container = document.getElementById('mapContainer');
        if (!container) return;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} position-absolute p-2`;
        alert.style.bottom = '10px';
        alert.style.left = '10px';
        alert.style.right = '10px';
        alert.style.zIndex = '1000';
        alert.innerHTML = message;
        
        // Add dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'btn-close float-end';
        dismissBtn.setAttribute('data-bs-dismiss', 'alert');
        dismissBtn.setAttribute('aria-label', 'Close');
        alert.appendChild(dismissBtn);
        
        container.appendChild(alert);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode === container) {
                container.removeChild(alert);
            }
        }, 5000);
    }
    
    // Try to load Google Maps if it's not already loaded
    function loadGoogleMaps() {
        if (window.google && window.google.maps) {
            console.log("Google Maps already loaded");
            return;
        }
        
        if (mapInitAttempts >= MAX_MAP_INIT_ATTEMPTS) {
            console.log("Max Google Maps init attempts reached, using SVG fallback");
            return;
        }
        
        mapInitAttempts++;
        
        // Add the Google Maps script
        const script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?callback=initMapCallback';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        
        // Define the callback
        window.initMapCallback = function() {
            console.log("Google Maps loaded");
            mapInitialized = true;
            
            // If we're on the results tab and have a solution, visualize it
            if (document.getElementById('results-tab').classList.contains('active') && 
                window.appState && window.appState.lastSolution) {
                visualizeSolutionOnMap(window.appState.lastSolution);
            }
        };
        
        // Handle errors
        script.onerror = function() {
            console.error("Failed to load Google Maps");
            mapInitialized = false;
        };
    }
    
    // ====================================================
    // PART 2: CONVERGENCE PLOT FIXES
    // ====================================================
    
    // Fixed version of showConvergencePlot function
    window.showConvergencePlot = function(costHistory, tempHistory) {
        console.log("Showing convergence plot");
        
        const container = document.getElementById('convergencePlotContainer');
        if (!container) {
            console.error("Convergence plot container not found");
            return;
        }
        
        // Clear previous content
        container.innerHTML = '<canvas id="convergenceChart"></canvas>';
        
        // Validate data
        if (!costHistory || !tempHistory || !costHistory.length || !tempHistory.length) {
            container.innerHTML = '<div class="alert alert-warning">No convergence data available</div>';
            return;
        }
        
        // Give DOM time to update
        setTimeout(() => {
            try {
                const canvas = document.getElementById('convergenceChart');
                if (!canvas) {
                    console.error("Convergence chart canvas not found");
                    return;
                }
                
                const ctx = canvas.getContext('2d');
                
                // Prepare data
                const iterations = Array.from({length: costHistory.length}, (_, i) => i);
                
                // Convert cost values from meters to kilometers for display
                const costHistoryKm = costHistory.map(cost => parseFloat(cost) / 1000);
                
                // Make sure temperature values are valid (no zeros for logarithmic scale)
                const tempHistoryFixed = tempHistory.map(temp => Math.max(parseFloat(temp), 0.001));
                
                // Create the chart
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: iterations,
                        datasets: [
                            {
                                label: 'Best Cost (km)',
                                data: costHistoryKm,
                                borderColor: '#36a2eb',
                                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.1,
                                yAxisID: 'y'
                            },
                            {
                                label: 'Temperature',
                                data: tempHistoryFixed,
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
                                intersect: false,
                                callbacks: {
                                    label: function(context) {
                                        if (context.datasetIndex === 0) {
                                            return `Best Cost: ${context.raw.toFixed(2)} km`;
                                        } else {
                                            return `Temperature: ${context.raw.toFixed(2)}`;
                                        }
                                    }
                                }
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
                                    text: 'Best Cost (km)'
                                }
                            },
                            y1: {
                                type: 'linear',  // Changed from logarithmic to linear for better visualization
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
                
                console.log("Convergence chart created successfully");
            } catch (error) {
                console.error("Error creating convergence chart:", error);
                container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
            }
        }, 100);
    };
    
    // ====================================================
    // PART 3: INITIALIZATION
    // ====================================================
    
    // Initialize the comprehensive fix
    function initFix() {
        console.log("Initializing comprehensive fix");
        
        // Try to load Google Maps
        loadGoogleMaps();
        
        // Add event listener for tab changes
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                console.log("Results tab shown");
                
                // If we have solution data, redraw visualizations
                if (window.appState && window.appState.lastSolution) {
                    console.log("Redrawing from cached solution");
                    
                    // Redraw map
                    visualizeSolutionOnMap(window.appState.lastSolution);
                    
                    // Redraw convergence plot
                    if (window.appState.costHistory && window.appState.tempHistory) {
                        window.showConvergencePlot(
                            window.appState.costHistory,
                            window.appState.tempHistory
                        );
                    }
                }
                
                // Force redraw for Google Maps
                if (window.google && window.google.maps && window.map) {
                    google.maps.event.trigger(window.map, "resize");
                }
            });
        }
        
        // Add event listener for solution data
        const originalDisplaySolutionResults = window.displaySolutionResults;
        if (typeof originalDisplaySolutionResults === 'function') {
            window.displaySolutionResults = function(data) {
                console.log("Enhanced displaySolutionResults called");
                
                if (data && data.solution) {
                    // Store solution in app state
                    if (!window.appState) {
                        window.appState = {};
                    }
                    window.appState.lastSolution = data.solution;
                    window.appState.costHistory = data.cost_history;
                    window.appState.tempHistory = data.temp_history;
                }
                
                // Call original function
                originalDisplaySolutionResults(data);
            };
        }
    }
    
    // Run the initialization
    initFix();
});