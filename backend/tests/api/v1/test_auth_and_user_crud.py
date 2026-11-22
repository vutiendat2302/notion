import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import verify_password
from app.modules.auth.services.admin_seed_service import ensure_default_admin
from app.modules.users.models.user import User
from tests.conftest import TransactionalProxySession


@pytest.mark.asyncio
async def test_admin_seed_idempotent(db_proxy_session: TransactionalProxySession) -> None:
    admin1 = await ensure_default_admin(db_proxy_session)  # type: ignore[arg-type]
    assert admin1 is not None
    assert admin1.role == "ADMIN"
    assert admin1.username == "admin"
    assert verify_password("dat123456", admin1.password_hash)

    admin2 = await ensure_default_admin(db_proxy_session)  # type: ignore[arg-type]
    assert admin2 is not None
    assert admin2.id == admin1.id

    rows = (
        await db_proxy_session.execute(
            select(User).where(User.email_normalized == "admin@dat.local")
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_register_email_or_phone_unique_and_login(client: AsyncClient) -> None:
    # 1. Missing both email and phone -> 422
    bad = await client.post(
        "/api/v1/auth/register",
        json={"display_name": "No Contact", "password": "StrongPassword123"},
    )
    assert bad.status_code == 422

    # 1b. Invalid email, phone, username, mismatched confirm_password, or policy not accepted -> 422
    bad_email = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "bad_user",
            "display_name": "Bad Email",
            "email": "not-an-email",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert bad_email.status_code == 422
    assert bad_email.json()["error"]["code"] == "INVALID_EMAIL"

    bad_phone = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Bad Phone",
            "phone": "0111222333",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert bad_phone.status_code == 422
    assert bad_phone.json()["error"]["code"] == "INVALID_PHONE"

    bad_confirm = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Mismatch",
            "email": "mismatch@example.com",
            "password": "StrongPassword123",
            "confirm_password": "OtherPassword123",
            "accepted_policy": True,
        },
    )
    assert bad_confirm.status_code == 422

    bad_policy = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "No Policy",
            "email": "nopolicy@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": False,
        },
    )
    assert bad_policy.status_code == 422

    # 2. Register with username + phone only (09...) -> normalized to +84...
    reg_phone = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "Phone.User_01",
            "display_name": "Phone User",
            "phone": "0912 345 678",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert reg_phone.status_code == 201
    phone_data = reg_phone.json()
    assert phone_data["user"]["role"] == "USER"
    assert phone_data["user"]["username"] == "Phone.User_01"
    assert phone_data["user"]["email"] is None
    assert phone_data["user"]["phone"] == "0912345678"
    assert reg_phone.cookies.get("access_token")
    assert reg_phone.cookies.get("csrf_token")

    # 2b. Duplicate username ignoring case -> 409 Conflict
    dup_username = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "phone.user_01",
            "display_name": "Dup Username",
            "email": "other@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert dup_username.status_code == 409
    assert dup_username.json()["error"]["code"] == "USERNAME_ALREADY_EXISTS"

    # 3. Duplicate phone using +84 format -> 409 Conflict
    dup_phone = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Dup Phone",
            "phone": "+84912345678",
            "password": "StrongPassword123",
        },
    )
    assert dup_phone.status_code == 409
    assert dup_phone.json()["error"]["code"] == "PHONE_ALREADY_EXISTS"

    # 4. Register with email only
    reg_email = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Email User",
            "email": "Member@Example.com",
            "password": "StrongPassword123",
        },
    )
    assert reg_email.status_code == 201
    assert reg_email.json()["user"]["email"] == "Member@Example.com"

    # 5. Duplicate email ignoring case -> 409 Conflict
    dup_email = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Dup Email",
            "email": "member@example.com",
            "password": "StrongPassword123",
        },
    )
    assert dup_email.status_code == 409
    assert dup_email.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"

    # 6. Login using phone number (+84 format) & username
    login_phone = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "+84912345678", "password": "StrongPassword123"},
    )
    assert login_phone.status_code == 200
    assert login_phone.json()["user"]["display_name"] == "Phone User"

    login_username = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "phone.user_01", "password": "StrongPassword123"},
    )
    assert login_username.status_code == 200
    assert login_username.json()["user"]["username"] == "Phone.User_01"


@pytest.mark.asyncio
async def test_user_me_sessions_and_admin_crud_rbac(
    client: AsyncClient,
    db_proxy_session: TransactionalProxySession,
) -> None:
    # Seed default admin inside transactional proxy
    admin = await ensure_default_admin(db_proxy_session)  # type: ignore[arg-type]
    assert admin is not None

    # 1. Register normal user and verify non-admin cannot access /admin/users
    reg_user = await client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Normal Member",
            "email": "normal@example.com",
            "password": "StrongPassword123",
        },
    )
    assert reg_user.status_code == 201
    user_token = reg_user.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    forbidden_resp = await client.get("/api/v1/admin/users", headers=user_headers)
    assert forbidden_resp.status_code == 403

    # 2. Normal user can update own profile & list/revoke sessions
    patch_me = await client.patch(
        "/api/v1/users/me",
        headers=user_headers,
        json={"display_name": "Normal Updated", "phone": "0988777666"},
    )
    assert patch_me.status_code == 200
    assert patch_me.json()["display_name"] == "Normal Updated"
    assert patch_me.json()["phone"] == "0988777666"

    sessions_resp = await client.get("/api/v1/users/me/sessions", headers=user_headers)
    assert sessions_resp.status_code == 200
    assert len(sessions_resp.json()) == 1
    assert sessions_resp.json()[0]["is_current"] is True

    # 3. Admin login with default password dat123456 via username OR email
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin", "password": "dat123456"},
    )
    assert admin_login.status_code == 200
    assert admin_login.json()["user"]["role"] == "ADMIN"
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 4. Admin CRUD: list, create, get, patch, disable
    list_resp = await client.get("/api/v1/admin/users", headers=admin_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 2

    create_resp = await client.post(
        "/api/v1/admin/users",
        headers=admin_headers,
        json={
            "display_name": "Created By Admin",
            "email": "created@example.com",
            "phone": "0909111222",
            "password": "StrongPassword123",
            "role": "USER",
            "status": "ACTIVE",
        },
    )
    assert create_resp.status_code == 201
    created_id = create_resp.json()["id"]

    # Cannot update to duplicate phone of Normal Member
    dup_patch = await client.patch(
        f"/api/v1/admin/users/{created_id}",
        headers=admin_headers,
        json={"phone": "0988777666"},
    )
    assert dup_patch.status_code == 409

    # Disable user -> login must fail with 403
    disable_resp = await client.delete(f"/api/v1/admin/users/{created_id}", headers=admin_headers)
    assert disable_resp.status_code == 200
    assert disable_resp.json()["status"] == "DISABLED"

    disabled_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "created@example.com", "password": "StrongPassword123"},
    )
    assert disabled_login.status_code == 403

    # Admin cannot disable self
    self_disable = await client.delete(
        f"/api/v1/admin/users/{admin_login.json()['user']['id']}",
        headers=admin_headers,
    )
    assert self_disable.status_code == 409


@pytest.mark.asyncio
async def test_csrf_origin_mismatch_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        headers={"Origin": "https://evil.example.com"},
        json={"identifier": "admin@dat.local", "password": "dat123456"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "CSRF_ORIGIN_MISMATCH"
