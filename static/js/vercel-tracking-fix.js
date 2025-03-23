// Updated vercel-tracking-fix.js with improved reliability

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced usage tracking system (v4)");
    
    // Flag to track if we've already recorded usage for the current session
    window.usageRecorded = {
        route: false,
        
    };
    
    // Store original solve handler if it exists
    let originalSolveHandler = null;
    let originalRunClientSideSolver = null;
    
    // Track pending recording attempts
    window.pendingRecordingAttempt = null;
    
    // Create a queue for failed tracking attempts
    if (!window.trackingQueue) {
        window.trackingQueue = [];
    }
    
    // Function to record route usage via API call with improved retry logic
    window.recordRouteUsage = function(retryCount = 0) {
        // If already recording, return the pending promise
        if (window.pendingRecordingAttempt) {
            console.log("Route usage recording already in progress, returning pending promise");
            return window.pendingRecordingAttempt;
        }
        
        // Check if we've already recorded usage for this session
        if (window.usageRecorded.route) {
            console.log("Route usage already recorded for this session");
            return Promise.resolve({ success: true, alreadyRecorded: true });
        }
        
        console.log("Recording route usage via API");
        
        // Create a timestamp for debugging
        const timestamp = new Date().toISOString();
        const sessionId = Math.random().toString(36).substring(2, 15);
        
        // Prepare request with additional metadata for debugging
        const requestData = {
            client_side: true,
            timestamp: timestamp,
            browser: navigator.userAgent,
            session_id: sessionId
        };
        
        // Create the promise and store it
        window.pendingRecordingAttempt = new Promise((resolve, reject) => {
            // Make API call to record route usage
            fetch('/record_route_usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(requestData),
                // Add credentials to ensure cookies are sent
                credentials: 'same-origin'
            })
            .then(response => {
                // Handle non-JSON responses
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    // If not JSON, create a standardized error response
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    return { success: true, message: "Server returned non-JSON success response" };
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log("Route usage recorded successfully", data);
                    window.usageRecorded.route = true;
                    
                    // Save record in localStorage as backup
                    try {
                        localStorage.setItem('lastRecordedUsage', JSON.stringify({
                            timestamp: new Date().toISOString(),
                            routes_used: data.routes_used,
                            max_routes: data.max_routes
                        }));
                    } catch (e) {
                        console.warn("Could not save to localStorage:", e);
                    }
                    
                    // Update any UI elements showing route usage
                    updateRouteUsageDisplay(data.routes_used, data.max_routes);
                    
                    resolve(data);
                } else {
                    console.error("Failed to record route usage:", data.error);
                    
                    // Check if this is a limit reached error
                    if (data.limit_reached) {
                        handleRouteLimitReached(data);
                        reject({
                            limitReached: true,
                            message: data.error || "Route limit reached",
                            redirect: data.redirect
                        });
                    } 
                    // Check if server scheduled a retry
                    else if (data.retry_scheduled) {
                        console.log("Server scheduled a retry for next request");
                        // Mark as tentatively successful since server will retry
                        window.usageRecorded.route = true;
                        resolve({
                            success: true,
                            message: "Server will retry on next request",
                            retryScheduled: true
                        });
                    } 
                    else {
                        reject(new Error(data.error || 'Unknown error recording usage'));
                    }
                }
            })
            .catch(error => {
                console.error("Error recording route usage:", error);
                
                // Queue the failed attempt for recovery
                queueTrackingAttempt('route_usage', requestData);
                
                // Implement retry mechanism with exponential backoff
                if (retryCount < 3) {
                    console.log(`Retrying route usage recording (attempt ${retryCount + 1}/3)`);
                    
                    // Clear the pending promise
                    window.pendingRecordingAttempt = null;
                    
                    // Wait with exponential backoff and retry
                    const backoffTime = 1000 * Math.pow(2, retryCount);
                    console.log(`Waiting ${backoffTime}ms before retry`);
                    
                    setTimeout(() => {
                        window.recordRouteUsage(retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, backoffTime);
                } else {
                    // Despite the error, let's consider it a "success" from the flow perspective
                    // but mark it as untracked
                    resolve({ 
                        success: false, 
                        error: error.message,
                        untracked: true,
                        fallbackStorage: true
                    });
                }
            })
            .finally(() => {
                // Clear the pending promise reference when done
                window.pendingRecordingAttempt = null;
            });
        });
        
        return window.pendingRecordingAttempt;
    };
    
    
    
    // Combined function to record both usage types before solving
    window.recordUsageBeforeSolving = function() {
        return new Promise((resolve, reject) => {
            console.log("Recording usage before solving");
            
            // First record route creation
            window.recordRouteUsage()
                .then(routeResult => {
                    console.log("Route usage result:", routeResult);
                    
                    
                    
                })
                
                .catch(error => {
                    console.error("Error recording usage:", error);
                    
                    // Check if this is a limit reached error
                    if (error && error.limitReached) {
                        reject(error);
                    } else {
                        // Other errors, still resolve to allow solver to run
                        resolve({ 
                            route: window.usageRecorded.route, 
                            
                            error: error.message
                        });
                    }
                });
        });
    };
    
    // Function to update credits display
    // Function to update UI elements showing route usage
    function updateRouteUsageDisplay(routesUsed, maxRoutes) {
        if (typeof routesUsed !== 'number' || typeof maxRoutes !== 'number') {
            console.warn("Invalid data for updateRouteUsageDisplay", { routesUsed, maxRoutes });
            return;
        }
        
        // Find elements that display route usage
        const routeUsageElements = document.querySelectorAll('.route-usage-count');
        routeUsageElements.forEach(element => {
            element.textContent = routesUsed;
        });
        
        // Update progress bars
        const routeProgressBars = document.querySelectorAll('.route-usage-progress');
        routeProgressBars.forEach(progressBar => {
            const percentage = Math.min(100, Math.round((routesUsed / maxRoutes) * 100));
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', routesUsed);
        });
        
        // Update any text showing the count
        const routeCountTexts = document.querySelectorAll('.routes-used-text');
        routeCountTexts.forEach(element => {
            element.textContent = `${routesUsed} of ${maxRoutes}`;
        });
    }
    
    // Function to handle route limit reached error
    function handleRouteLimitReached(data) {
        const errorMessage = data.error || 'You have reached your route creation limit for this billing period.';
        
        // Show alert
        alert(errorMessage + " Please upgrade your plan to continue.");
        
        // Redirect to pricing page if provided
        if (data.redirect) {
            window.location.href = data.redirect;
        }
    }
    
   
    
    // Queue a tracking attempt for later recovery
    function queueTrackingAttempt(type, data) {
        // Add to queue
        window.trackingQueue.push({
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        });
        
        // Store in localStorage for persistence
        try {
            localStorage.setItem('trackingQueue', JSON.stringify(window.trackingQueue));
        } catch (e) {
            console.warn("Could not save tracking queue to localStorage:", e);
        }
        
        console.log(`Added ${type} tracking attempt to queue. Queue size: ${window.trackingQueue.length}`);
    }
    
    // Process the tracking queue
    function processTrackingQueue() {
        if (!window.trackingQueue || window.trackingQueue.length === 0) {
            return Promise.resolve({ processed: 0 });
        }
        
        console.log(`Processing tracking queue. Items: ${window.trackingQueue.length}`);
        
        // Take the oldest item
        const item = window.trackingQueue.shift();
        
        // Skip if too old (older than 2 days)
        const timestamp = new Date(item.timestamp);
        const now = new Date();
        const ageInHours = (now - timestamp) / (1000 * 60 * 60);
        
        if (ageInHours > 48) {
            console.log(`Skipping old tracking item from ${item.timestamp}`);
            
            // Update localStorage
            try {
                localStorage.setItem('trackingQueue', JSON.stringify(window.trackingQueue));
            } catch (e) {
                console.warn("Could not update tracking queue in localStorage:", e);
            }
            
            // Process next item
            return processTrackingQueue();
        }
        
        // Process based on type
        let processPromise;
        
        if (item.type === 'route_usage') {
            // Temporarily disable the "already recorded" check
            window.usageRecorded.route = false;
            processPromise = window.recordRouteUsage();
        } 
        else {
            // Unknown type, skip
            processPromise = Promise.resolve({ success: false, error: `Unknown tracking type: ${item.type}` });
        }
        
        // After processing, continue with next item if any
        return processPromise
            .then(result => {
                console.log(`Processed queued ${item.type} tracking item:`, result);
                
                // Update localStorage
                try {
                    localStorage.setItem('trackingQueue', JSON.stringify(window.trackingQueue));
                } catch (e) {
                    console.warn("Could not update tracking queue in localStorage:", e);
                }
                
                // If there are more items, process them
                if (window.trackingQueue.length > 0) {
                    return processTrackingQueue();
                }
                
                return { processed: 1, result };
            })
            .catch(error => {
                console.error(`Error processing queued ${item.type} tracking item:`, error);
                
                // Put the item back at the end of the queue for retry later
                window.trackingQueue.push(item);
                
                // Update localStorage
                try {
                    localStorage.setItem('trackingQueue', JSON.stringify(window.trackingQueue));
                } catch (e) {
                    console.warn("Could not update tracking queue in localStorage:", e);
                }
                
                return { processed: 0, error: error.message };
            });
    }
    
    // Load tracking queue from localStorage
    function loadTrackingQueue() {
        try {
            const savedQueue = localStorage.getItem('trackingQueue');
            if (savedQueue) {
                const parsedQueue = JSON.parse(savedQueue);
                window.trackingQueue = Array.isArray(parsedQueue) ? parsedQueue : [];
                console.log(`Loaded ${window.trackingQueue.length} items from tracking queue`);
            }
        } catch (e) {
            console.warn("Could not load tracking queue from localStorage:", e);
            window.trackingQueue = [];
        }
    }
    
    // Function to reset tracking for testing
    window.resetUsageTracking = function() {
        window.usageRecorded = {
            route: false,
            
        };
        console.log("Usage tracking flags reset");
        return "Usage tracking reset successfully";
    };
    
    // Enhanced solve button handler
    function enhanceSolveButtonWithTracking() {
        const solveBtn = document.getElementById('solveBtn');
        if (!solveBtn) {
            console.error("Solve button not found - cannot apply tracking integration");
            return;
        }
        
        console.log("Enhancing solve button with tracking...");
        
        // Store original handler
        originalSolveHandler = solveBtn.onclick;
        
        // Replace with enhanced handler
        solveBtn.onclick = function(e) {
            if (e) e.preventDefault();
            
            console.log("Enhanced solve handler triggered");
            
            // Show loading state
            solveBtn.disabled = true;
            solveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Recording usage...';
            
            // First record usage, then solve
            window.recordUsageBeforeSolving()
                .then(() => {
                    console.log("Usage recorded successfully, proceeding with solve");
                    
                    // Reset button state
                    solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                    
                    // Simulate original handler invocation
                    if (typeof originalSolveHandler === 'function') {
                        originalSolveHandler.call(this);
                    } else {
                        console.warn("No original solve handler found");
                        
                        // Try to find and click the solve button to trigger any attached handlers
                        solveBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
                    }
                })
                .catch(error => {
                    console.error("Error recording usage:", error);
                    
                    // Reset button state
                    solveBtn.disabled = false;
                    solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                    
                    if (error && error.limitReached) {
                        // Already handled in the specific handler functions
                        console.log("Limit reached error already handled");
                    } else {
                        // For other errors, still try to run the solver
                        console.log("Continuing with solve despite tracking error");
                        if (typeof originalSolveHandler === 'function') {
                            originalSolveHandler.call(this);
                        }
                    }
                });
                
            // Prevent default and stop propagation
            return false;
        };
        
        console.log("Solve button enhanced with tracking");
    }
    
    // Intercept client-side solver if it exists
    function interceptClientSideSolver() {
        if (typeof window.runClientSideSolver === 'function') {
            console.log("Intercepting client-side solver function");
            
            // Store original function
            originalRunClientSideSolver = window.runClientSideSolver;
            
            // Replace with enhanced version
            window.runClientSideSolver = function(params, jobId) {
                console.log("Intercepted client-side solver to record usage");
                
                // First record usage, then run solver
                window.recordUsageBeforeSolving()
                    .then(() => {
                        console.log("Usage recorded successfully, proceeding with client-side solver");
                        originalRunClientSideSolver(params, jobId);
                    })
                    .catch(error => {
                        console.error("Error recording usage before client-side solver:", error);
                        
                        if (error && error.limitReached) {
                            // Reset UI state
                            const solveBtn = document.getElementById('solveBtn');
                            if (solveBtn) {
                                solveBtn.disabled = false;
                                solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                            }
                            
                            // Hide progress container
                            const solverProgressContainer = document.getElementById('solverProgressContainer');
                            if (solverProgressContainer) {
                                solverProgressContainer.style.display = 'none';
                            }
                        } else {
                            // For other errors, still run the solver
                            console.log("Continuing with client-side solver despite tracking error");
                            originalRunClientSideSolver(params, jobId);
                        }
                    });
            };
            
            console.log("Client-side solver intercepted successfully");
        } else {
            console.log("Client-side solver function not found - skipping interception");
        }
    }
    
    // Initialize tracking integration
    function initTrackingIntegration() {
        console.log("Initializing tracking integration...");
        
        // Load tracking queue from localStorage
        loadTrackingQueue();
        
        // Process any pending tracking attempts
        if (window.trackingQueue && window.trackingQueue.length > 0) {
            setTimeout(() => {
                processTrackingQueue()
                    .then(result => {
                        console.log("Processed tracking queue at startup:", result);
                    })
                    .catch(error => {
                        console.error("Error processing tracking queue:", error);
                    });
            }, 5000);
        }
        
        // Process queue periodically
        setInterval(() => {
            if (window.trackingQueue && window.trackingQueue.length > 0) {
                processTrackingQueue()
                    .then(result => {
                        console.log("Periodic queue processing complete:", result);
                    })
                    .catch(error => {
                        console.error("Error in periodic queue processing:", error);
                    });
            }
        }, 60000); // Check every minute
        
        // Enhance solve button with tracking
        enhanceSolveButtonWithTracking();
        
        // Intercept client-side solver
        interceptClientSideSolver();
        
        console.log("Tracking integration initialized");
    }
    
    // Run initialization with a slight delay to ensure page is fully loaded
    setTimeout(initTrackingIntegration, 1000);
});