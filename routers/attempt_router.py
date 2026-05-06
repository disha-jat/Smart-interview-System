from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import schemas
from services.scoring_service import calculate_score, calculate_coding_score

router = APIRouter()

CODING_CATEGORIES = {"coding", "code", "programming", "algorithm", "data structure"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/answer")
def submit_answer(answer: schemas.AnswerRequest, db: Session = Depends(get_db)):

    question = db.query(models.Question).filter(
        models.Question.id == answer.question_id
    ).first()

    if not question:
        return {"error": "Question not found"}

    # Use AI-powered coding scorer for coding questions; keyword scorer for others
    is_coding = (question.category or "").lower().strip() in CODING_CATEGORIES
    if is_coding:
        score = calculate_coding_score(
            answer.user_answer,
            question.ideal_answer,
            question.question_text,
        )
    else:
        score = calculate_score(answer.user_answer, question.ideal_answer)

    attempt = models.Attempt(
        question_id=answer.question_id,
        user_answer=answer.user_answer,
        score=score
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "score": score,
        "category": question.category,
        "difficulty": question.difficulty
    }