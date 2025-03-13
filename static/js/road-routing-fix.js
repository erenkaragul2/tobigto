// Enhanced Google Maps road routing implementation
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading road routing enhancement...");
    
    // Store original visualization function if it exists
    const originalVisualizeSolutionOnMap = window.visualizeSolutionOnMap;
    
    // Global variables for Google Maps
    let map = null;
    let markers = [];
    let directionsServices = []; // Multiple direction services for parallel requests
    let directionsRenderers = [];
    let routeProcessingQueue = [];
    let processingRoute = false;
    
    // Route colors
    const routeColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#C9CBCF', '#7CBB00', '#F652A0', '#00BCF2'
    ];
  
    // Enhanced visualization function that handles road routing
    window.visualizeSolutionOnMap = function(solution) {
      console.log("Road routing visualization called");
      
      // Validate solution data
      if (!solution || !solution.coordinates || !solution.routes) {
        console.error("Invalid solution data", solution);
        showMapError("Invalid solution data provided");
        return;
      }
      
      // Check if Google Maps is available
      if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error("Google Maps API not loaded");
        
        // Fall back to original visualization method if available
        if (typeof originalVisualizeSolutionOnMap === 'function') {
          console.log("Falling back to original visualization method");
          originalVisualizeSolutionOnMap(solution);
        } else {
          showMapError("Google Maps API not available");
        }
        return;
      }
      
      const mapContainer = document.getElementById('mapContainer');
      if (!mapContainer) {
        console.error("Map container not found");
        return;
      }
      
      // Extract data from solution
      const coordinates = solution.coordinates;
      const routes = solution.routes;
      const depot = solution.depot || 0;
      
      // Initialize map if needed
      if (!map) {
        initializeMap(mapContainer, coordinates);
      } else {
        // Clear existing elements
        clearMapElements();
      }
      
      // Create a bounds object to fit all points
      const bounds = new google.maps.LatLngBounds();
      
      // Add depot marker
      if (depot >= 0 && depot < coordinates.length) {
        const depotPos = {
          lat: parseFloat(coordinates[depot][0]),
          lng: parseFloat(coordinates[depot][1])
        };
        
        const depotMarker = new google.maps.Marker({
          position: depotPos,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF0000',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#FFFFFF'
          },
          label: {
            text: 'D',
            color: '#FFFFFF',
            fontWeight: 'bold'
          },
          title: 'Depot'
        });
        
        markers.push(depotMarker);
        bounds.extend(depotPos);
      }
      
      // Show processing message
      showMapMessage("Calculating road routes...", "info");
      
      // Initialize direction services (multiple instances to handle parallel requests)
      for (let i = 0; i < 3; i++) {
        directionsServices.push(new google.maps.DirectionsService());
      }
      
      // Prepare routes for processing
      routeProcessingQueue = [];
      routes.forEach((route, routeIndex) => {
        if (route && route.length > 0) {
          routeProcessingQueue.push({
            route: route,
            routeIndex: routeIndex,
            coordinates: coordinates,
            depot: depot,
            color: routeColors[routeIndex % routeColors.length],
            bounds: bounds
          });
        }
      });
      
      // Start processing routes
      processNextRouteInQueue();
      
      // Initial map fit (will be updated as routes are added)
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }
    };
    
    // Process routes one by one to avoid hitting API limits
    function processNextRouteInQueue() {
      if (processingRoute || routeProcessingQueue.length === 0) {
        if (routeProcessingQueue.length === 0) {
          // All routes processed
          showMapMessage("Routes displayed using road networks", "success", true);
          
          // Fit map to all markers after a slight delay
          setTimeout(() => {
            const bounds = new google.maps.LatLngBounds();
            markers.forEach(marker => {
              bounds.extend(marker.getPosition());
            });
            if (!bounds.isEmpty()) {
              map.fitBounds(bounds);
            }
          }, 500);
        }
        return;
      }
      
      processingRoute = true;
      const routeData = routeProcessingQueue.shift();
      
      // Update progress message
      showMapMessage(`Calculating route ${routeData.routeIndex + 1} of ${routeData.routeIndex + 1 + routeProcessingQueue.length}...`, "info", true);
      
      // Process all customers in this route
      addCustomerMarkers(routeData);
      
      // Calculate actual road route
      calculateRoadRoute(routeData)
        .then(() => {
          // Mark as done and process next route
          processingRoute = false;
          setTimeout(processNextRouteInQueue, 300); // Small delay to avoid rate limits
        })
        .catch(error => {
          console.error("Error calculating road route:", error);
          showMapMessage(`Error with route ${routeData.routeIndex + 1}: ${error.message}`, "warning", false);
          
          // Fall back to straight-line route
          drawStraightLineRoute(routeData);
          
          // Continue with next route despite error
          processingRoute = false;
          setTimeout(processNextRouteInQueue, 300);
        });
    }
    
    // Add customer markers for a route
    function addCustomerMarkers(routeData) {
      const { route, coordinates, bounds } = routeData;
      
      route.forEach(customer => {
        if (customer >= 0 && customer < coordinates.length) {
          const pos = {
            lat: parseFloat(coordinates[customer][0]),
            lng: parseFloat(coordinates[customer][1])
          };
          
          // Add customer marker
          const marker = new google.maps.Marker({
            position: pos,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#FFFFFF'
            },
            label: {
              text: customer.toString(),
              color: '#FFFFFF',
              fontSize: '10px'
            },
            title: 'Customer ' + customer
          });
          
          markers.push(marker);
          bounds.extend(pos);
        }
      });
    }
    
    // Calculate road route using Google Directions API
    function calculateRoadRoute(routeData) {
      return new Promise((resolve, reject) => {
        const { route, coordinates, depot, color, routeIndex } = routeData;
        
        if (route.length === 0) {
          resolve(); // Empty route, nothing to do
          return;
        }
        
        // Get depot coordinates
        const depotPos = new google.maps.LatLng(
          parseFloat(coordinates[depot][0]),
          parseFloat(coordinates[depot][1])
        );
        
        // For simple routes with 1-2 stops, use a simple approach
        if (route.length <= 2) {
          processSimpleRoute(routeData)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        // For longer routes, we need to split into segments
        // Google Maps has a limit of 25 waypoints per request
        const MAX_WAYPOINTS = 23; // Using 23 to be safe (origin + destination + 23 waypoints = 25 points)
        
        if (route.length <= MAX_WAYPOINTS) {
          // Can process in a single request
          processSingleRouteSegment(routeData)
            .then(resolve)
            .catch(reject);
        } else {
          // Need to split into multiple segments
          processMultiSegmentRoute(routeData, MAX_WAYPOINTS)
            .then(resolve)
            .catch(reject);
        }
      });
    }
    
    // Process a simple route (1-2 stops) for better performance
    function processSimpleRoute(routeData) {
      return new Promise((resolve, reject) => {
        const { route, coordinates, depot, color, routeIndex } = routeData;
        
        // Get depot coordinates
        const depotPos = new google.maps.LatLng(
          parseFloat(coordinates[depot][0]),
          parseFloat(coordinates[depot][1])
        );
        
        // Prepare waypoints
        const waypoints = route.map(customer => {
          return {
            location: new google.maps.LatLng(
              parseFloat(coordinates[customer][0]),
              parseFloat(coordinates[customer][1])
            ),
            stopover: true
          };
        });
        
        // Create request for directions
        const request = {
          origin: depotPos,
          destination: depotPos, // Return to depot
          waypoints: waypoints,
          optimizeWaypoints: false, // Don't reorder waypoints
          travelMode: google.maps.TravelMode.DRIVING
        };
        
        // Get directions
        const serviceIndex = routeIndex % directionsServices.length;
        directionsServices[serviceIndex].route(request, (response, status) => {
          if (status === 'OK') {
            // Create a DirectionsRenderer to display the route
            const directionsRenderer = new google.maps.DirectionsRenderer({
              map: map,
              directions: response,
              suppressMarkers: true, // Using our own markers
              polylineOptions: {
                strokeColor: color,
                strokeOpacity: 0.7,
                strokeWeight: 4
              }
            });
            
            directionsRenderers.push(directionsRenderer);
            
            // Add route number label
            addRouteLabel(coordinates, depot, route[0], routeIndex, color);
            
            resolve();
          } else {
            if (status === 'ZERO_RESULTS') {
              console.warn(`No road route found for route ${routeIndex}, falling back to straight line`);
              drawStraightLineRoute(routeData);
              resolve();
            } else {
              reject(new Error(`Directions request failed for route ${routeIndex}: ${status}`));
            }
          }
        });
      });
    }
    
    // Process a route that can be handled in a single directions request
    function processSingleRouteSegment(routeData) {
      return new Promise((resolve, reject) => {
        const { route, coordinates, depot, color, routeIndex } = routeData;
        
        // Get depot coordinates
        const depotPos = new google.maps.LatLng(
          parseFloat(coordinates[depot][0]),
          parseFloat(coordinates[depot][1])
        );
        
        // Prepare waypoints
        const waypoints = route.map(customer => {
          return {
            location: new google.maps.LatLng(
              parseFloat(coordinates[customer][0]),
              parseFloat(coordinates[customer][1])
            ),
            stopover: true
          };
        });
        
        // Create request for directions
        const request = {
          origin: depotPos,
          destination: depotPos, // Return to depot
          waypoints: waypoints,
          optimizeWaypoints: false, // Don't reorder waypoints
          travelMode: google.maps.TravelMode.DRIVING
        };
        
        // Get directions
        const serviceIndex = routeIndex % directionsServices.length;
        directionsServices[serviceIndex].route(request, (response, status) => {
          if (status === 'OK') {
            // Create a DirectionsRenderer to display the route
            const directionsRenderer = new google.maps.DirectionsRenderer({
              map: map,
              directions: response,
              suppressMarkers: true, // Using our own markers
              polylineOptions: {
                strokeColor: color,
                strokeOpacity: 0.7,
                strokeWeight: 4
              }
            });
            
            directionsRenderers.push(directionsRenderer);
            
            // Add route number label
            addRouteLabel(coordinates, depot, route[0], routeIndex, color);
            
            resolve();
          } else {
            if (status === 'ZERO_RESULTS') {
              console.warn(`No road route found for route ${routeIndex}, falling back to straight line`);
              drawStraightLineRoute(routeData);
              resolve();
            } else {
              reject(new Error(`Directions request failed for route ${routeIndex}: ${status}`));
            }
          }
        });
      });
    }
    
    // Process a route that needs to be split into multiple segments
    function processMultiSegmentRoute(routeData, maxWaypoints) {
      return new Promise((resolve, reject) => {
        const { route, coordinates, depot, color, routeIndex } = routeData;
        
        // Get depot coordinates
        const depotPos = new google.maps.LatLng(
          parseFloat(coordinates[depot][0]),
          parseFloat(coordinates[depot][1])
        );
        
        // Split route into segments
        const segments = [];
        for (let i = 0; i < route.length; i += maxWaypoints) {
          segments.push(route.slice(i, i + maxWaypoints));
        }
        
        console.log(`Route ${routeIndex} split into ${segments.length} segments`);
        
        // Process segments sequentially
        let segmentPromises = [];
        
        segments.forEach((segment, segmentIndex) => {
          segmentPromises.push(() => {
            return new Promise((segResolve, segReject) => {
              // Create waypoints for this segment
              const waypoints = segment.map(customer => {
                return {
                  location: new google.maps.LatLng(
                    parseFloat(coordinates[customer][0]),
                    parseFloat(coordinates[customer][1])
                  ),
                  stopover: true
                };
              });
              
              // If it's not the first segment, start from last customer of previous segment
              let origin = depotPos;
              if (segmentIndex > 0) {
                const prevSegment = segments[segmentIndex - 1];
                const lastCustomer = prevSegment[prevSegment.length - 1];
                origin = new google.maps.LatLng(
                  parseFloat(coordinates[lastCustomer][0]),
                  parseFloat(coordinates[lastCustomer][1])
                );
              }
              
              // If it's not the last segment, end at first customer of next segment
              let destination = depotPos;
              if (segmentIndex < segments.length - 1) {
                const nextSegment = segments[segmentIndex + 1];
                const firstCustomer = nextSegment[0];
                destination = new google.maps.LatLng(
                  parseFloat(coordinates[firstCustomer][0]),
                  parseFloat(coordinates[firstCustomer][1])
                );
              }
              
              // Create request for this segment
              const request = {
                origin: origin,
                destination: destination,
                waypoints: waypoints,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
              };
              
              // Get directions for this segment
              const serviceIndex = (routeIndex + segmentIndex) % directionsServices.length;
              directionsServices[serviceIndex].route(request, (response, status) => {
                if (status === 'OK') {
                  // Create renderer for this segment
                  const segmentColor = segmentIndex === 0 ? color : color; // Same color for simplicity
                  
                  const directionsRenderer = new google.maps.DirectionsRenderer({
                    map: map,
                    directions: response,
                    suppressMarkers: true,
                    polylineOptions: {
                      strokeColor: segmentColor,
                      strokeOpacity: 0.7,
                      strokeWeight: 4
                    }
                  });
                  
                  directionsRenderers.push(directionsRenderer);
                  
                  // Add route label only for first segment
                  if (segmentIndex === 0) {
                    addRouteLabel(coordinates, depot, route[0], routeIndex, color);
                  }
                  
                  segResolve();
                } else {
                  if (status === 'ZERO_RESULTS') {
                    console.warn(`No road route found for segment ${segmentIndex} of route ${routeIndex}, using straight lines`);
                    
                    // Draw straight lines for this segment
                    const segmentPath = [origin];
                    segment.forEach(customer => {
                      segmentPath.push(new google.maps.LatLng(
                        parseFloat(coordinates[customer][0]),
                        parseFloat(coordinates[customer][1])
                      ));
                    });
                    segmentPath.push(destination);
                    
                    const polyline = new google.maps.Polyline({
                      path: segmentPath,
                      geodesic: true,
                      strokeColor: color,
                      strokeOpacity: 0.7,
                      strokeWeight: 4,
                      strokeDasharray: [5, 5] // Dashed line for straight segments
                    });
                    
                    polyline.setMap(map);
                    directionsRenderers.push(polyline);
                    
                    segResolve();
                  } else {
                    segReject(new Error(`Directions request failed for segment ${segmentIndex} of route ${routeIndex}: ${status}`));
                  }
                }
              });
            });
          });
        });
        
        // Execute segment promises sequentially
        segmentPromises.reduce((promiseChain, currentPromise) => {
          return promiseChain.then(chainResults => 
            currentPromise().then(currentResult => 
              [...chainResults, currentResult]
            )
          );
        }, Promise.resolve([]))
          .then(() => resolve())
          .catch(error => {
            console.error("Error processing route segments:", error);
            drawStraightLineRoute(routeData);
            resolve(); // Resolve anyway to continue with other routes
          });
      });
    }
    
    // Add route number label near the start of the route
    function addRouteLabel(coordinates, depot, firstCustomer, routeIndex, color) {
      // Calculate position for label (midpoint between depot and first customer)
      const depotPos = {
        lat: parseFloat(coordinates[depot][0]),
        lng: parseFloat(coordinates[depot][1])
      };
      
      const customerPos = {
        lat: parseFloat(coordinates[firstCustomer][0]),
        lng: parseFloat(coordinates[firstCustomer][1])
      };
      
      const midLat = (depotPos.lat + customerPos.lat) / 2;
      const midLng = (depotPos.lng + customerPos.lng) / 2;
      
      // Create route label
      const labelMarker = new google.maps.Marker({
        position: { lat: midLat, lng: midLng },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: color,
          strokeWeight: 2
        },
        label: {
          text: (routeIndex + 1).toString(),
          color: color,
          fontWeight: 'bold'
        },
        title: `Route ${routeIndex + 1}`
      });
      
      markers.push(labelMarker);
    }
    
    // Fallback to drawing a straight-line route
    function drawStraightLineRoute(routeData) {
      const { route, coordinates, depot, color, routeIndex, bounds } = routeData;
      
      // Create path including depot -> customers -> depot
      const routePath = [];
      
      // Add depot as first point
      if (depot >= 0 && depot < coordinates.length) {
        routePath.push({
          lat: parseFloat(coordinates[depot][0]),
          lng: parseFloat(coordinates[depot][1])
        });
      }
      
      // Add all customer points
      route.forEach(customer => {
        if (customer >= 0 && customer < coordinates.length) {
          routePath.push({
            lat: parseFloat(coordinates[customer][0]),
            lng: parseFloat(coordinates[customer][1])
          });
        }
      });
      
      // Add depot as last point to close the route
      if (depot >= 0 && depot < coordinates.length) {
        routePath.push({
          lat: parseFloat(coordinates[depot][0]),
          lng: parseFloat(coordinates[depot][1])
        });
      }
      
      // Draw the route
      if (routePath.length > 1) {
        const routePolyline = new google.maps.Polyline({
          path: routePath,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 3,
          strokeDasharray: [5, 5] // Dashed line to indicate it's a fallback
        });
        
        routePolyline.setMap(map);
        directionsRenderers.push(routePolyline);
      }
      
      // Add route label
      if (route.length > 0) {
        addRouteLabel(coordinates, depot, route[0], routeIndex, color);
      }
    }
    
    // Initialize map
    function initializeMap(container, coordinates) {
      console.log("Initializing Google Maps");
      
      // Calculate center from coordinates
      let centerLat = 0;
      let centerLng = 0;
      let validCoords = 0;
      
      coordinates.forEach(coord => {
        if (coord && coord.length >= 2) {
          const lat = parseFloat(coord[0]);
          const lng = parseFloat(coord[1]);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            centerLat += lat;
            centerLng += lng;
            validCoords++;
          }
        }
      });
      
      if (validCoords > 0) {
        centerLat /= validCoords;
        centerLng /= validCoords;
      } else {
        // Default center if no valid coordinates
        centerLat = 40.7128;
        centerLng = -74.0060;
      }
      
      // Create map
      map = new google.maps.Map(container, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        fullscreenControl: true
      });
      
      console.log("Google Maps initialized successfully");
    }
    
    // Clear all map elements
    function clearMapElements() {
      // Clear markers
      markers.forEach(marker => {
        marker.setMap(null);
      });
      markers = [];
      
      // Clear directions renderers
      directionsRenderers.forEach(renderer => {
        if (renderer instanceof google.maps.DirectionsRenderer) {
          renderer.setMap(null);
        } else if (renderer instanceof google.maps.Polyline) {
          renderer.setMap(null);
        }
      });
      directionsRenderers = [];
      
      // Clear processing queue
      routeProcessingQueue = [];
      processingRoute = false;
    }
    
    // Show message on the map
    function showMapMessage(message, type = 'info', replace = true) {
      const mapContainer = document.getElementById('mapContainer');
      if (!mapContainer) return;
      
      // Remove existing messages if requested
      if (replace) {
        const existingMessages = mapContainer.querySelectorAll('.map-message');
        existingMessages.forEach(msg => {
          mapContainer.removeChild(msg);
        });
      }
      
      // Create message element
      const messageElement = document.createElement('div');
      messageElement.className = `alert alert-${type} position-absolute map-message`;
      messageElement.style.bottom = '10px';
      messageElement.style.left = '10px';
      messageElement.style.right = '10px';
      messageElement.style.zIndex = '1000';
      messageElement.innerHTML = message;
      
      // Add to map container
      mapContainer.appendChild(messageElement);
      
      // Auto-remove success messages
      if (type === 'success') {
        setTimeout(() => {
          if (messageElement.parentNode === mapContainer) {
            mapContainer.removeChild(messageElement);
          }
        }, 5000);
      }
    }
    
    // Show error on the map
    function showMapError(message) {
      showMapMessage(message, 'danger', false);
    }
  });