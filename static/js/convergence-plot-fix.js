// Unified convergence plot function to replace all existing implementations
function showConvergencePlot(costHistory, tempHistory) {
    console.log("Showing convergence plot with:", 
        { costPoints: costHistory?.length, tempPoints: tempHistory?.length });
    
    const container = document.getElementById('convergencePlotContainer');
    if (!container) {
        console.error("Convergence plot container not found!");
        return;
    }
    
    // Clear and prepare container
    container.innerHTML = '<canvas id="convergenceChart"></canvas>';
    container.style.height = '350px';
    container.style.width = '100%';
    
    // Validate data
    if (!costHistory || !tempHistory || costHistory.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No convergence data available</div>';
        return;
    }
    
    // Give DOM time to update before creating chart
    setTimeout(() => {
        try {
            const canvas = document.getElementById('convergenceChart');
            if (!canvas) {
                console.error("Canvas element not found");
                return;
            }
            
            const ctx = canvas.getContext('2d');
            
            // Prepare data
            const iterations = Array.from({length: costHistory.length}, (_, i) => i);
            
            // Convert cost values from meters to kilometers for display
            const costHistoryKm = costHistory.map(cost => cost / 1000);
            
            // Get min and max for better scaling
            const minCost = Math.min(...costHistoryKm) * 0.9;
            const maxCost = Math.max(...costHistoryKm) * 1.1;
            
            // Ensure temperature has no zero values for logarithmic scale
            const tempHistoryFixed = tempHistory.map(temp => Math.max(temp, 0.001));
            
            // Create chart
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
                            // Using linear scale is more reliable than logarithmic with varied data
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
        } catch (error) {
            console.error("Error creating chart:", error);
            container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
        }
    }, 100);
}

// Set this function as the global one to override any others
window.showConvergencePlot = showConvergencePlot;

// Handle tab visibility changes
document.addEventListener('DOMContentLoaded', function() {
    // Check if we should redraw the chart when results tab is shown
    const resultsTab = document.getElementById('results-tab');
    if (resultsTab) {
        resultsTab.addEventListener('shown.bs.tab', function() {
            console.log("Results tab shown - checking if chart needs redrawing");
            const canvas = document.getElementById('convergenceChart');
            const container = document.getElementById('convergencePlotContainer');
            
            // Force map to update when tab becomes visible
            if (window.map) {
                setTimeout(() => {
                    window.map.invalidateSize();
                }, 100);
            }
            
            // If we have an existing job ID, try to refresh the chart
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
        });
    }
});