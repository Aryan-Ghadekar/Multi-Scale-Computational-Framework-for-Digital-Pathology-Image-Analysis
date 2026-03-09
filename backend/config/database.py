from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL database URL (from Supabase)
SQLALCHEMY_DATABASE_URL = os.getenv("SUPABASE_DB_URL")
# Example format:
# postgres://username:password@host:port/database

# PostgreSQL engine (no check_same_thread needed)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True  # optional: logs SQL queries
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session in FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()