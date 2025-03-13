// Enhanced solution overview display
// This script improves the solution overview in the results tab

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced solution overview display...");
    
    // Override the original displaySolutionOverview function
    window.displaySolutionOverview = function(solution) {
        const solutionContainer = document.getElementById('solutionContainer');
        
        // Clear previous content
        solutionContainer.innerHTML = '';
        
        // Solution details
        const details = solution.details;
        
        // Convert total distance from meters to kilometers
        const totalDistanceKm = (details.total_distance / 1000).toFixed(2);
        
        // Create solution overview card
        const overviewCard = document.createElement('div');
        overviewCard.className = 'card shadow-sm mb-4';
        
        // Create summary section
        let summaryHTML = `
            <div class="card-header bg-primary text-white">
                <h5 class="card-title mb-0">
                    <i class="fas fa-route me-2"></i>Solution Summary
                </h5>
            </div>
            <div class="card-body">
                <div class="row g-0">
                    <div class="col-md-4 border-end">
                        <div class="text-center p-3">
                            <h3 class="display-4 text-primary mb-0">${totalDistanceKm}</h3>
                            <p class="lead">Total Distance (km)</p>
                        </div>
                    </div>
                    <div class="col-md-4 border-end">
                        <div class="text-center p-3">
                            <h3 class="display-4 text-primary mb-0">${details.routes.length}</h3>
                            <p class="lead">Number of Routes</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="text-center p-3">
                            <h3 class="display-4 text-primary mb-0">${countTotalCustomers(details.routes)}</h3>
                            <p class="lead">Total Customers</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create routes overview section
        let routesOverviewHTML = `
            <div class="table-responsive">
                <table class="table table-hover table-striped">
                    <thead class="table-light">
                        <tr>
                            <th>Route #</th>
                            <th>Stops</th>
                            <th>Load</th>
                            <th>Capacity %</th>
                            <th>Distance</th>
                            <th>Visualization</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add rows for each route
        details.routes.forEach((route, index) => {
            const routeColor = getRouteColor(index);
            const loadPercentage = (route.load / route.capacity) * 100;
            const loadColorClass = loadPercentage > 90 ? 'bg-danger' : 
                                  loadPercentage > 75 ? 'bg-warning' : 'bg-success';
            const routeDistanceKm = (route.distance / 1000).toFixed(2);
            
            routesOverviewHTML += `
                <tr>
                    <td>
                        <span class="badge rounded-pill" style="background-color: ${routeColor}">
                            Route ${route.id}
                        </span>
                    </td>
                    <td>${route.stops.length - 2} customers</td>
                    <td>${route.load}/${route.capacity}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar ${loadColorClass}" 
                                role="progressbar" 
                                style="width: ${loadPercentage}%" 
                                aria-valuenow="${loadPercentage}" 
                                aria-valuemin="0" 
                                aria-valuemax="100">
                                ${loadPercentage.toFixed(0)}%
                            </div>
                        </div>
                    </td>
                    <td>${routeDistanceKm} km</td>
                    <td>
                        <div class="stop-sequence">
                            ${createRouteSequenceHTML(route)}
                        </div>
                    </td>
                </tr>
            `;
        });
        
        routesOverviewHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Combine everything into the overview card
        overviewCard.innerHTML = summaryHTML + routesOverviewHTML;
        solutionContainer.appendChild(overviewCard);
        
        // Add export buttons
        addExportButtons(solutionContainer, solution);
    };
    
    // Helper function to get route color
    function getRouteColor(index) {
        const routeColors = [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
            '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
        ];
        return routeColors[index % routeColors.length];
    }
    
    // Helper function to count total customers
    function countTotalCustomers(routes) {
        let total = 0;
        routes.forEach(route => {
            // Subtract 2 for the depot (start and end)
            total += route.stops.length - 2;
        });
        return total;
    }
    
    // Helper function to create route sequence visualization
    function createRouteSequenceHTML(route) {
        const stops = route.stops;
        let html = '';
        
        stops.forEach((stop, index) => {
            const isDepot = index === 0 || index === stops.length - 1;
            const stopClass = isDepot ? 'depot-stop' : 'customer-stop';
            const label = isDepot ? 'D' : index;
            
            html += `
                <div class="stop-item ${stopClass}" 
                     title="${stop.name}" 
                     data-bs-toggle="tooltip" 
                     data-bs-placement="top">
                    ${label}
                </div>
            `;
        });
        
        return html;
    }
    
    // Helper function to add export buttons
    function addExportButtons(container, solution) {
        const exportBtns = document.createElement('div');
        exportBtns.className = 'btn-group mt-3';
        exportBtns.innerHTML = `
            <button class="btn btn-outline-primary" id="exportCSVBtn">
                <i class="fas fa-file-csv me-2"></i>Export Routes to CSV
            </button>
            <button class="btn btn-outline-secondary" id="printSolutionBtn">
                <i class="fas fa-print me-2"></i>Print Solution
            </button>
        `;
        
        container.appendChild(exportBtns);
        
        // Add event listeners
        document.getElementById('exportCSVBtn').addEventListener('click', function() {
            exportSolutionToCSV(solution);
        });
        
        document.getElementById('printSolutionBtn').addEventListener('click', function() {
            printSolution(solution);
        });
    }
    
    // Function to export solution to CSV
    function exportSolutionToCSV(solution) {
        const details = solution.details;
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += "Route,Stop Order,Stop Name,Node ID,Type,Coordinates\n";
        
        // Add data for each route
        details.routes.forEach(route => {
            route.stops.forEach((stop, index) => {
                const isDepot = index === 0 || index === route.stops.length - 1;
                const stopType = isDepot ? 'Depot' : 'Customer';
                
                const coords = solution.coordinates[stop.index];
                const coordsStr = coords ? `${coords[0]},${coords[1]}` : 'N/A';
                
                csvContent += `${route.id},${index},"${stop.name}",${stop.index},${stopType},${coordsStr}\n`;
            });
        });
        
        // Create and trigger download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "solution_routes.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Function to print solution
    function printSolution(solution) {
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            alert('Please allow pop-ups to print the solution');
            return;
        }
        
        const details = solution.details;
        const totalDistanceKm = (details.total_distance / 1000).toFixed(2);
        
        let printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>CVRP Solution - ${new Date().toLocaleString()}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .summary { display: flex; margin-bottom: 20px; }
                    .summary-item { flex: 1; text-align: center; padding: 10px; border: 1px solid #ddd; margin: 0 5px; }
                    .route-header { background-color: #f2f2f2; font-weight: bold; }
                    .route-table { page-break-inside: avoid; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                        h2 { page-break-before: always; }
                        h2:first-of-type { page-break-before: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px;">
                    <button onclick="window.print()">Print Solution</button>
                    <button onclick="window.close()">Close</button>
                </div>
                
                <h1>CVRP Solution - ${new Date().toLocaleString()}</h1>
                
                <div class="summary">
                    <div class="summary-item">
                        <h3>${totalDistanceKm} km</h3>
                        <p>Total Distance</p>
                    </div>
                    <div class="summary-item">
                        <h3>${details.routes.length}</h3>
                        <p>Number of Routes</p>
                    </div>
                    <div class="summary-item">
                        <h3>${countTotalCustomers(details.routes)}</h3>
                        <p>Total Customers</p>
                    </div>
                </div>
                
                <h2>Routes Summary</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Route</th>
                            <th>Stops</th>
                            <th>Load</th>
                            <th>Capacity</th>
                            <th>Distance (km)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${details.routes.map(route => `
                            <tr>
                                <td>Route ${route.id}</td>
                                <td>${route.stops.length - 2}</td>
                                <td>${route.load}/${route.capacity}</td>
                                <td>${((route.load / route.capacity) * 100).toFixed(0)}%</td>
                                <td>${(route.distance / 1000).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <h2>Detailed Routes</h2>
                ${details.routes.map(route => `
                    <div class="route-table">
                        <h3>Route ${route.id} - ${(route.distance / 1000).toFixed(2)} km</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Stop Order</th>
                                    <th>Stop Name</th>
                                    <th>Node ID</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${route.stops.map((stop, index) => `
                                    <tr>
                                        <td>${index}</td>
                                        <td>${stop.name}</td>
                                        <td>${stop.index}</td>
                                        <td>${index === 0 || index === route.stops.length - 1 ? 'Depot' : 'Customer'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Optional: automatically trigger print
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    }
});