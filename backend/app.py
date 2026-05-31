from fastapi import FastAPI, Depends, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import math
import os

# --- SQLAlchemy Engine & Session Configuration ---
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# SQLite & PostgreSQL production URI configuration
basedir = os.path.abspath(os.path.dirname(__file__))
database_url = os.environ.get('DATABASE_URL')
if database_url:
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URL = database_url
else:
    SQLALCHEMY_DATABASE_URL = 'sqlite:///' + os.path.join(basedir, 'waterwatch.db')

# SQLite check_same_thread compatibility mapping
engine_args = {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=engine_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Model ---
class Complaint(Base):
    __tablename__ = 'complaints'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    issue_type = Column(String(30), nullable=False) # leakage, shortage, contamination, pressure, other
    severity = Column(String(20), nullable=False)   # low, medium, high, critical
    status = Column(String(30), default='reported')  # reported, under_review, in_progress, resolved
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(255), nullable=False)
    reporter_name = Column(String(100), nullable=True)
    reporter_email = Column(String(100), nullable=True)
    photo_url = Column(String(255), nullable=True)
    authority_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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

# --- Pydantic Validation Schemas (For Strict Type Check & OpenAPI Auto-Docs) ---
class ComplaintCreate(BaseModel):
    title: str = Field(..., max_length=100, examples=["Major pipeline leakage flooding Koramangala"])
    description: str = Field(..., min_length=30, examples=["Explain the problem in detail. Must be at least 30 characters."])
    issue_type: str = Field(..., examples=["leakage"]) # leakage, shortage, contamination, pressure, other
    severity: str = Field(..., examples=["high"])     # low, medium, high, critical
    latitude: float = Field(..., examples=[12.9716])
    longitude: float = Field(..., examples=[77.5946])
    address: str = Field(..., examples=["Block 4, Koramangala, Bengaluru"])
    reporter_name: Optional[str] = Field(None, examples=["Aravind Kumar"])
    reporter_email: Optional[str] = Field(None, examples=["aravind.k@gmail.com"])
    photo_url: Optional[str] = Field(None, examples=["/assets/demo_images/issue_leakage.jpg"])
    bypass_duplicate: Optional[bool] = Field(False, description="Forces submission bypassing duplicate warning overlays")

class ComplaintStatusUpdate(BaseModel):
    status: str = Field(..., examples=["in_progress"]) # reported, under_review, in_progress, resolved
    authority_note: Optional[str] = Field(None, examples=["Technician crew dispatched to site."])

class ComplaintResponse(BaseModel):
    id: int
    display_id: str
    title: str
    description: str
    issue_type: str
    severity: str
    status: str
    latitude: float
    longitude: float
    address: str
    reporter_name: str
    reporter_email: str
    photo_url: str
    authority_note: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

# --- Lifespan Context Manager (Startup auto-creations and auto-seeding) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Events
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Complaint).count() == 0:
            try:
                from seed import seed_database
                seed_database(db, Complaint)
            except Exception as e:
                print(f"Database auto-seeding warning: {e}")
    finally:
        db.close()
    yield
    # Shutdown Events (None)

# Initialize FastAPI with metadata for beautiful OpenAPI displays
app = FastAPI(
    title="WaterWatch Civic API",
    description="Interactive REST endpoints for municipal water utility complaints, proximity checks, and control dash dashboards.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for all origins, supporting local frontend and remote hosts
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Session local dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Distance Utility ---
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Radius of the earth in km
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c  # in km

# --- API REST Routes ---

@app.post("/api/complaints", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED, tags=["Complaints"])
def submit_complaint(data: ComplaintCreate, response: Response, db: Session = Depends(get_db)):
    issue_type = data.issue_type.strip().lower()
    severity = data.severity.strip().lower()

    if issue_type not in ['leakage', 'shortage', 'contamination', 'pressure', 'other']:
        raise HTTPException(status_code=400, detail="Invalid issue category type.")
    if severity not in ['low', 'medium', 'high', 'critical']:
        raise HTTPException(status_code=400, detail="Invalid severity level.")

    # Proximity Check (Duplicate Alert within 500m / 0.5km for active tickets reported within the last 48 hours)
    if not data.bypass_duplicate:
        cutoff_time = datetime.utcnow() - timedelta(hours=48)
        active_nearby = db.query(Complaint).filter(
            Complaint.issue_type == issue_type,
            Complaint.status != 'resolved',
            Complaint.created_at >= cutoff_time
        ).all()
        
        for comp in active_nearby:
            dist = haversine_distance(data.latitude, data.longitude, comp.latitude, comp.longitude)
            if dist < 0.5:  # 500 meters
                # We return duplicate alerts as a 409 conflict, embedding JSON details of duplicate ticket
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "duplicate_found": True,
                        "message": "A similar active issue was recently reported within 500 meters of your location.",
                        "complaint": comp.to_dict()
                    }
                )

    # Save to database
    complaint = Complaint(
        title=data.title.strip(),
        description=data.description.strip(),
        issue_type=issue_type,
        severity=severity,
        latitude=data.latitude,
        longitude=data.longitude,
        address=data.address.strip(),
        reporter_name=data.reporter_name.strip() if data.reporter_name else None,
        reporter_email=data.reporter_email.strip() if data.reporter_email else None,
        photo_url=data.photo_url.strip() if data.photo_url else None
    )
    
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    
    return complaint.to_dict()

@app.get("/api/complaints", response_model=List[ComplaintResponse], tags=["Complaints"])
def list_complaints(
    response: Response,
    status: Optional[str] = None,
    issue_type: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)

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
    
    response.headers['X-Total-Count'] = str(total)
    # Expose custom header to client origins
    response.headers['Access-Control-Expose-Headers'] = 'X-Total-Count'
    
    return [c.to_dict() for c in complaints]

@app.get("/api/complaints/{id}", response_model=ComplaintResponse, tags=["Complaints"])
def get_complaint(id: int, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint with ID WW-{id:05d} not found.")
    return complaint.to_dict()

@app.patch("/api/complaints/{id}/status", response_model=ComplaintResponse, tags=["Complaints"])
def update_status(id: int, data: ComplaintStatusUpdate, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint with ID WW-{id:05d} not found.")
        
    new_status = data.status.strip().lower()
    if new_status not in ['reported', 'under_review', 'in_progress', 'resolved']:
        raise HTTPException(status_code=400, detail="Invalid status update value.")

    complaint.status = new_status
    if data.authority_note:
        complaint.authority_note = data.authority_note.strip()
        
    complaint.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(complaint)

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
        if complaint.authority_note:
            print(f" Authority Remark: \"{complaint.authority_note}\"")
        print(f" Track live: http://localhost:10000/track.html?id=WW-{complaint.id:05d}")
        print("="*80 + "\n")

    res = complaint.to_dict()
    res['mock_email_sent'] = email_dispatched
    return res

@app.get("/api/stats", tags=["Analytics"])
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Complaint).count()
    reported = db.query(Complaint).filter(Complaint.status == 'reported').count()
    under_review = db.query(Complaint).filter(Complaint.status == 'under_review').count()
    in_progress = db.query(Complaint).filter(Complaint.status == 'in_progress').count()
    resolved = db.query(Complaint).filter(Complaint.status == 'resolved').count()
    
    # Resolved this week
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    resolved_this_week = db.query(Complaint).filter(
        Complaint.status == 'resolved',
        Complaint.updated_at >= one_week_ago
    ).count()

    # Group by Issue Type
    types = ['leakage', 'shortage', 'contamination', 'pressure', 'other']
    type_counts = {}
    for t in types:
        type_counts[t] = db.query(Complaint).filter(Complaint.issue_type == t).count()
        
    # Group by Severity
    severities = ['low', 'medium', 'high', 'critical']
    severity_counts = {}
    for s in severities:
        severity_counts[s] = db.query(Complaint).filter(Complaint.severity == s).count()

    # Timeline (Last 30 Days)
    history = []
    today = datetime.utcnow().date()
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        count = db.query(Complaint).filter(
            Complaint.created_at >= day_start,
            Complaint.created_at <= day_end
        ).count()
        
        history.append({
            'date': day.strftime('%Y-%m-%d'),
            'count': count
        })

    return {
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
    }

@app.get("/api/complaints/nearby", response_model=List[ComplaintResponse], tags=["Complaints"])
def get_nearby_complaints(
    latitude: float,
    longitude: float,
    radius_km: float = Query(0.5, ge=0.01),
    issue_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)
    if issue_type:
        query = query.filter(Complaint.issue_type == issue_type.lower())

    all_complaints = query.all()
    nearby_list = []
    
    for c in all_complaints:
        dist = haversine_distance(latitude, longitude, c.latitude, c.longitude)
        if dist <= radius_km:
            dict_rep = c.to_dict()
            dict_rep['distance_km'] = round(dist, 3)
            # Add required response compatibility layer
            nearby_list.append(dict_rep)

    # Sort by distance
    nearby_list.sort(key=lambda x: x['distance_km'])
    return nearby_list

# --- Static Frontend Serving ---
# Mounts the frontend static folder to the root URL space. html=True automatically redirects / to /index.html!
app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")

if __name__ == '__main__':
    import uvicorn
    # Local fallback start uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)