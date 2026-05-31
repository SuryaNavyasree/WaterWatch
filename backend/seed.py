import os
import random
from datetime import datetime, timedelta
def seed_database(db, Complaint):
    session = getattr(db, 'session', db)
    if hasattr(db, 'create_all'):
        print("Creating database tables...")
        db.create_all()
    print("Clearing existing complaints...")
    session.query(Complaint).delete()

    # Bangalore-centered coordinates (approx 12.91 to 12.99 Lat, 77.55 to 77.68 Lng)
    bangalore_locations = [
        {"lat": 12.9348, "lng": 77.6189, "address": "Block 4, Koramangala, Bengaluru, Karnataka 560034"},
        {"lat": 12.9716, "lng": 77.5946, "address": "Kasturba Rd, Shantala Nagar, Ashok Nagar, Bengaluru 560001"},
        {"lat": 12.9081, "lng": 77.6476, "address": "Sector 3, HSR Layout, Bengaluru, Karnataka 560102"},
        {"lat": 12.9784, "lng": 77.6408, "address": "100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038"},
        {"lat": 12.9562, "lng": 77.7011, "address": "Spice Garden Layout, Lakshminarayana Pura, Marathahalli, Bengaluru 560037"},
        {"lat": 12.9279, "lng": 77.6833, "address": "Sarjapur Main Rd, Kaikondrahalli, Bengaluru, Karnataka 560035"},
        {"lat": 12.9698, "lng": 77.7499, "address": "ITPL Main Rd, Pattandur Agrahara, Whitefield, Bengaluru 560066"},
        {"lat": 12.9226, "lng": 77.5933, "address": "9th Main Rd, 4th Block, Jayanagar, Bengaluru, Karnataka 560011"},
        {"lat": 12.9915, "lng": 77.5709, "address": "Sampige Rd, Malleshwaram, Bengaluru, Karnataka 560003"},
        {"lat": 12.9431, "lng": 77.5684, "address": "Bull Temple Rd, Basavanagudi, Bengaluru, Karnataka 560004"},
        {"lat": 12.9382, "lng": 77.6305, "address": "Sony World Signal, Koramangala 6th Block, Bengaluru 560095"},
        {"lat": 12.9845, "lng": 77.6042, "address": "Cunningham Rd, Vasanth Nagar, Bengaluru, Karnataka 560051"},
        {"lat": 12.9154, "lng": 77.6322, "address": "24th Main Rd, Sector 1, HSR Layout, Bengaluru 560102"},
        {"lat": 12.9730, "lng": 77.6110, "address": "Brigade Rd, Ashok Nagar, Bengaluru, Karnataka 560001"},
        {"lat": 12.9610, "lng": 77.6385, "address": "HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560008"},
        {"lat": 12.9592, "lng": 77.5735, "address": "Lalbagh West Gate, Basavanagudi, Bengaluru 560004"},
        {"lat": 12.9329, "lng": 77.6101, "address": "Koramangala 3rd Block, Bengaluru, Karnataka 560034"},
        {"lat": 12.9812, "lng": 77.6784, "address": "Rustam Bagh Layout, Kodihalli, Bengaluru 560017"},
    ]

    issue_pool = [
        {
            "title": "Major pipe burst under street corner",
            "description": "A clean water line burst occurred beneath the pavement, flooding the street and wasting thousands of liters of clean water since early morning. Traffic is also being affected.",
            "issue_type": "leakage",
            "severity": "critical"
        },
        {
            "title": "Dirty brown water from tap supplies",
            "description": "Since yesterday, the tap water supply has been smelling strongly of sewage and has a visible brown turbidity. Completely unfit for drinking or domestic use.",
            "issue_type": "contamination",
            "severity": "high"
        },
        {
            "title": "Complete lack of water supply for 3 days",
            "description": "Our society and neighboring houses have received absolutely zero water supply for the past three consecutive days. The overhead tanks are completely dry, and we are forced to buy private tankers.",
            "issue_type": "shortage",
            "severity": "high"
        },
        {
            "title": "Extremely low tap pressure on 2nd floor",
            "description": "The water pressure has been extremely low for the past week. It takes almost 30 minutes to fill a single bucket of water, and water does not reach the bathroom on the second floor.",
            "issue_type": "pressure",
            "severity": "low"
        },
        {
            "title": "Minor pipe leakage from street connection",
            "description": "There is a small but continuous drip-leakage coming from the main supply valve on the sidewalk in front of our house. It is slowly forming a puddle on the pavement.",
            "issue_type": "leakage",
            "severity": "medium"
        },
        {
            "title": "Slight chemical smell in municipal tap supply",
            "description": "We detected a strong chemical/chlorine-like odor in the tap water supply this afternoon. It feels slippery to the touch and we are worried about heavy metal contamination.",
            "issue_type": "contamination",
            "severity": "medium"
        },
        {
            "title": "Scheduled supply cut extended without notice",
            "description": "The weekly scheduled water supply cutoff for maintenance was supposed to end yesterday at 6 PM. However, the water supply has still not resumed, leaving the entire community stranded.",
            "issue_type": "shortage",
            "severity": "medium"
        },
        {
            "title": "Water pressure dropped to a trickle",
            "description": "The pressure in the local line has dropped significantly today. We can barely run our RO water filters because the input pressure is insufficient.",
            "issue_type": "pressure",
            "severity": "low"
        },
        {
            "title": "Suspected sewage leakage into drinking water main",
            "description": "We are getting blackish water with suspended particles from our main supply tap. We suspect the nearby drainage pipe is leaking into the water supply line.",
            "issue_type": "contamination",
            "severity": "critical"
        },
        {
            "title": "Massive pipeline leakage flooding empty plot",
            "description": "The main distribution line running alongside the empty plot has a major crack. There is a huge fountain of water shooting up, flooding the entire plot and surrounding lane.",
            "issue_type": "leakage",
            "severity": "high"
        }
    ]

    statuses = ['reported', 'under_review', 'in_progress', 'resolved']
    reporters = [
        ("Aravind Kumar", "aravind.k@gmail.com"),
        ("Priya Sharma", "priya.sharma@yahoo.com"),
        ("Rajesh Patel", "rpatel.99@outlook.com"),
        ("Anjali Menon", "anjali.menon@gmail.com"),
        ("Sandeep Naik", "sandeep.naik@gmail.com"),
        ("Kavitha Rao", "kavitha.rao@rediffmail.com"),
        ("Vikram Singh", "vikram.singh@gmail.com"),
        ("Meera Joshi", "meera.joshi@outlook.com"),
        ("Nikhil Dsouza", "nikhil.d@gmail.com"),
        ("Deepa Nair", "deepa.nair@gmail.com")
    ]

    authority_notes = [
        "Technician team dispatched to the location to replace the cracked valve.",
        "Water sample taken and sent to the laboratory for contaminant testing.",
        "Valves opened fully. Supply pressure restored to standard levels.",
        "Completed pipeline patching and reinforced the concrete bedding.",
        "Tanker supply arranged for the affected street while line repairs are underway.",
        "Source of contamination identified as a private drain line and successfully sealed."
    ]

    now = datetime.utcnow()

    # Generate 18 distinct complaints matching the 18 locations
    for i, loc in enumerate(bangalore_locations):
        # Pick an issue archetype or generate one
        if i < len(issue_pool):
            issue = issue_pool[i]
        else:
            issue = random.choice(issue_pool)

        # Status and corresponding details
        status = random.choice(statuses)
        auth_note = None
        if status == 'resolved':
            auth_note = random.choice(authority_notes)
        elif status == 'in_progress':
            auth_note = "Technicians are currently on-site working on resolution."
        elif status == 'under_review':
            auth_note = "Assigned to the local water engineering division for site inspection."

        # Reporter details
        reporter_name, reporter_email = random.choice(reporters)

        # Timestamp distributed over the last 30 days
        days_ago = random.randint(0, 29)
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        created_time = now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
        updated_time = created_time
        
        if status == 'resolved':
            # Updated to resolved after a few days
            resolve_days = random.randint(1, 4)
            updated_time = created_time + timedelta(days=resolve_days)
            if updated_time > now:
                updated_time = now

        # Add to database
        complaint = Complaint(
            title=f"{issue['title']} - Zone {i+1}",
            description=issue['description'],
            issue_type=issue['issue_type'],
            severity=issue['severity'],
            status=status,
            latitude=loc['lat'],
            longitude=loc['lng'],
            address=loc['address'],
            reporter_name=reporter_name,
            reporter_email=reporter_email,
            photo_url=f"/assets/demo_images/issue_{issue['issue_type']}.jpg",
            authority_note=auth_note,
            created_at=created_time,
            updated_at=updated_time
        )
        session.add(complaint)

    session.commit()
    print("Database successfully seeded with 18 realistic complaints!")

if __name__ == '__main__':
    from app import app, db, Complaint
    if hasattr(app, 'app_context'):
        with app.app_context():
            seed_database(db, Complaint)
    else:
        from app import SessionLocal
        db_sess = SessionLocal()
        try:
            seed_database(db_sess, Complaint)
        finally:
            db_sess.close()
