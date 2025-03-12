// Function to fix the convergence plot display
function showConvergencePlot(costHistory, tempHistory) {
    const convergencePlotContainer = document.getElementById('convergencePlotContainer');
    
    // Clear previous content and create canvas
    convergencePlotContainer.innerHTML = '<canvas id="convergenceChart"></canvas>';
    
    // Make sure the container is visible with a fixed height
    convergencePlotContainer.style.height = '350px';
    convergencePlotContainer.style.width = '100%';
    
    // Create chart with delay to ensure container is ready
    setTimeout(() => {
        const ctx = document.getElementById('convergenceChart').getContext('2d');
        
        // Prepare data - ensure we have valid data
        if (!costHistory || !tempHistory || costHistory.length === 0 || tempHistory.length === 0) {
            console.error('Missing or empty cost/temperature history data');
            convergencePlotContainer.innerHTML = '<div class="alert alert-warning">No convergence data available</div>';
            return;
        }
        
        // Log the data for debugging
        console.log('Cost history:', costHistory);
        console.log('Temperature history:', tempHistory);
        
        const iterations = Array.from({length: costHistory.length}, (_, i) => i);
        
        // Convert cost values from meters to kilometers for display
        const costHistoryKm = costHistory.map(cost => cost / 1000);

        // Get min and max for better scaling
        const minCost = Math.min(...costHistoryKm) * 0.9;
        const maxCost = Math.max(...costHistoryKm) * 1.1;
        
        // Ensure temperature scale works with logarithmic axis (no zero values)
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
                        max: maxCost,
                        title: {
                            display: true,
                            text: 'Best Cost (km)'
                        }
                    },
                    y1: {
                        type: 'logarithmic',
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
        
        console.log('Chart created:', chart);
    }, 100); // Small delay to ensure DOM is ready
}

// Export the function to replace the existing one
window.showConvergencePlot = showConvergencePlot;