import pytest

from app.core.errors import ApiError
from app.services import dns_validation as dv

ZONE = "example.com."


def err(fn, *args, **kwargs):
    with pytest.raises(ApiError) as excinfo:
        fn(*args, **kwargs)
    return excinfo.value


def _record(**kwargs):
    base = {"name": "www", "type": "A", "values": ["192.0.2.1"]}
    base.update(kwargs)
    return base


def test_name_normalization():
    assert dv.normalize_record_name("www", ZONE) == "www.example.com."
    assert dv.normalize_record_name("WWW.Example.COM", ZONE) == "www.example.com."
    assert dv.normalize_record_name("", ZONE) == ZONE
    assert dv.normalize_record_name("@", ZONE) == ZONE
    assert dv.normalize_record_name("example.com", ZONE) == ZONE


def test_name_invalid():
    assert err(dv.normalize_record_name, "www.other.com.", ZONE).code == "InvalidDomainName"
    assert err(dv.normalize_record_name, "ww!w", ZONE).code == "InvalidDomainName"
    assert err(dv.normalize_record_name, "a" * 64, ZONE).code == "InvalidDomainName"
    assert err(dv.normalize_record_name, "a.*.img", ZONE).code == "InvalidDomainName"


def test_wildcard_and_underscore():
    assert dv.normalize_record_name("*.img", ZONE) == "*.img.example.com."
    assert dv.normalize_record_name("_dmarc", ZONE) == "_dmarc.example.com."
    assert err(dv.normalize_record_name, "w*w", ZONE).code == "InvalidDomainName"


def test_ttl():
    assert dv.validate_ttl(None) == 300
    assert dv.validate_ttl(0) == 0
    assert dv.validate_ttl(dv.MAX_TTL) == dv.MAX_TTL
    assert err(dv.validate_ttl, -1).code == "InvalidInput"
    assert err(dv.validate_ttl, dv.MAX_TTL + 1).code == "InvalidInput"


def test_a_values():
    assert dv.validate_record_values("A", ["192.0.2.1"]) == ["192.0.2.1"]
    assert err(dv.validate_record_values, "A", ["999.0.0.1"]).code == "InvalidInput"
    assert err(dv.validate_record_values, "A", ["2001:db8::1"]).code == "InvalidInput"


def test_aaaa_values():
    assert dv.validate_record_values("AAAA", ["2001:db8::1"]) == ["2001:db8::1"]
    assert err(dv.validate_record_values, "AAAA", ["192.0.2.1"]).code == "InvalidInput"


def test_cname_values():
    assert dv.validate_record_values("CNAME", ["t.example.com."]) == ["t.example.com."]
    assert err(dv.validate_record_values, "CNAME", ["a.com.", "b.com."]).code == "InvalidInput"
    assert err(dv.validate_record_values, "CNAME", ["bad..host"]).code == "InvalidInput"


def test_txt_auto_quoting():
    assert dv.validate_record_values("TXT", ["hello world"]) == ['"hello world"']
    assert dv.validate_record_values("TXT", ['"v=spf1 -all"']) == ['"v=spf1 -all"']
    assert dv.validate_record_values("TXT", ['say "hi"']) == ['"say \\"hi\\""']
    assert err(dv.validate_record_values, "TXT", ["x" * 256]).code == "InvalidInput"
    assert err(dv.validate_record_values, "TXT", ['"unterminated']).code == "InvalidInput"


def test_mx_values():
    assert dv.validate_record_values("MX", ["10 mail.example.com."]) == [
        "10 mail.example.com."
    ]
    assert err(dv.validate_record_values, "MX", ["mail.example.com."]).code == "InvalidInput"
    assert err(dv.validate_record_values, "MX", ["70000 mail.com."]).code == "InvalidInput"


def test_ns_ptr_values():
    assert dv.validate_record_values("NS", ["ns1.example.com."]) == ["ns1.example.com."]
    assert dv.validate_record_values("PTR", ["host.example.com."]) == ["host.example.com."]
    assert err(dv.validate_record_values, "NS", ["bad host"]).code == "InvalidInput"


def test_srv_values():
    assert dv.validate_record_values("SRV", ["10 5 5060 sip.example.com."]) == [
        "10 5 5060 sip.example.com."
    ]
    assert err(dv.validate_record_values, "SRV", ["10 5 sip.com."]).code == "InvalidInput"
    assert err(dv.validate_record_values, "SRV", ["10 5 99999 sip.com."]).code == "InvalidInput"


def test_caa_values():
    assert dv.validate_record_values("CAA", ['0 issue "letsencrypt.org"']) == [
        '0 issue "letsencrypt.org"'
    ]
    assert dv.validate_record_values("CAA", ["0 issue letsencrypt.org"]) == [
        '0 issue "letsencrypt.org"'
    ]
    assert err(dv.validate_record_values, "CAA", ['0 badtag "x"']).code == "InvalidInput"
    assert err(dv.validate_record_values, "CAA", ['300 issue "x"']).code == "InvalidInput"


def test_soa_values():
    value = "ns-1.awsdns-01.com. hostmaster.example.com. 1 7200 900 1209600 86400"
    assert dv.validate_record_values("SOA", [value]) == [value]
    assert err(dv.validate_record_values, "SOA", ["ns. host. 1 2 3 4"]).code == "InvalidInput"


def test_apex_cname_rejected():
    e = err(dv.validate_record_set, ZONE, _record(name="", type="CNAME", values=["x.com."]))
    assert e.code == "InvalidChangeBatch"


def test_alias_rules():
    out = dv.validate_record_set(
        ZONE,
        _record(
            values=None,
            is_alias=True,
            alias_dns_name="d1.cloudfront.net",
            alias_hosted_zone_id="Z2FDTNDATAQYW2",
        ),
    )
    assert out["ttl"] is None and out["values"] == []
    assert out["alias_dns_name"] == "d1.cloudfront.net."
    # ttl, values, missing target, unsupported type all rejected
    bad = [
        _record(values=None, ttl=300, is_alias=True,
                alias_dns_name="d1.cloudfront.net", alias_hosted_zone_id="Z2"),
        _record(is_alias=True, alias_dns_name="d1.cloudfront.net",
                alias_hosted_zone_id="Z2"),
        _record(values=None, is_alias=True),
        _record(type="TXT", values=None, is_alias=True,
                alias_dns_name="d1.cloudfront.net", alias_hosted_zone_id="Z2"),
    ]
    for payload in bad:
        assert err(dv.validate_record_set, ZONE, payload).code == "InvalidInput"


def test_routing_policies():
    assert err(dv.validate_record_set, ZONE, _record(set_identifier="x")).code == "InvalidInput"
    assert (
        err(dv.validate_record_set, ZONE, _record(routing_policy="WEIGHTED")).code
        == "InvalidInput"
    )
    out = dv.validate_record_set(
        ZONE, _record(routing_policy="WEIGHTED", set_identifier="a", weight=70)
    )
    assert out["weight"] == 70
    assert (
        err(
            dv.validate_record_set,
            ZONE,
            _record(routing_policy="LATENCY", set_identifier="a"),
        ).code
        == "InvalidInput"
    )
    assert (
        err(
            dv.validate_record_set,
            ZONE,
            _record(routing_policy="FAILOVER", set_identifier="a", failover="BAD"),
        ).code
        == "InvalidInput"
    )
    assert (
        err(
            dv.validate_record_set,
            ZONE,
            _record(routing_policy="GEOLOCATION", set_identifier="a"),
        ).code
        == "InvalidInput"
    )
    out = dv.validate_record_set(
        ZONE, _record(routing_policy="MULTIVALUE", set_identifier="a")
    )
    assert out["multivalue_answer"] is True
    assert (
        err(
            dv.validate_record_set,
            ZONE,
            _record(
                type="CNAME",
                values=["x.com."],
                routing_policy="MULTIVALUE",
                set_identifier="a",
            ),
        ).code
        == "InvalidInput"
    )
