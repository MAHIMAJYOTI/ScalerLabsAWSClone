from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow


class HostedZone(Base):
    __tablename__ = "hosted_zones"
    __table_args__ = (Index("ix_hosted_zones_owner_name", "owner_id", "name"),)

    id: Mapped[str] = mapped_column(String(21), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    caller_reference: Mapped[str] = mapped_column(String(64))
    comment: Mapped[str | None] = mapped_column(String(256))
    private_zone: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    vpcs: Mapped[list["HostedZoneVpc"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="HostedZoneVpc.id"
    )
    tags: Mapped[list["HostedZoneTag"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="HostedZoneTag.key"
    )
    name_servers: Mapped[list["DelegationNameServer"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DelegationNameServer.position",
    )


class HostedZoneVpc(Base):
    __tablename__ = "hosted_zone_vpcs"

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True
    )
    vpc_region: Mapped[str] = mapped_column(String(32))
    vpc_id: Mapped[str] = mapped_column(String(64))


class HostedZoneTag(Base):
    __tablename__ = "hosted_zone_tags"
    __table_args__ = (UniqueConstraint("zone_id", "key", name="uq_hosted_zone_tags_zone_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(256))


class DelegationNameServer(Base):
    __tablename__ = "delegation_name_servers"

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True
    )
    name_server: Mapped[str] = mapped_column(String(255))
    position: Mapped[int]
