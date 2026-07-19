import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .models import UserRegister, UserLogin, Token, UserOut
from .security import hash_password, verify_password, create_access_token
from .database import get_user_by_email, create_user, init_user_db
from .dependencies import get_current_user
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/api/auth", tags=["auth"])
init_user_db()


@router.post("/register", response_model=Token)
def register(payload: UserRegister):
    if get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    create_user(
        user_id=user_id, email=payload.email, username=payload.username,
        hashed_password=hash_password(payload.password), created_at=created_at,
    )
    token = create_access_token({"sub": user_id})
    return Token(access_token=token, user=UserOut(id=user_id, email=payload.email, username=payload.username, created_at=created_at))


@router.post("/login", response_model=Token)
def login(payload: UserLogin):
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["id"]})
    return Token(access_token=token, user=UserOut(id=user["id"], email=user["email"], username=user["username"], created_at=user["created_at"]))

@router.post("/token", include_in_schema=False)
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["id"]})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], username=user["username"], created_at=user["created_at"])
# import uuid
# from datetime import datetime, timezone
# from fastapi import APIRouter, HTTPException, Depends
# from .models import UserRegister, UserLogin, Token, UserOut
# from .security import hash_password, verify_password, create_access_token
# from .database import get_user_by_email, create_user, init_user_db
# from .dependencies import get_current_user
# from fastapi.security import OAuth2PasswordRequestForm
 
# router = APIRouter(prefix="/api/auth", tags=["auth"])
# init_user_db()
 
 
# @router.post("/register", response_model=Token)
# def register(payload: UserRegister):
#     if get_user_by_email(payload.email):
#         raise HTTPException(status_code=400, detail="Email already registered")
 
#     user_id = str(uuid.uuid4())
#     created_at = datetime.now(timezone.utc).isoformat()
#     create_user(
#         user_id=user_id,
#         email=payload.email,
#         username=payload.username,
#         hashed_password=hash_password(payload.password),
#         created_at=created_at,
#     )
#     token = create_access_token({"sub": user_id})
#     return Token(
#         access_token=token,
#         user=UserOut(id=user_id, email=payload.email, username=payload.username, created_at=created_at),
#     )
 

# @router.post("/login", response_model=Token)
# def login(form_data: OAuth2PasswordRequestForm = Depends()):
#     user = get_user_by_email(form_data.username)  # email goes in "username" field
#     if not user or not verify_password(form_data.password, user["hashed_password"]):
#         raise HTTPException(status_code=401, detail="Invalid email or password")

#     token = create_access_token({"sub": user["id"]})
#     return Token(
#         access_token=token,
#         user=UserOut(id=user["id"], email=user["email"], username=user["username"], created_at=user["created_at"]),
#     )
 
 
# @router.get("/me", response_model=UserOut)
# def me(user: dict = Depends(get_current_user)):
#     return UserOut(id=user["id"], email=user["email"], username=user["username"], created_at=user["created_at"])