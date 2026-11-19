"""MySQL metadata models owned exclusively by the independent AI service."""

from uuid import uuid7

from sqlalchemy import (
    BINARY,
    CHAR,
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import DATETIME, MEDIUMTEXT
from sqlalchemy.orm import DeclarativeBase

metadata = MetaData()


class Base(DeclarativeBase):
    metadata = metadata


def pk() -> Column:
    return Column("id", BINARY(16), primary_key=True, default=lambda: uuid7().bytes)


def created() -> Column:
    return Column("created_at", DATETIME(fsp=6), nullable=False)


ai_conversations = Table(
    "ai_conversations",
    metadata,
    pk(),
    Column("owner_user_id", BINARY(16), nullable=False),
    Column("title", String(200)),
    Column("context_summary", MEDIUMTEXT()),
    Column("last_message_at", DATETIME(fsp=6)),
    Column("expires_at", DATETIME(fsp=6)),
    Column("deleted_at", DATETIME(fsp=6)),
    created(),
    Column("updated_at", DATETIME(fsp=6), nullable=False),
    Index(
        "ix_ai_conversations_owner_deleted_last",
        "owner_user_id",
        "deleted_at",
        "last_message_at",
    ),
)

ai_messages = Table(
    "ai_messages",
    metadata,
    pk(),
    Column(
        "conversation_id",
        BINARY(16),
        ForeignKey("ai_conversations.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    Column("role", String(16), nullable=False),
    Column("content_text", MEDIUMTEXT(), nullable=False),
    Column("structured_result_json", JSON()),
    Column("provenance_json", JSON()),
    created(),
    CheckConstraint(
        "role IN ('USER','ASSISTANT','SYSTEM')", name="ck_ai_messages_role"
    ),
    Index("ix_ai_messages_conversation_created", "conversation_id", "created_at"),
)

ai_runs = Table(
    "ai_runs",
    metadata,
    pk(),
    Column("owner_user_id", BINARY(16), nullable=False),
    Column("request_id", String(64), nullable=False),
    Column("intent", String(64), nullable=False),
    Column("provider", String(16), nullable=False),
    Column("model_id", String(100), nullable=False),
    Column("tool_calls_count", Integer(), nullable=False, server_default=text("0")),
    Column("latency_ms", Integer(), nullable=False, server_default=text("0")),
    Column("status", String(16), nullable=False),
    Column("error_code", String(64)),
    created(),
    UniqueConstraint("request_id", name="uq_ai_runs_request_id"),
    CheckConstraint("provider IN ('OLLAMA','CLOUD')", name="ck_ai_runs_provider"),
    CheckConstraint(
        "status IN ('SUCCESS','FAILED','TIMEOUT')", name="ck_ai_runs_status"
    ),
    CheckConstraint(
        "tool_calls_count >= 0 AND latency_ms >= 0", name="ck_ai_runs_nonnegative"
    ),
    Index("ix_ai_runs_owner_created", "owner_user_id", "created_at"),
)

ai_document_jobs = Table(
    "ai_document_jobs",
    metadata,
    pk(),
    Column("owner_user_id", BINARY(16), nullable=False),
    Column("file_id", BINARY(16), nullable=False),
    Column("file_version", Integer(), nullable=False),
    Column("pipeline_version", String(32), nullable=False),
    Column("embedding_model", String(64), nullable=False),
    Column("idempotency_key", String(160), nullable=False),
    Column("status", String(24), nullable=False, server_default=text("'PENDING'")),
    Column("ocr_artifact_key", String(255)),
    Column("page_count", Integer()),
    Column("attempt_count", Integer(), nullable=False, server_default=text("0")),
    Column("lease_owner", String(100)),
    Column("lease_until", DATETIME(fsp=6)),
    Column("last_error_code", String(64)),
    created(),
    Column("updated_at", DATETIME(fsp=6), nullable=False),
    UniqueConstraint("idempotency_key", name="uq_ai_document_jobs_key"),
    CheckConstraint(
        "file_version > 0 AND attempt_count >= 0", name="ck_ai_document_jobs_counts"
    ),
    CheckConstraint(
        "status IN ('PENDING','EXTRACTING','CHUNKING','EMBEDDING','INDEXING','COMPLETED','FAILED_RETRYABLE','FAILED_PERMANENT','STALE_VERSION')",
        name="ck_ai_document_jobs_status",
    ),
    Index("ix_ai_document_jobs_status_lease", "status", "lease_until"),
    Index(
        "ix_ai_document_jobs_owner_file_version",
        "owner_user_id",
        "file_id",
        "file_version",
    ),
)

ai_document_chunks = Table(
    "ai_document_chunks",
    metadata,
    pk(),
    Column("owner_user_id", BINARY(16), nullable=False),
    Column("file_id", BINARY(16), nullable=False),
    Column("file_version", Integer(), nullable=False),
    Column("chunk_index", Integer(), nullable=False),
    Column("page_number", Integer()),
    Column("bbox_json", JSON()),
    Column("content_sha256", CHAR(64), nullable=False),
    Column("qdrant_point_id", BINARY(16), nullable=False),
    Column("is_active", Boolean(), nullable=False, server_default=text("1")),
    created(),
    UniqueConstraint(
        "file_id",
        "file_version",
        "chunk_index",
        name="uq_ai_document_chunks_file_version_index",
    ),
    CheckConstraint(
        "file_version > 0 AND chunk_index >= 0 AND (page_number IS NULL OR page_number > 0)",
        name="ck_ai_document_chunks_positions",
    ),
    Index(
        "ix_ai_document_chunks_owner_file_active",
        "owner_user_id",
        "file_id",
        "is_active",
    ),
)


class AiConversation(Base):
    __table__ = ai_conversations


class AiMessage(Base):
    __table__ = ai_messages


class AiRun(Base):
    __table__ = ai_runs


class AiDocumentJob(Base):
    __table__ = ai_document_jobs


class AiDocumentChunk(Base):
    __table__ = ai_document_chunks
