from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow


class RecordSet(Base):
    __tablename__ = "record_sets"
    __table_args__ = (
        Index("ix_record_sets_zone_type", "zone_id", "type"),
        Index("ix_record_sets_zone_name", "zone_id", "name"),
        Index(
            "uq_record_sets_identity",
            "zone_id",
            "name",
            "type",
            text("coalesce(set_identifier, '')"),
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(10))
    ttl: Mapped[int | None]
    routing_policy: Mapped[str] = mapped_column(String(16), default="SIMPLE")
    set_identifier: Mapped[str | None] = mapped_column(String(128))
    weight: Mapped[int | None]
    region: Mapped[str | None] = mapped_column(String(32))
    failover: Mapped[str | None] = mapped_column(String(16))
    geo_continent: Mapped[str | None] = mapped_column(String(32))
    geo_country: Mapped[str | None] = mapped_column(String(32))
    geo_subdivision: Mapped[str | None] = mapped_column(String(32))
    multivalue_answer: Mapped[bool] = mapped_column(default=False)
    health_check_id: Mapped[str | None] = mapped_column(String(64))
    is_alias: Mapped[bool] = mapped_column(default=False)
    alias_dns_name: Mapped[str | None] = mapped_column(String(255))
    alias_hosted_zone_id: Mapped[str | None] = mapped_column(String(32))
    alias_evaluate_target_health: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    resource_records: Mapped[list["ResourceRecord"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ResourceRecord.position",
    )


class ResourceRecord(Base):
    __tablename__ = "resource_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    record_set_id: Mapped[str] = mapped_column(
        ForeignKey("record_sets.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[str] = mapped_column(Text)
    position: Mapped[int]
