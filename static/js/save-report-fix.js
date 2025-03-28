// save-report-fix.js
// Add this to your static/js folder and include it in your index.html

(function() {
    console.log("Loading enhanced report storage fix...");
    
    // Store the original report generation function
    const originalGenerateReport = window.generateDetailedReport;
    
    // Replace with enhanced version
    window.generateDetailedReport = function(options = {}) {
        console.log("Enhanced report generation with improved database storage");
        
        // Default options
        const defaultOptions = {
            format: 'pdf',
            saveToDatabase: true,
            showPreview: true,
            debug: true // Enable debug mode
        };
        
        options = {...defaultOptions, ...options};
        
        // Add loading indicator
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
        
        // Extract solution data from the page
        const solution = extractSolutionData();
        
        if (!solution) {
            removeLoading();
            alert("No solution data found. Please solve the problem first.");
            return;
        }
        
        // Generate report HTML
        const reportHtml = generateReportHtml(solution);
        
        // Load dependencies and generate PDF
        loadDependenciesAndGeneratePDF(reportHtml, solution)
            .then(pdfData => {
                if (options.showPreview) {
                    // Open in new window
                    const reportWindow = window.open('');
                    reportWindow.document.write(reportHtml);
                    reportWindow.document.close();
                }
                
                if (options.saveToDatabase) {
                    saveReportToDatabase(pdfData, solution, options.debug)
                        .then(result => {
                            console.log("Report saved successfully:", result);
                            showSuccessNotification(result.report_id);
                        })
                        .catch(error => {
                            console.error("Error saving report:", error);
                            showErrorNotification(error.message || "Failed to save report");
                        })
                        .finally(() => {
                            removeLoading();
                        });
                } else {
                    removeLoading();
                }
            })
            .catch(error => {
                console.error("Error generating PDF:", error);
                showErrorNotification("Error generating PDF: " + error.message);
                removeLoading();
            });
    };
    
    // Function to extract solution data from the page
    function extractSolutionData() {
        // First check window.appState
        if (window.appState && window.appState.solution) {
            return window.appState.solution;
        }
        
        // Next try global solution variable
        if (window.solution) {
            return window.solution;
        }
        
        // Try to extract from DOM
        try {
            return extractSolutionFromDOM();
        } catch (error) {
            console.error("Error extracting solution:", error);
            return null;
        }
    }
    
    // Extract solution from DOM elements
    function extractSolutionFromDOM() {
        const solution = {
            routes: [],
            details: {
                routes: [],
                total_distance: 0
            },
            coordinates: [],
            company_names: []
        };
        
        // Find all route cards
        const routeCards = document.querySelectorAll('#routeDetailsContainer .card');
        if (!routeCards || routeCards.length === 0) {
            throw new Error("No route cards found in DOM");
        }
        
        // Process each route card
        routeCards.forEach((card, index) => {
            // Get route details
            const routeId = index + 1;
            const routeNodes = [];
            const stops = [];
            
            // Get distance
            let distance = 0;
            const distanceMatch = card.textContent.match(/Distance:.*?([\d.]+)\s*km/);
            if (distanceMatch && distanceMatch[1]) {
                distance = parseFloat(distanceMatch[1]) * 1000; // Convert to meters
                solution.details.total_distance += distance;
            }
            
            // Get load and capacity
            let load = 0;
            let capacity = 20;
            const loadMatch = card.textContent.match(/Load:.*?([\d.]+)\s*\/\s*([\d.]+)/);
            if (loadMatch && loadMatch[1] && loadMatch[2]) {
                load = parseFloat(loadMatch[1]);
                capacity = parseFloat(loadMatch[2]);
            }
            
            // Get stops
            const stopItems = card.querySelectorAll('.stop-item, .stop-badge');
            
            if (stopItems && stopItems.length > 0) {
                // First and last stops are depot
                for (let i = 0; i < stopItems.length; i++) {
                    const isDepot = i === 0 || i === stopItems.length - 1;
                    const nodeIndex = isDepot ? 0 : solution.coordinates.length + 1;
                    
                    if (!isDepot) {
                        routeNodes.push(nodeIndex);
                    }
                    
                    stops.push({
                        index: nodeIndex,
                        name: isDepot ? "Depot" : `Customer ${nodeIndex}`
                    });
                    
                    // Ensure coordinates array is big enough
                    while (solution.coordinates.length <= nodeIndex) {
                        solution.coordinates.push([0, 0]);
                        solution.company_names.push(isDepot ? "Depot" : `Customer ${solution.company_names.length}`);
                    }
                }
            }
            
            // Add to solution
            solution.routes.push(routeNodes);
            solution.details.routes.push({
                id: routeId,
                stops: stops,
                load: load,
                capacity: capacity,
                distance: distance
            });
        });
        
        // Generate default coordinates if needed
        if (solution.coordinates.length === 0 || solution.coordinates.every(c => c[0] === 0 && c[1] === 0)) {
            solution.coordinates = generatePlaceholderCoordinates(solution.details.routes.length + 1);
        }
        
        return solution;
    }
    
    // Generate placeholder coordinates
    function generatePlaceholderCoordinates(count) {
        const coordinates = [];
        const centerLat = 40.730;
        const centerLng = -73.935;
        const radius = 0.05;
        
        coordinates.push([centerLat, centerLng]); // Depot
        
        for (let i = 1; i < count; i++) {
            const angle = ((i - 1) / (count - 1)) * Math.PI * 2;
            const lat = centerLat + Math.cos(angle) * radius;
            const lng = centerLng + Math.sin(angle) * radius;
            coordinates.push([lat, lng]);
        }
        
        return coordinates;
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
        
        // Create HTML content
        let html = `
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
        
        // Add route details
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
            html += `
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
                
                html += `
                    <tr>
                        <td>
                            <span class="stop-badge ${badgeClass}">${stopIndex}</span>
                        </td>
                        <td>${stop.name || (isDepot ? 'Depot' : `Customer ${stop.index}`)}</td>
                        <td>${stopType}</td>
                        <td>${coordStr}</td>
                    </tr>
                `;
            });
            
            // Close the table
            html += `
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
            `;
            
            // Add Google Maps link if available
            if (googleMapsUrl) {
                html += `
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
            html += `
                            </div>
                        </div>
                    </div>
                </div>
                ${index < details.routes.length - 1 ? '<div class="page-break"></div>' : ''}
            `;
        });
        
        // Close the HTML
        html += `
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
        
        return html;
    }
    
    // Load dependencies and generate PDF
    async function loadDependenciesAndGeneratePDF(html, solution) {
        // First load the dependencies
        await loadDependencies();
        
        // Create a temporary element to render the HTML
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '800px';
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv);
        
        try {
            // Convert HTML to canvas
            const canvas = await html2canvas(tempDiv, {
                scale: 1.5,
                useCORS: true,
                logging: false
            });
            
            // Create PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            return pdf.output('datauristring');
        } finally {
            // Cleanup
            document.body.removeChild(tempDiv);
        }
    }
    
    // Load jsPDF and html2canvas
    async function loadDependencies() {
        // Check if dependencies are already loaded
        if (window.jsPDF && window.html2canvas) {
            return;
        }
        
        // Load html2canvas
        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        // Load jsPDF
        if (!window.jsPDF) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    }
    
    // Save report to Supabase database
    async function saveReportToDatabase(pdfData, solution, debug = false) {
        try {
            // Create metadata
            const metadata = {
                created_at: new Date().toISOString(),
                route_count: solution.details.routes.length,
                total_distance: solution.details.total_distance,
                job_id: window.appState?.jobId || Math.random().toString(36).substring(2, 9),
                debug_info: debug ? {
                    user_agent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: Date.now()
                } : undefined
            };
            
            // Log the data being sent
            if (debug) {
                console.log("Saving report with metadata:", {
                    ...metadata,
                    pdf_size: pdfData.length
                });
            }
            
            // Make sure we have a valid CSRF token if needed
            const csrfToken = getCSRFToken();
            
            // Send to server
            const response = await fetch('/save_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    pdf_data: pdfData,
                    metadata: metadata
                }),
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                // For non-JSON responses
                if (!response.headers.get('content-type')?.includes('application/json')) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save report');
            }
            
            return result;
        } catch (error) {
            console.error("Error in saveReportToDatabase:", error);
            throw error;
        }
    }
    
    // Helper function to get CSRF token
    function getCSRFToken() {
        // Look for CSRF token in meta tag
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (metaToken) return metaToken;
        
        // Look for CSRF token in form
        const formToken = document.querySelector('input[name="csrf_token"]')?.value;
        if (formToken) return formToken;
        
        // Return empty string if not found
        return '';
    }
    
    // Display success notification
    function showSuccessNotification(reportId) {
        // Create notification element
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
        notificationDiv.style.top = '20px';
        notificationDiv.style.right = '20px';
        notificationDiv.style.zIndex = '9999';
        notificationDiv.style.maxWidth = '400px';
        notificationDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        notificationDiv.innerHTML = `
            <strong><i class="fas fa-check-circle me-2"></i>Success!</strong>
            <p>Report saved successfully to your account.</p>
            <a href="/view_report/${reportId}" target="_blank" class="btn btn-sm btn-primary">View Report</a>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to document
        document.body.appendChild(notificationDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notificationDiv)) {
                notificationDiv.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(notificationDiv)) {
                        document.body.removeChild(notificationDiv);
                    }
                }, 300);
            }
        }, 5000);
        
        // Also add to results tab as a permanent notification
        const resultsTab = document.getElementById('results');
        if (resultsTab) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-success alert-dismissible fade show mb-4';
            alertDiv.innerHTML = `
                <strong><i class="fas fa-check-circle me-2"></i>Report Saved!</strong>
                <p>Your route optimization report has been saved to your account.</p>
                <div class="mt-2">
                    <a href="/view_report/${reportId}" target="_blank" class="btn btn-sm btn-primary">
                        <i class="fas fa-file-pdf me-1"></i> View Report
                    </a>
                    <a href="/my_reports" class="btn btn-sm btn-outline-primary ms-2">
                        <i class="fas fa-folder me-1"></i> All Reports
                    </a>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            // Insert at the top
            resultsTab.insertBefore(alertDiv, resultsTab.firstChild);
        }
    }
    
    // Display error notification
    function showErrorNotification(message) {
        // Create notification element
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        notificationDiv.style.top = '20px';
        notificationDiv.style.right = '20px';
        notificationDiv.style.zIndex = '9999';
        notificationDiv.style.maxWidth = '400px';
        notificationDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        notificationDiv.innerHTML = `
            <strong><i class="fas fa-exclamation-circle me-2"></i>Error</strong>
            <p>${message}</p>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to document
        document.body.appendChild(notificationDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notificationDiv)) {
                notificationDiv.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(notificationDiv)) {
                        document.body.removeChild(notificationDiv);
                    }
                }, 300);
            }
        }, 5000);
        
        // Also add to results tab as a permanent error
        const resultsTab = document.getElementById('results');
        if (resultsTab) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger alert-dismissible fade show mb-4';
            alertDiv.innerHTML = `
                <strong><i class="fas fa-exclamation-circle me-2"></i>Error Saving Report</strong>
                <p>${message}</p>
                <p class="mb-0">The report was still generated successfully, but could not be saved to your account.</p>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            // Insert at the top
            resultsTab.insertBefore(alertDiv, resultsTab.firstChild);
        }
    }
    
    console.log("Enhanced report storage fix loaded successfully");
})();