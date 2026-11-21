from src.db.database import Base, engine
from src.db.models import User

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")