"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-06

"""

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=128), nullable=False),
        sa.Column("account_id", sa.String(length=12), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"], unique=True)
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "hosted_zones",
        sa.Column("id", sa.String(length=21), primary_key=True),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("caller_reference", sa.String(length=64), nullable=False),
        sa.Column("comment", sa.String(length=256), nullable=True),
        sa.Column("private_zone", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hosted_zones_owner_name", "hosted_zones", ["owner_id", "name"])

    op.create_table(
        "hosted_zone_vpcs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "zone_id",
            sa.String(length=21),
            sa.ForeignKey("hosted_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("vpc_region", sa.String(length=32), nullable=False),
        sa.Column("vpc_id", sa.String(length=64), nullable=False),
    )
    op.create_index("ix_hosted_zone_vpcs_zone_id", "hosted_zone_vpcs", ["zone_id"])

    op.create_table(
        "hosted_zone_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "zone_id",
            sa.String(length=21),
            sa.ForeignKey("hosted_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("value", sa.String(length=256), nullable=False),
        sa.UniqueConstraint("zone_id", "key", name="uq_hosted_zone_tags_zone_key"),
    )
    op.create_index("ix_hosted_zone_tags_zone_id", "hosted_zone_tags", ["zone_id"])

    op.create_table(
        "delegation_name_servers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "zone_id",
            sa.String(length=21),
            sa.ForeignKey("hosted_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name_server", sa.String(length=255), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_delegation_name_servers_zone_id", "delegation_name_servers", ["zone_id"]
    )

    op.create_table(
        "record_sets",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column(
            "zone_id",
            sa.String(length=21),
            sa.ForeignKey("hosted_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("ttl", sa.Integer(), nullable=True),
        sa.Column("routing_policy", sa.String(length=16), nullable=False),
        sa.Column("set_identifier", sa.String(length=128), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("region", sa.String(length=32), nullable=True),
        sa.Column("failover", sa.String(length=16), nullable=True),
        sa.Column("geo_continent", sa.String(length=32), nullable=True),
        sa.Column("geo_country", sa.String(length=32), nullable=True),
        sa.Column("geo_subdivision", sa.String(length=32), nullable=True),
        sa.Column("multivalue_answer", sa.Boolean(), nullable=False),
        sa.Column("health_check_id", sa.String(length=64), nullable=True),
        sa.Column("is_alias", sa.Boolean(), nullable=False),
        sa.Column("alias_dns_name", sa.String(length=255), nullable=True),
        sa.Column("alias_hosted_zone_id", sa.String(length=32), nullable=True),
        sa.Column("alias_evaluate_target_health", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_record_sets_zone_type", "record_sets", ["zone_id", "type"])
    op.create_index("ix_record_sets_zone_name", "record_sets", ["zone_id", "name"])
    op.create_index(
        "uq_record_sets_identity",
        "record_sets",
        ["zone_id", "name", "type", sa.text("coalesce(set_identifier, '')")],
        unique=True,
    )

    op.create_table(
        "resource_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "record_set_id",
            sa.String(length=32),
            sa.ForeignKey("record_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_resource_records_record_set_id", "resource_records", ["record_set_id"]
    )

    op.create_table(
        "changes",
        sa.Column("id", sa.String(length=21), primary_key=True),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("comment", sa.String(length=256), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("changes")
    op.drop_index("ix_resource_records_record_set_id", table_name="resource_records")
    op.drop_table("resource_records")
    op.drop_index("uq_record_sets_identity", table_name="record_sets")
    op.drop_index("ix_record_sets_zone_name", table_name="record_sets")
    op.drop_index("ix_record_sets_zone_type", table_name="record_sets")
    op.drop_table("record_sets")
    op.drop_index(
        "ix_delegation_name_servers_zone_id", table_name="delegation_name_servers"
    )
    op.drop_table("delegation_name_servers")
    op.drop_index("ix_hosted_zone_tags_zone_id", table_name="hosted_zone_tags")
    op.drop_table("hosted_zone_tags")
    op.drop_index("ix_hosted_zone_vpcs_zone_id", table_name="hosted_zone_vpcs")
    op.drop_table("hosted_zone_vpcs")
    op.drop_index("ix_hosted_zones_owner_name", table_name="hosted_zones")
    op.drop_table("hosted_zones")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_sessions_token_hash", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
