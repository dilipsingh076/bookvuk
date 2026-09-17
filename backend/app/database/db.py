from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

SQLALCHEMY_DATABASE_URL = settings.sqlalchemy_url

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # A managed database (Supabase et al.) sits behind a pooler that closes idle
    # connections, so a pooled connection can be dead by the time we reuse it.
    # pre-ping discards those instead of failing the request; recycle keeps
    # connections younger than the provider's idle timeout.
    #
    # Settable because the ping is a round trip on every request — 243 ms with
    # the database in another region, ~2 ms beside it. See the note on
    # DATABASE_POOL_PRE_PING for when turning it off is the right call.
    pool_pre_ping=settings.DATABASE_POOL_PRE_PING,
    pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    connect_args={
        "connect_timeout": settings.DATABASE_CONNECT_TIMEOUT,
        "application_name": "bookvuk-api",
        # TCP keepalives stop a long-lived connection from being silently dropped
        # by NAT/firewall timeouts on the way to a remote host.
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
