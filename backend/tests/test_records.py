import pytest
from sqlalchemy.exc import IntegrityError

from app.models import RecordSet
from app.services.id_gen import new_record_id

API = "/api/v1"


@pytest.fixture
def zone(make_zone):
    return make_zone("example.com")["hosted_zone"]


def list_records(client, zone_id, **params):
    resp = client.get(f"{API}/hostedzones/{zone_id}/records", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def find(items, name, rtype):
    return next(i for i in items if i["name"] == name and i["type"] == rtype)


def test_unique_identity_index_enforced_at_db_level(db, zone):
    """Bypass services: the uq_record_sets_identity expression index (zone_id,
    name, type, COALESCE(set_identifier, '')) must reject duplicates on its own."""
    first = RecordSet(
        id=new_record_id(),
        zone_id=zone["id"],
        name="dup.example.com.",
        type="A",
        ttl=300,
    )
    db.add(first)
    db.commit()

    duplicate = RecordSet(
        id=new_record_id(),
        zone_id=zone["id"],
        name="dup.example.com.",
        type="A",
        ttl=60,
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_protected_flag_on_records(auth_client, zone, make_records):
    created = make_records(
        zone["id"], {"name": "www", "type": "A", "values": ["192.0.2.1"]}
    )["records"][0]
    assert created["protected"] is False
    items = list_records(auth_client, zone["id"])["items"]
    assert find(items, "example.com.", "SOA")["protected"] is True
    assert find(items, "example.com.", "NS")["protected"] is True
    assert find(items, "www.example.com.", "A")["protected"] is False


def test_create_single_record_normalized(auth_client, zone, make_records):
    body = make_records(zone["id"], {"name": "WWW", "type": "a", "values": ["192.0.2.1"]})
    record = body["records"][0]
    assert record["name"] == "www.example.com."
    assert record["type"] == "A"
    assert record["ttl"] == 300  # default applied
    assert record["values"] == ["192.0.2.1"]
    assert body["change"]["status"] == "PENDING"


def test_create_multiple_records_one_call(auth_client, zone, make_records):
    body = make_records(
        zone["id"],
        {
            "records": [
                {"name": "www", "type": "A", "ttl": 60, "values": ["192.0.2.1"]},
                {"name": "", "type": "MX", "values": ["10 mail.example.com."]},
            ]
        },
    )
    assert len(body["records"]) == 2
    assert list_records(auth_client, zone["id"])["total"] == 4  # + apex NS, SOA


def test_batch_create_is_atomic(auth_client, zone):
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records",
        json={
            "records": [
                {"name": "ok", "type": "A", "values": ["192.0.2.1"]},
                {"name": "bad", "type": "A", "values": ["not-an-ip"]},
            ]
        },
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "InvalidChangeBatch"
    assert error["details"][0]["index"] == 1
    # nothing inserted: only apex NS + SOA remain
    assert list_records(auth_client, zone["id"])["total"] == 2


def test_duplicate_record_rejected_with_route53_message(auth_client, zone, make_records):
    make_records(zone["id"], {"name": "www", "type": "A", "values": ["192.0.2.1"]})
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records",
        json={"name": "www", "type": "A", "values": ["192.0.2.2"]},
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "InvalidChangeBatch"
    assert (
        "Tried to create resource record set [name='www.example.com.', type='A'] "
        "but it already exists" in error["message"]
    )
    # details carry index + name + type (same shape as import errors)
    detail = error["details"][0]
    assert detail["index"] == 0
    assert detail["name"] == "www.example.com."
    assert detail["type"] == "A"
    assert detail["message"]


def test_cname_cannot_coexist_both_directions(auth_client, zone, make_records):
    make_records(zone["id"], {"name": "app", "type": "A", "values": ["192.0.2.1"]})
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records",
        json={"name": "app", "type": "CNAME", "values": ["target.example.com."]},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "InvalidChangeBatch"

    make_records(
        zone["id"], {"name": "cn", "type": "CNAME", "values": ["target.example.com."]}
    )
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records",
        json={"name": "cn", "type": "TXT", "values": ["hello"]},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "InvalidChangeBatch"


def test_update_record_full_replace_and_immutable_name_type(
    auth_client, zone, make_records
):
    record = make_records(
        zone["id"], {"name": "www", "type": "A", "ttl": 300, "values": ["192.0.2.1"]}
    )["records"][0]
    url = f"{API}/hostedzones/{zone['id']}/records/{record['id']}"

    resp = auth_client.put(url, json={"ttl": 600, "values": ["192.0.2.9", "192.0.2.10"]})
    assert resp.status_code == 200
    updated = resp.json()["record"]
    assert updated["ttl"] == 600
    assert updated["values"] == ["192.0.2.9", "192.0.2.10"]
    assert resp.json()["change"]["status"] == "PENDING"

    assert auth_client.put(
        url, json={"name": "other", "values": ["192.0.2.1"]}
    ).status_code == 400
    assert auth_client.put(url, json={"type": "TXT", "values": ["x"]}).status_code == 400


def test_delete_record(auth_client, zone, make_records):
    record = make_records(
        zone["id"], {"name": "www", "type": "A", "values": ["192.0.2.1"]}
    )["records"][0]
    resp = auth_client.delete(f"{API}/hostedzones/{zone['id']}/records/{record['id']}")
    assert resp.status_code == 200
    assert "change" in resp.json()
    resp = auth_client.get(f"{API}/hostedzones/{zone['id']}/records/{record['id']}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NoSuchRecordSet"


def test_soa_and_apex_ns_protected(auth_client, zone):
    items = list_records(auth_client, zone["id"])["items"]
    soa = find(items, "example.com.", "SOA")
    ns = find(items, "example.com.", "NS")

    # SOA editable
    new_value = soa["values"][0].rsplit(" ", 1)[0] + " 300"
    resp = auth_client.put(
        f"{API}/hostedzones/{zone['id']}/records/{soa['id']}",
        json={"ttl": 900, "values": [new_value]},
    )
    assert resp.status_code == 200
    assert resp.json()["record"]["values"] == [new_value]

    # SOA not deletable / creatable; apex NS not deletable
    resp = auth_client.delete(f"{API}/hostedzones/{zone['id']}/records/{soa['id']}")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "InvalidChangeBatch"
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records",
        json={"name": "sub", "type": "SOA", "values": ["ns. host. 1 2 3 4 5"]},
    )
    assert resp.status_code == 400
    resp = auth_client.delete(f"{API}/hostedzones/{zone['id']}/records/{ns['id']}")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "InvalidChangeBatch"


def test_record_search_and_pagination_totals(auth_client, zone, make_records):
    make_records(
        zone["id"],
        {
            "records": [
                {"name": "www", "type": "A", "values": ["192.0.2.55"]},
                {"name": "mail", "type": "A", "values": ["192.0.2.66"]},
                {"name": "", "type": "MX", "values": ["10 mail.example.com."]},
            ]
        },
    )
    # q matches values and names; total_unfiltered ignores all filters
    data = list_records(auth_client, zone["id"], q="192.0.2.55")
    assert data["total"] == 1 and data["items"][0]["name"] == "www.example.com."
    assert data["total_unfiltered"] == 5  # 3 created + apex NS + SOA
    assert list_records(auth_client, zone["id"], q="mail")["total"] == 2
    # type filter
    assert list_records(auth_client, zone["id"], type="A,MX")["total"] == 3
    # default sort: apex NS first, then SOA
    items = list_records(auth_client, zone["id"])["items"]
    assert [i["type"] for i in items[:2]] == ["NS", "SOA"]
    # pagination totals
    data = list_records(auth_client, zone["id"], page=1, page_size=2)
    assert data["total"] == 5 and len(data["items"]) == 2
    data = list_records(auth_client, zone["id"], page=3, page_size=2)
    assert len(data["items"]) == 1
