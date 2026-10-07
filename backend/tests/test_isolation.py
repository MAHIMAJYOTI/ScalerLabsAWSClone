API = "/api/v1"


def test_cross_user_zone_isolation(auth_client, other_client, make_zone, make_records):
    zone = make_zone("example.com")["hosted_zone"]
    record = make_records(
        zone["id"], {"name": "www", "type": "A", "values": ["192.0.2.1"]}
    )["records"][0]

    # another user's zone is a 404, never a 403
    resp = other_client.get(f"{API}/hostedzones/{zone['id']}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NoSuchHostedZone"

    assert other_client.get(f"{API}/hostedzones/{zone['id']}/records").status_code == 404
    assert (
        other_client.get(
            f"{API}/hostedzones/{zone['id']}/records/{record['id']}"
        ).status_code
        == 404
    )
    assert other_client.delete(f"{API}/hostedzones/{zone['id']}").status_code == 404

    # listings are scoped per user; the zone survives for its owner
    assert other_client.get(f"{API}/hostedzones").json()["total"] == 0
    assert auth_client.get(f"{API}/hostedzones").json()["total"] == 1
