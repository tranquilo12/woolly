from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import uuid
from dotenv import load_dotenv

load_dotenv(".env.local")

DATABASE_URL = os.environ.get(
    "POSTGRES_URL",
    "postgresql://default:zmNuXOkn14TJ@ep-proud-sound-a4rerowu-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
