from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import enum

DATABASE_URL = "sqlite:///./mulanui.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class UserRole(str, enum.Enum):
    FOUNDER = "founder"
    ADMIN = "admin"
    PROVIDER = "provider"
    CLIENT = "client"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default=UserRole.CLIENT.value, nullable=False)
    balance = Column(Float, default=0.0) # <-- أضف هذا السطر للرصيد

    services = relationship("Service", back_populates="provider")
    
class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, default="games", nullable=True) 
    image_url = Column(String, nullable=True)
    icon_url = Column(String, nullable=True) 
    is_active = Column(Boolean, default=True)

    services = relationship("Service", back_populates="game")
class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    game_id = Column(Integer, ForeignKey("games.id"))
    provider_id = Column(Integer, ForeignKey("users.id"))

    game = relationship("Game", back_populates="services")
    provider = relationship("User", back_populates="services")

def init_db():
    Base.metadata.create_all(bind=engine)

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"))
    service_id = Column(Integer, ForeignKey("services.id"))
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=True) 
    status = Column(String, default=OrderStatus.PENDING.value, nullable=False)
    created_at = Column(String, nullable=True)

    client = relationship("User", foreign_keys=[client_id], backref="client_orders")
    provider = relationship("User", foreign_keys=[provider_id], backref="provider_orders")
    service = relationship("Service", backref="orders")