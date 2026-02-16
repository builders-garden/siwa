"""
Local account signer implementation using eth-account.
"""

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_account.signers.local import LocalAccount

from siwa_py.types import Signer


class LocalAccountSigner(Signer):
    """
    Signer that uses a local private key via eth-account.

    Example:
        >>> from eth_account import Account
        >>> from siwa_py.signers import LocalAccountSigner
        >>>
        >>> account = Account.from_key("0x...")
        >>> signer = LocalAccountSigner(account)
        >>> address = await signer.get_address()
        >>> signature = await signer.sign_message("Hello")
    """

    def __init__(self, account: LocalAccount):
        """
        Create a new LocalAccountSigner.

        Args:
            account: An eth-account LocalAccount instance
        """
        self._account = account

    @classmethod
    def from_private_key(cls, private_key: str) -> "LocalAccountSigner":
        """
        Create a signer from a private key hex string.

        Args:
            private_key: Private key as hex string (with or without 0x prefix)

        Returns:
            A new LocalAccountSigner instance
        """
        account = Account.from_key(private_key)
        return cls(account)

    async def get_address(self) -> str:
        """Get the checksummed address of this signer."""
        return self._account.address

    async def sign_message(self, message: str) -> str:
        """
        Sign a message using EIP-191 personal_sign.

        Args:
            message: The message to sign

        Returns:
            The signature as a hex string with 0x prefix
        """
        message_hash = encode_defunct(text=message)
        signed = self._account.sign_message(message_hash)
        return "0x" + signed.signature.hex()
