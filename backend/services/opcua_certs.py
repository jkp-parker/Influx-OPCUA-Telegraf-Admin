"""
Auto-generate a self-signed X.509 client certificate and RSA private key
for OPC UA connections that require Basic256Sha256 / SignAndEncrypt.

Certificates are stored in the persistent data directory and reused across
container restarts.
"""

import os
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data"))
CERT_PATH = DATA_DIR / "opcua_client_cert.der"
KEY_PATH = DATA_DIR / "opcua_client_key.pem"


def get_cert_path() -> str:
    return str(CERT_PATH)


def get_key_path() -> str:
    return str(KEY_PATH)


def ensure_certs_exist() -> None:
    """Generate client cert + key if they don't already exist."""
    if CERT_PATH.exists() and KEY_PATH.exists():
        logger.info("OPC UA client certificate already exists at %s", CERT_PATH)
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Generating OPC UA client certificate...")

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "FluxForge OPC UA Client"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "FluxForge"),
    ])

    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.UniformResourceIdentifier("urn:fluxforge:opcua:client"),
            ]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=True,
                key_encipherment=True,
                data_encipherment=True,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.CLIENT_AUTH]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    CERT_PATH.write_bytes(cert.public_bytes(serialization.Encoding.DER))
    KEY_PATH.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    logger.info("OPC UA client certificate written to %s", CERT_PATH)
