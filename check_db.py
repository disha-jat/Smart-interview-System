from database import SessionLocal
from models import Question

db = SessionLocal()

questions = db.query(Question).all()

print("Total questions:", len(questions))

for q in questions[:10]:
    print("DOMAIN:", q.domain, "| DIFFICULTY:", q.difficulty)