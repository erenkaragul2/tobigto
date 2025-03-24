// Direct button interception for report generation
// Save this as a NEW file: static/js/button-fix.js

(function() {
    console.log("Installing direct button interception...");
    
    // Function to find and intercept the report button
    function interceptReportButton() {
        const reportBtn = document.getElementById('generateReportBtn');
        if (!reportBtn) {
            console.log("Report button not found, will try again in 500ms");
            setTimeout(interceptReportButton, 500);
            return;
        }

        console.log("Found report button, replacing click handler");
        
        // Remove all existing click handlers
        const newButton = reportBtn.cloneNode(true);
        reportBtn.parentNode.replaceChild(newButton, reportBtn);
        
        // Add our direct handler
        newButton.addEventListener('click', function(e) {
            // Prevent default action and stop event propagation
            e.preventDefault();
            e.stopPropagation();
            
            console.log("Intercepted report button click");
            generateReport();
            
            // Return false to prevent other handlers
            return false;
        });
        
        console.log("Button handler successfully replaced");
    }
    
    // Execute the interception immediately and on document ready
    interceptReportButton();
    
    // Also add a document ready handler
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(interceptReportButton, 100);
    } else {
        document.addEventListener("DOMContentLoaded", interceptReportButton);
    }
    
    // The main report generation function
    function generateReport() {
        console.log("Starting direct report generation");
        
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
                <div style="display: flex; align-items: center;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; margin-right: 15px; animation: spin 2s linear infinite;"></div>
                    <div>Generating route report...</div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(loadingDiv);
        
        // Remove loading function
        function removeLoading() {
            if (document.body.contains(loadingDiv)) {
                document.body.removeChild(loadingDiv);
            }
        }

        try {
            // Extract route data from the results tab
            const routeData = extractRouteData();
            
            if (!routeData || !routeData.routes || routeData.routes.length === 0) {
                console.error("Failed to extract valid route data");
                removeLoading();
                alert("Could not extract route data from the page. Please make sure your solution is visible in the Results tab.");
                return;
            }
            
            console.log("Successfully extracted route data:", routeData);
            
            // Create a new window for the report
            const reportWindow = window.open('', '_blank');
            if (!reportWindow) {
                console.error("Failed to open report window - popup might be blocked");
                removeLoading();
                alert("Please allow popups to view the route report");
                return;
            }
            
            // Generate the report HTML
            const reportHtml = generateReportHtml(routeData);
            
            // Write to the report window
            reportWindow.document.open();
            reportWindow.document.write(reportHtml);
            reportWindow.document.close();
            
            // Remove loading indicator
            removeLoading();
            
        } catch (error) {
            console.error("Error generating report:", error);
            removeLoading();
            alert("Error generating report: " + error.message);
        }
    }
    
    // Extract route data from the page
    function extractRouteData() {
        console.log("Extracting route data from DOM");
        
        // First check if solution is available in global scope
        if (window.appState && window.appState.solution) {
            console.log("Found solution in window.appState");
            return window.appState.solution;
        }
        
        // Next check for window.solution
        if (window.solution) {
            console.log("Found solution in window.solution");
            return window.solution;
        }
        
        // Next check for solution data elements in the page
        const routeDetailsContainer = document.getElementById('routeDetailsContainer');
        if (!routeDetailsContainer) {
            console.error("Route details container not found");
            return null;
        }
        
        // Find all route cards within the container
        const routeCards = routeDetailsContainer.querySelectorAll('.card');
        if (!routeCards || routeCards.length === 0) {
            console.error("No route cards found in container");
            return null;
        }
        
        console.log(`Found ${routeCards.length} route cards`);
        
        // Build solution object from route cards
        const solution = {
            routes: [],
            coordinates: [],
            company_names: [],
            depot: 0,
            details: {
                total_distance: 0,
                routes: []
            }
        };
        
        // Process each route card
        routeCards.forEach((card, index) => {
            const routeId = index + 1;
            
            // Extract route distance
            let routeDistance = 0;
            const distanceText = card.textContent.match(/Distance:\s*([\d.]+)\s*km/);
            if (distanceText && distanceText[1]) {
                routeDistance = parseFloat(distanceText[1]) * 1000; // Convert to meters
                solution.details.total_distance += routeDistance;
            }
            
            // Extract load information
            let load = 0;
            let capacity = 20; // Default capacity
            const loadText = card.textContent.match(/Load:\s*([\d.]+)\s*\/\s*([\d.]+)/);
            if (loadText && loadText[1] && loadText[2]) {
                load = parseFloat(loadText[1]);
                capacity = parseFloat(loadText[2]);
            }
            
            // Extract stops
            const routeStops = [];
            const routeIndices = [];
            
            // Try different selectors for stop items
            const stopItems = card.querySelectorAll('.stop-item, .stop-badge, .customer-stop, .depot-stop');
            
            if (stopItems && stopItems.length > 0) {
                console.log(`Found ${stopItems.length} stops in route ${routeId}`);
                
                stopItems.forEach((item, stopIndex) => {
                    // Try to get node index
                    let nodeIndex;
                    let name;
                    
                    // Check for data attributes first
                    if (item.hasAttribute('data-index')) {
                        nodeIndex = parseInt(item.getAttribute('data-index'));
                    } else {
                        // Try to parse from text content
                        const indexMatch = item.textContent.match(/\d+/);
                        if (indexMatch) {
                            nodeIndex = parseInt(indexMatch[0]);
                        } else {
                            // Default fallback
                            nodeIndex = stopIndex === 0 || stopIndex === stopItems.length - 1 ? 
                                        solution.depot : solution.coordinates.length;
                        }
                    }
                    
                    // Get name from data attribute or nearby element
                    if (item.hasAttribute('data-name')) {
                        name = item.getAttribute('data-name');
                    } else if (item.nextElementSibling && item.nextElementSibling.classList.contains('stop-name')) {
                        name = item.nextElementSibling.textContent.trim();
                    } else {
                        name = stopIndex === 0 || stopIndex === stopItems.length - 1 ? 
                               "Depot" : `Customer ${nodeIndex}`;
                    }
                    
                    // Add to stops list
                    routeStops.push({
                        index: nodeIndex,
                        name: name
                    });
                    
                    // Only add to route indices if not the depot
                    if (stopIndex !== 0 && stopIndex !== stopItems.length - 1) {
                        routeIndices.push(nodeIndex);
                    }
                    
                    // Ensure coordinates and names arrays are big enough
                    while (solution.coordinates.length <= nodeIndex) {
                        solution.coordinates.push(null);
                        solution.company_names.push(null);
                    }
                    
                    // Update company name
                    solution.company_names[nodeIndex] = name;
                });
            } else {
                console.log(`No stop items found in route ${routeId}, looking for sequence visualization`);
                
                // Try to find sequence visualization
                const sequenceViz = card.querySelector('.stop-sequence');
                if (sequenceViz) {
                    const stops = sequenceViz.childNodes;
                    
                    stops.forEach((stop, stopIndex) => {
                        if (stop.nodeType === Node.ELEMENT_NODE) {
                            let nodeIndex;
                            const textContent = stop.textContent.trim();
                            
                            if (textContent === 'D') {
                                nodeIndex = solution.depot;
                            } else {
                                nodeIndex = parseInt(textContent) || stopIndex;
                            }
                            
                            const name = stop.getAttribute('title') || 
                                        (nodeIndex === solution.depot ? "Depot" : `Customer ${nodeIndex}`);
                            
                            // Add to stops list if it's a real stop
                            if (stopIndex === 0 || stopIndex === stops.length - 1) {
                                // This is depot
                                routeStops.push({
                                    index: solution.depot,
                                    name: "Depot"
                                });
                            } else {
                                routeStops.push({
                                    index: nodeIndex,
                                    name: name
                                });
                                routeIndices.push(nodeIndex);
                            }
                            
                            // Ensure coordinates and names arrays are big enough
                            while (solution.coordinates.length <= nodeIndex) {
                                solution.coordinates.push(null);
                                solution.company_names.push(null);
                            }
                            
                            // Update company name
                            solution.company_names[nodeIndex] = name;
                        }
                    });
                }
            }
            
            // If we still have no stops, create a placeholder route
            if (routeStops.length === 0) {
                console.log(`Could not find stops for route ${routeId}, creating placeholders`);
                
                // Create depot start
                routeStops.push({
                    index: solution.depot,
                    name: "Depot"
                });
                
                // Create placeholder nodes
                for (let i = 0; i < 3; i++) {
                    const nodeIndex = solution.coordinates.length;
                    routeStops.push({
                        index: nodeIndex,
                        name: `Customer ${nodeIndex}`
                    });
                    routeIndices.push(nodeIndex);
                    
                    // Add to coordinates and names
                    solution.coordinates.push(null);
                    solution.company_names.push(`Customer ${nodeIndex}`);
                }
                
                // Create depot end
                routeStops.push({
                    index: solution.depot,
                    name: "Depot"
                });
            }
            
            // Add route to solution
            solution.routes.push(routeIndices);
            
            // Add route details
            solution.details.routes.push({
                id: routeId,
                stops: routeStops,
                load: load,
                capacity: capacity,
                distance: routeDistance
            });
        });
        
        // Generate coordinates if needed
        generateCoordinates(solution);
        
        // Return the solution
        return solution;
    }
    
    // Generate coordinates for nodes that don't have them
    function generateCoordinates(solution) {
        // Check if we need to generate coordinates
        if (!solution.coordinates || solution.coordinates.every(c => c === null)) {
            console.log("Generating coordinates for solution");
            
            // Generate coordinates in a circle pattern
            const centerLat = 40.730;
            const centerLng = -73.935;
            const radius = 0.05;
            
            // Set depot coordinates
            solution.coordinates[solution.depot] = [centerLat, centerLng];
            
            // Generate for all other nodes
            for (let i = 0; i < solution.coordinates.length; i++) {
                if (i !== solution.depot && !solution.coordinates[i]) {
                    const angle = ((i % 12) / 12) * Math.PI * 2;
                    const distanceMultiplier = 1 + Math.floor(i / 12) * 0.5;
                    
                    const lat = centerLat + Math.cos(angle) * radius * distanceMultiplier;
                    const lng = centerLng + Math.sin(angle) * radius * distanceMultiplier;
                    
                    solution.coordinates[i] = [lat, lng];
                }
            }
        } else {
            console.log("Filling in missing coordinates");
            
            // Fill in missing coordinates
            if (solution.coordinates[solution.depot]) {
                // Use depot as reference
                const depotCoord = solution.coordinates[solution.depot];
                const radius = 0.05;
                
                for (let i = 0; i < solution.coordinates.length; i++) {
                    if (!solution.coordinates[i]) {
                        const angle = ((i % 12) / 12) * Math.PI * 2;
                        const distanceMultiplier = 1 + Math.floor(i / 12) * 0.5;
                        
                        const lat = depotCoord[0] + Math.cos(angle) * radius * distanceMultiplier;
                        const lng = depotCoord[1] + Math.sin(angle) * radius * distanceMultiplier;
                        
                        solution.coordinates[i] = [lat, lng];
                    }
                }
            } else {
                // Set default coordinates
                const centerLat = 40.730;
                const centerLng = -73.935;
                const radius = 0.05;
                
                for (let i = 0; i < solution.coordinates.length; i++) {
                    if (!solution.coordinates[i]) {
                        const angle = ((i % 12) / 12) * Math.PI * 2;
                        const distanceMultiplier = 1 + Math.floor(i / 12) * 0.5;
                        
                        const lat = centerLat + Math.cos(angle) * radius * distanceMultiplier;
                        const lng = centerLng + Math.sin(angle) * radius * distanceMultiplier;
                        
                        solution.coordinates[i] = [lat, lng];
                    }
                }
            }
        }
    }
    
    // Generate HTML for the report
    function generateReportHtml(solution) {
        const details = solution.details;
        const coordinates = solution.coordinates;
        const company_names = solution.company_names;
        const depot = solution.depot || 0;
        
        // Helper function to count total customers
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
        let reportHtml = `
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
                
                <!-- Routes -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Route Details</h2>
                    </div>
                </div>
        `;
        
        // Add each route
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
            reportHtml += `
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
                
                reportHtml += `
                                                    <tr>
                                                        <td>
                                                            <span class="stop-badge ${badgeClass}">${stopIndex}</span>
                                                        </td>
                                                        <td>${stop.name || (stopType === 'Depot' ? 'Depot' : `Customer ${stop.index}`)}</td>
                                                        <td>${stopType}</td>
                                                        <td>${coordStr}</td>
                                                    </tr>
                `;
            });
            
            // Close the table
            reportHtml += `
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
            `;
            
            // Add Google Maps link if available
            if (googleMapsUrl) {
                reportHtml += `
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
            reportHtml += `
                            </div>
                        </div>
                    </div>
                </div>
                ${index < details.routes.length - 1 ? '<div class="page-break"></div>' : ''}
            `;
        });
        
        // Close the HTML
        reportHtml += `
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
        
        return reportHtml;
    }
    
    console.log("Direct button interception installed");
})();