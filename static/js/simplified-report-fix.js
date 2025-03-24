// 100% client-side report generator that works without server data
// Replace the entire content of simplified-report-fix.js with this code

// Global storage for solution data
if (!window.reportData) {
    window.reportData = {
        solution: null,
        lastSolveTime: null
    };
}

// The main report generation function
window.generateDetailedReport = function() {
    console.log("Starting 100% client-side report generator");
    
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '0';
    loadingDiv.style.left = '0';
    loadingDiv.style.width = '100%';
    loadingDiv.style.height = '100%';
    loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
    loadingDiv.style.zIndex = '9999';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.justifyContent = 'center';
    loadingDiv.style.alignItems = 'center';
    
    loadingDiv.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
            <div class="d-flex align-items-center">
                <div class="spinner-border text-primary me-3" role="status"></div>
                <div>Generating report...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(loadingDiv);
    
    // Function to remove loading indicator
    function removeLoading() {
        if (document.body.contains(loadingDiv)) {
            document.body.removeChild(loadingDiv);
        }
    }
    
    // Extract solution directly from DOM
    try {
        // Build solution from the current UI
        const solution = buildSolutionFromDOM();
        
        if (solution && solution.routes && solution.routes.length > 0) {
            console.log("Successfully built solution from DOM");
            window.reportData.solution = solution;
            window.reportData.lastSolveTime = new Date().getTime();
            
            // Generate the report with this solution
            createReportWindow(solution);
        } else {
            console.error("Could not extract valid solution from DOM");
            removeLoading();
            alert("Could not find route solution data. Please make sure you've solved the problem and are viewing the results.");
        }
    } catch (error) {
        console.error("Error generating report:", error);
        removeLoading();
        alert("Error generating report: " + error.message);
    }
    
    // Function to build solution data from the DOM
    function buildSolutionFromDOM() {
        console.log("Building solution from DOM elements");
        
        // Initialize solution object
        const solution = {
            routes: [],
            coordinates: [],
            company_names: [],
            details: {
                total_distance: 0,
                routes: []
            },
            depot: 0
        };
        
        // Try multiple strategies to extract data
        
        // Strategy 1: Look for route details in routeDetailsContainer
        const routeDetailsContainer = document.getElementById('routeDetailsContainer');
        if (!routeDetailsContainer) {
            console.warn("Route details container not found");
            return null;
        }
        
        // Find all route cards
        const routeCards = routeDetailsContainer.querySelectorAll('.card');
        if (!routeCards || routeCards.length === 0) {
            console.warn("No route cards found in route details container");
            return null;
        }
        
        console.log(`Found ${routeCards.length} route cards`);
        
        // Process each route card
        routeCards.forEach((card, routeIndex) => {
            // Look for route details
            const titleElement = card.querySelector('.card-title');
            const routeId = routeIndex + 1;
            
            // Extract route distance
            let distance = 0;
            const distanceElement = card.querySelector('.card-text');
            if (distanceElement) {
                const distanceMatch = distanceElement.textContent.match(/Distance:\s*([\d.]+)\s*km/);
                if (distanceMatch && distanceMatch[1]) {
                    distance = parseFloat(distanceMatch[1]) * 1000; // Convert to meters
                    solution.details.total_distance += distance;
                }
            }
            
            // Extract load information
            let load = 0;
            let capacity = 0;
            const loadElement = card.querySelector('.card-text:nth-child(2)');
            if (loadElement) {
                const loadMatch = loadElement.textContent.match(/Load:\s*([\d.]+)\s*\/\s*([\d.]+)/);
                if (loadMatch && loadMatch[1] && loadMatch[2]) {
                    load = parseFloat(loadMatch[1]);
                    capacity = parseFloat(loadMatch[2]);
                }
            }
            
            // Extract stops
            const stopElements = card.querySelectorAll('.stop-badge, .stop-item');
            const stops = [];
            const routeNodeIndices = [];
            
            // Handle different DOM structures
            if (stopElements && stopElements.length > 0) {
                stopElements.forEach((stopElement, stopIndex) => {
                    // Get node index
                    let nodeIndex;
                    if (stopElement.hasAttribute('data-index')) {
                        nodeIndex = parseInt(stopElement.getAttribute('data-index'));
                    } else {
                        // If no data attribute, try to get from text content
                        const indexMatch = stopElement.textContent.match(/\d+/);
                        if (indexMatch) {
                            nodeIndex = parseInt(indexMatch[0]);
                        } else {
                            nodeIndex = stopIndex === 0 || stopIndex === stopElements.length - 1 ? 
                                       solution.depot : solution.coordinates.length;
                        }
                    }
                    
                    // Get name
                    let name;
                    if (stopElement.hasAttribute('data-name')) {
                        name = stopElement.getAttribute('data-name');
                    } else {
                        // Try to find nearby name element
                        const nameElement = stopElement.nextElementSibling;
                        if (nameElement && nameElement.classList.contains('stop-name')) {
                            name = nameElement.textContent.trim();
                        } else {
                            name = stopIndex === 0 || stopIndex === stopElements.length - 1 ? 
                                  "Depot" : `Customer ${nodeIndex}`;
                        }
                    }
                    
                    // Only add to route indices if it's not the depot
                    const isDepot = stopIndex === 0 || stopIndex === stopElements.length - 1;
                    if (!isDepot) {
                        routeNodeIndices.push(nodeIndex);
                    }
                    
                    // Add to stops list
                    stops.push({
                        index: nodeIndex,
                        name: name
                    });
                    
                    // Ensure we have placeholders in coordinate and name arrays
                    while (solution.coordinates.length <= nodeIndex) {
                        solution.coordinates.push([0, 0]);
                        solution.company_names.push(`Node ${solution.company_names.length}`);
                    }
                    
                    // Update company name
                    solution.company_names[nodeIndex] = name;
                });
            }
            
            // Add route to solution
            solution.routes.push(routeNodeIndices);
            
            // Add route details
            solution.details.routes.push({
                id: routeId,
                stops: stops,
                load: load,
                capacity: capacity,
                distance: distance
            });
        });
        
        // Extract coordinates from the map if possible
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer && window.google && window.google.maps && window.markers) {
            // Google Maps is available, use marker positions
            window.markers.forEach(marker => {
                const position = marker.getPosition();
                const title = marker.getTitle() || '';
                let index = -1;
                
                // Try to extract index from title
                const indexMatch = title.match(/Customer\s+(\d+)/);
                if (indexMatch && indexMatch[1]) {
                    index = parseInt(indexMatch[1]);
                } else if (title.toLowerCase().includes('depot')) {
                    index = solution.depot;
                }
                
                // Update coordinates if we found a valid index
                if (index >= 0 && index < solution.coordinates.length) {
                    solution.coordinates[index] = [position.lat(), position.lng()];
                }
            });
        }
        
        // If we don't have valid coordinates, generate placeholder coordinates
        if (solution.coordinates.length === 0 || 
            solution.coordinates.every(coord => coord[0] === 0 && coord[1] === 0)) {
            solution.coordinates = generatePlaceholderCoordinates(solution.routes.length + 1);
        }
        
        return solution.routes.length > 0 ? solution : null;
    }
    
    // Generate placeholder coordinates for visual representation
    function generatePlaceholderCoordinates(count) {
        // Generate coordinates in a circle around a center point
        const coordinates = [];
        const centerLat = 40.730;
        const centerLng = -73.935;
        const radius = 0.05;
        
        // Add depot at center
        coordinates.push([centerLat, centerLng]);
        
        // Add points in a circle
        for (let i = 1; i < count; i++) {
            const angle = (i / (count - 1)) * Math.PI * 2;
            const lat = centerLat + Math.cos(angle) * radius;
            const lng = centerLng + Math.sin(angle) * radius;
            coordinates.push([lat, lng]);
        }
        
        return coordinates;
    }
    
    // Create the report window and generate HTML
    function createReportWindow(solution) {
        const reportWindow = window.open('', '_blank');
        
        if (!reportWindow) {
            removeLoading();
            alert('Please allow pop-ups to view the report');
            return;
        }
        
        const details = solution.details;
        const coordinates = solution.coordinates;
        const depot = solution.depot || 0;
        
        // Calculate total customers
        function countTotalCustomers() {
            let total = 0;
            details.routes.forEach(route => {
                total += route.stops.length - 2; // Subtract 2 for depot at start and end
            });
            return total;
        }
        
        // Get route colors
        function getRouteColor(index) {
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
            ];
            return colors[index % colors.length];
        }
        
        // Start building the report content
        let reportContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Route Optimization Report - ${new Date().toLocaleString()}</title>
            
            <!-- Bootstrap CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
            
            <style>
                body {
                    padding: 20px;
                    font-family: Arial, sans-serif;
                }
                
                .route-card {
                    margin-bottom: 20px;
                    break-inside: avoid;
                }
                
                .route-header {
                    padding: 10px;
                    border-radius: 5px 5px 0 0;
                    color: white;
                    font-weight: bold;
                }
                
                .google-maps-link {
                    display: inline-block;
                    padding: 6px 12px;
                    background-color: #4285F4;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 5px 0;
                }
                
                .google-maps-link:hover {
                    background-color: #3367D6;
                    color: white;
                }
                
                .stop-badge {
                    display: inline-block;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    text-align: center;
                    line-height: 30px;
                    color: white;
                    margin-right: 5px;
                }
                
                .depot-badge {
                    background-color: #d9534f;
                }
                
                .customer-badge {
                    background-color: #5bc0de;
                }
                
                @media print {
                    .no-print { display: none !important; }
                    .page-break { page-break-after: always; }
                    a { text-decoration: none !important; color: #000 !important; }
                    .route-card { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="container">
                <div class="row mb-4">
                    <div class="col-12">
                        <h1 class="text-center">Route Optimization Report</h1>
                        <p class="text-center text-muted">Generated on ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                
                <!-- Controls -->
                <div class="row mb-4 no-print">
                    <div class="col-12 text-center">
                        <button class="btn btn-primary me-2" onclick="window.print()">
                            <i class="fas fa-print me-2"></i>Print Report
                        </button>
                        <button class="btn btn-secondary" onclick="window.close()">
                            <i class="fas fa-times me-2"></i>Close
                        </button>
                    </div>
                </div>
                
                <!-- Summary -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h3 class="card-title mb-0">Solution Summary</h3>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-4 text-center">
                                        <h4>${(details.total_distance / 1000).toFixed(2)} km</h4>
                                        <p class="text-muted">Total Distance</p>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <h4>${details.routes.length}</h4>
                                        <p class="text-muted">Number of Routes</p>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <h4>${countTotalCustomers()}</h4>
                                        <p class="text-muted">Total Customers</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        // Add each route with Google Maps link
        reportContent += `
                <!-- Routes -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Route Details</h2>
                    </div>
                </div>
        `;
        
        // Add details for each route
        details.routes.forEach((route, index) => {
            const routeColor = getRouteColor(index);
            const routeKm = (route.distance / 1000).toFixed(2);
            const loadPercent = ((route.load / route.capacity) * 100).toFixed(0);
            
            // Build waypoints for Google Maps URL
            let waypoints = [];
            let waypointsParam = "";
            
            if (route.stops.length > 2) { // More than just depot-depot
                // Skip first and last (depot)
                const routeCustomers = route.stops.slice(1, -1);
                
                // Build waypoints string for Google Maps
                routeCustomers.forEach(stop => {
                    const coord = coordinates[stop.index];
                    if (coord && coord.length >= 2) {
                        waypoints.push(`${coord[0]},${coord[1]}`);
                    }
                });
                
                if (waypoints.length > 0) {
                    waypointsParam = `&waypoints=${waypoints.join('|')}`;
                }
            }
            
            // Get depot coordinates
            const depotCoord = coordinates[depot];
            const depotLatLng = depotCoord && depotCoord.length >= 2 ? `${depotCoord[0]},${depotCoord[1]}` : '';
            
            // Create Google Maps URL for the route
            let googleMapsUrl = '';
            if (depotLatLng && waypoints.length > 0) {
                googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${depotLatLng}&destination=${depotLatLng}${waypointsParam}&travelmode=driving`;
            }
            
            // Add route card
            reportContent += `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card route-card">
                            <div class="route-header" style="background-color: ${routeColor};">
                                <h3 class="card-title mb-0">Route ${route.id}</h3>
                            </div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <strong>Distance:</strong> ${routeKm} km
                                    </div>
                                    <div class="col-md-4">
                                        <strong>Load:</strong> ${route.load}/${route.capacity} (${loadPercent}%)
                                    </div>
                                    <div class="col-md-4">
                                        <strong>Stops:</strong> ${route.stops.length - 2} customers
                                    </div>
                                </div>
                                
                                <div class="row mb-3">
                                    <div class="col-12">
                                        <h5>Route Sequence</h5>
                                        <div class="table-responsive">
                                            <table class="table table-striped table-hover">
                                                <thead>
                                                    <tr>
                                                        <th>Stop #</th>
                                                        <th>Name</th>
                                                        <th>Type</th>
                                                        <th>Coordinates</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
            `;
            
            // Add each stop in the route
            route.stops.forEach((stop, stopIndex) => {
                const isDepot = stopIndex === 0 || stopIndex === route.stops.length - 1;
                const stopType = isDepot ? 'Depot' : 'Customer';
                const badgeClass = isDepot ? 'depot-badge' : 'customer-badge';
                const coord = coordinates[stop.index];
                const coordStr = coord && coord.length >= 2 ? `${coord[0]}, ${coord[1]}` : 'N/A';
                
                reportContent += `
                                                    <tr>
                                                        <td>
                                                            <span class="stop-badge ${badgeClass}">${stopIndex}</span>
                                                        </td>
                                                        <td>${stop.name}</td>
                                                        <td>${stopType}</td>
                                                        <td>${coordStr}</td>
                                                    </tr>
                `;
            });
            
            // Close the table
            reportContent += `
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
            `;
            
            // Add Google Maps link if available
            if (googleMapsUrl) {
                reportContent += `
                                <div class="row mt-2">
                                    <div class="col-12">
                                        <a href="${googleMapsUrl}" target="_blank" class="google-maps-link">
                                            <i class="fas fa-map-marked-alt me-2"></i>Open in Google Maps
                                        </a>
                                        <p class="small text-muted mt-1">
                                            Click the link above to view this route in Google Maps. 
                                            You can then follow the directions on your mobile device.
                                        </p>
                                    </div>
                                </div>
                `;
            }
            
            // Close the card
            reportContent += `
                            </div>
                        </div>
                    </div>
                </div>
                ${index < details.routes.length - 1 ? '<div class="page-break"></div>' : ''}
            `;
        });
        
        // Close the HTML
        reportContent += `
                <!-- Notes -->
                <div class="row mt-5">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-light">
                                <h4 class="card-title mb-0">Notes</h4>
                            </div>
                            <div class="card-body">
                                <ul>
                                    <li>This report was generated from your route optimization solution.</li>
                                    <li>Google Maps links are provided for each route for navigation purposes.</li>
                                    <li>Print this report or save it as PDF for offline use.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
        
        // Write to the new window
        reportWindow.document.write(reportContent);
        reportWindow.document.close();
        
        // Remove loading indicator after everything is done
        removeLoading();
    }
};

// Monitor the application to store solution data as soon as it becomes available
(function() {
    console.log("Initializing solution monitoring system");
    
    // Ensure reportData exists
    if (!window.reportData) {
        window.reportData = {
            solution: null,
            lastSolveTime: null
        };
    }
    
    // Monitor for solution results being displayed
    const originalDisplaySolutionResults = window.displaySolutionResults;
    if (typeof originalDisplaySolutionResults === 'function') {
        console.log("Patching displaySolutionResults function");
        
        window.displaySolutionResults = function(data) {
            console.log("Solution display detected - caching data");
            
            // Store solution data globally if available
            if (data && data.solution) {
                window.reportData.solution = data.solution;
                window.reportData.lastSolveTime = new Date().getTime();
                console.log("Solution data cached successfully");
            }
            
            // Call original function
            return originalDisplaySolutionResults.apply(this, arguments);
        };
    }
    
    // Add event listener to report button if it exists
    document.addEventListener('DOMContentLoaded', function() {
        const reportBtn = document.getElementById('generateReportBtn');
        if (reportBtn) {
            console.log("Adding click listener to report button");
            
            reportBtn.addEventListener('click', function(e) {
                console.log("Report button clicked");
                window.generateDetailedReport();
                // Prevent default action if needed
                if (e) e.preventDefault();
            });
        } else {
            console.warn("Report button not found on DOMContentLoaded");
            
            // Set up a mutation observer to catch dynamically added button
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                        for (let i = 0; i < mutation.addedNodes.length; i++) {
                            const node = mutation.addedNodes[i];
                            if (node.id === 'generateReportBtn') {
                                console.log("Report button dynamically added - attaching listener");
                                node.addEventListener('click', function() {
                                    console.log("Report button clicked (dynamic)");
                                    window.generateDetailedReport();
                                });
                                observer.disconnect();
                                break;
                            }
                        }
                    }
                });
            });
            
            // Start observing the document
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
    
    console.log("Solution monitoring system initialized");
})();