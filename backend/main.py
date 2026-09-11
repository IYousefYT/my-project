import os
import hashlib
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from database import init_db, SessionLocal, User, UserRole, Game, Service, Order, OrderStatus
from schemas import UserCreate, UserResponse, Token, GameCreate, GameResponse, ServiceCreate, ServiceResponse, OrderCreate, OrderResponse
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
from fastapi.staticfiles import StaticFiles

# تحميل متغيرات البيئة من ملف .env
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "Mulanui_Super_Secret_JWT_Key_2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

# تعريف التطبيق مرة واحدة فقط بشكل صحيح
app = FastAPI(title="Mulanui Services API")

# إضافة الـ CORS لمد الأذونات للواجهة الأمامية
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

# ربط مجلد الملفات الثابتة والصور لكي يتمكن المتصفح من عرضها
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
def startup_event():
    init_db()
    
    # قراءة بيانات وحساب الفاوندر من ملف البيئة بشكل آمن
    db = SessionLocal()
    try:
        founder = db.query(User).filter(User.role == UserRole.FOUNDER).first()
        if not founder:
            f_username = os.getenv("FOUNDER_USERNAME", "founder")
            f_email = os.getenv("FOUNDER_EMAIL", "founder@mulanui.shop")
            raw_password = os.getenv("FOUNDER_PASSWORD", "YourSecurePasswordHere")
            hashed_password = hashlib.sha256(raw_password.encode()).hexdigest()
            
            default_founder = User(
                username=f_username,
                email=f_email,
                hashed_password=hashed_password,
                role=UserRole.FOUNDER
            )
            db.add(default_founder)
            db.commit()
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@app.get("/")
def read_root():
    return {"message": "Welcome to Mulanui Services API!", "status": "Database Connected Successfully"}

@app.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter((User.username == user.username) | (User.email == user.email)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username or Email already registered")

    fake_hashed_password = hashlib.sha256(user.password.encode()).hexdigest()

    new_user = User(
        username=user.username,
        nickname=user.nickname,
        email=user.email,
        hashed_password=fake_hashed_password,
        role=UserRole.CLIENT  
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    input_email = form_data.username
    fake_hashed_password = hashlib.sha256(form_data.password.encode()).hexdigest()
    
    env_founder_email = os.getenv("FOUNDER_EMAIL", "founder@mulanui.shop")
    env_founder_password = os.getenv("FOUNDER_PASSWORD", "YourSecurePasswordHere")
    env_founder_hashed = hashlib.sha256(env_founder_password.encode()).hexdigest()
    
    if input_email == env_founder_email and fake_hashed_password == env_founder_hashed:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": os.getenv("FOUNDER_USERNAME", "founder"), "role": UserRole.FOUNDER.value}, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}

    user = db.query(User).filter(User.email == input_email, User.hashed_password == fake_hashed_password).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        if username == os.getenv("FOUNDER_USERNAME", "founder"):
            class MockFounder:
                username = os.getenv("FOUNDER_USERNAME", "founder")
                role = UserRole.FOUNDER
            return MockFounder()
        raise credentials_exception
    return user

def get_current_founder(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.FOUNDER:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges (Founder only)")
    return current_user

@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/founder/dashboard")
def founder_dashboard(current_user: User = Depends(get_current_founder)):
    return {
        "message": f"Welcome to the Founder Dashboard, {current_user.username}!",
        "privilege_level": "Full System Access"
    }

@app.post("/games", response_model=GameResponse)
def create_game(game: GameCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    db_game = Game(
        title=game.title, 
        description=game.description, 
        category=game.category,
        image_url=game.image_url,
        icon_url=game.icon_url
    )
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game

@app.get("/admin/games", response_model=list[GameResponse])
def get_admin_games(db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    return db.query(Game).all()

@app.post("/admin/games", response_model=GameResponse)
def create_admin_game(game: GameCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    db_game = Game(
        title=game.title, 
        description=game.description, 
        category=game.category,
        image_url=game.image_url,
        icon_url=game.icon_url
    )
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game

@app.delete("/admin/games/{game_id}")
def delete_admin_game(game_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="اللعبة غير موجودة")
    
    db.delete(game)
    db.commit()
    return {"message": "تم حذف اللعبة بنجاح"}

@app.post("/services", response_model=ServiceResponse)
def create_service(service: ServiceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.PROVIDER and current_user.role != UserRole.FOUNDER:
        raise HTTPException(status_code=403, detail="Only Providers or Founders can create services")
    
    db_service = Service(
        title=service.title,
        description=service.description,
        price=service.price,
        game_id=service.game_id,
        image_url=service.image_url,
        provider_id=current_user.id if hasattr(current_user, "id") else 1
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@app.get("/services", response_model=list[ServiceResponse])
def get_services(db: Session = Depends(get_db)):
    return db.query(Service).all()

@app.post("/orders", response_model=OrderResponse)
def form_order(order: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.CLIENT and current_user.role != UserRole.FOUNDER:
        raise HTTPException(status_code=403, detail="Only clients can place orders")
    
    db_order = Order(
        client_id=current_user.id if hasattr(current_user, "id") else 1,
        service_id=order.service_id,
        status=OrderStatus.PENDING,
        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@app.get("/orders", response_model=list[OrderResponse])
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role in [UserRole.FOUNDER, UserRole.ADMIN]:
        return db.query(Order).all()
    elif current_user.role == UserRole.PROVIDER:
        return db.query(Order).filter(
            (Order.status == OrderStatus.APPROVED) & (Order.provider_id == None) |
            (Order.provider_id == current_user.id)
        ).all()
    elif current_user.role == UserRole.CLIENT:
        return db.query(Order).filter(Order.client_id == current_user.id).all()
    raise HTTPException(status_code=403, detail="Unauthorized role")

@app.patch("/orders/{order_id}/accept", response_model=OrderResponse)
def accept_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can accept orders")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status != OrderStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Order is not approved by admin yet")
    
    if order.provider_id is not None:
        raise HTTPException(status_code=400, detail="This order has already been taken by another booster")
    
    order.provider_id = current_user.id
    order.status = OrderStatus.IN_PROGRESS
    db.commit()
    db.refresh(order)
    
    response_data = OrderResponse.model_validate(order)
    response_data.provider_username = current_user.username
    return response_data

@app.patch("/orders/{order_id}/approve", response_model=OrderResponse)
def approve_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.FOUNDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only Admins or Founders can approve orders")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status != OrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending orders can be approved")

    order.provider_id = current_user.id if hasattr(current_user, "id") else None
    order.status = OrderStatus.APPROVED
    db.commit()
    db.refresh(order)
    
    response_data = OrderResponse.model_validate(order)
    response_data.provider_username = order.provider.username if order.provider else None
    return response_data

@app.get("/admin/users", response_model=list[UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    db_users = db.query(User).all()
    
    env_founder_username = os.getenv("FOUNDER_USERNAME", "founder")
    env_founder_email = os.getenv("FOUNDER_EMAIL", "founder@mulanui.shop")
    
    founder_in_db = any(u.username == env_founder_username or u.email == env_founder_email for u in db_users)
    
    users_list = list(db_users)
    
    if not founder_in_db:
        class EnvFounderMock:
            id = 0 
            username = env_founder_username
            nickname = "Founder"
            email = env_founder_email
            role = UserRole.FOUNDER
            balance = 0.0
            
        users_list.insert(0, EnvFounderMock())
        
    return users_list

@app.delete("/admin/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    env_founder_username = os.getenv("FOUNDER_USERNAME", "founder")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.username == env_founder_username or user.role == UserRole.FOUNDER:
        raise HTTPException(status_code=400, detail="Cannot delete the system founder account")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

class UpdateRoleRequest(BaseModel):
    role: UserRole

class UpdateBalanceRequest(BaseModel):
    amount: float
    operation: str  

@app.patch("/admin/users/{user_id}/role")
def update_user_role(user_id: int, body: UpdateRoleRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = body.role
    db.commit()
    return {"message": "Role updated successfully"}

@app.patch("/admin/users/{user_id}/balance")
def update_user_balance(user_id: int, body: UpdateBalanceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not hasattr(user, 'balance'):
        raise HTTPException(status_code=400, detail="User balance field missing in database")

    if body.operation == "add":
        user.balance += body.amount
    elif body.operation == "subtract":
        user.balance = max(0.0, user.balance - body.amount)
    
    db.commit()
    return {"message": "Balance updated successfully", "new_balance": user.balance}

@app.get("/admin/users/{user_id}/orders")
def get_user_orders(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    orders = db.query(Order).filter(Order.client_id == user_id).all()
    return orders

class AdminCreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: UserRole
    nickname: str | None = None

@app.post("/admin/users")
def create_user_by_admin(user: AdminCreateUserRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    existing_user = db.query(User).filter((User.username == user.username) | (User.email == user.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل")
    
    hashed_password = hashlib.sha256(user.password.encode()).hexdigest()
    
    new_user = User(
        username=user.username,
        email=user.email,
        nickname=user.nickname,
        hashed_password=hashed_password,
        role=user.role,
        balance=0.0
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User created successfully", "user_id": new_user.id}

class NicknameUpdate(BaseModel):
    nickname: str | None = None
    
@app.patch("/admin/users/{user_id}/nickname")
def update_user_nickname(user_id: int, data: NicknameUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    user.nickname = data.nickname
    db.commit()
    db.refresh(user)
    return {"message": "تم تحديث اسم العرض بنجاح", "nickname": user.nickname}

@app.get("/games", response_model=list[GameResponse])
def get_public_games(db: Session = Depends(get_db)):
    return db.query(Game).filter(Game.is_active == True).all()

class GameUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    image_url: str | None = None
    icon_url: str | None = None
    is_active: bool | None = None

@app.patch("/admin/games/{game_id}", response_model=GameResponse)
def update_admin_game(game_id: int, game_update: GameUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="اللعبة غير موجودة")
    
    if game_update.title is not None:
        game.title = game_update.title
    if game_update.description is not None:
        game.description = game_update.description
    if game_update.category is not None:
        game.category = game_update.category
    if game_update.image_url is not None:
        game.image_url = game_update.image_url
    if game_update.icon_url is not None:
        game.icon_url = game_update.icon_url
    if game_update.is_active is not None:
        game.is_active = game_update.is_active
        
    db.commit()
    db.refresh(game)
    return game

@app.delete("/admin/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    db.delete(order)
    db.commit()
    return {"message": "Order deleted successfully"}

@app.delete("/admin/services/{service_id}")
def delete_admin_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_founder)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")
    
    db.delete(service)
    db.commit()
    return {"message": "تم حذف الخدمة بنجاح"}

UPLOAD_DIR = "static/uploads/services"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/admin/upload-image")
def upload_service_image(file: UploadFile = File(...), current_user: User = Depends(get_current_founder)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    normalized_path = file_path.replace("\\", "/")
    return {"image_url": f"http://127.0.0.1:8000/{normalized_path}"}