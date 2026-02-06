# SIWA — Sign In With Agent

**The easiest way for AI agents to prove who they are.**

Think of SIWA like "Sign in with Google" — but for AI agents instead of humans. It lets agents create an identity, prove they own it, and sign in to apps and services securely.

---

## 🚀 Getting Started (The Simple Version)

### What is SIWA?

SIWA helps AI agents:
1. **Create an identity** — A unique ID on the blockchain (like a digital passport)
2. **Prove who they are** — Show cryptographically that they control that identity
3. **Sign in to apps** — Use that identity to access services, just like "Sign in with Google"

### Why Use SIWA?

- ✅ **Simple for developers** — Add agent authentication with a few lines of code
- ✅ **Secure by design** — Private keys stay safe, even if the agent is compromised
- ✅ **Standard across apps** — One identity works everywhere that supports SIWA
- ✅ **Built for AI agents** — Designed specifically for how agents work, not humans

### The Basics in 30 Seconds

```javascript
// An agent creates their identity once
const agent = await SiwaAgent.create({
  name: "MyAwesomeAgent"
});

// Later, they can sign in to any app
const session = await agent.signIn("cool-app.com");
```

That's it! The agent now has a verified identity they can use anywhere.

### Try It Yourself (5 Minutes)

Want to see SIWA in action? Here's the fastest way:

```bash
# 1. Clone this repo
git clone https://github.com/builders-garden/siwa.git
cd siwa

# 2. Install dependencies
pnpm install

# 3. Run the demo
cd packages/siwa-testing
pnpm run dev
```

You'll see a complete agent registration and sign-in flow running locally.

---

## 📚 What Do You Want to Do?

| I want to... | Go here |
|--------------|---------|
| **Add SIWA to my app** (I'm a developer) | [Integration Guide →](packages/siwa-skill/references/registration-guide.md) |
| **Understand how it works** (I'm technical) | [Technical Spec →](packages/siwa-skill/references/siwa-spec.md) |
| **See the security details** (I'm security-minded) | [Security Model →](packages/siwa-skill/references/security-model.md) |
| **Build an agent with SIWA** (I'm an agent builder) | [Skill Documentation →](packages/siwa-skill/SKILL.md) |
| **Run my own infrastructure** (I'm DevOps) | [Docker Setup →](#docker-testing) |

---

## 🏗️ Architecture Overview (The Nerd Version)

For those who want the technical details:

### The Parts

| Component | What It Does |
|-----------|--------------|
| **SIWA Library** (`packages/siwa/`) | Core code for creating identities, signing messages, verifying proofs |
| **SIWA Skill** (`packages/siwa-skill/`) | Documentation and assets for building SIWA-enabled agents |
| **Keyring Proxy** (`packages/keyring-proxy/`) | A security service that holds private keys outside the agent process |
| **Testing Tools** (`packages/siwa-testing/`) | Demo apps and test suites |

### How It Works

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Agent     │──────▶│ Keyring      │──────▶│ Blockchain  │
│   (Your AI) │◀──────│ Proxy        │◀──────│ (Identity)  │
└─────────────┘      └──────────────┘      └─────────────┘
      │                       │
      │   "Please sign this"  │
      │   ─────────────────▶  │
      │                       │
      │   "Here's the proof"  │
      │   ◀─────────────────  │
      │                       │
   Never sees              Holds the
   private key             private key
```

The **keyring proxy** is the secret sauce. Even if someone hacks the agent completely, they can't steal the private key — they can only ask the proxy to sign things. And the proxy won't sign anything without proper authentication.

### Technical Details

- **Standard**: Built on [ERC-8004](https://github.com/builders-garden/ERC-8004)
- **Protocol**: Challenge-response authentication (like SIWE/EIP-4361)
- **Security**: HMAC-SHA256 authenticated requests between agent and keyring
- **Storage**: Encrypted file-based or proxy-based keystore options

---

## 🐳 Docker Testing (Advanced)

For production deployments and security testing, we provide Docker configurations:

### Quick Docker Start

```bash
# Copy and fill in the environment variables
cp .env.proxy.example .env
# Edit .env with your secrets

# Run the keyring proxy + OpenClaw gateway
docker compose -f docker-compose.proxy.yml up -d
```

### Full Integration Test

```bash
# Build and run everything
docker compose -f docker-compose.test.yml up -d --build

# Run tests against the Docker environment
cd packages/siwa-testing
pnpm run reset
KEYSTORE_BACKEND=proxy \
  KEYRING_PROXY_URL=http://localhost:3100 \
  KEYRING_PROXY_SECRET=your-secret \
  SERVER_URL=http://localhost:3000 \
  pnpm run agent:flow
```

See [`packages/siwa-testing/README.md`](packages/siwa-testing/README.md) for detailed testing documentation.

---

## 📦 Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`packages/siwa`](packages/siwa/) | Core library | `npm install @buildersgarden/siwa` |
| [`packages/siwa-skill`](packages/siwa-skill/) | Agent skill definition | Copy to your agent's skills folder |
| [`packages/siwa-testing`](packages/siwa-testing/) | Test harness | Clone and run locally |
| [`packages/keyring-proxy`](packages/keyring-proxy/) | Secure signing proxy | Deploy to Railway/Docker |

---

## 🔐 Security Model

Private keys are held in a separate **keyring proxy server** and never enter the agent process. The agent delegates all signing over HMAC-SHA256 authenticated HTTP. Even under full agent compromise, an attacker can only request signatures — the key itself cannot be extracted.

See [`packages/siwa-skill/references/security-model.md`](packages/siwa-skill/references/security-model.md) for the full threat model.

---

## 💡 Common Questions

**Q: Do I need to run a blockchain node?**  
A: No! SIWA works with any EVM-compatible blockchain. You can use public RPCs or services like Alchemy/Infura.

**Q: Can I use SIWA with my existing agent framework?**  
A: Yes! SIWA is framework-agnostic. It works with OpenClaw, LangChain, AutoGPT, or custom agents.

**Q: Is it free?**  
A: Yes! The protocol is open source (MIT license). You only pay blockchain gas fees for registration transactions.

**Q: What if my agent gets hacked?**  
A: If you're using the keyring proxy, the attacker can't steal the private key. They can only request signatures, and you can revoke the proxy's access.

---

## 📖 Documentation Index

- **[Getting Started Guide](packages/siwa-skill/references/registration-guide.md)** — Step-by-step for developers
- **[Technical Specification](packages/siwa-skill/references/siwa-spec.md)** — Complete protocol details
- **[Security Model](packages/siwa-skill/references/security-model.md)** — Threat model and security analysis
- **[Contract Addresses](packages/siwa-skill/references/contract-addresses.md)** — Deployed contract addresses
- **[Skill Documentation](packages/siwa-skill/SKILL.md)** — For building SIWA-enabled agents

---

## 🤝 Contributing

We welcome contributions! Whether you're fixing a typo, improving docs, or adding features:

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing-thing`)
3. Make your changes
4. Submit a PR

For major changes, please open an issue first to discuss what you'd like to change.

---

## 📜 License

MIT — Builders Garden SRL 2026

---

<p align="center">
  <sub>Built with 🦞 by <a href="https://builders.garden">Builders Garden</a></sub>
</p>
