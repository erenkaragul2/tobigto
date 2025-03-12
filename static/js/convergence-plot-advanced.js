// Enhanced convergence plot function with better debugging and data handling
(function() {
    console.log("Loading advanced convergence plot fix...");
    
    /**
     * The primary function to display convergence plots
     */
    function showConvergencePlotAdvanced(costHistory, tempHistory) {
        console.log("Advanced showConvergencePlot called with:", { 
            costHistoryType: typeof costHistory,
            costHistoryLength: costHistory ? costHistory.length : 'undefined', 
            tempHistoryType: typeof tempHistory,
            tempHistoryLength: tempHistory ? tempHistory.length : 'undefined' 
        });
        
        // Get container and check if it exists
        const container = document.getElementById('convergencePlotContainer');
        if (!container) {
            console.error("Convergence plot container not found!");
            return;
        }
        
        // Clear and prepare container
        container.innerHTML = '<canvas id="convergenceChart"></canvas>';
        container.style.height = '350px';
        container.style.width = '100%';
        
        // Validate data with detailed logging
        if (!costHistory) {
            console.error("Cost history is null or undefined");
            container.innerHTML = '<div class="alert alert-warning">No cost history data available</div>';
            return;
        }
        
        if (!tempHistory) {
            console.error("Temperature history is null or undefined");
            container.innerHTML = '<div class="alert alert-warning">No temperature history data available</div>';
            return;
        }
        
        if (!Array.isArray(costHistory)) {
            console.error("Cost history is not an array:", costHistory);
            container.innerHTML = '<div class="alert alert-warning">Invalid cost history data format</div>';
            return;
        }
        
        if (!Array.isArray(tempHistory)) {
            console.error("Temperature history is not an array:", tempHistory);
            container.innerHTML = '<div class="alert alert-warning">Invalid temperature history data format</div>';
            return;
        }
        
        if (costHistory.length === 0) {
            console.error("Cost history array is empty");
            container.innerHTML = '<div class="alert alert-warning">Empty cost history data</div>';
            return;
        }
        
        if (tempHistory.length === 0) {
            console.error("Temperature history array is empty");
            container.innerHTML = '<div class="alert alert-warning">Empty temperature history data</div>';
            return;
        }
        
        console.log("Cost history sample:", costHistory.slice(0, 5));
        console.log("Temperature history sample:", tempHistory.slice(0, 5));
        
        // Wait a short time to ensure DOM is updated before creating chart
        setTimeout(() => {
            try {
                // Get canvas element
                const canvas = document.getElementById('convergenceChart');
                if (!canvas) {
                    console.error("Canvas element 'convergenceChart' not found");
                    container.innerHTML = '<div class="alert alert-danger">Error: Canvas element not found</div>';
                    return;
                }
                
                // Get 2D context
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.error("Failed to get 2D context from canvas");
                    container.innerHTML = '<div class="alert alert-danger">Error: Failed to get canvas context</div>';
                    return;
                }
                
                // Prepare data
                const iterations = Array.from({length: costHistory.length}, (_, i) => i);
                
                // Validate cost values
                let hasInvalidCost = false;
                for (let i = 0; i < costHistory.length; i++) {
                    if (isNaN(parseFloat(costHistory[i]))) {
                        console.error(`Invalid cost value at index ${i}:`, costHistory[i]);
                        hasInvalidCost = true;
                        break;
                    }
                }
                
                if (hasInvalidCost) {
                    container.innerHTML = '<div class="alert alert-danger">Error: Invalid cost history values</div>';
                    return;
                }
                
                // Validate temperature values
                let hasInvalidTemp = false;
                for (let i = 0; i < tempHistory.length; i++) {
                    if (isNaN(parseFloat(tempHistory[i]))) {
                        console.error(`Invalid temperature value at index ${i}:`, tempHistory[i]);
                        hasInvalidTemp = true;
                        break;
                    }
                }
                
                if (hasInvalidTemp) {
                    container.innerHTML = '<div class="alert alert-danger">Error: Invalid temperature history values</div>';
                    return;
                }
                
                // Convert cost values from meters to kilometers for display
                const costHistoryKm = costHistory.map(cost => parseFloat(cost) / 1000);
                
                // Get min and max for better scaling
                const minCost = Math.min(...costHistoryKm) * 0.9;
                const maxCost = Math.max(...costHistoryKm) * 1.1;
                
                // Ensure temperature has no zero values for logarithmic scale
                const tempHistoryFixed = tempHistory.map(temp => Math.max(parseFloat(temp), 0.001));
                
                // Create chart with detailed options
                console.log("Creating chart with processed data");
                try {
                    const chart = new Chart(ctx, {
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
                                    min: minCost,
                                    title: {
                                        display: true,
                                        text: 'Best Cost (km)'
                                    }
                                },
                                y1: {
                                    // Use linear scale which is more reliable than logarithmic
                                    type: 'linear',
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
                    
                    // Force a resize event to ensure chart renders properly
                    window.dispatchEvent(new Event('resize'));
                } catch (chartError) {
                    console.error("Error creating Chart.js instance:", chartError);
                    container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${chartError.message}</div>`;
                }
            } catch (outerError) {
                console.error("Outer error in showConvergencePlot:", outerError);
                container.innerHTML = `<div class="alert alert-danger">Error: ${outerError.message}</div>`;
            }
        }, 100);
    }
    
    // Replace the original function with our enhanced version
    window.showConvergencePlot = showConvergencePlotAdvanced;
    
    // Add a helper function to manually fetch and display the convergence data
    window.refreshConvergencePlot = function() {
        if (window.appState && window.appState.jobId) {
            console.log("Manually refreshing convergence plot for job:", window.appState.jobId);
            
            fetch(`/get_solution/${window.appState.jobId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.cost_history && data.temp_history) {
                        console.log("Retrieved solution data for convergence plot");
                        showConvergencePlotAdvanced(data.cost_history, data.temp_history);
                        return "Convergence plot refreshed with server data";
                    } else {
                        console.error("Invalid or missing data from server:", data);
                        return "Failed to get valid data from server";
                    }
                })
                .catch(err => {
                    console.error("Error fetching solution data:", err);
                    return "Error fetching data: " + err.message;
                });
            
            return "Refresh request sent to server";
        } else {
            console.error("No job ID available in app state");
            return "No job ID available";
        }
    };
    
    // Add an event listener to trigger refresh when results tab is shown
    document.addEventListener('DOMContentLoaded', function() {
        // Check if we should redraw the chart when results tab is shown
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                console.log("Results tab shown - checking if chart needs redrawing");
                
                // If we have an existing job ID, try to refresh the chart
                if (window.appState && window.appState.jobId) {
                    console.log("Refreshing convergence plot for job:", window.appState.jobId);
                    window.refreshConvergencePlot();
                }
            });
        }
    });
    
    console.log("Advanced convergence plot fix loaded successfully");
})();