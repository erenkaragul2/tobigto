# db_connection.py - Add this file to your project to handle database connections

import os
from flask import g, current_app
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from urllib.parse import urlparse
import logging

# Logger for debugging database issues
logger = logging.getLogger(__name__)

# Get environment variables - using different names to accommodate various naming conventions
SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SERVICE_KEY') or os.environ.get('DATABASE_SERVICE_KEY')
DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_URL') or os.environ.get('DB_URL')

# Extract database connection parameters from DATABASE_URL if available
if DATABASE_URL and DATABASE_URL.startswith('postgresql'):
    parsed_url = urlparse(DATABASE_URL)
    DB_HOST = parsed_url.hostname
    DB_NAME = parsed_url.path[1:]  # Remove leading slash
    DB_USER = parsed_url.username
    DB_PASSWORD = parsed_url.password
    DB_PORT = parsed_url.port or 5432
else:
    # Fallback to individual environment variables
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_NAME = os.environ.get('DB_NAME', 'cvrp_db')
    DB_USER = os.environ.get('DB_USER', 'postgres')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_PORT = os.environ.get('DB_PORT', '5432')

def get_db_connection(use_service_role=False):
    """Create a database connection, optionally using the service role to bypass RLS
    
    Args:
        use_service_role: Whether to use the service role credentials
        
    Returns:
        Database connection object
    """
    try:
        # Log connection attempt (for debugging)
        logger.debug(f"Connecting to database: {DB_HOST}/{DB_NAME} as {'service role' if use_service_role else 'regular user'}")
        
        # If we need to use service role and have a service key
        if use_service_role and SERVICE_KEY:
            # For Supabase - look for service key and use it instead of regular password
            # The service key format is typically "service_role_key_value"
            # Extract user from service key if needed or use the configured DB_USER
            
            conn = psycopg2.connect(
                host=DB_HOST,
                database=DB_NAME,
                user=DB_USER,  # Keep the same user
                password=SERVICE_KEY,  # Use service key as password
                port=DB_PORT,
                cursor_factory=RealDictCursor
            )
            
            # Set application_name for tracking in database logs
            conn.cursor().execute("SET application_name = 'cvrp_app_service_role';")
            conn.commit()
            
            return conn
            
        # Regular connection
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        
        # Set application_name for tracking in database logs
        conn.cursor().execute("SET application_name = 'cvrp_app_regular';")
        conn.commit()
        
        return conn
        
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        # Re-raise for higher-level handling
        raise

def with_db_connection(use_service_role=False):
    """Decorator to provide a database connection to a route function
    
    Args:
        use_service_role: Whether to use service role credentials
        
    The connection is stored in g.db and closed after the request
    """
    def decorator(f):
        def wrapped_function(*args, **kwargs):
            # Get a database connection and store it in Flask's g object
            g.db = get_db_connection(use_service_role=use_service_role)
            
            try:
                # Call the decorated function
                return f(*args, **kwargs)
            finally:
                # Always close the database connection
                if hasattr(g, 'db') and g.db:
                    g.db.close()
                    
        # Preserve the original function's metadata
        wrapped_function.__name__ = f.__name__
        wrapped_function.__doc__ = f.__doc__
        
        return wrapped_function
    return decorator