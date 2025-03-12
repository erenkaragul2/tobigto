// Create this as a new file: static/js/convergence-debug-fix.js

// Immediately execute debugging code when script is loaded
(function() {
    console.log("Convergence plot debug script loaded");
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded!");
    } else {
        console.log("Chart.js is properly loaded");
    }
    
    // Add debugging style to make container visible
    const debugStyle = document.createElement('style');
    debugStyle.textContent = `
        #convergencePlotContainer {
            border: 2px solid #ff0000;
            height: 350px !important;
            width: 100% !important;
            min-height: 350px !important;
            background-color: #f8f8f8;
            position: relative;
        }
        
        #convergenceChart {
            width: 100% !important;
            height: 100% !important;
            position: absolute;
            top: 0;
            left: 0;
        }
    `;
    document.head.appendChild(debugStyle);
})();

// Enhanced implementation of showConvergencePlot with strong error checking
window.showConvergencePlot = function(costHistory, tempHistory) {
    console.log("showConvergencePlot called with:", { 
        costHistoryLength: costHistory ? costHistory.length : 'undefined', 
        tempHistoryLength: tempHistory ? tempHistory.length : 'undefined' 
    });
    
    // Get the container
    const container = document.getElementById('convergencePlotContainer');
    if (!container) {
        console.error("Container not found!");
        return;
    }
    
    try {
        // Clear previous content and create canvas
        container.innerHTML = '<canvas id="convergenceChart"></canvas>';
        
        // Make container visible with explicit dimensions
        container.style.display = 'block';
        container.style.height = '350px';
        container.style.width = '100%';
        
        // Validate data
        if (!costHistory || !tempHistory || !costHistory.length || !tempHistory.length) {
            console.error("Invalid data for convergence plot:", { costHistory, tempHistory });
            container.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Error:</strong> No convergence data available.<br>
                    Cost history: ${costHistory ? costHistory.length : 'missing'} points<br>
                    Temperature history: ${tempHistory ? tempHistory.length : 'missing'} points
                </div>
            `;
            return;
        }
        
        // Log the data
        console.log("Cost history:", costHistory);
        console.log("Temperature history:", tempHistory);
        
        // Wait a moment for the DOM to be ready
        setTimeout(() => {
            try {
                const canvas = document.getElementById('convergenceChart');
                if (!canvas) {
                    console.error("Canvas element not found!");
                    return;
                }
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.error("Failed to get 2D context from canvas!");
                    return;
                }
                
                // Prepare data
                const iterations = Array.from({length: costHistory.length}, (_, i) => i);
                
                // Convert cost values from meters to kilometers for display
                const costHistoryKm = costHistory.map(cost => cost / 1000);
                
                // Calculate min and max for better y-axis scaling
                const minCost = Math.max(0, Math.min(...costHistoryKm) * 0.9);
                const maxCost = Math.max(...costHistoryKm) * 1.1;
                
                // Ensure no zeros for logarithmic scale
                const tempHistoryFixed = tempHistory.map(temp => Math.max(temp, 0.001));
                
                // Log processed data
                console.log("Cost history (km):", costHistoryKm);
                console.log("Temperature history (fixed):", tempHistoryFixed);
                
                // Create chart with explicit configuration
                const chartOptions = {
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
                                intersect: false
                            },
                            legend: {
                                display: true,
                                position: 'top'
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
                                type: 'linear', // Changed from logarithmic to linear for better visualization
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
                };
                
                console.log("Creating chart with options:", chartOptions);
                
                // Create the chart
                const chart = new Chart(ctx, chartOptions);
                console.log("Chart created successfully:", chart);
                
                // Force a resize to ensure chart renders properly
                window.dispatchEvent(new Event('resize'));
            } catch (error) {
                console.error("Error creating chart:", error);
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error creating chart:</strong> ${error.message}
                    </div>
                `;
            }
        }, 300); // Longer delay to ensure DOM is fully ready
    } catch (error) {
        console.error("Top level error in showConvergencePlot:", error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
};

// Add a helper function to ensure the Canvas element is visible and sized correctly
function checkCanvasVisibility() {
    const container = document.getElementById('convergencePlotContainer');
    const canvas = document.getElementById('convergenceChart');
    
    if (container && canvas) {
        console.log("Container dimensions:", {
            width: container.offsetWidth,
            height: container.offsetHeight,
            display: window.getComputedStyle(container).display
        });
        
        console.log("Canvas dimensions:", {
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            display: window.getComputedStyle(canvas).display
        });
        
        // Make sure canvas has explicit dimensions
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    } else {
        console.error("Container or canvas not found");
    }
}

// Add a MutationObserver to watch for tab changes
document.addEventListener('DOMContentLoaded', function() {
    // Function to check if the results tab is active
    function checkResultsTab() {
        const resultsTab = document.getElementById('results');
        if (resultsTab && window.getComputedStyle(resultsTab).display !== 'none') {
            console.log("Results tab is active");
            setTimeout(checkCanvasVisibility, 500);
            
            // If we have data in the session, try to rerender the chart
            if (window.appState && window.appState.jobId) {
                fetch(`/get_solution/${window.appState.jobId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.cost_history && data.temp_history) {
                            console.log("Refreshing convergence plot with server data");
                            showConvergencePlot(data.cost_history, data.temp_history);
                        }
                    })
                    .catch(err => console.error("Error fetching solution data:", err));
            }
        }
    }
    
    // Monitor tab changes
    const tabTriggers = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabTriggers.forEach(trigger => {
        trigger.addEventListener('shown.bs.tab', event => {
            if (event.target.id === 'results-tab') {
                setTimeout(checkResultsTab, 300);
            }
        });
    });
    
    // Also check initially in case results tab is already active
    setTimeout(checkResultsTab, 500);
});