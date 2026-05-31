from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import math
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
# Enable CORS for all routes, supporting local frontend and remote hosts
CORS(app)

# SQLite & PostgreSQL production URI configuration
basedir = os.path.abspath(os.path.dirname(__file__))
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Render and Heroku sometimes pass 'postgres://' which SQLAlchemy 1.4+ requires as 'postgresql://'
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'waterwatch.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Model ---
class Complaint(db.Model):
    __tablename__ = 'complaints'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    issue_type = db.Column(db.String(30), nullable=False) # leakage, shortage, contamination, pressure, other
    severity = db.Column(db.String(20), nullable=False)   # low, medium, high, critical
    status = db.Column(db.String(30), default='reported')  # reported, under_review, in_progress, resolved
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(255), nullable=False)
    reporter_name = db.Column(db.String(100), nullable=True)
    reporter_email = db.Column(db.String(100), nullable=True)
    photo_url = db.Column(db.String(255), nullable=True)
    authority_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'display_id': f'WW-{self.id:05d}',
            'title': self.title,
            'description': self.description,
            'issue_type': self.issue_type,
            'severity': self.severity,
            'status': self.status,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'reporter_name': self.reporter_name or 'Anonymous',
            'reporter_email': self.reporter_email or '',
            'photo_url': self.photo_url or '',
            'authority_note': self.authority_note or '',
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

# Ensure database tables exist and are auto-seeded if empty on startup
with app.app_context():
    db.create_all()
    try:
        if Complaint.query.count() == 0:
            from seed import seed_database
            seed_database(db, Complaint)
    except Exception as e:
        print(f"Database auto-initialization/seeding warning: {e}", flush=True)

# --- Distance Utility ---
def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in kilometers.
    """
    R = 6371.0  # Radius of the earth in km
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance  # in km

# --- Routes ---

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/complaints', methods=['POST'])
def submit_complaint():
    data = request.get_json() or {}
    
    # Client-side style validation fallback
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    issue_type = data.get('issue_type', '').strip().lower()
    severity = data.get('severity', '').strip().lower()
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    address = data.get('address', '').strip()
    reporter_name = (data.get('reporter_name') or '').strip()
    reporter_email = (data.get('reporter_email') or '').strip()
    photo_url = (data.get('photo_url') or '').strip()
    bypass_duplicate = data.get('bypass_duplicate', False)

    if not title or len(title) > 100:
        return jsonify({'error': 'Title is required and must be less than 100 characters.'}), 400
    if not description or len(description) < 30:
        return jsonify({'error': 'Description is required and must be at least 30 characters.'}), 400
    if issue_type not in ['leakage', 'shortage', 'contamination', 'pressure', 'other']:
        return jsonify({'error': 'Invalid issue type.'}), 400
    if severity not in ['low', 'medium', 'high', 'critical']:
        return jsonify({'error': 'Invalid severity level.'}), 400
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid Latitude and Longitude are required.'}), 400
    if not address:
        return jsonify({'error': 'Address is required.'}), 400

    # Proximity Check (Duplicate Alert within 500m / 0.5km for active tickets reported within the last 48 hours)
    if not bypass_duplicate:
        cutoff_time = datetime.utcnow() - timedelta(hours=48)
        active_nearby = Complaint.query.filter(
            Complaint.issue_type == issue_type,
            Complaint.status != 'resolved',
            Complaint.created_at >= cutoff_time
        ).all()
        
        for comp in active_nearby:
            dist = haversine_distance(lat, lng, comp.latitude, comp.longitude)
            if dist < 0.5:  # 500 meters
                return jsonify({
                    'duplicate_found': True,
                    'message': 'A similar active issue was recently reported within 500 meters of your location.',
                    'complaint': comp.to_dict()
                }), 409

    # Save to database
    complaint = Complaint(
        title=title,
        description=description,
        issue_type=issue_type,
        severity=severity,
        latitude=lat,
        longitude=lng,
        address=address,
        reporter_name=reporter_name or None,
        reporter_email=reporter_email or None,
        photo_url=photo_url or None
    )
    
    db.session.add(complaint)
    db.session.commit()
    
    return jsonify(complaint.to_dict()), 201

@app.route('/api/complaints', methods=['GET'])
def list_complaints():
    # Filter query parameters
    status = request.args.get('status')
    issue_type = request.args.get('issue_type')
    severity = request.args.get('severity')
    search = request.args.get('search')
    
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)

    query = Complaint.query

    if status:
        query = query.filter(Complaint.status == status.lower())
    if issue_type:
        query = query.filter(Complaint.issue_type == issue_type.lower())
    if severity:
        query = query.filter(Complaint.severity == severity.lower())
    if search:
        query = query.filter(
            (Complaint.title.ilike(f'%{search}%')) |
            (Complaint.description.ilike(f'%{search}%')) |
            (Complaint.address.ilike(f'%{search}%'))
        )

    # Order newest first
    query = query.order_by(Complaint.created_at.desc())
    
    total = query.count()
    complaints = query.offset(offset).limit(limit).all()
    
    response = jsonify([c.to_dict() for c in complaints])
    response.headers['X-Total-Count'] = str(total)
    return response, 200

@app.route('/api/complaints/<int:id>', methods=['GET'])
def get_complaint(id):
    complaint = Complaint.query.get(id)
    if not complaint:
        return jsonify({'error': f'Complaint with ID WW-{id:05d} not found.'}), 404
    return jsonify(complaint.to_dict()), 200

@app.route('/api/complaints/<int:id>/status', methods=['PATCH'])
def update_status(id):
    complaint = Complaint.query.get(id)
    if not complaint:
        return jsonify({'error': f'Complaint with ID WW-{id:05d} not found.'}), 404
        
    data = request.get_json() or {}
    new_status = data.get('status', '').strip().lower()
    authority_note = data.get('authority_note', '').strip()

    if not new_status:
        return jsonify({'error': 'Status is required.'}), 400
    if new_status not in ['reported', 'under_review', 'in_progress', 'resolved']:
        return jsonify({'error': 'Invalid status update.'}), 400

    complaint.status = new_status
    if authority_note:
        complaint.authority_note = authority_note
        
    complaint.updated_at = datetime.utcnow()
    db.session.commit()

    # Mock Email Dispatch System
    email_dispatched = False
    if complaint.reporter_email:
        email_dispatched = True
        print("\n" + "="*80)
        print(" [MOCK EMAIL SYSTEM - NOTIFICATION DISPATCHED] ")
        print(f" Timestamp: {datetime.utcnow().isoformat()}")
        print(f" To:        {complaint.reporter_email}")
        print(f" Subject:   WaterWatch Notification - Issue WW-{complaint.id:05d} Status Update")
        print("-"*80)
        print(f" Hello {complaint.reporter_name or 'Citizen'},")
        print(f" The status of your report \"{complaint.title}\" has been updated to: {new_status.replace('_', ' ').upper()}.")
        if authority_note:
            print(f" Authority Remark: \"{authority_note}\"")
        print(f" Track live: http://localhost:3000/track.html?id=WW-{complaint.id:05d}")
        print("="*80 + "\n")

    res = complaint.to_dict()
    res['mock_email_sent'] = email_dispatched
    return jsonify(res), 200

@app.route('/api/stats', methods=['GET'])
def get_stats():
    # Counts
    total = Complaint.query.count()
    reported = Complaint.query.filter(Complaint.status == 'reported').count()
    under_review = Complaint.query.filter(Complaint.status == 'under_review').count()
    in_progress = Complaint.query.filter(Complaint.status == 'in_progress').count()
    resolved = Complaint.query.filter(Complaint.status == 'resolved').count()
    
    # Resolved this week
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    resolved_this_week = Complaint.query.filter(
        Complaint.status == 'resolved',
        Complaint.updated_at >= one_week_ago
    ).count()

    # Group by Issue Type
    types = ['leakage', 'shortage', 'contamination', 'pressure', 'other']
    type_counts = {}
    for t in types:
        type_counts[t] = Complaint.query.filter(Complaint.issue_type == t).count()
        
    # Group by Severity
    severities = ['low', 'medium', 'high', 'critical']
    severity_counts = {}
    for s in severities:
        severity_counts[s] = Complaint.query.filter(Complaint.severity == s).count()

    # Timeline (Last 30 Days)
    history = []
    today = datetime.utcnow().date()
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        count = Complaint.query.filter(
            Complaint.created_at >= day_start,
            Complaint.created_at <= day_end
        ).count()
        
        history.append({
            'date': day.strftime('%Y-%m-%d'),
            'count': count
        })

    return jsonify({
        'total_reports': total,
        'status_counts': {
            'reported': reported,
            'under_review': under_review,
            'in_progress': in_progress,
            'resolved': resolved
        },
        'resolved_this_week': resolved_this_week,
        'type_counts': type_counts,
        'severity_counts': severity_counts,
        'history': history
    }), 200

@app.route('/api/complaints/nearby', methods=['GET'])
def get_nearby_complaints():
    lat_param = request.args.get('latitude')
    lng_param = request.args.get('longitude')
    radius_param = request.args.get('radius_km', 0.5, type=float)
    issue_type = request.args.get('issue_type')

    if not lat_param or not lng_param:
        return jsonify({'error': 'latitude and longitude parameters are required.'}), 400

    try:
        user_lat = float(lat_param)
        user_lng = float(lng_param)
    except ValueError:
        return jsonify({'error': 'latitude and longitude must be valid float values.'}), 400

    query = Complaint.query
    if issue_type:
        query = query.filter(Complaint.issue_type == issue_type.lower())

    all_complaints = query.all()
    nearby_list = []
    
    for c in all_complaints:
        dist = haversine_distance(user_lat, user_lng, c.latitude, c.longitude)
        if dist <= radius_param:
            dict_rep = c.to_dict()
            dict_rep['distance_km'] = round(dist, 3)
            nearby_list.append(dict_rep)

    # Sort by distance
    nearby_list.sort(key=lambda x: x['distance_km'])
    return jsonify(nearby_list), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
