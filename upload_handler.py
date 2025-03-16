"""
Enhanced upload handler for Flask application.
This module improves file upload handling with better error reporting and fallback mechanisms.
"""

import os
import pandas as pd
from flask import request, jsonify, current_app
from werkzeug.utils import secure_filename

# Configure allowed file extensions and upload folder
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
UPLOAD_FOLDER = 'static/uploads'

def setup_upload_directory():
    """Ensure the upload directory exists"""
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
        print(f"Created upload directory: {UPLOAD_FOLDER}")

def allowed_file(filename):
    """Check if the file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_dataframe_from_file(file):
    """
    Extract a pandas DataFrame from the uploaded file
    with robust error handling
    """
    # Get file extension
    filename = file.filename
    file_ext = os.path.splitext(filename)[1].lower()
    
    try:
        # Read the file based on its extension
        if file_ext in ['.xlsx', '.xls']:
            # For Excel files
            try:
                df = pd.read_excel(file)
            except Exception as excel_error:
                # Detailed error for Excel files
                current_app.logger.error(f"Excel read error: {str(excel_error)}")
                raise Exception(f"Error reading Excel file: {str(excel_error)}")
                
        elif file_ext == '.csv':
            # For CSV files, try different encodings and delimiters
            encodings = ['utf-8', 'latin1', 'iso-8859-1']
            delimiters = [',', ';', '\t']
            
            df = None
            last_error = None
            
            # Try different encoding and delimiter combinations
            for encoding in encodings:
                for delimiter in delimiters:
                    try:
                        # Reset file position to beginning for each attempt
                        file.stream.seek(0)
                        df = pd.read_csv(file, encoding=encoding, sep=delimiter)
                        # If successful, break out of loops
                        break
                    except Exception as e:
                        last_error = e
                        continue
                
                if df is not None:
                    break
            
            if df is None:
                # If all attempts failed, raise the last error
                raise Exception(f"Failed to read CSV file: {str(last_error)}")
                
        else:
            raise Exception(f"Unsupported file format: {file_ext}")
        
        # Verify that the dataframe is not empty
        if df.empty:
            raise Exception("The uploaded file contains no data")
            
        # Verify that the dataframe has at least the minimum required columns
        min_cols = 2  # At minimum we need coordinates/location and demand
        if len(df.columns) < min_cols:
            raise Exception(f"The uploaded file must contain at least {min_cols} columns")
            
        return df
        
    except Exception as e:
        current_app.logger.error(f"Error processing uploaded file {filename}: {str(e)}")
        raise
    
def enhanced_upload_handler():
    """Enhanced file upload handler with improved error handling"""
    # Ensure upload directory exists
    setup_upload_directory()
    
    # Check if file part exists in request
    if 'file' not in request.files:
        current_app.logger.error("No file part in the request")
        return jsonify({
            'success': False, 
            'error': 'No file part in request'
        }), 400
    
    file = request.files['file']
    
    # Check if a file was selected
    if file.filename == '':
        current_app.logger.error("No file selected")
        return jsonify({
            'success': False, 
            'error': 'No file selected'
        }), 400
    
    # Log upload attempt
    current_app.logger.info(f"Upload attempt: {file.filename}")
    
    # Check if file extension is allowed
    if not allowed_file(file.filename):
        current_app.logger.error(f"Invalid file type: {file.filename}")
        return jsonify({
            'success': False, 
            'error': 'Please upload a CSV, XLS, or XLSX file'
        }), 400
    
    try:
        # Secure the filename
        filename = secure_filename(file.filename)
        
        # Optional: Save file for debugging purposes
        # file_path = os.path.join(UPLOAD_FOLDER, filename)
        # file.save(file_path)
        # current_app.logger.info(f"Saved uploaded file to {file_path}")
        
        # Extract DataFrame from file
        data_df = get_dataframe_from_file(file)
        
        # Standardize column names (case-insensitive match)
        column_mapping = {}
        for col in data_df.columns:
            col_lower = str(col).lower()
            if 'name' in col_lower or 'company' in col_lower:
                column_mapping[col] = 'company_name'
            elif ('coord' in col_lower and not ('x_' in col_lower or 'y_' in col_lower)) or \
                ('location' in col_lower and not ('address' in col_lower)):
                column_mapping[col] = 'coordinates'
            elif 'demand' in col_lower or 'quantity' in col_lower or 'amount' in col_lower:
                column_mapping[col] = 'demand'
            elif 'address' in col_lower:
                column_mapping[col] = 'address'
            elif 'x_' in col_lower or 'lat' in col_lower:
                column_mapping[col] = 'x_coord'
            elif 'y_' in col_lower or 'lon' in col_lower or 'lng' in col_lower:
                column_mapping[col] = 'y_coord'
        
        # Rename columns if mapping exists
        if column_mapping:
            data_df.rename(columns=column_mapping, inplace=True)
            current_app.logger.info(f"Mapped columns: {column_mapping}")
        
        # Check for missing required columns
        required_columns = []
        if 'coordinates' not in data_df.columns:
            if 'x_coord' not in data_df.columns or 'y_coord' not in data_df.columns:
                required_columns.append('coordinates or x_coord/y_coord')
        if 'demand' not in data_df.columns:
            required_columns.append('demand')
            
        if required_columns:
            missing = ', '.join(required_columns)
            return jsonify({
                'success': False,
                'error': f'Missing required columns: {missing}'
            }), 400
            
        # Fill NaN values with defaults to prevent errors
        if 'demand' in data_df.columns:
            data_df['demand'] = data_df['demand'].fillna(0)
            
        if 'company_name' in data_df.columns:
            data_df['company_name'] = data_df['company_name'].fillna(f"Customer {data_df.index}")
            
        # Convert to session storage format
        session_data = {
            'filename': file.filename,
            'columns': data_df.columns.tolist(),
            'dataframe': data_df.to_json(orient='split')
        }
        
        # Return headers to client with preview data
        preview_rows = min(20, len(data_df))
        preview_data = data_df.head(preview_rows).to_dict(orient='records')
        
        current_app.logger.info(f"File processed successfully: {file.filename}")
        
        return jsonify({
            'success': True, 
            'message': f'File {file.filename} uploaded and processed successfully',
            'columns': data_df.columns.tolist(),
            'previewData': preview_data,
            'rows': len(data_df)
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        current_app.logger.error(f"Error processing upload: {error_details}")
        
        # Provide a user-friendly error message
        error_message = str(e)
        if "UnicodeDecodeError" in error_details:
            error_message = "File encoding not supported. Please save your file as UTF-8 and try again."
        elif "Excel" in error_details:
            error_message = "Error reading Excel file. Please ensure it's a valid Excel file (.xlsx or .xls)."
        
        return jsonify({
            'success': False, 
            'error': error_message,
            'details': error_details[:200] + "..." if len(error_details) > 200 else error_details
        }), 500