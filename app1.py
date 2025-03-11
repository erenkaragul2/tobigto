from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    try:
        return render_template('index.html')  # No leading slash
    except Exception as e:
        return f"Error loading template: {str(e)}"

if __name__ == '__main__':
    print("Starting Flask server...")
    print("Open http://127.0.0.1:5000/ in your browser")
    app.run(debug=True)