import pytest

API = "/api/v1"


@pytest.fixture
def zone(make_zone):
    return make_zone("example.com")["hosted_zone"]


def records_of(client, zone_id):
    resp = client.get(
        f"{API}/hostedzones/{zone_id}/records", params={"page_size": 300}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def do_import(client, zone_id, zone_file, expect=201):
    resp = client.post(
        f"{API}/hostedzones/{zone_id}/records/import", json={"zone_file": zone_file}
    )
    assert resp.status_code == expect, resp.text
    return resp.json()


HAPPY_ZONE_FILE = """\
$ORIGIN example.com.
$TTL 3600
; mail servers for the apex
@ IN MX ( 10
          mail1.example.com. )  ; parentheses span one rdata across lines
@ IN MX 20 mail2.example.com.
www 300 IN A 192.0.2.1
www 300 IN A 192.0.2.2
ftp IN CNAME www.example.com.   ; relative owner name
@ 300 IN TXT "v=spf1" " include:x.example.com ~all"
_sip._tcp 300 IN SRV 10 5 5060 sip.example.com.
@ 300 IN CAA 0 issue "letsencrypt.org"
"""


def test_import_happy_path(auth_client, zone):
    body = do_import(auth_client, zone["id"], HAPPY_ZONE_FILE)
    assert body["created"] == 6
    assert body["skipped"] == []
    assert body["change"]["status"] == "PENDING"

    by_key = {
        (item["name"], item["type"]): item
        for item in records_of(auth_client, zone["id"])["items"]
    }
    mx = by_key[("example.com.", "MX")]
    assert sorted(mx["values"]) == ["10 mail1.example.com.", "20 mail2.example.com."]
    assert mx["ttl"] == 3600  # from $TTL
    www = by_key[("www.example.com.", "A")]
    assert sorted(www["values"]) == ["192.0.2.1", "192.0.2.2"]
    assert www["ttl"] == 300
    assert by_key[("ftp.example.com.", "CNAME")]["values"] == ["www.example.com."]
    assert by_key[("example.com.", "TXT")]["values"] == [
        '"v=spf1" " include:x.example.com ~all"'
    ]
    assert by_key[("_sip._tcp.example.com.", "SRV")]["values"] == [
        "10 5 5060 sip.example.com."
    ]
    assert by_key[("example.com.", "CAA")]["values"] == ['0 issue "letsencrypt.org"']


def test_import_skips_soa_and_apex_ns(auth_client, zone):
    zone_file = """\
$ORIGIN example.com.
$TTL 300
@ IN SOA ns-1.awsdns-01.com. hostmaster.example.com. 1 7200 900 1209600 86400
@ IN NS ns-1.awsdns-01.com.
sub IN NS ns-other.example.org.
app IN A 192.0.2.9
"""
    body = do_import(auth_client, zone["id"], zone_file)
    assert body["created"] == 2  # sub NS + app A
    skipped = {(item["name"], item["type"]) for item in body["skipped"]}
    assert skipped == {("example.com.", "SOA"), ("example.com.", "NS")}
    assert all(
        item["reason"] == "Route 53 ignores the SOA and root NS records"
        for item in body["skipped"]
    )


def test_import_skips_unsupported_type(auth_client, zone):
    zone_file = """\
$ORIGIN example.com.
$TTL 300
box IN HINFO "intel" "linux"
app IN A 192.0.2.9
"""
    body = do_import(auth_client, zone["id"], zone_file)
    assert body["created"] == 1
    assert body["skipped"] == [
        {
            "name": "box.example.com.",
            "type": "HINFO",
            "reason": "Unsupported record type",
        }
    ]


def test_import_syntax_error_reports_line(auth_client, zone):
    zone_file = "$ORIGIN example.com.\n$TTL 300\nwww 300 IN A not-an-ip\n"
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records/import",
        json={"zone_file": zone_file},
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "InvalidZoneFile"
    assert error["details"][0]["line"] > 0
    assert error["details"][0]["message"]
    # the "<string>:N: " prefix is stripped — the line lives in the line field
    assert "<string>" not in error["message"]
    assert "<string>" not in error["details"][0]["message"]


def test_import_cname_conflict_is_atomic(auth_client, zone, make_records):
    make_records(
        zone["id"], {"name": "cn", "type": "CNAME", "values": ["target.example.com."]}
    )
    before = records_of(auth_client, zone["id"])["total"]

    zone_file = """\
$ORIGIN example.com.
$TTL 300
cn IN A 192.0.2.5
ok IN A 192.0.2.6
"""
    resp = auth_client.post(
        f"{API}/hostedzones/{zone['id']}/records/import",
        json={"zone_file": zone_file},
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "InvalidChangeBatch"
    conflict = next(d for d in error["details"] if d["name"] == "cn.example.com.")
    assert conflict["type"] == "A"
    assert conflict["message"]
    # all-or-nothing: the valid "ok" record was not written either
    assert records_of(auth_client, zone["id"])["total"] == before


def test_round_trip_bind_export_import(auth_client, zone, make_zone, make_records):
    make_records(
        zone["id"],
        {
            "records": [
                {"name": "", "type": "A", "ttl": 300, "values": ["192.0.2.1", "192.0.2.2"]},
                {"name": "ipv6", "type": "AAAA", "ttl": 300, "values": ["2001:db8::1"]},
                {"name": "www", "type": "CNAME", "ttl": 60, "values": ["example.com."]},
                {
                    "name": "",
                    "type": "MX",
                    "ttl": 3600,
                    "values": ["10 m1.example.com.", "20 m2.example.com."],
                },
                {"name": "", "type": "TXT", "ttl": 300, "values": ["hello world"]},
                {
                    "name": "_sip._tcp",
                    "type": "SRV",
                    "ttl": 300,
                    "values": ["10 5 5060 sip.example.com."],
                },
                {"name": "", "type": "CAA", "ttl": 300, "values": ['0 issue "pki.example"']},
                {
                    "name": "api",
                    "type": "A",
                    "ttl": 60,
                    "values": ["192.0.2.20"],
                    "routing_policy": "WEIGHTED",
                    "set_identifier": "a",
                    "weight": 1,
                },
            ]
        },
    )

    resp = auth_client.get(f"{API}/hostedzones/{zone['id']}/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")
    assert (
        resp.headers["content-disposition"]
        == 'attachment; filename="example.com.zone"'
    )
    bind_text = resp.text
    assert "$ORIGIN example.com." in bind_text
    assert "; WEIGHTED api.example.com. A set_identifier=a" in bind_text

    # duplicate zone names are allowed — import the export into a fresh one
    copy = make_zone("example.com")["hosted_zone"]
    do_import(auth_client, copy["id"], bind_text)

    def simple_sets(zone_id, zone_name):
        items = records_of(auth_client, zone_id)["items"]
        return {
            (item["name"], item["type"], item["ttl"], tuple(sorted(item["values"])))
            for item in items
            if not item["is_alias"]
            and item["routing_policy"] == "SIMPLE"
            and not (
                item["name"] == zone_name and item["type"] in ("NS", "SOA")
            )
        }

    assert simple_sets(zone["id"], zone["name"]) == simple_sets(
        copy["id"], copy["name"]
    )


def test_export_json_shape(auth_client, zone, make_records):
    make_records(
        zone["id"],
        {
            "records": [
                {
                    "name": "api",
                    "type": "A",
                    "ttl": 60,
                    "values": ["192.0.2.20"],
                    "routing_policy": "WEIGHTED",
                    "set_identifier": "primary",
                    "weight": 70,
                },
                {
                    "name": "cdn",
                    "type": "A",
                    "is_alias": True,
                    "alias_dns_name": "d1.cloudfront.net.",
                    "alias_hosted_zone_id": "Z2FDTNDATAQYW2",
                },
            ]
        },
    )
    resp = auth_client.get(
        f"{API}/hostedzones/{zone['id']}/export", params={"format": "json"}
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert (
        resp.headers["content-disposition"]
        == 'attachment; filename="example.com.json"'
    )
    body = resp.json()
    assert body["HostedZone"]["Id"] == f"/hostedzone/{zone['id']}"
    assert body["HostedZone"]["Name"] == "example.com."
    assert body["HostedZone"]["Config"]["PrivateZone"] is False

    sets = {(s["Name"], s["Type"]): s for s in body["ResourceRecordSets"]}
    alias = sets[("cdn.example.com.", "A")]
    assert alias["AliasTarget"] == {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "d1.cloudfront.net.",
        "EvaluateTargetHealth": False,
    }
    assert "TTL" not in alias and "ResourceRecords" not in alias
    weighted = sets[("api.example.com.", "A")]
    assert weighted["SetIdentifier"] == "primary"
    assert weighted["Weight"] == 70
    apex_ns = sets[("example.com.", "NS")]
    assert apex_ns["TTL"] == 172800
    assert len(apex_ns["ResourceRecords"]) == 4
    assert "SetIdentifier" not in apex_ns and "AliasTarget" not in apex_ns


def test_import_export_cross_user_404(auth_client, other_client, zone):
    resp = other_client.post(
        f"{API}/hostedzones/{zone['id']}/records/import",
        json={"zone_file": "$ORIGIN example.com.\n$TTL 300\nx IN A 192.0.2.1\n"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NoSuchHostedZone"

    resp = other_client.get(f"{API}/hostedzones/{zone['id']}/export")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NoSuchHostedZone"
