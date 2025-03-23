// usage-tracking-fix.js
// Add this to your static/js/ folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced usage tracking system (v5)...");
    
    // Track successful operations
    window.successfulOperations = {
        route: false,      // Whether a route was created in this session
        algorithm: false   // Whether an algorithm was run in this session
    };
    
    // Original functions to record usage
    const originalRecordRouteUsage = window.recordRouteUsage;
    const originalRecordAlgorithmRun = window.recordAlgorithmRun;
    
    // Enhanced function to record route usage with better error handling and confirmation
    window.recordRouteUsage = function(force = false) {
        // Skip if already recorded unless forced
        if (window.successfulOperations.route && !force) {
            console.log("Route usage already recorded for this session");
            return Promise.resolve({ success: true, alreadyRecorded: true });
        }
        
        // Call original function if it exists
        if (typeof originalRecordRouteUsage === 'function') {
            return originalRecordRouteUsage().then(result => {
                if (result.success) {
                    window.successfulOperations.route = true;
                    console.log("Route usage recorded successfully");
                }
                return result;
            });
        }
        
        // Fallback implementation
        console.log("Recording route usage...");
        return fetch('/record_route_usage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                client_side: true,
                timestamp: new Date().toISOString()
            }),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.successfulOperations.route = true;
                console.log("Route usage recorded successfully via fallback");
            }
            return data;
        })
        .catch(error => {
            console.error("Error recording route usage:", error);
            // Return a standardized error response
            return { success: false, error: error.message };
        });
    };
    
    // Enhanced function to record algorithm run with better confirmation
    window.recordAlgorithmRun = function(force = false) {
        // Skip if already recorded unless forced
        if (window.successfulOperations.algorithm && !force) {
            console.log("Algorithm run already recorded for this session");
            return Promise.resolve({ success: true, alreadyRecorded: true });
        }
        
        // Call original function if it exists
        if (typeof originalRecordAlgorithmRun === 'function') {
            return originalRecordAlgorithmRun().then(result => {
                if (result.success) {
                    window.successfulOperations.algorithm = true;
                    console.log("Algorithm run recorded successfully");
                }
                return result;
            });
        }
        
        // Fallback implementation
        console.log("Recording algorithm run...");
        return fetch('/record_algorithm_run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                client_side: true,
                timestamp: new Date().toISOString()
            }),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.successfulOperations.algorithm = true;
                console.log("Algorithm run recorded successfully via fallback");
            }
            return data;
        })
        .catch(error => {
            console.error("Error recording algorithm run:", error);
            // Return a standardized error response
            return { success: false, error: error.message };
        });
    };
    
    // Enhanced function to record both operations at once
    window.recordSolverOperations = function(force = false) {
        console.log("Recording both route and algorithm operations...");
        return Promise.all([
            window.recordRouteUsage(force),
            window.recordAlgorithmRun(force)
        ]).then(results => {
            return {
                success: results[0].success && results[1].success,
                route: results[0],
                algorithm: results[1]
            };
        });
    };
    
    // Function to refresh dashboard stats
    window.refreshDashboardStats = function() {
        console.log("Refreshing dashboard stats...");
        
        // Check if we're on the dashboard page
        const routeUsageCount = document.querySelector('.route-usage-count');
        const creditsElement = document.querySelector('.algorithm-credits');
        
        if (!routeUsageCount && !creditsElement) {
            console.log("Not on dashboard, skipping refresh");
            return Promise.resolve(false);
        }
        
        // Fetch current status
        return fetch('/subscription/status')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.subscription) {
                    console.log("Got fresh subscription data:", data.subscription);
                    
                    // Update route usage count
                    const routesUsed = data.subscription.routes_used || 0;
                    const maxRoutes = data.subscription.max_routes || 5;
                    
                    document.querySelectorAll('.route-usage-count').forEach(el => {
                        el.textContent = routesUsed;
                    });
                    
                    // Update progress bars
                    const percentage = Math.min(100, Math.round((routesUsed / maxRoutes) * 100));
                    document.querySelectorAll('.route-usage-progress').forEach(el => {
                        el.style.width = `${percentage}%`;
                        el.setAttribute('aria-valuenow', routesUsed);
                    });
                    
                    // Update text displays
                    document.querySelectorAll('.routes-used-text').forEach(el => {
                        el.textContent = `${routesUsed} of ${maxRoutes}`;
                    });
                    
                    // Update algorithm credits if available
                    const creditsUsed = data.subscription.credits_used || 0;
                    const maxCredits = data.subscription.max_credits || 10;
                    
                    document.querySelectorAll('.algorithm-credits').forEach(el => {
                        el.textContent = `${creditsUsed}/${maxCredits}`;
                    });
                    
                    document.querySelectorAll('.credits-progress').forEach(el => {
                        const creditsPercentage = Math.min(100, Math.round((creditsUsed / maxCredits) * 100));
                        el.style.width = `${creditsPercentage}%`;
                    });
                    
                    return true;
                }
                return false;
            })
            .catch(error => {
                console.error("Error refreshing stats:", error);
                return false;
            });
    };
    
    // Enhance the solution display to record and refresh stats
    const originalDisplaySolutionResults = window.displaySolutionResults;
    if (typeof originalDisplaySolutionResults === 'function') {
        window.displaySolutionResults = function(data) {
            // First record both operations if solution is successful
            if (data && data.success) {
                console.log("Solution successful, recording operations...");
                
                // Force record operations to ensure they're tracked
                window.recordSolverOperations(true)
                    .then(result => {
                        console.log("Solver operations recorded after successful solution:", result);
                        
                        // Refresh dashboard stats
                        window.refreshDashboardStats().then(refreshed => {
                            console.log("Dashboard stats refreshed:", refreshed);
                        });
                    })
                    .catch(error => {
                        console.error("Error recording operations after solution:", error);
                    });
            }
            
            // Call original function
            return originalDisplaySolutionResults(data);
        };
        console.log("Enhanced displaySolutionResults function");
    }
    
    // Add refresh button to dashboard
    function addRefreshButton() {
        const usageStatsCard = document.querySelector('.card:has(.route-usage-count)');
        if (usageStatsCard) {
            const cardHeader = usageStatsCard.querySelector('.card-header');
            if (cardHeader) {
                // Check if button already exists
                if (!cardHeader.querySelector('#refreshStatsBtn')) {
                    // Create wrapper for title and refresh button
                    const wrapper = document.createElement('div');
                    wrapper.className = 'd-flex justify-content-between align-items-center w-100';
                    
                    // Move existing content to wrapper
                    const existingContent = cardHeader.innerHTML;
                    const titleDiv = document.createElement('div');
                    titleDiv.innerHTML = existingContent;
                    wrapper.appendChild(titleDiv);
                    
                    // Add refresh button
                    const refreshBtn = document.createElement('button');
                    refreshBtn.id = 'refreshStatsBtn';
                    refreshBtn.className = 'btn btn-sm btn-outline-primary';
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                    refreshBtn.title = 'Refresh usage statistics';
                    refreshBtn.addEventListener('click', function() {
                        this.disabled = true;
                        this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
                        window.refreshDashboardStats().then(() => {
                            this.disabled = false;
                            this.innerHTML = '<i class="fas fa-sync-alt"></i>';
                        });
                    });
                    wrapper.appendChild(refreshBtn);
                    
                    // Replace card header content
                    cardHeader.innerHTML = '';
                    cardHeader.appendChild(wrapper);
                }
            }
        }
    }
    
    // Enhance solve button to record usage before and after solving
    function enhanceSolveButton() {
        const solveBtn = document.getElementById('solveBtn');
        if (!solveBtn) return;
        
        console.log("Enhancing solve button...");
        
        // Store original handler
        const originalOnClick = solveBtn.onclick;
        
        // Replace with enhanced handler
        solveBtn.onclick = function(e) {
            if (e) e.preventDefault();
            
            console.log("Enhanced solve button clicked");
            
            // Record usage before solving
            solveBtn.disabled = true;
            solveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Recording usage...';
            
            window.recordSolverOperations()
                .then(result => {
                    console.log("Usage recorded before solving:", result);
                    
                    // Reset button
                    solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                    
                    // Call original handler or trigger solve
                    if (typeof originalOnClick === 'function') {
                        console.log("Calling original solve handler");
                        originalOnClick.call(this, e);
                    } else {
                        console.log("No original handler, starting solve process");
                        startSolveProcess();
                    }
                })
                .catch(error => {
                    console.error("Error recording usage:", error);
                    
                    // Reset button and allow solving anyway
                    solveBtn.disabled = false;
                    solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                    
                    if (typeof originalOnClick === 'function') {
                        originalOnClick.call(this, e);
                    }
                });
                
            return false;
        };
    }
    
    // Function to start solve process (fallback if original handler is missing)
    function startSolveProcess() {
        const solveBtn = document.getElementById('solveBtn');
        const solverProgressContainer = document.getElementById('solverProgressContainer');
        const solverProgressBar = document.getElementById('solverProgressBar');
        const solverStatusMessage = document.getElementById('solverStatusMessage');
        
        // Show progress container
        if (solverProgressContainer) {
            solverProgressContainer.style.display = 'block';
        }
        
        // Update button
        if (solveBtn) {
            solveBtn.disabled = true;
            solveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Solving...';
        }
        
        // Get params from form
        const params = {
            initial_temperature: parseFloat(document.getElementById('initialTempInput')?.value || 1000.0),
            final_temperature: parseFloat(document.getElementById('finalTempInput')?.value || 1.0),
            cooling_rate: parseFloat(document.getElementById('coolingRateInput')?.value || 0.98),
            max_iterations: parseInt(document.getElementById('maxIterInput')?.value || 1000),
            iterations_per_temp: parseInt(document.getElementById('iterPerTempInput')?.value || 100),
            max_vehicles: parseInt(document.getElementById('maxVehiclesInput')?.value || 5)
        };
        
        // Call solve endpoint
        fetch('/solve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Solve process started successfully:", data);
                // Start checking status
                checkSolverStatus(data.job_id);
            } else {
                console.error("Error starting solve process:", data.error);
                if (solverStatusMessage) {
                    solverStatusMessage.textContent = `Error: ${data.error}`;
                }
                if (solveBtn) {
                    solveBtn.disabled = false;
                    solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                }
            }
        })
        .catch(error => {
            console.error("Error calling solve endpoint:", error);
            if (solverStatusMessage) {
                solverStatusMessage.textContent = `Error: ${error.message}`;
            }
            if (solveBtn) {
                solveBtn.disabled = false;
                solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
            }
        });
    }
    
    // Function to check solver status
    function checkSolverStatus(jobId) {
        const solverProgressBar = document.getElementById('solverProgressBar');
        const solverStatusMessage = document.getElementById('solverStatusMessage');
        
        // Call status endpoint
        fetch(`/solver_status/${jobId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update progress
                    if (solverProgressBar) {
                        solverProgressBar.style.width = `${data.progress}%`;
                        solverProgressBar.setAttribute('aria-valuenow', data.progress);
                    }
                    
                    if (solverStatusMessage) {
                        solverStatusMessage.textContent = data.message;
                    }
                    
                    // Add updates to live updates container
                    const liveUpdatesContainer = document.getElementById('liveUpdatesContainer');
                    if (liveUpdatesContainer && data.updates && data.updates.length > 0) {
                        data.updates.forEach(update => {
                            const updateDiv = document.createElement('div');
                            updateDiv.className = 'update-entry';
                            
                            if (update.time) {
                                updateDiv.innerHTML = `
                                    <small class="text-muted">${update.time}</small>
                                    <span class="ms-2">Iteration: ${update.iteration}, Temp: ${update.temperature.toFixed(2)}, 
                                        Best Cost: ${update.best_cost.toFixed(2)}</span>
                                `;
                            } else {
                                updateDiv.textContent = update.message || 'Update received';
                            }
                            
                            liveUpdatesContainer.appendChild(updateDiv);
                            liveUpdatesContainer.scrollTop = liveUpdatesContainer.scrollHeight;
                        });
                    }
                    
                    // Check if solution is ready
                    if (data.status === 'completed' && data.solution) {
                        console.log("Solution ready:", data.solution);
                        // Display solution and record operations
                        if (typeof window.displaySolutionResults === 'function') {
                            window.displaySolutionResults({
                                success: true,
                                solution: data.solution
                            });
                        }
                    } else if (data.status === 'error') {
                        console.error("Solver error:", data.message);
                        if (solverStatusMessage) {
                            solverStatusMessage.textContent = `Error: ${data.message}`;
                        }
                        // Reset solve button
                        const solveBtn = document.getElementById('solveBtn');
                        if (solveBtn) {
                            solveBtn.disabled = false;
                            solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                        }
                    } else {
                        // Continue checking status
                        setTimeout(() => checkSolverStatus(jobId), 1000);
                    }
                } else {
                    console.error("Error checking solver status:", data.error);
                }
            })
            .catch(error => {
                console.error("Error fetching solver status:", error);
                // Try again after a delay
                setTimeout(() => checkSolverStatus(jobId), 2000);
            });
    }
    
    // Initialize tracking enhancements
    function initialize() {
        // Run on page load
        console.log("Initializing enhanced usage tracking...");
        
        // Add refresh button to dashboard
        addRefreshButton();
        
        // Enhance solve button
        enhanceSolveButton();
        
        // Set up auto-refresh for dashboard
        if (window.location.pathname.includes('/dashboard')) {
            // Initial refresh
            window.refreshDashboardStats();
            
            // Periodic refresh every 30 seconds
            setInterval(window.refreshDashboardStats, 30000);
        }
        
        // Auto-record after page load if we're displaying a solution
        setTimeout(() => {
            const solutionContainer = document.getElementById('solutionContainer');
            if (solutionContainer && solutionContainer.children.length > 0) {
                console.log("Solution already displayed, recording operations...");
                window.recordSolverOperations();
            }
        }, 2000);
    }
    
    // Run initialization
    initialize();
});