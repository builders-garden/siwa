"""
Type definitions for SIWA Python SDK.
"""

from abc import ABC, abstractmethod
from typing import Literal

SignerType = Literal["eoa", "sca"]


class Signer(ABC):
    """
    Abstract base class for SIWA signers.

    Implementations:
        - LocalAccountSigner: Uses a local private key
        - KeyringProxySigner: Uses a remote keyring proxy server
    """

    @abstractmethod
    async def get_address(self) -> str:
        """Get the address of the signer."""
        ...

    @abstractmethod
    async def sign_message(self, message: str) -> str:
        """Sign a message and return the signature as hex string."""
        ...
