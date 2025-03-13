// Fixed Google Maps Road Routing Implementation
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading fixed road routing implementation...");
    
    // Global variables for Google Maps
    let map = null;
    let markers = [];
    let directionService = null;
    let directionsRenderers = [];
    let currentJobId = null;
    
    // Route colors
    const routeColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
    ];
    
    // Initialize map when the page loads
    function initMap(container) {
      // Create map container if needed
      if (!container) {
        console.error('Map container not found');
        return false;
      }
      
      try {
        // Create a new map instance
        map = new google.maps.Map(container, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        });
        
        // Create a directions service
        directionService = new google.maps.DirectionsService();
        
        console.log("Google Maps initialized successfully");
        return true;
      } catch (e) {
        console.error("Error initializing map:", e);
        return false;
      }
    }
    
    // Override the original visualizeSolutionOnMap function
    window.visualizeSolutionOnMap = function(solution) {
      console.log("Road routing visualization called");
      
      // Validate solution data
      if (!solution || !solution.coordinates || !solution.routes) {
        console.error("Invalid solution data", solution);
        return;
      }
      
      const coordinates = solution.coordinates;
      const routes = solution.routes;
      const depot = solution.depot || 0;
      
      // Get map container
      const mapContainer = document.getElementById('mapContainer');
      if (!mapContainer) {
        console.error("Map container not found");
        return;
      }
      
      // Clear existing visualization
      clearMap();
      
      // Initialize map if not already done
      if (!map) {
        if (!initMap(mapContainer)) {
          return;
        }
      }
      
      // Set the current job ID to detect if visualization is overridden by a newer request
      currentJobId = Date.now().toString();
      const thisJobId = currentJobId;
      
      // Show loading status
      showMapStatus("Calculating routes...");
      
      // Add depot marker
      if (depot >= 0 && depot < coordinates.length) {
        try {
          const depotCoord = coordinates[depot];
          const depotPos = { 
            lat: parseFloat(depotCoord[0]), 
            lng: parseFloat(depotCoord[1]) 
          };
          
          // Add depot marker using modern API
          const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: depotPos,
            title: "Depot",
            content: createMarkerElement('D', '#FF0000')
          });
          
          markers.push(marker);
        } catch (e) {
          // Fallback to standard marker if AdvancedMarkerElement fails
          try {
            const depotCoord = coordinates[depot];
            const depotPos = { 
              lat: parseFloat(depotCoord[0]), 
              lng: parseFloat(depotCoord[1]) 
            };
            
            const marker = new google.maps.Marker({
              position: depotPos,
              map: map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#FF0000',
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#FFFFFF',
                scale: 10
              },
              label: {
                text: 'D',
                color: '#FFFFFF',
                fontWeight: 'bold'
              },
              title: 'Depot'
            });
            
            markers.push(marker);
          } catch (e2) {
            console.error("Error adding depot marker:", e2);
          }
        }
      }
      
      // Process each route
      const bounds = new google.maps.LatLngBounds();
      let routeCounter = 0;
      let totalRoutes = routes.length;
      
      // Process each route sequentially
      function processNextRoute(index) {
        // Check if this job has been superseded
        if (thisJobId !== currentJobId) {
          console.log("Route calculation canceled - newer job started");
          return;
        }
        
        // Process all routes
        if (index >= routes.length) {
          // All routes processed
          showMapStatus("Routes displayed using road networks", true);
          
          // Fit map to bounds if we have any points
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 50 });
          }
          return;
        }
        
        const route = routes[index];
        const routeColor = routeColors[index % routeColors.length];
        
        showMapStatus(`Calculating route ${index + 1} of ${totalRoutes}...`);
        
        // Add customer markers for this route
        route.forEach(customer => {
          if (customer >= 0 && customer < coordinates.length) {
            try {
              const customerCoord = coordinates[customer];
              const customerPos = { 
                lat: parseFloat(customerCoord[0]), 
                lng: parseFloat(customerCoord[1]) 
              };
              
              bounds.extend(customerPos);
              
              // Try to use modern AdvancedMarkerElement
              try {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                  map: map,
                  position: customerPos,
                  title: "Customer " + customer,
                  content: createMarkerElement(customer.toString(), '#4285F4')
                });
                
                markers.push(marker);
              } catch (e) {
                // Fallback to standard marker
                const marker = new google.maps.Marker({
                  position: customerPos,
                  map: map,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#4285F4',
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: '#FFFFFF',
                    scale: 7
                  },
                  label: {
                    text: customer.toString(),
                    color: '#FFFFFF',
                    fontSize: '10px'
                  },
                  title: 'Customer ' + customer
                });
                
                markers.push(marker);
              }
            } catch (e) {
              console.error(`Error adding customer marker ${customer}:`, e);
            }
          }
        });
        
        // Create route between depot and customers
        try {
          // Skip empty routes
          if (route.length === 0) {
            processNextRoute(index + 1);
            return;
          }
          
          // Get depot coordinates
          const depotCoord = coordinates[depot];
          const depotPos = { 
            lat: parseFloat(depotCoord[0]), 
            lng: parseFloat(depotCoord[1]) 
          };
          
          // Add depot to bounds
          bounds.extend(depotPos);
          
          // Create waypoints for all customers
          const waypoints = route.map(customer => {
            const coord = coordinates[customer];
            return {
              location: new google.maps.LatLng(
                parseFloat(coord[0]), 
                parseFloat(coord[1])
              ),
              stopover: true
            };
          });
          
          // If we have too many waypoints, use straight lines
          if (waypoints.length > 25) {
            console.warn(`Route ${index} has too many waypoints (${waypoints.length}), using straight lines`);
            drawStraightLine(coordinates, route, depot, routeColor);
            setTimeout(() => processNextRoute(index + 1), 100);
            return;
          }
          
          // Create directions request
          const request = {
            origin: new google.maps.LatLng(depotPos.lat, depotPos.lng),
            destination: new google.maps.LatLng(depotPos.lat, depotPos.lng),
            waypoints: waypoints,
            optimizeWaypoints: false, // Don't reorder waypoints
            travelMode: google.maps.TravelMode.DRIVING
          };
          
          // Call directions service
          directionService.route(request, function(response, status) {
            // Check if this job has been superseded
            if (thisJobId !== currentJobId) {
              return;
            }
            
            if (status === 'OK') {
              // Render the directions
              const renderer = new google.maps.DirectionsRenderer({
                map: map,
                directions: response,
                suppressMarkers: true, // We added our own markers
                polylineOptions: {
                  strokeColor: routeColor,
                  strokeOpacity: 0.7,
                  strokeWeight: 4
                }
              });
              
              directionsRenderers.push(renderer);
            } else {
              // If directions failed, draw straight lines
              console.warn(`Directions request failed for route ${index}: ${status}, using straight lines instead`);
              drawStraightLine(coordinates, route, depot, routeColor);
            }
            
            // Process next route after a delay to avoid API rate limits
            setTimeout(() => processNextRoute(index + 1), 500);
          });
        } catch (e) {
          console.error(`Error processing route ${index}:`, e);
          // Draw straight line as fallback
          drawStraightLine(coordinates, route, depot, routeColor);
          setTimeout(() => processNextRoute(index + 1), 100);
        }
      }
      
      // Start processing routes
      processNextRoute(0);
    };
    
    // Helper function to create a marker element
    function createMarkerElement(text, bgColor) {
      const element = document.createElement('div');
      element.style.backgroundColor = bgColor;
      element.style.color = 'white';
      element.style.borderRadius = '50%';
      element.style.padding = '8px';
      element.style.width = '28px';
      element.style.height = '28px';
      element.style.display = 'flex';
      element.style.justifyContent = 'center';
      element.style.alignItems = 'center';
      element.style.fontWeight = 'bold';
      element.style.fontSize = '12px';
      element.style.border = '2px solid white';
      element.textContent = text;
      return element;
    }
    
    // Helper function to draw a straight line route
    function drawStraightLine(coordinates, route, depot, color) {
      try {
        // Create path coordinates
        const path = [];
        
        // Add depot as first point
        const depotCoord = coordinates[depot];
        path.push({ 
          lat: parseFloat(depotCoord[0]), 
          lng: parseFloat(depotCoord[1]) 
        });
        
        // Add all customer points
        route.forEach(customer => {
          const coord = coordinates[customer];
          path.push({ 
            lat: parseFloat(coord[0]), 
            lng: parseFloat(coord[1]) 
          });
        });
        
        // Add depot as last point to close the loop
        path.push({ 
          lat: parseFloat(depotCoord[0]), 
          lng: parseFloat(depotCoord[1]) 
        });
        
        // Create polyline
        const polyline = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 3
        });
        
        polyline.setMap(map);
        directionsRenderers.push(polyline); // Store for later cleanup
      } catch (e) {
        console.error("Error drawing straight line:", e);
      }
    }
    
    // Helper function to clear the map
    function clearMap() {
      // Clear markers
      markers.forEach(marker => {
        try {
          marker.map = null;
        } catch (e) {
          // If that fails, try another method
          try {
            marker.setMap(null);
          } catch (e2) {
            console.warn("Could not clear marker:", e2);
          }
        }
      });
      markers = [];
      
      // Clear directions renderers
      directionsRenderers.forEach(renderer => {
        try {
          if (renderer instanceof google.maps.DirectionsRenderer) {
            renderer.setMap(null);
          } else if (renderer instanceof google.maps.Polyline) {
            renderer.setMap(null);
          }
        } catch (e) {
          console.warn("Could not clear renderer:", e);
        }
      });
      directionsRenderers = [];
    }
    
    // Helper function to show status messages on the map
    function showMapStatus(message, autoHide = false) {
      const mapContainer = document.getElementById('mapContainer');
      if (!mapContainer) return;
      
      // Remove any existing status messages
      const existingMessages = mapContainer.querySelectorAll('.map-status-message');
      existingMessages.forEach(msg => msg.remove());
      
      // Create and add the new message
      const statusDiv = document.createElement('div');
      statusDiv.className = 'map-status-message alert alert-info position-absolute';
      statusDiv.style.bottom = '10px';
      statusDiv.style.left = '10px';
      statusDiv.style.right = '10px';
      statusDiv.style.zIndex = '1000';
      statusDiv.innerHTML = message;
      mapContainer.appendChild(statusDiv);
      
      // Auto-hide if requested
      if (autoHide) {
        setTimeout(() => {
          if (statusDiv.parentNode === mapContainer) {
            statusDiv.remove();
          }
        }, 5000);
      }
    }
    
    // When results tab is shown, make sure the map is properly displayed
    const resultsTab = document.getElementById('results-tab');
    if (resultsTab) {
      resultsTab.addEventListener('shown.bs.tab', function() {
        if (map) {
          // Force redraw of the map
          google.maps.event.trigger(map, 'resize');
        }
      });
    }
  });