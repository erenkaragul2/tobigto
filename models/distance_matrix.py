"""
Distance Matrix calculation module for CVRP Solver.
Provides functions to calculate distance matrices using either:
1. Simple Euclidean distance (straight-line)
2. Google Maps Distance Matrix API (real-world travel distances)
"""

import numpy as np
import requests
import time
import os
import logging
from math import ceil

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('distance_matrix')

def compute_euclidean_distance_matrix(coordinates):
    """
    Compute distance matrix using Euclidean distance (straight-line)
    
    Parameters:
    - coordinates: List of (lat, lng) tuples
    
    Returns:
    - 2D numpy array of distances
    """
    num_nodes = len(coordinates)
    distance_matrix = np.zeros((num_nodes, num_nodes))
    for i in range(num_nodes):
        for j in range(num_nodes):
            distance_matrix[i, j] = np.sqrt(np.sum((coordinates[i] - coordinates[j])**2))
    return distance_matrix

def compute_google_distance_matrix(coordinates, api_key, batch_size=10, delay=1.0, mode="driving", 
                                   max_retries=3, use_euclidean_fallback=True):
    """
    Compute distance matrix using Google Distance Matrix API with batching to handle rate limits
    
    Parameters:
    - coordinates: List of (lat, lng) tuples
    - api_key: Google Maps API key (required)
    - batch_size: Maximum number of origins/destinations per request (max 25 allowed by Google)
    - delay: Time to wait between API calls in seconds
    - mode: Travel mode (driving, walking, bicycling, transit)
    - max_retries: Number of retries if API call fails
    - use_euclidean_fallback: Whether to fall back to Euclidean distance if API call fails
    
    Returns:
    - 2D numpy array of distances in meters
    """
    num_nodes = len(coordinates)
    distance_matrix = np.zeros((num_nodes, num_nodes))
    
    if api_key is None or api_key.strip() == "":
        logger.warning("No Google Maps API key provided, falling back to Euclidean distance")
        return compute_euclidean_distance_matrix(coordinates)
    
    # Calculate number of batches needed
    num_batches = ceil(num_nodes / batch_size)
    total_batches = num_batches * num_batches
    current_batch = 0
    
    logger.info(f"Computing distance matrix for {num_nodes} nodes using Google Maps API")
    logger.info(f"Split into {total_batches} batches with {delay}s delay between batches")
    
    # Track API usage
    api_calls = 0
    elements_requested = 0
    
    # For each batch of origins
    for i in range(num_batches):
        # Get batch of origins
        origin_start = i * batch_size
        origin_end = min((i + 1) * batch_size, num_nodes)
        origins_batch = coordinates[origin_start:origin_end]
        origin_count = len(origins_batch)
        
        # For each batch of destinations
        for j in range(num_batches):
            current_batch += 1
            # Get batch of destinations
            dest_start = j * batch_size
            dest_end = min((j + 1) * batch_size, num_nodes)
            dests_batch = coordinates[dest_start:dest_end]
            dest_count = len(dests_batch)
            
            # Log progress
            logger.info(f"Processing batch {current_batch}/{total_batches}: {origin_count}x{dest_count} elements")
            
            # Keep track of elements for quota calculation
            elements_in_batch = origin_count * dest_count
            elements_requested += elements_in_batch
            
            # Format coordinates for API
            origins_str = "|".join([f"{lat},{lng}" for lat, lng in origins_batch])
            dests_str = "|".join([f"{lat},{lng}" for lat, lng in dests_batch])
            
            retry_count = 0
            success = False
            
            while retry_count < max_retries and not success:
                try:
                    # Make API request
                    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
                    params = {
                        "origins": origins_str,
                        "destinations": dests_str,
                        "mode": mode,
                        "key": api_key
                    }
                    
                    # Log API call (but not the key)
                    logger.info(f"Making API call: {elements_in_batch} elements, mode={mode}")
                    
                    # Increment API call counter
                    api_calls += 1
                    
                    # Make the request
                    response = requests.get(url, params=params)
                    data = response.json()
                    
                    # Check if the request was successful
                    if data["status"] != "OK":
                        logger.error(f"API error: {data['status']}")
                        if "error_message" in data:
                            logger.error(f"Error message: {data['error_message']}")
                        
                        # Check specific error types
                        if data["status"] == "OVER_QUERY_LIMIT":
                            # Exponential backoff
                            sleep_time = delay * (2 ** retry_count)
                            logger.warning(f"Rate limit exceeded. Retrying in {sleep_time} seconds")
                            time.sleep(sleep_time)
                            retry_count += 1
                            continue
                        
                        # For other errors, fall back to Euclidean distance
                        if use_euclidean_fallback:
                            logger.warning(f"Falling back to Euclidean distance for batch {current_batch}")
                            _use_euclidean_for_batch(distance_matrix, origins_batch, dests_batch, 
                                                   origin_start, dest_start)
                    else:
                        # Process the results
                        for origin_idx, row in enumerate(data["rows"]):
                            for dest_idx, element in enumerate(row["elements"]):
                                i_idx = origin_start + origin_idx
                                j_idx = dest_start + dest_idx
                                
                                if element["status"] == "OK":
                                    # Use distance value in meters
                                    distance_matrix[i_idx, j_idx] = element["distance"]["value"]
                                else:
                                    logger.warning(f"No route from {origin_idx} to {dest_idx}: {element['status']}")
                                    # If route not found, fall back to Euclidean
                                    origin = origins_batch[origin_idx]
                                    dest = dests_batch[dest_idx]
                                    distance_matrix[i_idx, j_idx] = np.sqrt(np.sum((np.array(origin) - np.array(dest))**2))
                    
                    success = True  # Mark as success to exit retry loop
                    
                except Exception as e:
                    logger.error(f"Error making API request: {e}")
                    retry_count += 1
                    if retry_count < max_retries:
                        # Exponential backoff
                        sleep_time = delay * (2 ** retry_count)
                        logger.warning(f"Retrying in {sleep_time} seconds")
                        time.sleep(sleep_time)
                    elif use_euclidean_fallback:
                        # Fall back to Euclidean distance for this batch
                        logger.warning(f"Falling back to Euclidean distance for batch {current_batch}")
                        _use_euclidean_for_batch(distance_matrix, origins_batch, dests_batch, 
                                               origin_start, dest_start)
                        success = True  # Exit retry loop
            
            # Wait between API calls to avoid hitting rate limits
            if current_batch < total_batches:
                logger.info(f"Waiting {delay} seconds before next batch")
                time.sleep(delay)
    
    logger.info(f"Distance matrix computation complete. API calls: {api_calls}, Elements: {elements_requested}")
    return distance_matrix

def _use_euclidean_for_batch(distance_matrix, origins_batch, dests_batch, origin_start, dest_start):
    """Helper function to calculate Euclidean distances for a batch"""
    for origin_idx, origin in enumerate(origins_batch):
        for dest_idx, dest in enumerate(dests_batch):
            i_idx = origin_start + origin_idx
            j_idx = dest_start + dest_idx
            # Calculate Euclidean distance as fallback
            distance_matrix[i_idx, j_idx] = np.sqrt(np.sum((np.array(origin) - np.array(dest))**2))