API = "/api/v1"


def records_of(client, zone_id, **params):
    resp = client.get(f"{API}/hostedzones/{zone_id}/records", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_create_public_zone_auto_ns_soa(auth_client, make_zone):
    body = make_zone("Example.COM", comment="prod zone")
    zone = body["hosted_zone"]
    assert zone["name"] == "example.com."
    assert zone["record_count"] == 2
    assert len(body["delegation_set"]["name_servers"]) == 4
    assert body["change"]["status"] == "PENDING"

    data = records_of(auth_client, zone["id"])
    assert data["total"] == 2
    ns, soa = data["items"][0], data["items"][1]
    assert ns["type"] == "NS" and ns["ttl"] == 172800 and len(ns["values"]) == 4
    assert all(v.endswith(".") for v in ns["values"])
    assert soa["type"] == "SOA" and soa["ttl"] == 900
    assert soa["values"][0].endswith("1 7200 900 1209600 86400")
    assert soa["values"][0].split()[0] == ns["values"][0]


def test_private_zone_vpc_rules_and_tags(auth_client, make_zone):
    # private without VPC rejected
    resp = auth_client.post(
        f"{API}/hostedzones", json={"name": "internal.corp", "private_zone": True}
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "InvalidInput"
    # public with VPC rejected
    resp = auth_client.post(
        f"{API}/hostedzones",
        json={"name": "x.com", "vpcs": [{"region": "us-east-1", "vpc_id": "vpc-1"}]},
    )
    assert resp.status_code == 400
    # valid private zone with tags; detail returns vpcs + tags, no delegation set
    body = make_zone(
        "internal.corp",
        private_zone=True,
        vpcs=[{"region": "us-east-1", "vpc_id": "vpc-123"}],
        tags=[{"key": "env", "value": "prod"}],
    )
    assert body["delegation_set"] is None
    detail = auth_client.get(f"{API}/hostedzones/{body['hosted_zone']['id']}").json()
    assert detail["private_zone"] is True
    assert detail["name_servers"] == []
    assert detail["vpcs"] == [{"region": "us-east-1", "vpc_id": "vpc-123"}]
    assert detail["tags"] == [{"key": "env", "value": "prod"}]
    # private zones get the fixed Route53 placeholder NS set + matching SOA mname
    records = records_of(auth_client, body["hosted_zone"]["id"])
    ns = next(i for i in records["items"] if i["type"] == "NS")
    soa = next(i for i in records["items"] if i["type"] == "SOA")
    assert ns["values"] == [
        "ns-0.awsdns-00.com.",
        "ns-1024.awsdns-00.org.",
        "ns-512.awsdns-00.net.",
        "ns-1536.awsdns-00.co.uk.",
    ]
    assert soa["values"][0].startswith("ns-0.awsdns-00.com. ")


def test_duplicate_zone_names_allowed(auth_client, make_zone):
    first = make_zone("example.com")["hosted_zone"]
    second = make_zone("example.com")["hosted_zone"]
    assert first["id"] != second["id"]
    assert auth_client.get(f"{API}/hostedzones", params={"q": "example.com"}).json()[
        "total"
    ] == 2


def test_patch_updates_only_comment(auth_client, make_zone):
    zone = make_zone("example.com", comment="before")["hosted_zone"]
    resp = auth_client.patch(f"{API}/hostedzones/{zone['id']}", json={"comment": "after"})
    assert resp.status_code == 200
    assert resp.json()["comment"] == "after"
    assert resp.json()["name"] == "example.com."


def test_delete_zone_not_empty_then_success(auth_client, make_zone, make_records):
    zone = make_zone("example.com")["hosted_zone"]
    created = make_records(
        zone["id"], {"name": "www", "type": "A", "values": ["192.0.2.1"]}
    )
    resp = auth_client.delete(f"{API}/hostedzones/{zone['id']}")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "HostedZoneNotEmpty"

    record_id = created["records"][0]["id"]
    auth_client.delete(f"{API}/hostedzones/{zone['id']}/records/{record_id}")
    resp = auth_client.delete(f"{API}/hostedzones/{zone['id']}")
    assert resp.status_code == 200
    assert resp.json()["change"]["status"] == "PENDING"
    assert auth_client.get(f"{API}/hostedzones/{zone['id']}").status_code == 404


def test_list_search_filter_pagination_totals(auth_client, make_zone):
    make_zone("alpha.com", comment="first zone")
    make_zone("beta.com", comment="second zone")
    make_zone(
        "gamma.corp",
        private_zone=True,
        vpcs=[{"region": "us-east-1", "vpc_id": "vpc-1"}],
    )
    for i in range(12):
        make_zone(f"filler-{i:02d}.dev")

    assert auth_client.get(f"{API}/hostedzones", params={"q": "beta"}).json()["total"] == 1
    assert (
        auth_client.get(f"{API}/hostedzones", params={"q": "second zone"}).json()[
            "items"
        ][0]["name"]
        == "beta.com."
    )
    assert (
        auth_client.get(f"{API}/hostedzones", params={"type": "private"}).json()["total"]
        == 1
    )

    body = auth_client.get(
        f"{API}/hostedzones", params={"page": 1, "page_size": 10}
    ).json()
    assert body["total"] == 15
    assert len(body["items"]) == 10
    assert all(item["record_count"] == 2 for item in body["items"])
    body = auth_client.get(
        f"{API}/hostedzones", params={"page": 2, "page_size": 10}
    ).json()
    assert len(body["items"]) == 5
