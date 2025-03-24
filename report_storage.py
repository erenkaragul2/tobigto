# report_storage.py
"""
Handles saving and retrieving route optimization reports using Supabase.
"""

import base64
import io
import json
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, send_file, render_template, g, abort, current_app, redirect, url_for, flash
from auth_middleware import login_required
from db_connection import with_db_connection, get_db_connection


# Create a blueprint for report storage routes
report_bp = Blueprint('report', __name__)


@report_bp.route('/save_report', methods=['POST'])
@login_required
def save_report():
    """
    Save a PDF report to Supabase
    
    Expects JSON with:
    - pdf_data: PDF content as base64 string
    - metadata: Report metadata
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400
        
        # Validate required fields
        if 'pdf_data' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing PDF data'
            }), 400
        
        # Extract PDF data
        pdf_data = data['pdf_data']
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data[28:]
        elif pdf_data.startswith('data:'):
            # Remove any other data URL prefix
            pdf_data = pdf_data.split(',', 1)[1]
        
        # Extract metadata
        metadata = data.get('metadata', {})
        
        # Generate a unique ID for the report
        report_id = str(uuid.uuid4())
        
        # Create timestamp
        current_time = datetime.now(timezone.utc)
        
        # Create the report object
        report_data = {
            'id': report_id,
            'user_id': user_id,
            'report_name': f"Route Optimization Report - {current_time.strftime('%Y-%m-%d %H:%M')}",
            'created_at': current_time.isoformat(),
            'pdf_data': pdf_data,
            'route_count': metadata.get('route_count', 0),
            'total_distance': metadata.get('total_distance', 0),
            'metadata': json.dumps(metadata),
            'job_id': metadata.get('job_id', None)
        }
        
        # Get Supabase client from app
        from app import supabase
        
        # Store in Supabase
        response = supabase.table('route_reports').insert(report_data).execute()
        
        if hasattr(response, 'data') and len(response.data) > 0:
            return jsonify({
                'success': True,
                'message': 'Report saved successfully',
                'report_id': report_id
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to save report to database'
            }), 500
            
    except Exception as e:
        import traceback
        print(f"Error saving report: {str(e)}")
        print(traceback.format_exc())
        
        return jsonify({
            'success': False,
            'error': f'Error saving report: {str(e)}'
        }), 500


@report_bp.route('/view_report/<report_id>', methods=['GET'])
@login_required
def view_report(report_id):
    """
    View a saved report
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Get Supabase client from app
        from app import supabase
        
        # Get report from Supabase
        response = supabase.table('route_reports').select('*').eq('id', report_id).eq('user_id', user_id).execute()
        
        if not hasattr(response, 'data') or not response.data:
            flash('Report not found or you do not have permission to view it', 'danger')
            return redirect(url_for('report.my_reports'))
        
        report = response.data[0]
        
        # Send PDF file directly
        pdf_data = report.get('pdf_data')
        pdf_bytes = base64.b64decode(pdf_data)
        
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=False,
            download_name=f"route_report_{report_id}.pdf"
        )
            
    except Exception as e:
        import traceback
        print(f"Error viewing report: {str(e)}")
        print(traceback.format_exc())
        
        flash(f"Error viewing report: {str(e)}", 'danger')
        return redirect(url_for('report.my_reports'))


@report_bp.route('/my_reports', methods=['GET'])
@login_required
def my_reports():
    """
    View all user reports
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Get Supabase client from app
        from app import supabase
        
        # Get reports from Supabase
        response = supabase.table('route_reports').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        
        reports = []
        if hasattr(response, 'data'):
            reports = response.data
            
            # Convert created_at strings to datetime objects for template
            for report in reports:
                if 'created_at' in report and report['created_at']:
                    try:
                        report['created_at'] = datetime.fromisoformat(report['created_at'].replace('Z', '+00:00'))
                    except (ValueError, TypeError):
                        # If conversion fails, keep as is
                        pass
        
        return render_template('my_reports.html', reports=reports)
            
    except Exception as e:
        import traceback
        print(f"Error fetching reports: {str(e)}")
        print(traceback.format_exc())
        
        flash(f"Error fetching reports: {str(e)}", 'danger')
        return redirect(url_for('dashboard'))


@report_bp.route('/delete_report/<report_id>', methods=['POST'])
@login_required
def delete_report(report_id):
    """
    Delete a saved report
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Get Supabase client from app
        from app import supabase
        
        # Delete from Supabase
        response = supabase.table('route_reports').delete().eq('id', report_id).eq('user_id', user_id).execute()
        
        if hasattr(response, 'data') and len(response.data) > 0:
            return jsonify({
                'success': True,
                'message': 'Report deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Report not found or you do not have permission to delete it'
            }), 404
            
    except Exception as e:
        import traceback
        print(f"Error deleting report: {str(e)}")
        print(traceback.format_exc())
        
        return jsonify({
            'success': False,
            'error': f'Error deleting report: {str(e)}'
        }), 500


# Helper function to create route_reports table in Supabase if needed
def init_reports_table():
    """
    Initialize the route_reports table in Supabase if it doesn't exist
    """
    try:
        # Get Supabase client from app
        from app import supabase
        
        # Check if table exists by trying to select from it
        try:
            response = supabase.table('route_reports').select('id').limit(1).execute()
            if hasattr(response, 'data'):
                print("route_reports table exists in Supabase")
                return
        except Exception as e:
            if 'relation "route_reports" does not exist' not in str(e):
                # If it's a different error, just log and return
                print(f"Error checking for route_reports table: {str(e)}")
                return
        
        # Table doesn't exist, create it via SQL (requires admin privileges)
        # This is tricky to do via API, so we'll just print instructions
        print("=== IMPORTANT: route_reports TABLE SETUP ===")
        print("The route_reports table does not exist in your Supabase project.")
        print("Please create it manually using the Supabase SQL editor with the following SQL:")
        print("""
CREATE TABLE IF NOT EXISTS route_reports (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    report_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    pdf_data TEXT NOT NULL,
    route_count INTEGER,
    total_distance FLOAT,
    metadata JSONB,
    job_id TEXT
);

-- Add index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_route_reports_user_id ON route_reports(user_id);

-- Add RLS policies
ALTER TABLE route_reports ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own reports
CREATE POLICY route_reports_user_select ON route_reports
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own reports
CREATE POLICY route_reports_user_insert ON route_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reports
CREATE POLICY route_reports_user_delete ON route_reports
    FOR DELETE USING (auth.uid() = user_id);
""")
        print("===============================================")
            
    except Exception as e:
        import traceback
        print(f"Error initializing route_reports table: {str(e)}")
        print(traceback.format_exc())