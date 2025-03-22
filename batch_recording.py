# Add this to app.py or create a new file batch_recording.py and import it

from flask import Blueprint, request, jsonify, session, current_app
import json
import traceback
from datetime import datetime, timezone
from db_connection import get_db_connection

# Create a Blueprint
batch_recording_bp = Blueprint('batch_recording', __name__)

@batch_recording_bp.route('/batch_record_usage', methods=['POST'])
def batch_record_usage():
    """
    Endpoint for batch recording of usage events
    Accepts a list of tracking events and processes them in a single database transaction
    """
    try:
        # Get events from request
        data = request.json
        
        if not data or 'events' not in data or not isinstance(data['events'], list):
            return jsonify({
                'success': False,
                'error': 'Invalid request format. Expected "events" array.'
            }), 400
            
        events = data['events']
        
        if not events:
            return jsonify({
                'success': True,
                'message': 'No events to process',
                'processed': 0
            })
            
        # User ID can be specified in the request or taken from session
        user_id = None
        
        # First try to get from session
        if 'user' in session and session.get('user', {}).get('id'):
            user_id = session['user']['id']
            
        # If not in session, try to get from the first event
        if not user_id and events and 'user_id' in events[0]:
            user_id = events[0]['user_id']
            
        # If still no user_id, return error
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User ID not found in session or events'
            }), 400
        
        # Connect to the database with service role to bypass RLS
        conn = get_db_connection(use_service_role=True)
        
        try:
            with conn.cursor() as cursor:
                # Begin transaction
                cursor.execute("BEGIN")
                
                # Get today's date
                today = datetime.now(timezone.utc).date()
                
                # Check if a record exists for today
                cursor.execute(
                    """
                    SELECT id, routes_created, algorithm_runs 
                    FROM usage_tracking 
                    WHERE user_id = %s AND usage_date = %s
                    FOR UPDATE
                    """, 
                    (user_id, today)
                )
                
                existing = cursor.fetchone()
                
                # Count events by type
                route_events = sum(1 for event in events if event.get('type') == 'route_creation')
                algorithm_events = sum(1 for event in events if event.get('type') == 'algorithm_run')
                
                if existing:
                    # Update existing record
                    current_routes = existing['routes_created'] or 0
                    current_algorithms = existing['algorithm_runs'] or 0
                    
                    cursor.execute(
                        """
                        UPDATE usage_tracking 
                        SET routes_created = %s, 
                            algorithm_runs = %s, 
                            updated_at = NOW()
                        WHERE id = %s
                        RETURNING id
                        """,
                        (current_routes + route_events, 
                         current_algorithms + algorithm_events, 
                         existing['id'])
                    )
                else:
                    # Insert new record
                    cursor.execute(
                        """
                        INSERT INTO usage_tracking 
                        (user_id, usage_date, routes_created, algorithm_runs) 
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                        (user_id, today, route_events, algorithm_events)
                    )
                    
                # Get the ID of the updated/inserted record
                result = cursor.fetchone()
                    
                # Also log the processed events in a tracking table if available
                try:
                    for event in events:
                        event_type = event.get('type')
                        event_id = event.get('id')
                        timestamp = event.get('timestamp')
                        
                        if event_type and event_id:
                            cursor.execute(
                                """
                                INSERT INTO tracking_events 
                                (user_id, event_id, event_type, event_data, created_at)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (event_id) DO NOTHING
                                """,
                                (user_id, event_id, event_type, 
                                 json.dumps(event), 
                                 timestamp or datetime.now(timezone.utc).isoformat())
                            )
                except Exception as e:
                    # If tracking_events table doesn't exist, just log and continue
                    current_app.logger.warning(f"Could not log to tracking_events: {str(e)}")
                    
                # Commit the transaction
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': f'Successfully processed {len(events)} events',
                    'processed': len(events),
                    'routes': route_events,
                    'algorithms': algorithm_events,
                    'record_id': result['id'] if result else None
                })
                
        except Exception as db_error:
            # Rollback transaction on error
            conn.rollback()
            current_app.logger.error(f"Database error in batch processing: {str(db_error)}")
            current_app.logger.error(traceback.format_exc())
            
            return jsonify({
                'success': False,
                'error': f'Database error: {str(db_error)}',
                'events_received': len(events)
            }), 500
            
        finally:
            # Always close the connection
            conn.close()
            
    except Exception as e:
        current_app.logger.error(f"Error in batch_record_usage: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

# Don't forget to register this blueprint in app.py:
# from batch_recording import batch_recording_bp
# app.register_blueprint(batch_recording_bp)