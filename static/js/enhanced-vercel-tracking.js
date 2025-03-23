// enhanced-vercel-tracking.js
// Add this to your static/js folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Enhanced usage tracking system initializing (v5)...");
    
    // Create a queue for tracking events that will persist across page refreshes
    if (!window.trackingQueue) {
        try {
            // Try to load from localStorage first
            const savedQueue = localStorage.getItem('cvrpTrackingQueue');
            window.trackingQueue = savedQueue ? JSON.parse(savedQueue) : [];
        } catch (e) {
            console.warn("Could not load tracking queue from localStorage:", e);
            window.trackingQueue = [];
        }
    }
    
    // Enhanced route usage recording with robust error handling and persistence
    window.recordRouteUsage = function() {
        console.log("Recording route usage with enhanced tracking...");
        
        // Use a unique ID for this tracking event
        const trackingId = 'route_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        
        // Create tracking event with all necessary metadata
        const trackingEvent = {
            id: trackingId,
            type: 'route_creation',
            timestamp: new Date().toISOString(),
            user_id: getUserId(),
            attempts: 0,
            max_attempts: 5,
            status: 'pending'
        };
        
        // Add to queue immediately to avoid loss
        addToTrackingQueue(trackingEvent);
        
        // Process immediately
        return processTrackingEvent(trackingEvent)
            .then(result => {
                console.log("Route usage recording result:", result);
                return result;
            })
            .catch(error => {
                console.error("Error recording route usage:", error);
                // Still return a success response to not block the UI
                return {
                    success: true,
                    warning: 'Will retry recording in background',
                    id: trackingId
                };
            });
    };
    
    
    
    // Helper function to get the current user ID
    function getUserId() {
        // Try to get user ID from various sources
        
        // 1. Check if we have it in sessionStorage
        const sessionUserId = sessionStorage.getItem('userId');
        if (sessionUserId) return sessionUserId;
        
        // 2. Try to extract it from the page
        const userElements = document.querySelectorAll('[data-user-id]');
        if (userElements.length > 0) {
            const userId = userElements[0].getAttribute('data-user-id');
            if (userId) {
                sessionStorage.setItem('userId', userId);
                return userId;
            }
        }
        
        // 3. If we have a user email displayed, use that as a fallback key
        const userEmailElements = document.querySelectorAll('.user-email');
        if (userEmailElements.length > 0) {
            const email = userEmailElements[0].textContent.trim();
            if (email) {
                return 'email:' + email;
            }
        }
        
        // 4. Last resort - generate a temporary ID based on timestamp
        return 'temp_user_' + Date.now();
    }
    
    // Add tracking event to queue and persist
    function addToTrackingQueue(event) {
        // Add to memory queue
        window.trackingQueue.push(event);
        
        // Persist to localStorage for resilience
        try {
            localStorage.setItem('cvrpTrackingQueue', JSON.stringify(window.trackingQueue));
        } catch (e) {
            console.warn("Could not save tracking queue to localStorage:", e);
        }
        
        console.log(`Added tracking event ${event.id} to queue. Queue size: ${window.trackingQueue.length}`);
    }
    
    // Update tracking event in queue
    function updateTrackingEvent(eventId, updates) {
        const index = window.trackingQueue.findIndex(e => e.id === eventId);
        if (index !== -1) {
            // Apply updates
            window.trackingQueue[index] = {...window.trackingQueue[index], ...updates};
            
            // Persist changes
            try {
                localStorage.setItem('cvrpTrackingQueue', JSON.stringify(window.trackingQueue));
            } catch (e) {
                console.warn("Could not update tracking queue in localStorage:", e);
            }
        }
    }
    
    // Remove tracking event from queue
    function removeFromTrackingQueue(eventId) {
        const initialLength = window.trackingQueue.length;
        window.trackingQueue = window.trackingQueue.filter(e => e.id !== eventId);
        
        if (window.trackingQueue.length < initialLength) {
            // Event was found and removed, update localStorage
            try {
                localStorage.setItem('cvrpTrackingQueue', JSON.stringify(window.trackingQueue));
                console.log(`Removed tracking event ${eventId} from queue`);
            } catch (e) {
                console.warn("Could not update tracking queue in localStorage after removal:", e);
            }
        }
    }
    
    // Process a single tracking event
    function processTrackingEvent(event) {
        // Increment attempt counter
        event.attempts++;
        updateTrackingEvent(event.id, {attempts: event.attempts, last_attempt: new Date().toISOString()});
        
        // Prepare request data
        const requestData = {
            client_side: true,
            tracking_id: event.id,
            timestamp: event.timestamp,
            user_id: event.user_id,
            browser: navigator.userAgent
        };
        
        // Determine endpoint based on event type
        const endpoint = event.type === 'route_creation' 
            ? '/record_route_usage' 
            : '/record_algorithm_run';
        
        console.log(`Processing ${event.type} tracking event ${event.id} (attempt ${event.attempts}/${event.max_attempts})`);
        
        // Make API request
        return new Promise((resolve, reject) => {
            fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(requestData),
                credentials: 'same-origin'
            })
            .then(response => {
                // Handle non-JSON responses
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    return { success: true, message: "Server returned non-JSON success response" };
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Mark as successful and remove from queue
                    updateTrackingEvent(event.id, {status: 'completed'});
                    removeFromTrackingQueue(event.id);
                    resolve(data);
                } else if (data.limit_reached) {
                    // Special case - limit reached, mark as error but remove from queue
                    updateTrackingEvent(event.id, {status: 'error', error: data.error});
                    removeFromTrackingQueue(event.id);
                    reject(data);
                } else {
                    // Server returned error - mark event for retry
                    updateTrackingEvent(event.id, {
                        status: 'retry', 
                        error: data.error || 'Unknown server error',
                        next_attempt: new Date(Date.now() + getBackoffTime(event.attempts)).toISOString()
                    });
                    
                    // Check if we should retry immediately or later
                    if (event.attempts >= event.max_attempts) {
                        console.log(`Max attempts reached for event ${event.id} - will try later`);
                        reject(new Error('Max attempts reached'));
                    } else {
                        console.log(`Will retry event ${event.id} after backoff`);
                        reject(new Error(data.error || 'Server error, will retry'));
                    }
                }
            })
            .catch(error => {
                // Network or parsing error
                updateTrackingEvent(event.id, {
                    status: 'retry', 
                    error: error.message,
                    next_attempt: new Date(Date.now() + getBackoffTime(event.attempts)).toISOString()
                });
                
                // If we've reached max attempts, store for later processing
                if (event.attempts >= event.max_attempts) {
                    console.log(`Max attempts reached for event ${event.id}`);
                    // Use the fallback tracking mechanism
                    storeInIndexedDBFallback(event);
                    reject(error);
                } else {
                    console.log(`Will retry event ${event.id} later`);
                    reject(error);
                }
            });
        });
    }
    
    // Calculate exponential backoff time
    function getBackoffTime(attemptCount) {
        return Math.min(30000, 1000 * Math.pow(2, attemptCount - 1));
    }
    
    // IndexedDB fallback storage for persistent tracking
    function storeInIndexedDBFallback(event) {
        // Only proceed if IndexedDB is available
        if (!window.indexedDB) {
            console.log("IndexedDB not available, using localStorage only");
            return;
        }
        
        try {
            const request = indexedDB.open("CVRPTracking", 1);
            
            request.onupgradeneeded = function(e) {
                const db = e.target.result;
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains('trackingEvents')) {
                    const store = db.createObjectStore('trackingEvents', { keyPath: 'id' });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
            
            request.onerror = function(e) {
                console.error("IndexedDB error:", e.target.error);
            };
            
            request.onsuccess = function(e) {
                const db = e.target.result;
                const transaction = db.transaction(['trackingEvents'], 'readwrite');
                const store = transaction.objectStore('trackingEvents');
                
                // Store with additional metadata
                const eventToStore = {
                    ...event,
                    stored_at: new Date().toISOString(),
                    recovery_attempts: 0
                };
                
                const storeRequest = store.put(eventToStore);
                
                storeRequest.onsuccess = function() {
                    console.log(`Tracking event ${event.id} stored in IndexedDB`);
                };
                
                storeRequest.onerror = function(e) {
                    console.error("Error storing in IndexedDB:", e.target.error);
                };
            };
        } catch (e) {
            console.error("Error setting up IndexedDB:", e);
        }
    }
    
    // Process all pending tracking events in the queue
    function processTrackingQueue() {
        if (window.trackingQueue.length === 0) {
            return Promise.resolve({processed: 0});
        }
        
        console.log(`Processing tracking queue with ${window.trackingQueue.length} events...`);
        
        // Process events in batches to avoid overwhelming the server
        const batchSize = 3;
        const eventsToProcess = window.trackingQueue.slice(0, batchSize);
        
        // Process each event with a delay between events
        return eventsToProcess.reduce((promise, event, index) => {
            return promise.then(results => {
                // Wait a bit between requests
                const delay = index * 500; // 500ms between requests
                
                return new Promise(resolve => setTimeout(resolve, delay))
                    .then(() => processTrackingEvent(event))
                    .then(result => {
                        // Successful processing
                        return [...results, {id: event.id, success: true, result}];
                    })
                    .catch(error => {
                        // Failed processing - already handled in processTrackingEvent
                        return [...results, {id: event.id, success: false, error: error.message}];
                    });
            });
        }, Promise.resolve([]))
        .then(results => {
            console.log(`Processed ${results.length} tracking events in this batch`);
            return {
                processed: results.length,
                results: results,
                remaining: window.trackingQueue.length - results.length
            };
        });
    }
    
    // Setup recurring processing of tracking queue
    function setupQueueProcessing() {
        // Process queue on page load after a short delay
        setTimeout(() => {
            processTrackingQueue().then(result => {
                console.log("Initial queue processing complete:", result);
            });
        }, 3000);
        
        // Process queue periodically
        setInterval(() => {
            if (window.trackingQueue.length > 0) {
                processTrackingQueue().then(result => {
                    console.log("Periodic queue processing complete:", result);
                });
            }
        }, 60000); // Every minute
        
        // Process on visibility change (when user returns to the tab)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && window.trackingQueue.length > 0) {
                processTrackingQueue().then(result => {
                    console.log("Visibility change queue processing complete:", result);
                });
            }
        });
        
        // Process before page unload but only if queue is small
        window.addEventListener('beforeunload', () => {
            if (window.trackingQueue.length > 0 && window.trackingQueue.length <= 2) {
                // For a small number of events, try to process synchronously before leaving
                fetch('/batch_record_usage', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({events: window.trackingQueue}),
                    // Use sendBeacon-like approach
                    keepalive: true
                });
            }
        });
    }
    
    // If solution button is present, intercept click and ensure tracking is done
    function enhanceSolveButton() {
        const solveBtn = document.getElementById('solveBtn');
        if (!solveBtn) return;
        
        console.log("Enhancing solve button with tracking...");
        
        // Store original onclick handler
        const originalHandler = solveBtn.onclick;
        
        // Replace with enhanced handler
        solveBtn.onclick = function(e) {
            if (e) e.preventDefault();
            
            // First record usage
            return false;
        };
    }
    
    // Add debug functions to window for testing
    window.trackingDebug = {
        getQueue: function() {
            return window.trackingQueue;
        },
        clearQueue: function() {
            window.trackingQueue = [];
            localStorage.removeItem('cvrpTrackingQueue');
            return "Queue cleared";
        },
        forceProcess: function() {
            return processTrackingQueue();
        },
        diagnose: function() {
            // Run diagnostics on the tracking system
            const stats = {
                queue: {
                    size: window.trackingQueue.length,
                    types: {},
                    statuses: {}
                },
                storage: {
                    localStorage: false,
                    indexedDB: false
                },
                user: getUserId(),
                endpoints: {}
            };
            
            // Analyze queue
            window.trackingQueue.forEach(event => {
                stats.queue.types[event.type] = (stats.queue.types[event.type] || 0) + 1;
                stats.queue.statuses[event.status] = (stats.queue.statuses[event.status] || 0) + 1;
            });
            
            // Check storage availability
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                stats.storage.localStorage = true;
            } catch (e) {
                stats.storage.localStorage = false;
            }
            
            stats.storage.indexedDB = !!window.indexedDB;
            
            // Test endpoints
            Promise.all([
                fetch('/debug-session-data').then(r => r.ok).catch(() => false),
                fetch('/debug/usage-tracking').then(r => r.ok).catch(() => false)
            ]).then(results => {
                stats.endpoints = {
                    'debug-session-data': results[0],
                    'debug/usage-tracking': results[1]
                };
                console.log("Tracking diagnostics complete:", stats);
            });
            
            return stats;
        }
    };
    
    // Initialize everything
    function initialize() {
        console.log("Initializing enhanced tracking system...");
        
        // Setup tracking queue processing
        setupQueueProcessing();
        
        // Enhance solve button
        enhanceSolveButton();
        
        console.log("Enhanced tracking system initialized with queue size:", window.trackingQueue.length);
    }
    
    // Start initialization
    initialize();
});