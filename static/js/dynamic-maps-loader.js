// Dynamic Google Maps API Loader
// This script fetches the API key from the server and loads Google Maps API dynamically

document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing dynamic Google Maps loader...");
    
    // Fetch the API key from the server
    fetch('/get_google_maps_key')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.api_key) {
                // Load Google Maps API with the provided key
                loadGoogleMapsAPI(data.api_key);
            } else {
                console.error("Failed to get Google Maps API key");
                showMapError("Failed to load Google Maps API key");
            }
        })
        .catch(error => {
            console.error("Error fetching Google Maps API key:", error);
            showMapError("Error loading Google Maps API: " + error.message);
        });
    
    // Function to dynamically load Google Maps API
    function loadGoogleMapsAPI(apiKey) {
        console.log("Loading Google Maps API...");
        
        // Create script element
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;
        
        // Add error handling
        script.onerror = function() {
            console.error("Failed to load Google Maps API");
            showMapError("Failed to load Google Maps API script");
        };
        
        // Add to document
        document.head.appendChild(script);
    }
    
    // Define callback function that will be called when API is loaded
    window.initGoogleMapsCallback = function() {
        console.log("Google Maps API loaded successfully");
        
        // Initialize map
        if (typeof initializeGoogleMap === 'function') {
            setTimeout(initializeGoogleMap, 500);
        }
        
        // If we're already on the results tab, try to visualize any existing solution
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab && resultsTab.classList.contains('active') && window.appState && window.appState.lastSolution) {
            setTimeout(() => {
                visualizeSolutionOnGoogleMap(window.appState.lastSolution);
            }, 1000);
        }
    };
});

// Helper function to show map errors
function showMapError(message) {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    
    // Remove loading spinner if present
    mapContainer.innerHTML = '';
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger m-3';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle me-2"></i>${message}
    `;
    
    // Add to map container
    mapContainer.appendChild(errorDiv);
}